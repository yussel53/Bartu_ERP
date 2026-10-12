using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController : ControllerBase
{
    private readonly DashboardRepository _repo;

    public DashboardController(DashboardRepository repo)
    {
        _repo = repo;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary(CancellationToken ct)
    {
        try
        {
            var data = await _repo.GetSummaryAsync(ct);
            return Ok(data);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("tabs")]
    public async Task<ActionResult<IReadOnlyList<DashboardTabDto>>> ListTabs(
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        try
        {
            return Ok(await _repo.ListTabsAsync(includeInactive, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("tabs")]
    public async Task<ActionResult<DashboardTabDto>> CreateTab(
        [FromBody] DashboardTabSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertTabAsync(null, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("tabs/{id:int}")]
    public async Task<ActionResult<DashboardTabDto>> UpdateTab(
        int id,
        [FromBody] DashboardTabSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertTabAsync(id, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("tabs/{id:int}")]
    public async Task<IActionResult> DeleteTab(int id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteTabAsync(id, ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("tabs/items")]
    public async Task<ActionResult<DashboardTabItemDto>> CreateItem(
        [FromBody] DashboardTabItemSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertItemAsync(null, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("tabs/items/{id:int}")]
    public async Task<ActionResult<DashboardTabItemDto>> UpdateItem(
        int id,
        [FromBody] DashboardTabItemSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertItemAsync(id, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("tabs/items/{id:int}")]
    public async Task<IActionResult> DeleteItem(int id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteItemAsync(id, ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
