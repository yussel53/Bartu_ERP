using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/product-prices")]
public sealed class ProductPricesController : ControllerBase
{
    private readonly ProductPricesRepository _repo;

    public ProductPricesController(ProductPricesRepository repo)
    {
        _repo = repo;
    }

    /// <summary>
    /// Malzeme/hizmet için birim fiyat önerileri: liste, son alım/satış (cari), net.
    /// direction: sales | purchase
    /// </summary>
    [HttpGet("suggestions")]
    public async Task<ActionResult<ProductPriceSuggestionsDto>> Suggestions(
        [FromQuery] int productCardId,
        [FromQuery] int? customerId,
        [FromQuery] string? direction,
        CancellationToken ct)
    {
        try
        {
            if (productCardId <= 0)
                return BadRequest(new { message = "productCardId gerekli" });

            var data = await _repo.GetSuggestionsAsync(productCardId, customerId, direction, ct);
            return Ok(data);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
