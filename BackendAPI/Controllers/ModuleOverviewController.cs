using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/module-overview")]
public sealed class ModuleOverviewController : ControllerBase
{
    private readonly ModuleOverviewRepository _repo;

    public ModuleOverviewController(ModuleOverviewRepository repo) => _repo = repo;

    /// <summary>
    /// Modül veya grup özeti (KPI + durum dağılımı + aylık / sıralama panelleri).
    /// </summary>
    [HttpGet("{modulePath}")]
    public async Task<IActionResult> Get(
        string modulePath,
        [FromQuery] string? group = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int? typeFilter = null,
        CancellationToken ct = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(modulePath))
                return BadRequest(new { message = "modulePath zorunlu." });
            var data = await _repo.GetAsync(modulePath, group, dateFrom, dateTo, typeFilter, ct);
            return Ok(data);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
