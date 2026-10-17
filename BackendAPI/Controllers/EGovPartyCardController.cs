using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>e-Belge (UBL) karşı tarafından cari kart — önizleme ve oluşturma.</summary>
[ApiController]
[Route("api/egov/documents/{id:int}/party-card")]
public sealed class EGovPartyCardController : ControllerBase
{
    private readonly EGovPartyCardRepository _repo;

    public EGovPartyCardController(EGovPartyCardRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<IActionResult> Preview(int id, CancellationToken ct)
    {
        try
        {
            var (info, error) = await _repo.ReadAsync(id, ct);
            return info is null ? BadRequest(new { message = error }) : Ok(info);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create(int id, [FromBody] EGovPartyCreateRequest req, CancellationToken ct)
    {
        try
        {
            var (ok, cardId, code, message) = await _repo.CreateAsync(id, req, ct);
            return ok
                ? Ok(new { success = true, message, customerCardID = cardId, code })
                : BadRequest(new { success = false, message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
