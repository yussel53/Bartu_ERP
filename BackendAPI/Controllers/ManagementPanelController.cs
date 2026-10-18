using System.Data;
using System.Security.Claims;
using BartuERP.Backend.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-14: Genel Durum → yönetim paneli özeti.</summary>
[ApiController]
[Route("api/dashboard/management")]
public sealed class ManagementPanelController : ControllerBase
{
    private readonly ManagementPanelService _svc;
    private readonly DataScopeService _scope;
    private readonly IDbConnection _db;

    public ManagementPanelController(ManagementPanelService svc, DataScopeService scope, IDbConnection db)
    {
        _svc = svc;
        _scope = scope;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        try
        {
            var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var u) ? u : 0;
            // Y-02: yetkisi olmayan carilerin vadeleri panelde görünmez
            var scope = await _scope.GetAsync(ct);
            Func<int, bool> canSee = _ => true;
            if (!scope.Unrestricted)
            {
                var visible = new HashSet<int>();
                foreach (var id in await _db.QueryAsync<int>("SELECT CustomerCardID FROM dbo.CustomerCard"))
                    if (await _scope.CanSeeRecordAsync("CustomerCard", "CustomerCardID", id, ct)) visible.Add(id);
                canSee = visible.Contains;
            }
            return Ok(await _svc.GetAsync(userId, canSee, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
