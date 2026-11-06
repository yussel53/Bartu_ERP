using System.Data;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

/// <summary>
/// Küçük mükellef tablosu (yalnız carilerin VKN'leri) için kontrol durumu ve e-Logo anlık sorgusu.
/// EFaturaMukellefCheck: VKN'nin son kontrol zamanı — taze ise «tabloda yok» = mükellef değil.
/// Taze değilse VKN e-Logo CheckGibUser ile (toplu) sorgulanır, sonuç tabloya yazılır.
/// </summary>
public sealed class EFaturaMukellefLookupService
{
    private readonly IDbConnection _db;
    private readonly IntegratorMukellefService _integrator;
    private readonly ELogoDocumentSyncService _elogo;
    private readonly GibEFaturaUserListService _gib;
    private readonly ILogger<EFaturaMukellefLookupService> _log;

    public EFaturaMukellefLookupService(IDbConnection db, IntegratorMukellefService integrator, ELogoDocumentSyncService elogo,
        GibEFaturaUserListService gib, ILogger<EFaturaMukellefLookupService> log)
    {
        _db = db;
        _integrator = integrator;
        _elogo = elogo;
        _gib = gib;
        _log = log;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public static string Normalize(string? taxNr) => new((taxNr ?? "").Where(char.IsDigit).ToArray());

    /// <summary>Son <see cref="GibEFaturaUserListOptions.SyncFreshHours"/> saatte kontrol edilmiş VKN'ler</summary>
    public async Task<HashSet<string>> FreshAsync(IEnumerable<string> taxes, CancellationToken ct)
    {
        Open();
        var set = new HashSet<string>();
        var since = DateTime.Now.AddHours(-Math.Max(1, _gib.Options.SyncFreshHours));
        foreach (var chunk in taxes.Select(Normalize).Where(t => t.Length is 10 or 11).Distinct().Chunk(1000))
        {
            var found = await _db.QueryAsync<string>(new CommandDefinition(
                "SELECT TaxNr FROM dbo.EFaturaMukellefCheck WHERE CheckedAt >= @since AND TaxNr IN @chunk",
                new { since, chunk }, cancellationToken: ct));
            set.UnionWith(found);
        }
        return set;
    }

    /// <summary>
    /// Taze olmayan VKN'leri e-Logo'dan sorgular ve tabloya yazar. Dönen: sorgulanan VKN sayısı ve varsa hata.
    /// </summary>
    public async Task<(int Checked, string? Error)> RefreshOnlineAsync(IEnumerable<string> taxes, int max, CancellationToken ct)
    {
        var all = taxes.Select(Normalize).Where(t => t.Length is 10 or 11).Distinct().ToList();
        var fresh = await FreshAsync(all, ct);
        var todo = all.Where(t => !fresh.Contains(t)).Take(Math.Max(0, max)).ToList();
        if (todo.Count == 0) return (0, null);

        var cred = await _elogo.FindELogoCompanyAsync(ct);
        if (cred == null) return (0, "e-Logo kullanıcısı tanımlı firma yok; VKN'ler anlık sorgulanamadı.");
        try
        {
            var res = await _integrator.CheckManyElogoAsync(cred.IntegratorWsUrl, cred.IntegratorUser!, cred.IntegratorPassword!, todo, ct);
            Open();
            using var tx = _db.BeginTransaction();
            foreach (var (tax, rows) in res)
                await SaveAsync(_db, tx, tax, rows, "ELogo", ct);
            tx.Commit();
            return (res.Count, null);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _log.LogWarning(ex, "e-Logo mükellef toplu sorgusu başarısız");
            return (0, "e-Logo mükellef sorgusu başarısız: " + ex.Message);
        }
    }

    /// <summary>Tek VKN için e-Logo sonucunu (check-integrator ucu) tabloya ve kontrol kaydına yazar</summary>
    public async Task SaveOnlineResultAsync(string taxNr, IReadOnlyCollection<EFaturaMukellefRow> rows, CancellationToken ct)
    {
        var tax = Normalize(taxNr);
        if (tax.Length is not (10 or 11)) return;
        Open();
        using var tx = _db.BeginTransaction();
        await SaveAsync(_db, tx, tax, rows, "ELogo", ct);
        tx.Commit();
    }

    /// <summary>
    /// VKN'nin etiketlerini yazar: gelen etiketler etkin, gelmeyenler pasif; kontrol zamanı işlenir.
    /// Gece senkronu ve e-Logo sorgusu ortak kullanır.
    /// </summary>
    internal static async Task SaveAsync(IDbConnection db, IDbTransaction tx, string tax, IReadOnlyCollection<EFaturaMukellefRow> rows,
        string source, CancellationToken ct)
    {
        var aliases = rows
            .Where(r => !string.IsNullOrWhiteSpace(r.Alias) && r.Alias.Trim().Length <= 200)
            .GroupBy(r => r.Alias.Trim(), StringComparer.OrdinalIgnoreCase)
            // Aynı etiket fatura ve irsaliyede varsa fatura satırı tutulur
            .Select(g => g.OrderBy(r => r.UnitType == "e-Fatura" ? 0 : 1).First())
            .ToList();

        foreach (var r in aliases)
        {
            await db.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.EFaturaMukellef SET Title = @title, AliasType = @AliasType, UnitType = @UnitType,
                       FirstCreateDate = COALESCE(@FirstCreateDate, FirstCreateDate), IsActive = 1
                WHERE TaxNr = @tax AND Alias = @alias;
                IF @@ROWCOUNT = 0
                  INSERT dbo.EFaturaMukellef (TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive)
                  VALUES (@tax, @title, @alias, @AliasType, @UnitType, COALESCE(@FirstCreateDate, GETDATE()), 1);
                """, new
            {
                tax, alias = r.Alias.Trim(), title = r.Title is { Length: > 250 } t ? t[..250] : r.Title,
                r.AliasType, r.UnitType, r.FirstCreateDate,
            }, tx, cancellationToken: ct));
        }

        var keep = aliases.Select(a => a.Alias.Trim()).ToArray();
        await db.ExecuteAsync(new CommandDefinition(keep.Length == 0
                ? "UPDATE dbo.EFaturaMukellef SET IsActive = 0 WHERE TaxNr = @tax AND IsActive = 1"
                : "UPDATE dbo.EFaturaMukellef SET IsActive = 0 WHERE TaxNr = @tax AND IsActive = 1 AND Alias NOT IN @keep",
            new { tax, keep }, tx, cancellationToken: ct));

        await db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.EFaturaMukellefCheck SET CheckedAt = GETDATE(), IsMukellef = @m, Source = @source WHERE TaxNr = @tax;
            IF @@ROWCOUNT = 0 INSERT dbo.EFaturaMukellefCheck (TaxNr, CheckedAt, IsMukellef, Source) VALUES (@tax, GETDATE(), @m, @source);
            """, new { tax, m = aliases.Any(a => a.AliasType == "PK"), source }, tx, cancellationToken: ct));
    }
}
