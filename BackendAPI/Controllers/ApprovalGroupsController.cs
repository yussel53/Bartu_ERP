using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Onay grupları (Yönetici / Alt Yönetici / Müdür …) ve üyeleri.</summary>
[ApiController]
[Route("api/approval-groups")]
public sealed class ApprovalGroupsController : ControllerBase
{
    private readonly ApprovalGroupRepository _repo;

    public ApprovalGroupsController(ApprovalGroupRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default)
    {
        if (!await _repo.ReadyAsync(ct))
            return Ok(new { ready = false, message = ApprovalGroupRepository.MissingTableMessage, rows = Array.Empty<object>() });
        return Ok(new { ready = true, rows = await _repo.ListAsync(activeOnly, ct) });
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken ct) => Ok(await _repo.ListUsersAsync(ct));

    [HttpPost]
    public Task<IActionResult> Create([FromBody] ApprovalGroupInput dto, CancellationToken ct) => Save(0, dto, ct);

    [HttpPut("{id:int}")]
    public Task<IActionResult> Update(int id, [FromBody] ApprovalGroupInput dto, CancellationToken ct) => Save(id, dto, ct);

    private async Task<IActionResult> Save(int id, ApprovalGroupInput dto, CancellationToken ct)
    {
        if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = ApprovalGroupRepository.MissingTableMessage });
        var error = await _repo.ValidateAsync(dto, id, ct);
        if (error != null) return BadRequest(new { message = error });
        var newId = await _repo.SaveAsync(id, dto, ct);
        return Ok(new { success = true, id = newId, message = id == 0 ? "Onay grubu eklendi." : "Onay grubu güncellendi." });
    }

    [HttpPost("{id:int}/default")]
    public async Task<IActionResult> SetDefault(int id, CancellationToken ct)
    {
        var (ok, message) = await _repo.SetDefaultAsync(id, ct);
        return ok ? Ok(new { success = true, message }) : BadRequest(new { message });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var (ok, message) = await _repo.DeleteAsync(id, ct);
        return ok ? Ok(new { success = true, message }) : BadRequest(new { message });
    }
}
