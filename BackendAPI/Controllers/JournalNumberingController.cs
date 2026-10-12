using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/journal-numbering")]
public sealed class JournalNumberingController : ControllerBase
{
    private readonly JournalNumberingRepository _repo;

    public JournalNumberingController(JournalNumberingRepository repo)
    {
        _repo = repo;
    }

    /// <summary>Uygulamadan önce hangi fişe hangi numaranın verileceğini listeler.</summary>
    [HttpPost("preview")]
    public Task<IActionResult> Preview([FromBody] JournalNumberingRequest req, CancellationToken ct) =>
        Run(req, apply: false, ct);

    [HttpPost("apply")]
    public Task<IActionResult> Apply([FromBody] JournalNumberingRequest req, CancellationToken ct) =>
        Run(req, apply: true, ct);

    [HttpGet("suggest-start")]
    public async Task<IActionResult> SuggestStart([FromQuery] DateTime startDate, [FromQuery] int? companyId, CancellationToken ct)
    {
        try
        {
            return Ok(new { startNumber = await _repo.SuggestStartNumberAsync(startDate, companyId, ct) });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> History([FromQuery] int take = 50, CancellationToken ct = default)
    {
        try
        {
            return Ok(await _repo.HistoryAsync(take, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    private async Task<IActionResult> Run(JournalNumberingRequest req, bool apply, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.RunAsync(req, apply, ct));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
