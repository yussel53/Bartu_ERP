using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-09: belgeden muhasebe fişi — tek belge, bekleyen liste ve toplu muhasebeleştirme.</summary>
[ApiController]
[Route("api/accounting")]
public sealed class AccountingController : ControllerBase
{
    private readonly AccountingPostService _post;

    public AccountingController(AccountingPostService post)
    {
        _post = post;
    }

    /// <summary>source: invoice | safevoucher</summary>
    [HttpPost("post/{source}/{id:int}")]
    public async Task<IActionResult> Post(string source, int id, CancellationToken ct)
    {
        var r = await _post.PostAsync(source, id, ct);
        return r.Success ? Ok(r) : BadRequest(r);
    }

    [HttpGet("pending")]
    public async Task<IActionResult> Pending([FromQuery] DateTime? from, [FromQuery] DateTime? to) =>
        Ok(await _post.PendingAsync(from, to));

    [HttpPost("post-pending")]
    public async Task<IActionResult> PostPending([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var ok = 0;
        var errors = new List<string>();
        foreach (var row in await _post.PendingAsync(from, to))
        {
            string source = row.Source;
            int id = row.Id;
            var r = await _post.PostAsync(source, id, ct);
            if (r.Success) ok++;
            else errors.Add($"{(source == "invoice" ? "Fatura" : "Kasa fişi")} {row.DocumentNumber ?? id.ToString()}: {r.Message}");
        }
        return Ok(new { posted = ok, failed = errors.Count, errors = errors.Take(50) });
    }
}
