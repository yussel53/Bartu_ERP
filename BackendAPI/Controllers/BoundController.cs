using System.Security.Claims;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-11: çek / senet portföyü, bordrolar, vade takvimi, kart geçmişi.</summary>
[ApiController]
[Route("api/bound")]
public sealed class BoundController : ControllerBase
{
    private readonly BoundPortfolioService _svc;

    public BoundController(BoundPortfolioService svc)
    {
        _svc = svc;
    }

    [HttpGet("meta")]
    public IActionResult Meta() => Ok(new { rollTypes = BoundPortfolioService.RollTypes, positions = BoundPortfolioService.Positions });

    /// <summary>status: virgülle konumlar (ör. 1,3,4) — boş: hepsi</summary>
    [HttpGet("portfolio")]
    public async Task<IActionResult> Portfolio([FromQuery] string? status, CancellationToken ct)
    {
        var st = (status ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var v) ? v : -1).Where(v => v >= 0).ToArray();
        return Ok(await _svc.PortfolioAsync(st, ct));
    }

    [HttpGet("rolls")]
    public async Task<IActionResult> Rolls([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct) =>
        Ok(await _svc.RollsAsync(from, to, ct));

    [HttpPost("rolls")]
    public async Task<IActionResult> Create([FromBody] BoundRollInput body, CancellationToken ct)
    {
        int? userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var u) ? u : null;
        var (ok, message, id) = await _svc.CreateAsync(body, userId, ct);
        return ok ? Ok(new { success = true, message, id }) : BadRequest(new { success = false, message });
    }

    [HttpDelete("rolls/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var (ok, message) = await _svc.DeleteAsync(id, ct);
        return ok ? Ok(new { success = true, message }) : BadRequest(new { success = false, message });
    }

    [HttpGet("{id:int}/history")]
    public async Task<IActionResult> History(int id, CancellationToken ct) => Ok(await _svc.HistoryAsync(id, ct));
}
