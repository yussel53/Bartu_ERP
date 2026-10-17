using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/sql-reports")]
public sealed class SqlReportsController : ControllerBase
{
    private readonly SqlReportsRepository _repo;

    public SqlReportsController(SqlReportsRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SqlReportDto>>> List([FromQuery] string? group, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ListAsync(group, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("menus")]
    public async Task<ActionResult<IReadOnlyList<SqlReportMenuDto>>> ListMenus(
        [FromQuery] int? userId,
        [FromQuery] bool isAdmin = false,
        CancellationToken ct = default)
    {
        try
        {
            return Ok(await _repo.ListMenusAsync(userId, isAdmin, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<SqlReportUserDto>>> ListUsers(CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ListUsersAsync(ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}/auth")]
    public async Task<ActionResult<SqlReportAuthStateDto>> GetAuth(int id, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.GetReportAuthAsync(id, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPut("{id:int}/auth")]
    public async Task<ActionResult<SqlReportAuthStateDto>> SaveAuth(
        int id,
        [FromBody] SqlReportAuthSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.SaveReportAuthAsync(id, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("auth/by-user/{userId:int}")]
    public async Task<ActionResult<SqlReportUserAuthStateDto>> GetUserAuth(int userId, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.GetUserAuthAsync(userId, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPut("auth/by-user/{userId:int}")]
    public async Task<ActionResult<SqlReportUserAuthStateDto>> SaveUserAuth(
        int userId,
        [FromBody] SqlReportUserAuthSaveDto dto,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.SaveUserAuthAsync(userId, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPost("menus")]
    public async Task<ActionResult<SqlReportMenuDto>> CreateMenu([FromBody] SqlReportMenuSaveDto dto, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertMenuAsync(null, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPut("menus/{id:int}")]
    public async Task<ActionResult<SqlReportMenuDto>> UpdateMenu(int id, [FromBody] SqlReportMenuSaveDto dto, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.UpsertMenuAsync(id, dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpDelete("menus/{id:int}")]
    public async Task<ActionResult> DeleteMenu(int id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteMenuAsync(id, ct);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("export")]
    public async Task<ActionResult<SqlReportPackageDto>> Export([FromQuery] string? ids, CancellationToken ct)
    {
        try
        {
            List<int>? reportIds = null;
            if (!string.IsNullOrWhiteSpace(ids))
            {
                reportIds = ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(x => int.TryParse(x, out var n) ? n : 0)
                    .Where(x => x > 0)
                    .ToList();
            }
            return Ok(await _repo.ExportPackageAsync(reportIds, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPost("import")]
    public async Task<ActionResult<SqlReportImportResult>> Import([FromBody] SqlReportPackageDto package, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ImportPackageAsync(package, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SqlReportDto>> Get(int id, CancellationToken ct)
    {
        try
        {
            var report = await _repo.GetAsync(id, ct);
            if (report is null) return NotFound(new { message = "Rapor bulunamadı." });
            return Ok(report);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPost]
    public async Task<ActionResult<SqlReportDto>> Create([FromBody] SqlReportSaveDto dto, CancellationToken ct)
    {
        try
        {
            var saved = await _repo.UpsertAsync(null, dto, ct);
            return Ok(saved);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<SqlReportDto>> Update(int id, [FromBody] SqlReportSaveDto dto, CancellationToken ct)
    {
        try
        {
            var saved = await _repo.UpsertAsync(id, dto, ct);
            return Ok(saved);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
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

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPost("run")]
    public async Task<ActionResult<SqlReportRunResult>> Run([FromBody] SqlReportRunRequest req, CancellationToken ct)
    {
        try
        {
            var result = await _repo.RunAsync(req, ct);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new SqlReportRunResult
            {
                Success = false,
                Message = ex.Message,
            });
        }
    }

    [HttpPost("{id:int}/run")]
    public async Task<ActionResult<SqlReportRunResult>> RunById(
        int id,
        [FromBody] SqlReportRunRequest? req,
        CancellationToken ct)
    {
        req ??= new SqlReportRunRequest();
        req.ReportId = id;
        return await Run(req, ct);
    }
}
