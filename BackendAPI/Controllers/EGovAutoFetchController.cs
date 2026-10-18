using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// E-Devlet → Tanımlar → Otomatik Belge Çekme: firma bazında ayar, «Şimdi çek» ve çekme günlüğü (E-02).
/// Ayar değişikliği yönetici işi; günlük ve elle çekme oturum açmış kullanıcıya açık.
/// </summary>
[ApiController]
[Route("api/egov/auto-fetch")]
public sealed class EGovAutoFetchController : ControllerBase
{
    private readonly EGovAutoFetchService _svc;

    public EGovAutoFetchController(EGovAutoFetchService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        try
        {
            if (!await _svc.ReadyAsync(ct)) return BadRequest(new { message = EGovAutoFetchService.MissingSetupMessage });
            return Ok(await _svc.ListSettingsAsync(ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPut("{companyId:int}")]
    [Authorize(Policy = AuthClaims.AdminPolicy)]
    public async Task<IActionResult> Save(int companyId, [FromBody] EGovAutoFetchSettingDto dto, CancellationToken ct)
    {
        try
        {
            if (!await _svc.ReadyAsync(ct)) return BadRequest(new { message = EGovAutoFetchService.MissingSetupMessage });
            dto.CompanyId = companyId;
            var (ok, message) = await _svc.SaveSettingAsync(dto, User.UserId(), ct);
            return ok ? Ok(new { success = true, message }) : BadRequest(new { message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>Ayarlardaki belge türleriyle hemen çeker (otomatik çekme kapalı olsa da)</summary>
    [HttpPost("{companyId:int}/run")]
    public async Task<IActionResult> Run(int companyId, CancellationToken ct)
    {
        try
        {
            var r = await _svc.RunAsync(companyId, "manual", User.UserId() > 0 ? User.UserId() : null, ct);
            return Ok(r);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("logs")]
    public async Task<IActionResult> Logs([FromQuery] int? companyId, [FromQuery] int take = 100, CancellationToken ct = default)
    {
        try
        {
            if (!await _svc.ReadyAsync(ct)) return BadRequest(new { message = EGovAutoFetchService.MissingSetupMessage });
            return Ok(await _svc.ListLogsAsync(companyId, take, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
