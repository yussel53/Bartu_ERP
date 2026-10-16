using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Kart sağ tık menüsü: Ekstre / Hareketler / ek bölümler.</summary>
[ApiController]
[Route("api/card-statement")]
public sealed class CardStatementController : ControllerBase
{
    private readonly CardStatementRepository _repo;

    public CardStatementController(CardStatementRepository repo)
    {
        _repo = repo;
    }

    [HttpGet("{kind}/{id:int}")]
    public async Task<ActionResult<CardStatementResult>> Get(
        string kind,
        int id,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        CancellationToken ct = default)
    {
        try
        {
            return Ok(await _repo.GetAsync(kind, id, from, to, ct));
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
}
