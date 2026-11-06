using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Authorization;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/db-bootstrap")]
[AllowAnonymous]
[SetupOrAdmin]
public sealed class DbBootstrapController : ControllerBase
{
    private readonly DbBootstrapRepository _repo;
    private readonly TenantDbRegistry _tenants;

    public DbBootstrapController(DbBootstrapRepository repo, TenantDbRegistry tenants)
    {
        _repo = repo;
        _tenants = tenants;
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
        if (result.Success)
        {
            try { SqlConnection.ClearAllPools(); } catch { /* ignore */ }
            _tenants.Invalidate();
        }
        return Ok(result);
    }

    /// <summary>Laboratuvar: DROP DATABASE + yeniden kurulum (çoklu onay + WipeSecret).</summary>
    [HttpPost("wipe")]
    public async Task<ActionResult<DbBootstrapResult>> Wipe(
        [FromBody] DbWipeRequest? body,
        CancellationToken ct)
    {
        if (body == null)
            return BadRequest(new { message = "Onay gövdesi gerekli" });
        var result = await _repo.WipeAndRebuildAsync(body, ct);
        if (result.Success)
        {
            try { SqlConnection.ClearAllPools(); } catch { /* ignore */ }
            _tenants.Invalidate();
        }
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
}
