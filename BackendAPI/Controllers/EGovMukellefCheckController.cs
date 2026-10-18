using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>E-Devlet → İşlemler → Cari Mükellef Kontrolü: carilerin GİB e-Fatura mükellefiyeti ve etiketleri (E-06).</summary>
[ApiController]
[Route("api/egov/mukellef-check")]
public sealed class EGovMukellefCheckController : ControllerBase
{
    private readonly EGovMukellefCheckRepository _repo;

    public EGovMukellefCheckController(EGovMukellefCheckRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> Check([FromQuery] bool onlyChanges = true, CancellationToken ct = default)
    {
        try
        {
            var (result, error) = await _repo.CheckAsync(onlyChanges, ct);
            return result is null ? BadRequest(new { message = error }) : Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    public sealed class ApplyRequest
    {
        public List<MukellefApplyItem> Items { get; set; } = new();
    }

    /// <summary>Seçilen satırlara önerileri uygular (öneri sunucuda yeniden hesaplanır)</summary>
    [HttpPost("apply")]
    public async Task<IActionResult> Apply([FromBody] ApplyRequest req, CancellationToken ct)
    {
        if (req.Items.Count == 0) return BadRequest(new { message = "Uygulanacak satır seçin." });
        try
        {
            var (cards, addresses) = await _repo.ApplyAsync(req.Items, ct);
            return Ok(new { success = true, message = $"{cards} cari kart ve {addresses} adres güncellendi." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
