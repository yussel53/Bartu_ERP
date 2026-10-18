using System.Security.Claims;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-13: zamanlanmış rapor e-postaları (yönetici).</summary>
[ApiController]
[Route("api/report-schedules")]
[Authorize(Policy = AuthClaims.AdminPolicy)]
public sealed class ReportSchedulesController : ControllerBase
{
    private readonly ReportScheduleService _svc;

    public ReportSchedulesController(ReportScheduleService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await _svc.ListAsync());

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] ReportScheduleDto body)
    {
        try
        {
            int? userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var u) ? u : null;
            return Ok(new { id = await _svc.SaveAsync(body, userId) });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _svc.DeleteAsync(id);
        return Ok(new { success = true });
    }

    /// <summary>Şimdi gönder</summary>
    [HttpPost("{id:int}/send")]
    public async Task<IActionResult> Send(int id, CancellationToken ct)
    {
        try
        {
            var (ok, message, _, _) = await _svc.RunAsync(id, true, ct);
            return ok ? Ok(new { message }) : BadRequest(new { message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Excel önizleme (göndermeden indir)</summary>
    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> File(int id, CancellationToken ct)
    {
        try
        {
            var (ok, message, file, name) = await _svc.RunAsync(id, false, ct);
            if (!ok || file == null) return BadRequest(new { message });
            return File(file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
