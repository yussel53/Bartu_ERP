using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Kart sağ tık menüsü: Ekstre / Hareketler / ek bölümler.</summary>
[ApiController]
[Route("api/card-statement")]
public sealed class CardStatementController : ControllerBase
{
    private readonly CardStatementRepository _repo;
    private readonly DataScopeService _scope;
    private readonly CustomerAgingService _aging;
    private readonly RiskService _risk;

    /// <summary>Ekstre türü → kart tablosu (Y-02 yetki denetimi)</summary>
    private static readonly Dictionary<string, (string Table, string Pk)> CardTables = new(StringComparer.OrdinalIgnoreCase)
    {
        ["customer"] = ("CustomerCard", "CustomerCardID"),
        ["product"] = ("ProductCard", "ProductCardID"),
        ["bank"] = ("BankCard", "BankCardID"),
        ["bankAccount"] = ("BankAccountCard", "BankAccountCardID"),
        ["safe"] = ("SafeCard", "SafeCardID"),
    };

    public CardStatementController(CardStatementRepository repo, DataScopeService scope, CustomerAgingService aging, RiskService risk)
    {
        _aging = aging;
        _risk = risk;
        _repo = repo;
        _scope = scope;
    }

    /// <summary>Cari listesi: bakiye + son hareket + açık sipariş + il/ilçe + iletişim + risk grubu</summary>
    [HttpGet("customer-summaries")]
    public async Task<IActionResult> CustomerSummaries(CancellationToken ct)
    {
        try
        {
            var list = await _repo.CustomerSummariesAsync(ct);
            // Y-10: vadesi geçen
            foreach (var a in await _aging.AgingAsync(null, ct))
                if (list.FirstOrDefault(c => c.CustomerCardID == a.CustomerCardID) is { } s && a.Overdue > 0)
                {
                    s.Overdue = a.Overdue;
                    s.OverdueDays = a.MaxDays;
                }
            var scope = await _scope.GetAsync(ct);
            if (!scope.Unrestricted)
            {
                // Y-02: yalnız görebildiği carilerin özeti
                var visible = new HashSet<int>();
                foreach (var c in list)
                    if (await _scope.CanSeeRecordAsync("CustomerCard", "CustomerCardID", c.CustomerCardID, ct)) visible.Add(c.CustomerCardID);
                list = list.Where(c => visible.Contains(c.CustomerCardID)).ToList();
            }
            return Ok(list);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>Y-10: cari vade yaşlandırma (FIFO kapama sonrası açık kalemler)</summary>
    [HttpGet("aging")]
    public async Task<IActionResult> Aging([FromQuery] DateTime? asOf, CancellationToken ct)
    {
        try
        {
            var rows = await _aging.AgingAsync(asOf, ct);
            var scope = await _scope.GetAsync(ct);
            if (!scope.Unrestricted)
            {
                var visible = new List<AgingRow>();
                foreach (var r in rows)
                    if (await _scope.CanSeeRecordAsync("CustomerCard", "CustomerCardID", r.CustomerCardID, ct)) visible.Add(r);
                rows = visible;
            }
            return Ok(rows);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>Y-12: carinin riski (bakiye + açık sipariş + irsaliye + portföy) ve limiti</summary>
    [HttpGet("risk/{id:int}")]
    public async Task<IActionResult> Risk(int id, CancellationToken ct)
    {
        try
        {
            if (!await _scope.CanSeeRecordAsync("CustomerCard", "CustomerCardID", id, ct))
                return StatusCode(403, new { message = "Bu kayda yetkiniz yok." });
            return Ok(await _risk.InfoAsync(id, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>Y-10: carinin açık kalemleri</summary>
    [HttpGet("open-items/{id:int}")]
    public async Task<IActionResult> OpenItems(int id, [FromQuery] DateTime? asOf, CancellationToken ct)
    {
        try
        {
            if (!await _scope.CanSeeRecordAsync("CustomerCard", "CustomerCardID", id, ct))
                return StatusCode(403, new { message = "Bu kayda yetkiniz yok." });
            return Ok(await _aging.OpenItemsAsync(id, asOf, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{kind}/{id:int}")]
    public async Task<ActionResult<CardStatementResult>> Get(
        string kind,
        int id,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        try
        {
            if (CardTables.TryGetValue(kind, out var t) && !await _scope.CanSeeRecordAsync(t.Table, t.Pk, id, ct))
                return StatusCode(403, new { message = "Bu karta yetkiniz yok." });
            return Ok(await _repo.GetAsync(kind, id, from, to, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
