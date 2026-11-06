using BartuERP.Backend.Repositories;
using Dapper;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;
using System.Data;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/efatura-mukellef")]
public sealed class EFaturaMukellefController : ControllerBase
{
    private readonly EFaturaMukellefRepository _repo;
    private readonly GibEFaturaUserListService _gib;
    private readonly IntegratorMukellefService _integrator;
    private readonly IDbConnection _db;
    private readonly ELogoDocumentSyncService _elogo;
    private readonly EFaturaMukellefLookupService _lookup;

    public EFaturaMukellefController(
        EFaturaMukellefRepository repo,
        GibEFaturaUserListService gib,
        IntegratorMukellefService integrator,
        IDbConnection db,
        ELogoDocumentSyncService elogo,
        EFaturaMukellefLookupService lookup)
    {
        _lookup = lookup;
        _repo = repo;
        _gib = gib;
        _integrator = integrator;
        _db = db;
        _elogo = elogo;
    }

    /// <summary>
    /// VKN/TCKN ile e-Fatura mükellef alias listesi.
    /// Önce yerel tablo (yalnız carilerin VKN'leri); yoksa ve VKN yakın zamanda kontrol edilmediyse e-Logo'dan anlık sorgu.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<EFaturaMukellefQueryResult>> Query(
        [FromQuery] string taxNr,
        [FromQuery] bool checkExternal = true,
        CancellationToken ct = default)
    {
        var result = await _repo.QueryByTaxNrAsync(taxNr ?? "", ct);
        result.Source = "Local";

        var (lastOk, _, _) = await _gib.GetLastSyncAsync(_db, ct);
        result.LastSyncAt = lastOk;

        if (result.Found || !checkExternal || !_gib.Options.AutoExternalLookup)
            return Ok(result);

        // VKN yakın zamanda (gece listesi ya da e-Logo) kontrol edildiyse yerel "yok" güvenilir
        if (result.TaxNr.Length is 10 or 11 && (await _lookup.FreshAsync(new[] { result.TaxNr }, ct)).Count > 0)
        {
            result.Source = "GibAuthoritative";
            result.Message = $"VKN/TCKN {result.TaxNr} GİB listesinde yok — e-Fatura mükellefi değil.";
            return Ok(result);
        }

        // Kontrol edilmemiş / eski → e-Logo anlık sorgu (sonuç tabloya yazılır)
        var (_, error) = await _lookup.RefreshOnlineAsync(new[] { result.TaxNr }, 1, ct);
        if (error != null)
        {
            result.CheckedExternal = true;
            result.ExternalMessage = error;
            result.Message = $"{result.Message} | {error}";
            return Ok(result);
        }

        result = await _repo.QueryByTaxNrAsync(result.TaxNr, ct);
        result.Source = "ELogo";
        result.CheckedExternal = true;
        result.LastSyncAt = lastOk;
        result.ExternalMessage = result.Found ? "e-Logo'dan sorgulandı" : "e-Logo: e-Fatura mükellefi değil";
        result.Message = result.Found
            ? $"{result.Message} (e-Logo'dan sorgulandı)"
            : $"VKN/TCKN {result.TaxNr} e-Fatura mükellefi değil (e-Logo sorgusu).";
        return Ok(result);
    }

    /// <summary>
    /// Firma entegrasyon bilgileri ile mükellef kontrolü (e-Logo CheckGibUser).
    /// Bulunan alias'lar yerel EFaturaMukellef tablosuna da yazılır.
    /// </summary>
    [HttpPost("check-integrator")]
    public async Task<ActionResult<EFaturaMukellefQueryResult>> CheckIntegrator(
        [FromBody] IntegratorMukellefRequest body,
        CancellationToken ct)
    {
        if (body == null || string.IsNullOrWhiteSpace(body.TaxNr))
            return BadRequest(new { message = "TaxNr zorunlu" });

        // Firma kartı şifreyi almaz (kayıt ucu gizler): boşsa kayıtlı şifreyi kullan
        if (string.IsNullOrEmpty(body.IntegratorPassword) && body.CompanyId is > 0)
        {
            body.IntegratorPassword = await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
                "SELECT IntegratorPassword FROM dbo.SYS_Companies WHERE CompanyId = @id",
                new { id = body.CompanyId },
                cancellationToken: ct));
        }

        var result = await _integrator.CheckAsync(body, ct);
        if (result.CheckedExternal && result.ExternalMessage?.StartsWith("CheckGibUser OK") == true)
        {
            // Mükellef olsun olmasın sonuç yazılır: kontrol zamanı işlenir, gelmeyen etiketler pasif
            try { await _lookup.SaveOnlineResultAsync(result.TaxNr, result.Rows, ct); }
            catch { /* yerel yazım opsiyonel */ }
        }
        if (result.Found && result.Rows.Count > 0)
        {
            // ID'leri yerel tablodan tazele
            var local = await _repo.QueryByTaxNrAsync(result.TaxNr, ct);
            if (local.Found)
            {
                result.Rows = local.Rows;
                result.SuggestedPostLabel ??= local.SuggestedPostLabel;
                result.SuggestedSenderLabel ??= local.SuggestedSenderLabel;
                result.Title ??= local.Title;
                result.LocalListCount = local.LocalListCount;
            }
        }

        return Ok(result);
    }

    [HttpGet("count")]
    public async Task<ActionResult<object>> Count(CancellationToken ct)
    {
        var n = await _repo.CountAsync(ct);
        var (lastOk, total, msg) = await _gib.GetLastSyncAsync(_db, ct);
        return Ok(new
        {
            count = n,
            lastSyncAt = lastOk,
            lastSyncTotal = total,
            lastSyncMessage = msg,
            pkListUrl = _gib.Options.PkListUrl,
            gbListUrl = _gib.Options.GbListUrl,
        });
    }

    [HttpGet("sync-status")]
    public async Task<ActionResult<object>> SyncStatus(CancellationToken ct)
    {
        var n = await _repo.CountAsync(ct);
        var (lastOk, total, msg) = await _gib.GetLastSyncAsync(_db, ct);
        return Ok(new
        {
            localCount = n,
            lastSyncAt = lastOk,
            lastSyncTotal = total,
            lastSyncMessage = msg,
            authoritative = lastOk != null && DateTime.Now - lastOk.Value <= TimeSpan.FromHours(_gib.Options.SyncFreshHours),
            cacheDirectory = _gib.ResolveCacheDir(),
        });
    }

    /// <summary>
    /// GİB PK+GB zip listelerini indirip carilerin VKN'lerini yerel tabloya yazar; liste dosyaları sonra silinir (uzun sürebilir).
    /// GİB adresine erişilemezse liste e-Logo hesabından (getUserListNew) alınır.
    /// </summary>
    [HttpPost("sync")]
    public async Task<ActionResult<GibSyncOutcome>> Sync(CancellationToken ct)
    {
        var outcome = await _gib.SyncFullAsync(_db, ct, await _elogo.FindELogoCompanyAsync(ct));
        _gib.DeleteCachedZips();
        if (!outcome.Success) return StatusCode(502, outcome);
        return Ok(outcome);
    }

    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] EFaturaMukellefRow body, CancellationToken ct)
    {
        var (ok, message, id) = await _repo.UpsertAsync(body, ct);
        if (!ok) return BadRequest(new { success = false, message });
        return Ok(new { success = true, message, id });
    }

    /** Elle CSV yedek yolu (GİB zip erişilemezse) */
    [HttpPost("import-csv")]
    [RequestSizeLimit(120_000_000)]
    public async Task<ActionResult<EFaturaMukellefImportResult>> ImportCsv(CancellationToken ct)
    {
        string csv;
        if (Request.HasFormContentType && Request.Form.Files.Count > 0)
        {
            var file = Request.Form.Files[0];
            await using var stream = file.OpenReadStream();
            using var reader = new StreamReader(stream, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            csv = await reader.ReadToEndAsync(ct);
        }
        else
        {
            using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
            var body = await reader.ReadToEndAsync(ct);
            if (body.TrimStart().StartsWith('{'))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(body);
                    csv = doc.RootElement.TryGetProperty("csv", out var p) ? (p.GetString() ?? "") : body;
                }
                catch
                {
                    csv = body;
                }
            }
            else csv = body;
        }

        var result = await _repo.ImportCsvAsync(csv, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
}
