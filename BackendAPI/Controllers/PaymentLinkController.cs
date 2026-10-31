using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/payment-link")]
public sealed class PaymentLinkController : ControllerBase
{
    private readonly PaymentLinkService _svc;

    public PaymentLinkController(PaymentLinkService svc) => _svc = svc;

    /// <summary>Kayıtlı cari fiş için ödeme linki üret (iyzico / manuel).</summary>
    [HttpPost("generate/{customerVoucherId:int}")]
    public async Task<IActionResult> Generate(int customerVoucherId, CancellationToken ct)
    {
        var baseUrl =
            $"{Request.Scheme}://{Request.Host}{Request.PathBase}".TrimEnd('/');
        var r = await _svc.GenerateAsync(customerVoucherId, baseUrl, ct);
        if (!r.Ok) return BadRequest(new { success = false, message = r.Message });
        return Ok(new
        {
            success = true,
            message = r.Message,
            url = r.Url,
            token = r.Token,
            provider = r.Provider,
            status = r.Status,
        });
    }
}
