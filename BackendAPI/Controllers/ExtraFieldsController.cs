using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/extra-fields")]
public sealed class ExtraFieldsController : ControllerBase
{
    private readonly ExtraFieldsRepository _repo;

    public ExtraFieldsController(ExtraFieldsRepository repo) => _repo = repo;

    [HttpGet("targets")]
    public IActionResult Targets() => Ok(ExtraFieldsRepository.Targets);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? table, [FromQuery] bool includeInactive, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ListAsync(table, includeInactive, ct));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(new { needsUpdate = true, message = ex.Message, items = Array.Empty<object>() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("columns/{table}")]
    public async Task<IActionResult> Columns(string table, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ColumnsAsync(table, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] ExtraFieldDef def, CancellationToken ct)
    {
        try
        {
            var (ok, message, field) = await _repo.SaveAsync(def, ct);
            return ok ? Ok(new { ok, message, field }) : BadRequest(new { ok, message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] bool dropColumn, CancellationToken ct)
    {
        try
        {
            var (ok, message) = await _repo.DeleteAsync(id, dropColumn, ct);
            return ok ? Ok(new { ok, message }) : BadRequest(new { ok, message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
