using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Authorization;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/db-bootstrap")]
[AllowAnonymous]
[SetupOrAdmin]
public sealed class DbBootstrapController : ControllerBase
{
    private readonly DbBootstrapRepository _repo;

    public DbBootstrapController(DbBootstrapRepository repo)
    {
        _repo = repo;
    }

    [SkipSetupCheck]
    [HttpGet("status")]
    public async Task<ActionResult<DbBootstrapStatus>> Status(CancellationToken ct)
    {
        return Ok(await _repo.GetStatusAsync(ct));
    }

    [HttpGet("scripts/{fileName}")]
    public async Task<IActionResult> ScriptContent(string fileName)
    {
        var content = await _repo.GetScriptContentAsync(fileName);
        if (content == null) return NotFound(new { message = "Script bulunamadı" });
        return Ok(new { fileName, content });
    }

    [HttpPost("create")]
    public async Task<ActionResult<DbBootstrapResult>> Create(
        [FromBody] DbBootstrapRequest? body,
        CancellationToken ct)
    {
        var result = await _repo.BootstrapAsync(body ?? new DbBootstrapRequest(), ct);
        return Ok(result);
    }
}
