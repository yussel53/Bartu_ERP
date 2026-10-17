using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Malzeme barkodları — benzersizlik kontrolü ve okutulan barkodu çözme (birim barkodu dahil).</summary>
[ApiController]
[Route("api/barcodes")]
public sealed class BarcodesController : ControllerBase
{
    private readonly BarcodeRepository _repo;

    public BarcodesController(BarcodeRepository repo)
    {
        _repo = repo;
    }

    public sealed class CheckRequest
    {
        public int ProductId { get; set; }
        public List<Dictionary<string, object?>> Barcodes { get; set; } = new();
    }

    /// <summary>Kart üzerindeki barkodlar için anlık kontrol (kaydetmeden)</summary>
    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] CheckRequest req)
    {
        try
        {
            return Ok(await _repo.ValidateAsync(req.ProductId, req.Barcodes));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>Barkod → malzeme (+ birim barkodunda miktar)</summary>
    [HttpGet("resolve")]
    public async Task<IActionResult> Resolve([FromQuery] string code)
    {
        try
        {
            return Ok(await _repo.ResolveAsync(code));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
