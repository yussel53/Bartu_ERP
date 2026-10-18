using System.Data;
using BartuERP.Backend.Services;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class MukellefCheckRow
{
    public int CustomerCardID { get; set; }
    public int? CustomerAdressID { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public string? AddressTitle { get; set; }
    public string? TaxNr { get; set; }
    /// <summary>GİB listesinde aktif e-Fatura PK etiketi var</summary>
    public bool IsMukellef { get; set; }
    public string? GibTitle { get; set; }
    /// <summary>CustomerCard.EinvoiceType: 0 Yok · 1 e-Fatura · 2 e-Arşiv</summary>
    public int? EinvoiceType { get; set; }
    public int? SuggestedEinvoiceType { get; set; }
    public DateTime? EinvoiceEntryDate { get; set; }
    public DateTime? SuggestedEntryDate { get; set; }
    public string? PostLabel { get; set; }
    public string? SuggestedPostLabel { get; set; }
    public string? SenderLabel { get; set; }
    public string? SuggestedSenderLabel { get; set; }
    public DateTime? LastCheckAt { get; set; }
    /// <summary>Uygulanacak değişiklik var (tür / tarih / PK / GB)</summary>
    public bool HasChanges { get; set; }
}

public sealed class MukellefCheckResult
{
    public int LocalListCount { get; set; }
    public DateTime? LastSyncAt { get; set; }
    /// <summary>Yerel liste tam ve güncel — «mükellef değil» sonucu güvenilir (yoksa yalnız olumlu güncelleme önerilir)</summary>
    public bool Authoritative { get; set; }
    public int TotalCustomers { get; set; }
    public int MukellefCount { get; set; }
    public int ChangeCount { get; set; }
    public List<MukellefCheckRow> Rows { get; set; } = new();
}

public sealed class MukellefApplyItem
{
    public int CustomerCardID { get; set; }
    public int? CustomerAdressID { get; set; }
}

/// <summary>
/// Cari toplu mükellef kontrolü (yol haritası E-06): carilerin VKN/TCKN'si yerel GİB listesiyle (EFaturaMukellef)
/// karşılaştırılır; CustomerCard.EinvoiceType / EinvoiceEntryDate ve adresteki PostLabel (PK) / SenderLabel (GB)
/// için öneri üretilir, seçilenler uygulanır. Öneri sunucuda yeniden hesaplanır — istemcinin gönderdiği değer kullanılmaz.
/// </summary>
public sealed class EGovMukellefCheckRepository
{
    private readonly IDbConnection _db;
    private readonly GibEFaturaUserListService _gib;

    public EGovMukellefCheckRepository(IDbConnection db, GibEFaturaUserListService gib)
    {
        _db = db;
        _gib = gib;
    }

    private sealed class CardAddr
    {
        public int CustomerCardID { get; set; }
        public int? CustomerAdressID { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
        public string? AddressTitle { get; set; }
        public string? CardTax { get; set; }
        public string? AddrTax { get; set; }
        public int? EinvoiceType { get; set; }
        public DateTime? EinvoiceEntryDate { get; set; }
        public string? PostLabel { get; set; }
        public string? SenderLabel { get; set; }
        public DateTime? MukellefCheckAt { get; set; }
    }

    public async Task<(MukellefCheckResult? Result, string? Error)> CheckAsync(bool onlyChanges, CancellationToken ct = default)
    {
        Open();
        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL OR OBJECT_ID(N'dbo.CustomerCard', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 0)
            return (null, "EFaturaMukellef tablosu yok — Veritabanı Güncelleme ile 25_efatura_mukellef.sql uygulayın.");

        var r = new MukellefCheckResult
        {
            LocalListCount = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1", cancellationToken: ct)),
        };
        (r.LastSyncAt, _, _) = await _gib.GetLastSyncAsync(_db, ct);
        r.Authoritative = _gib.IsLocalListAuthoritative(r.LocalListCount, r.LastSyncAt);

        var rows = await BuildAsync(null, r.Authoritative, ct);
        r.TotalCustomers = rows.Select(x => x.CustomerCardID).Distinct().Count();
        r.MukellefCount = rows.Where(x => x.IsMukellef).Select(x => x.CustomerCardID).Distinct().Count();
        r.ChangeCount = rows.Count(x => x.HasChanges);
        r.Rows = onlyChanges ? rows.Where(x => x.HasChanges).ToList() : rows;
        return (r, null);
    }

    public async Task<(int Cards, int Addresses)> ApplyAsync(IReadOnlyCollection<MukellefApplyItem> items, CancellationToken ct = default)
    {
        Open();
        var count = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1", cancellationToken: ct));
        var (lastSync, _, _) = await _gib.GetLastSyncAsync(_db, ct);
        var authoritative = _gib.IsLocalListAuthoritative(count, lastSync);

        var cardIds = items.Select(i => i.CustomerCardID).Distinct().ToArray();
        var rows = (await BuildAsync(cardIds, authoritative, ct))
            .Where(x => items.Any(i => i.CustomerCardID == x.CustomerCardID && i.CustomerAdressID == x.CustomerAdressID))
            .ToList();

        int cards = 0, addresses = 0;
        using var tx = _db.BeginTransaction();
        // Kart düzeyi (tür / başlangıç tarihi) — bir kartın birden çok adres satırı olabilir, bir kez yazılır
        foreach (var c in rows.GroupBy(x => x.CustomerCardID).Select(g => g.First()))
        {
            if (c.SuggestedEinvoiceType == c.EinvoiceType && c.SuggestedEntryDate == c.EinvoiceEntryDate) continue;
            cards += await _db.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.CustomerCard SET EinvoiceType = @t, EinvoiceEntryDate = @d WHERE CustomerCardID = @id",
                new { t = c.SuggestedEinvoiceType, d = c.SuggestedEntryDate, id = c.CustomerCardID }, tx, cancellationToken: ct));
        }
        foreach (var a in rows.Where(x => x.CustomerAdressID is > 0))
        {
            var status = a.IsMukellef
                ? $"GİB: e-Fatura mükellefi · PK {a.SuggestedPostLabel}"
                : authoritative ? "GİB: e-Fatura mükellefi değil" : "GİB yerel listesinde yok (liste güncel değil)";
            addresses += await _db.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.CustomerAdress
                SET PostLabel = @pk, SenderLabel = @gb, MukellefCheckStatus = LEFT(@status, 400), MukellefCheckAt = GETDATE()
                WHERE CustomerAdressID = @id
                """, new { pk = a.SuggestedPostLabel, gb = a.SuggestedSenderLabel, status, id = a.CustomerAdressID }, tx, cancellationToken: ct));
        }
        tx.Commit();
        return (cards, addresses);
    }

    /// <summary>Kart + adres satırları ve öneriler. cardIds null → tüm cariler (VKN/TCKN'si olanlar).</summary>
    private async Task<List<MukellefCheckRow>> BuildAsync(int[]? cardIds, bool authoritative, CancellationToken ct)
    {
        var hasAddr = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.CustomerAdress', N'U') IS NULL THEN 0 ELSE 1 END", cancellationToken: ct)) == 1;
        var filter = cardIds is null ? "" : "AND c.CustomerCardID IN @cardIds";
        // Adres: aktif ve VKN'si boş ya da kartla aynı olanlar (şube / farklı VKN'li adresler kendi VKN'siyle)
        var sql = hasAddr
            ? $"""
              SELECT c.CustomerCardID, a.CustomerAdressID, c.Code, CAST(c.Title AS nvarchar(400)) AS Title, a.Title AS AddressTitle,
                     c.TaxNr AS CardTax, a.TaxNr AS AddrTax, c.EinvoiceType, c.EinvoiceEntryDate,
                     a.PostLabel, a.SenderLabel, a.MukellefCheckAt
              FROM dbo.CustomerCard c
              LEFT JOIN dbo.CustomerAdress a ON a.CustomerCardID = c.CustomerCardID AND ISNULL(a.Active, 1) = 1
              WHERE c.CustomerCardID > 0 {filter}
              ORDER BY c.Code, CASE WHEN a.IsDefault = 1 THEN 0 ELSE 1 END, a.CustomerAdressID
              """
            : $"""
              SELECT c.CustomerCardID, CAST(NULL AS int) AS CustomerAdressID, c.Code, CAST(c.Title AS nvarchar(400)) AS Title,
                     CAST(NULL AS nvarchar(200)) AS AddressTitle, c.TaxNr AS CardTax, CAST(NULL AS nvarchar(100)) AS AddrTax,
                     c.EinvoiceType, c.EinvoiceEntryDate, CAST(NULL AS nvarchar(300)) AS PostLabel,
                     CAST(NULL AS nvarchar(300)) AS SenderLabel, CAST(NULL AS datetime) AS MukellefCheckAt
              FROM dbo.CustomerCard c WHERE c.CustomerCardID > 0 {filter} ORDER BY c.Code
              """;
        var list = (await _db.QueryAsync<CardAddr>(new CommandDefinition(sql, new { cardIds }, cancellationToken: ct))).ToList();

        static string? Tax(string? v)
        {
            var d = new string((v ?? "").Where(char.IsDigit).ToArray());
            return d.Length is 10 or 11 ? d : null;
        }
        var taxes = list.Select(x => Tax(x.AddrTax) ?? Tax(x.CardTax)).Where(t => t != null).Distinct().ToList();

        var gib = new Dictionary<string, List<EFaturaMukellefRow>>();
        foreach (var chunk in taxes.Chunk(1000))
        {
            var found = await _db.QueryAsync<EFaturaMukellefRow>(new CommandDefinition(
                """
                SELECT TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive
                FROM dbo.EFaturaMukellef
                WHERE IsActive = 1 AND TaxNr IN @chunk AND (UnitType IS NULL OR UnitType LIKE N'%Fatura%')
                """, new { chunk }, cancellationToken: ct));
            foreach (var g in found.GroupBy(f => f.TaxNr)) gib[g.Key] = g.ToList();
        }

        var rows = new List<MukellefCheckRow>();
        foreach (var x in list)
        {
            var tax = Tax(x.AddrTax) ?? Tax(x.CardTax);
            if (tax is null) continue;
            gib.TryGetValue(tax, out var aliases);
            aliases ??= new();
            var pk = aliases.Where(a => string.Equals(a.AliasType, "PK", StringComparison.OrdinalIgnoreCase)).ToList();
            var gb = aliases.Where(a => string.Equals(a.AliasType, "GB", StringComparison.OrdinalIgnoreCase)).ToList();
            var isMukellef = pk.Count > 0;

            var row = new MukellefCheckRow
            {
                CustomerCardID = x.CustomerCardID,
                CustomerAdressID = x.CustomerAdressID,
                Code = x.Code,
                Title = x.Title,
                AddressTitle = x.AddressTitle,
                TaxNr = tax,
                IsMukellef = isMukellef,
                GibTitle = aliases.Select(a => a.Title).FirstOrDefault(t => !string.IsNullOrWhiteSpace(t)),
                EinvoiceType = x.EinvoiceType,
                EinvoiceEntryDate = x.EinvoiceEntryDate,
                PostLabel = Blank(x.PostLabel),
                SenderLabel = Blank(x.SenderLabel),
                LastCheckAt = x.MukellefCheckAt,
            };

            if (isMukellef)
            {
                row.SuggestedEinvoiceType = 1;
                row.SuggestedEntryDate = aliases.Min(a => a.FirstCreateDate)?.Date ?? x.EinvoiceEntryDate;
                row.SuggestedPostLabel = PickLabel(pk, row.PostLabel);
                row.SuggestedSenderLabel = gb.Count > 0 ? PickLabel(gb, row.SenderLabel) : row.SenderLabel;
            }
            else if (authoritative)
            {
                // Liste tam ve güncel: mükellef değil → e-Arşiv (önceden e-Fatura işaretliyse), etiketler boşalır
                row.SuggestedEinvoiceType = x.EinvoiceType == 1 ? 2 : x.EinvoiceType;
                row.SuggestedEntryDate = x.EinvoiceType == 1 ? null : x.EinvoiceEntryDate;
                row.SuggestedPostLabel = null;
                row.SuggestedSenderLabel = null;
            }
            else
            {
                // Yerel liste eksik: «yok» güvenilir değil — değişiklik önerilmez
                row.SuggestedEinvoiceType = x.EinvoiceType;
                row.SuggestedEntryDate = x.EinvoiceEntryDate;
                row.SuggestedPostLabel = row.PostLabel;
                row.SuggestedSenderLabel = row.SenderLabel;
            }

            row.HasChanges = row.SuggestedEinvoiceType != row.EinvoiceType
                             || row.SuggestedEntryDate?.Date != row.EinvoiceEntryDate?.Date
                             || (x.CustomerAdressID is > 0
                                 && (!string.Equals(row.SuggestedPostLabel, row.PostLabel, StringComparison.OrdinalIgnoreCase)
                                     || !string.Equals(row.SuggestedSenderLabel, row.SenderLabel, StringComparison.OrdinalIgnoreCase)));
            rows.Add(row);
        }
        return rows;
    }

    /// <summary>Mevcut etiket hâlâ listede ise o; değilse «default» içeren, yoksa en yeni kayıtlı etiket</summary>
    private static string PickLabel(List<EFaturaMukellefRow> aliases, string? current)
    {
        if (current != null && aliases.Any(a => string.Equals(a.Alias, current, StringComparison.OrdinalIgnoreCase)))
            return current;
        return (aliases.FirstOrDefault(a => a.Alias.Contains("default", StringComparison.OrdinalIgnoreCase)) ?? aliases[0]).Alias;
    }

    private static string? Blank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
