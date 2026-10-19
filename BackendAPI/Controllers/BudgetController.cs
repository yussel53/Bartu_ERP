using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-17: bütçe / gerçekleşen raporu ve faturadaki bütçe çubuğu.</summary>
[ApiController]
[Route("api/budget")]
public sealed class BudgetController : ControllerBase
{
    private readonly BudgetService _svc;

    public BudgetController(BudgetService svc)
    {
        _svc = svc;
    }

    [HttpGet("report")]
    public async Task<IActionResult> Report([FromQuery] int? year, CancellationToken ct) =>
        Ok(await _svc.ReportAsync(year ?? DateTime.Today.Year, ct));

    [HttpPost("check-invoice")]
    public async Task<IActionResult> CheckInvoice([FromBody] BudgetCheckRequest req, CancellationToken ct) =>
        Ok(await _svc.CheckInvoiceAsync(req, ct));
}
