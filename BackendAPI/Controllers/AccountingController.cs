using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Y-09: muhasebe havuzu, parametreler, belge → muhasebe fişi.</summary>
[ApiController]
[Route("api/accounting")]
public sealed class AccountingController : ControllerBase
{
    private readonly AccountingPostService _post;

    public AccountingController(AccountingPostService post)
    {
        _post = post;
    }

    /// <summary>source: invoice | safevoucher — havuza yazıp muhasebeleştirir</summary>
    [HttpPost("post/{source}/{id:int}")]
    public async Task<IActionResult> Post(string source, int id, CancellationToken ct)
    {
        var r = await _post.PostAsync(source, id, ct);
        return r.Success ? Ok(r) : BadRequest(r);
    }

    /// <summary>Muhasebe fişi var mı (kilit için)</summary>
    [HttpGet("status/{source}/{id:int}")]
    public async Task<IActionResult> Status(string source, int id) =>
        Ok(await _post.StatusAsync(source, id));

    /// <summary>Muhasebe fişini geri al (yevmiye numarası yoksa)</summary>
    [HttpPost("unpost/{source}/{id:int}")]
    public async Task<IActionResult> Unpost(string source, int id)
    {
        var err = await _post.UnpostAsync(source, id);
        if (err != null) return BadRequest(new { message = err });
        return Ok(new { message = "Muhasebe fişi geri alındı" });
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
            int id = (int)row.Id;
            int? poolId = null;
            try { poolId = (int?)row.AccPoolID; } catch { /* eski satır */ }
            AccountingPostResult r;
            if (poolId is int pid && pid > 0)
                r = await _post.PostPoolAsync(pid, ct);
            else
                r = await _post.PostAsync(source, id, ct);
            if (r.Success) ok++;
            else errors.Add($"{(source == "invoice" ? "Fatura" : "Kasa fişi")} {row.DocumentNumber ?? id.ToString()}: {r.Message}");
        }
        return Ok(new { posted = ok, failed = errors.Count, errors = errors.Take(50) });
    }

    [HttpGet("pool")]
    public async Task<IActionResult> Pool(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int? status) =>
        Ok(await _post.PoolListAsync(from, to, status));

    [HttpGet("pool/{id:int}/lines")]
    public async Task<IActionResult> PoolLines(int id) => Ok(await _post.PoolLinesAsync(id));

    [HttpPost("pool/{id:int}/post")]
    public async Task<IActionResult> PostPool(int id, CancellationToken ct)
    {
        var r = await _post.PostPoolAsync(id, ct);
        return r.Success ? Ok(r) : BadRequest(r);
    }

    [HttpPost("pool/{id:int}/rebuild")]
    public async Task<IActionResult> RebuildPool(int id, CancellationToken ct)
    {
        var r = await _post.RebuildPoolAsync(id, ct);
        return r.Success || r.Missing.Count > 0 ? Ok(r) : BadRequest(r);
    }

    public sealed class PoolPostBody
    {
        public int[]? Ids { get; set; }
    }

    [HttpPost("pool/post-selected")]
    public async Task<IActionResult> PostSelected([FromBody] PoolPostBody body, CancellationToken ct)
    {
        var ids = body.Ids ?? Array.Empty<int>();
        if (ids.Length == 0) return BadRequest(new { message = "Kayıt seçilmedi." });
        var (posted, errors) = await _post.PostPoolManyAsync(ids, ct);
        return Ok(new { posted, failed = errors.Count, errors = errors.Take(50) });
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfig() => Ok(await _post.GetConfigAsync());

    [HttpPut("config")]
    public async Task<IActionResult> SaveConfig([FromBody] AccPoolConfig cfg)
    {
        await _post.SaveConfigAsync(cfg);
        return Ok(await _post.GetConfigAsync());
    }
}
