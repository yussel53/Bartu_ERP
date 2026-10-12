using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/roles")]
public sealed class RolesController : ControllerBase
{
    private readonly RolesRepository _repo;

    public RolesController(RolesRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RoleDto>>> List(CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ListAsync(ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RoleDto>> Get(int id, CancellationToken ct)
    {
        try
        {
            var role = await _repo.GetAsync(id, ct);
            if (role is null) return NotFound(new { message = "Rol bulunamadı." });
            return Ok(role);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<RoleDto>> Create([FromBody] RoleSaveDto dto, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertAsync(null, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<RoleDto>> Update(int id, [FromBody] RoleSaveDto dto, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertAsync(id, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteAsync(id, ct);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("by-user/{userId:int}")]
    public async Task<ActionResult<UserRoleAssignmentDto>> GetUserRoles(int userId, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.GetUserRolesAsync(userId, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("by-user/{userId:int}")]
    public async Task<ActionResult<UserRoleAssignmentDto>> SaveUserRoles(
        int userId,
        [FromBody] UserRolesSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.SaveUserRolesAsync(userId, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("effective/{userId:int}")]
    public async Task<ActionResult<EffectiveAuthDto>> Effective(int userId, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.GetEffectiveAuthAsync(userId, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
