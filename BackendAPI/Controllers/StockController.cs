using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Stok maliyeti (Y-07): ağırlıklı ortalama yeniden hesap, stok değeri ve brüt kâr raporu.</summary>
[ApiController]
[Route("api/stock")]
public sealed class StockController : ControllerBase
{
    private readonly StockService _stock;

    public StockController(StockService stock)
    {
        _stock = stock;
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPost("cost/recalculate")]
    public async Task<IActionResult> Recalculate(CancellationToken ct)
    {
        try
        {
            return Ok(await _stock.RecalculateAsync(null, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("cost-report")]
    public async Task<IActionResult> CostReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        try
        {
            return Ok(new
            {
                scope = await _stock.SettingAsync("STK_COST_SCOPE", "0") == "1" ? "ambar" : "firma",
                negativeControl = await _stock.SettingAsync("STK_NEG_CTRL", "0"),
                rows = await _stock.CostReportAsync(from, to, ct),
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
