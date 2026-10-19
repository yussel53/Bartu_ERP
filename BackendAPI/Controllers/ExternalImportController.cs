using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-16: Logo / Mikro veritabanından aktarım (yönetici).</summary>
[ApiController]
[Route("api/external-import")]
[Authorize(Policy = AuthClaims.AdminPolicy)]
public sealed class ExternalImportController : ControllerBase
{
    private readonly ExternalImportService _svc;

    public ExternalImportController(ExternalImportService svc)
    {
        _svc = svc;
    }

    [HttpGet("sources")]
    public async Task<IActionResult> Sources(CancellationToken ct) => Ok(await _svc.SourcesAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Import([FromBody] ExternalImportRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _svc.ImportAsync(req, User.Identity?.Name, ct));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
