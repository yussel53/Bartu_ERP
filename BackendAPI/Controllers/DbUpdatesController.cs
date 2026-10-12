using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/db-updates")]
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

    [HttpPost("{scriptName}/apply")]
    public async Task<ActionResult<DbUpdateApplyResult>> Apply(
        string scriptName,
        [FromQuery] string? appliedBy,
        CancellationToken ct)
    {
        var result = await _repo.ApplyAsync(scriptName, appliedBy, ct);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPost("apply-pending")]
    public async Task<ActionResult<List<DbUpdateApplyResult>>> ApplyPending(
        [FromQuery] string? appliedBy,
        CancellationToken ct)
    {
        var results = await _repo.ApplyPendingAsync(appliedBy, ct);
        if (results.Any(r => !r.Success)) return BadRequest(results);
        return Ok(results);
    }
}
