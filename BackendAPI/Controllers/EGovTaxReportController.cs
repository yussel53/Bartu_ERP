using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>E-Devlet → Raporlar → KDV ve Ba / Bs (E-08). Yalnız okuma.</summary>
[ApiController]
[Route("api/egov/tax-report")]
public sealed class EGovTaxReportController : ControllerBase
{
    private readonly EGovTaxReportRepository _repo;

    public EGovTaxReportController(EGovTaxReportRepository repo) => _repo = repo;

    private static string? CheckRange(DateTime from, DateTime to) =>
        from > to ? "Başlangıç tarihi bitişten sonra olamaz."
        : (to - from).TotalDays > 366 ? "En fazla bir yıllık dönem seçin." : null;

    /// <summary>from / to: yyyy-MM-dd (dönem — genelde bir ay)</summary>
    [HttpGet("kdv")]
    public async Task<IActionResult> Kdv([FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] int? companyId, CancellationToken ct)
    {
        if (CheckRange(from, to) is { } err) return BadRequest(new { message = err });
        try
        {
            return Ok(await _repo.KdvAsync(from, to, companyId is > 0 ? companyId : null, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>limit: KDV hariç TL sınırı (varsayılan 5.000)</summary>
    [HttpGet("babs")]
    public async Task<IActionResult> BaBs([FromQuery] DateTime from, [FromQuery] DateTime to, [FromQuery] int? companyId,
        [FromQuery] decimal limit = 5000, CancellationToken ct = default)
    {
        if (CheckRange(from, to) is { } err) return BadRequest(new { message = err });
        if (limit < 0) return BadRequest(new { message = "Sınır negatif olamaz." });
        try
        {
            return Ok(await _repo.BaBsAsync(from, to, companyId is > 0 ? companyId : null, limit, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>kind: ba | bs · key: VKN/TCKN ya da «#kartNo»</summary>
    [HttpGet("babs/docs")]
    public async Task<IActionResult> BaBsDocs([FromQuery] string kind, [FromQuery] string key, [FromQuery] DateTime from, [FromQuery] DateTime to,
        [FromQuery] int? companyId, CancellationToken ct)
    {
        if (CheckRange(from, to) is { } err) return BadRequest(new { message = err });
        if (string.IsNullOrWhiteSpace(key)) return BadRequest(new { message = "Cari seçin." });
        try
        {
            return Ok(await _repo.BaBsDocsAsync(kind, key.Trim(), from, to, companyId is > 0 ? companyId : null, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
