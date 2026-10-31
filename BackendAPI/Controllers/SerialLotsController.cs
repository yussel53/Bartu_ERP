using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/serial-lots")]
public sealed class SerialLotsController : ControllerBase
{
    private readonly RecordsRepository _repo;

    public SerialLotsController(RecordsRepository repo) => _repo = repo;

    /// <summary>Çıkışta seçilebilecek stok: 1 lot · 2 seri · 3 seri grubu.</summary>
    [HttpGet("available")]
    public async Task<IActionResult> Available(
        [FromQuery] int productCardId,
        [FromQuery] byte kind,
        CancellationToken ct)
    {
        try
        {
            if (kind is not (1 or 2 or 3))
                return Ok(Array.Empty<SerialLotOptionDto>());
            return Ok(await _repo.ListAvailableSerialLotsAsync(productCardId, kind, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
