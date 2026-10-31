using System.Data;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/banks")]
public sealed class BankCatalogController : ControllerBase
{
    private readonly BankSeedService _seed;
    private readonly IDbConnection _db;

    public BankCatalogController(BankSeedService seed, IDbConnection db)
    {
        _seed = seed;
        _db = db;
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct)
        => Ok(await _seed.StatusAsync(_db, ct));

    /// <summary>tr-banks JSON → SYS_Bank / SYS_BankBranch</summary>
    [HttpPost("seed")]
    public async Task<ActionResult<BankSeedResult>> Seed(CancellationToken ct)
    {
        try
        {
            var result = await _seed.SeedAsync(_db, ct);
            if (!result.Success && string.IsNullOrEmpty(result.Message) == false && result.Banks == 0)
                return BadRequest(result);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new BankSeedResult
            {
                Success = false,
                Message = ex.Message,
            });
        }
    }
}
