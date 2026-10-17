using System.Data;
using BartuERP.Backend.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Döviz kurları — TCMB'den indirme, günlük kur listesi, otomatik indirilecek dövizler.</summary>
[ApiController]
[Route("api/currency-rates")]
public sealed class CurrencyRatesController : ControllerBase
{
    private readonly TcmbRateService _tcmb;
    private readonly IDbConnection _db;

    public CurrencyRatesController(TcmbRateService tcmb, IDbConnection db)
    {
        _tcmb = tcmb;
        _db = db;
    }

    public sealed class AutoRequest
    {
        public List<string> Codes { get; set; } = new();
    }

    /// <summary>Bir günün kurları (tarih yoksa en son kayıtlı gün) + son indirme</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateTime? date)
    {
        try
        {
            if (!await _tcmb.ReadyAsync())
                return Ok(new { ready = false, message = "74_tcmb_currency_rates.sql uygulanmadı." });
            var day = date?.Date ?? await _db.ExecuteScalarAsync<DateTime?>("SELECT MAX(RateDate) FROM dbo.SYS_CurrencyRate");
            var rates = day is null
                ? Enumerable.Empty<object>()
                : await _db.QueryAsync(@"
SELECT c.CurrencyID AS currencyID, c.Code AS code, c.Title AS title, c.AutoRate AS autoRate,
       r.RateDate AS rateDate, r.Unit AS unit, r.BuyRate AS buyRate, r.SellRate AS sellRate,
       r.BanknoteBuyRate AS banknoteBuyRate, r.BanknoteSellRate AS banknoteSellRate,
       r.BulletinNo AS bulletinNo, r.Source AS source, r.DownloadedAt AS downloadedAt
FROM dbo.SYS_CurrencyRate r
INNER JOIN dbo.SYS_Currency c ON c.CurrencyID = r.CurrencyID
WHERE r.RateDate = @day
ORDER BY CASE c.Code WHEN 'USD' THEN 0 WHEN 'EUR' THEN 1 WHEN 'GBP' THEN 2 ELSE 3 END, c.Code", new { day });
            var days = await _db.QueryAsync<DateTime>(
                "SELECT DISTINCT TOP 30 RateDate FROM dbo.SYS_CurrencyRate ORDER BY RateDate DESC");
            var logs = await _db.QueryAsync(@"
SELECT TOP 15 RunAt AS runAt, RequestDate AS requestDate, RateDate AS rateDate, BulletinNo AS bulletinNo,
       Trigger_ AS triggerName, Success AS success, RateCount AS rateCount, Message AS message
FROM dbo.SYS_CurrencyRateLog ORDER BY RunAt DESC");
            return Ok(new { ready = true, date = day, rates, days, logs });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>TCMB'den indir (tarih yoksa son yayımlanan bülten). codes boşsa otomatik dövizler.</summary>
    [HttpPost("download")]
    public async Task<IActionResult> Download([FromQuery] DateTime? date, [FromBody] AutoRequest? body, CancellationToken ct)
    {
        var r = await _tcmb.DownloadAsync(date, "Elle", body?.Codes is { Count: > 0 } c ? c : null, ct: ct);
        return r.Success ? Ok(r) : BadRequest(r);
    }

    /// <summary>TCMB'nin yayımladığı dövizler + sistemdeki karşılığı ve otomatik indirme durumu</summary>
    [HttpGet("tcmb-currencies")]
    public async Task<IActionResult> TcmbCurrencies(CancellationToken ct)
    {
        try
        {
            var b = await _tcmb.FetchAsync(null, ct);
            var ready = await _tcmb.ReadyAsync();
            var sys = ready
                ? (await _db.QueryAsync<(int CurrencyID, string Code, bool AutoRate)>(
                    "SELECT CurrencyID, UPPER(Code), AutoRate FROM dbo.SYS_Currency WHERE ISNULL(IsLocal,0)=0"))
                    .ToDictionary(x => x.Code, x => x)
                : new Dictionary<string, (int CurrencyID, string Code, bool AutoRate)>();
            var list = (b?.Rates ?? new()).Select(r => new
            {
                code = r.Code,
                name = r.Name,
                unit = r.Unit,
                hasRate = r.ForexBuying != null,
                inSystem = sys.ContainsKey(r.Code),
                autoRate = sys.TryGetValue(r.Code, out var s) && s.AutoRate,
            });
            return Ok(new { ready, bulletinDate = b?.Date, bulletinNo = b?.BulletinNo, currencies = list });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new { message = "TCMB'ye ulaşılamadı: " + ex.Message });
        }
    }

    /// <summary>Otomatik indirilecek dövizleri ayarla (listede olmayanların bayrağı kalkar)</summary>
    [HttpPost("auto")]
    public async Task<IActionResult> SetAuto([FromBody] AutoRequest body)
    {
        try
        {
            if (!await _tcmb.ReadyAsync()) return BadRequest(new { message = "74_tcmb_currency_rates.sql uygulanmadı." });
            var codes = body.Codes.Select(c => c.Trim().ToUpperInvariant()).Where(c => c.Length > 0).Distinct().ToArray();
            await _db.ExecuteAsync(
                "UPDATE dbo.SYS_Currency SET AutoRate = CASE WHEN UPPER(Code) IN @codes THEN 1 ELSE 0 END WHERE ISNULL(IsLocal,0) = 0",
                new { codes = codes.Length > 0 ? codes : new[] { "__none__" } });
            return Ok(new { ok = true, count = codes.Length });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
