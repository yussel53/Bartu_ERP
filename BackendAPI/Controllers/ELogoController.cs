using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/elogo")]
public sealed class ELogoController : ControllerBase
{
    private readonly ELogoDocumentSyncService _sync;

    public ELogoController(ELogoDocumentSyncService sync) => _sync = sync;

    [HttpGet("companies")]
    public async Task<IActionResult> Companies(CancellationToken ct)
    {
        try
        {
            var list = await _sync.ListCompaniesAsync(ct);
            // şifreyi API'ye çıkarma
            return Ok(list.Select(c => new
            {
                c.CompanyId,
                c.Title,
                c.IntegratorName,
                c.IntegratorWsUrl,
                c.IntegratorUser,
                hasPassword = !string.IsNullOrWhiteSpace(c.IntegratorPassword),
                c.IntegratorVkN
            }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>
    /// e-Logo GetDocumentList → EGovDocument + PDF/XML + (gelen) süreç kuyruğu.
    /// </summary>
    [HttpPost("sync")]
    public async Task<IActionResult> Sync([FromBody] ELogoSyncRequest req, CancellationToken ct)
    {
        try
        {
            if (req.EndDate < req.BeginDate)
                return BadRequest(new { message = "Bitiş tarihi başlangıçtan önce olamaz." });
            if ((req.EndDate - req.BeginDate).TotalDays > 92)
                return BadRequest(new { message = "Tarih aralığı en fazla 92 gün olabilir." });

            var result = await _sync.SyncAsync(req, ct);
            return result.Ok ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
