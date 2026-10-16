using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Müşteri → Cari dönüşümü (liste sağ tık «Cariye Dönüştür»).</summary>
[ApiController]
[Route("api/customers")]
public sealed class CustomerKindController : ControllerBase
{
    private readonly CustomerKindRepository _repo;

    public CustomerKindController(CustomerKindRepository repo)
    {
        _repo = repo;
    }

    [HttpPost("{id:int}/to-cari")]
    public async Task<IActionResult> ToCari(int id, CancellationToken ct)
    {
        try
        {
            var (changed, message) = await _repo.ToCariAsync(id, ct);
            return Ok(new { success = changed, message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
}
