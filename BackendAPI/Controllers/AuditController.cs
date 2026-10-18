using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-15: kaydın değişiklik geçmişi (sağ tık → Değişiklik Geçmişi).</summary>
[ApiController]
[Route("api/audit")]
public sealed class AuditController : ControllerBase
{
    private readonly AuditService _audit;
    private readonly RecordsRepository _repo;
    private readonly DataScopeService _scope;

    public AuditController(AuditService audit, RecordsRepository repo, DataScopeService scope)
    {
        _audit = audit;
        _repo = repo;
        _scope = scope;
    }

    [HttpGet("{tableName}/{id:int}")]
    public async Task<IActionResult> History(string tableName, int id, [FromQuery] string? pk, CancellationToken ct)
    {
        try
        {
            // Y-02: görmediği kaydın geçmişini de göremez (silinmiş kayıtta yönetici)
            var rec = await _repo.GetAsync(tableName, pk, id, ct);
            var scope = await _scope.GetAsync(ct);
            if (rec != null ? !_scope.CanSee(scope, tableName, rec.StandardFields) : !scope.Unrestricted)
                return StatusCode(403, new { message = "Bu kayda yetkiniz yok." });
            return Ok(await _audit.HistoryAsync(tableName, id));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
