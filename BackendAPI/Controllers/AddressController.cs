using System.Data;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/address")]
public sealed class AddressController : ControllerBase
{
    private readonly AddressSeedService _seed;
    private readonly IDbConnection _db;

    public AddressController(AddressSeedService seed, IDbConnection db)
    {
        _seed = seed;
        _db = db;
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
        => Ok(await _seed.StatusAsync(_db, ct));

    /// <summary>TurkiyeAPI JSON → SYS_Province / District / Neighborhood (tam yenileme)</summary>
    [HttpPost("seed")]
    public async Task<ActionResult<AddressSeedResult>> Seed(CancellationToken ct)
    {
        try
        {
            var result = await _seed.SeedAsync(_db, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new AddressSeedResult
            {
                Success = false,
                Message = ex.Message,
            });
        }
    }
}
