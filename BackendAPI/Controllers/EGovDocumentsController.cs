using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>E-Devlet kutuları: e-Fatura / e-Arşiv / e-İrsaliye gelen-giden-arşiv listeleri.</summary>
[ApiController]
[Route("api/egov/documents")]
public sealed class EGovDocumentsController : ControllerBase
{
    private readonly EGovDocumentRepository _repo;

    public EGovDocumentsController(EGovDocumentRepository repo)
    {
        _repo = repo;
    }

    /// <summary>docKind: 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye — direction: 1 Gelen · 2 Giden</summary>
    [HttpGet]
    public async Task<ActionResult<EGovDocumentListResult>> List(
        [FromQuery] byte docKind,
        [FromQuery] byte direction,
        [FromQuery] bool archived = false,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] int take = 500,
        CancellationToken ct = default)
    {
        if (docKind is < 1 or > 3 || direction is < 1 or > 2)
            return BadRequest(new { message = "docKind 1-3, direction 1-2 olmalı" });
        try
        {
            return Ok(await _repo.ListAsync(new EGovDocumentListQuery
            {
                DocKind = docKind,
                Direction = direction,
                Archived = archived,
                From = from,
                To = to,
                Search = search,
                Status = status,
                Take = take,
            }, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
