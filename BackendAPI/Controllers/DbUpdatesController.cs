using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Authorization;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/db-updates")]
[AllowAnonymous]
[SetupOrAdmin]
public sealed class DbUpdatesController : ControllerBase
{
    private readonly DbUpdateRepository _repo;

    public DbUpdatesController(DbUpdateRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult<DbUpdateStatusInfo>> GetStatus(CancellationToken ct)
    {
        return Ok(await _repo.GetStatusAsync(ct));
    }

    [HttpGet("{scriptName}")]
    public async Task<ActionResult<object>> Preview(string scriptName)
    {
        var content = await _repo.GetScriptContentAsync(scriptName);
        if (content == null) return NotFound(new { message = "Script bulunamadı" });
        return Ok(new { scriptName, content });
    }

    /// <summary>Script öncesi otomatik yedek (veritabanı varsa; yedek alınamazsa güncelleme yine yapılır)</summary>
    private async Task BackupBeforeAsync(DbBackupService backup, CancellationToken ct)
    {
        if (await SetupOrAdminAttribute.SetupModeAsync(HttpContext.RequestServices)
            && !(await _repo.GetStatusAsync(ct)).Scripts.Any(s => s.Applied))
            return; // ilk kurulum: yedeklenecek veri yok
        await backup.BackupAsync("sql", ct);
    }

    [HttpPost("{scriptName}/apply")]
    public async Task<ActionResult<DbUpdateApplyResult>> Apply(
        string scriptName,
        [FromQuery] string? appliedBy,
        [FromServices] DbBackupService backup,
        CancellationToken ct)
    {
        await BackupBeforeAsync(backup, ct);
        var result = await _repo.ApplyAsync(scriptName, appliedBy, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("apply-pending")]
    public async Task<ActionResult<List<DbUpdateApplyResult>>> ApplyPending(
        [FromQuery] string? appliedBy,
        [FromServices] DbBackupService backup,
        CancellationToken ct)
    {
        if ((await _repo.GetStatusAsync(ct)).PendingCount > 0) await BackupBeforeAsync(backup, ct);
        var results = await _repo.ApplyPendingAsync(appliedBy, ct);
        if (results.Any(r => !r.Success)) return BadRequest(results);
        return Ok(results);
    }
}
