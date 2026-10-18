using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>E-Devlet → İşlemler → e-Belge Konsolu: gelen / giden / bekleyen e-belgelerin dönem özeti.</summary>
[ApiController]
[Route("api/egov/console")]
public sealed class EGovConsoleController : ControllerBase
{
    private readonly EGovConsoleRepository _repo;

    public EGovConsoleController(EGovConsoleRepository repo) => _repo = repo;

    /// <summary>from / to: yyyy-MM-dd (varsayılan son 30 gün) · docKind: 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye (boş = tümü)</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] byte? docKind, CancellationToken ct)
    {
        var end = (to ?? DateTime.Today).Date;
        var start = (from ?? end.AddDays(-29)).Date;
        if (start > end) return BadRequest(new { message = "Başlangıç tarihi bitişten sonra olamaz." });
        if ((end - start).TotalDays > 366) return BadRequest(new { message = "En fazla bir yıllık dönem seçin." });
        if (docKind is not null and not (1 or 2 or 3)) return BadRequest(new { message = "docKind 1-3 olmalı." });
        try
        {
            return Ok(await _repo.GetAsync(start, end, docKind, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
