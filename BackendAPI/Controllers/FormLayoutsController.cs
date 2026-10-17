using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Ekran tasarımları — kullanıcı / rol bazında form düzeni.</summary>
[ApiController]
[Route("api/form-layouts")]
public sealed class FormLayoutsController : ControllerBase
{
    private readonly FormLayoutRepository _repo;

    public FormLayoutsController(FormLayoutRepository repo)
    {
        _repo = repo;
    }

    private async Task<IActionResult> Run(Func<Task<object?>> fn)
    {
        try
        {
            var r = await fn();
            return r is null ? NotFound() : Ok(r);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(409, new { needsUpdate = true, message = ex.Message });
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

    /// <summary>Formun tüm tasarımları (yönetim / tasarım modu)</summary>
    [HttpGet]
    public Task<IActionResult> List([FromQuery] string formCode) =>
        Run(async () => await _repo.ListAsync(formCode));

    /// <summary>Kullanıcının görebileceği tasarımlar + önerilen tasarım</summary>
    [HttpGet("resolve")]
    public Task<IActionResult> Resolve(
        [FromQuery] string formCode,
        [FromQuery] string? userId,
        [FromQuery] string? roleIds,
        [FromQuery] bool isAdmin = false) =>
        Run(async () => await _repo.ResolveAsync(
            formCode,
            userId,
            (roleIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            isAdmin));

    [HttpPost]
    public Task<IActionResult> Save([FromBody] FormLayoutDto dto) =>
        Run(async () => new { id = await _repo.SaveAsync(dto, Request.Headers["X-User-Id"].FirstOrDefault()) });

    [HttpDelete("{id:int}")]
    public Task<IActionResult> Delete(int id) =>
        Run(async () => new { ok = await _repo.DeleteAsync(id) });
}
