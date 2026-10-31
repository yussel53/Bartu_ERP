using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/process")]
public sealed class ProcessController : ControllerBase
{
    private readonly ProcessRepository _repo;

    public ProcessController(ProcessRepository repo) => _repo = repo;

    [HttpGet("defs")]
    public async Task<IActionResult> ListDefs([FromQuery] bool includeInactive, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ListDefsAsync(includeInactive, ct));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(new { needsUpdate = true, message = ex.Message, items = Array.Empty<object>() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("defs/{id:int}")]
    public async Task<IActionResult> GetDef(int id, CancellationToken ct)
    {
        try
        {
            var def = await _repo.GetDefAsync(id, ct);
            return def is null ? NotFound(new { message = "Süreç bulunamadı." }) : Ok(def);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("defs")]
    public async Task<IActionResult> SaveDef([FromBody] ProcessDefDto dto, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.SaveDefAsync(dto, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("defs/{id:int}")]
    public async Task<IActionResult> DeleteDef(int id, CancellationToken ct)
    {
        try
        {
            await _repo.DeleteDefAsync(id, ct);
            return Ok(new { ok = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("instances")]
    public async Task<IActionResult> ListInstances([FromQuery] string? status, [FromQuery] int take = 100, CancellationToken ct = default)
    {
        try
        {
            return Ok(await _repo.ListInstancesAsync(status, take, ct));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(new { needsUpdate = true, message = ex.Message, items = Array.Empty<object>() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("inbox")]
    public async Task<IActionResult> Inbox([FromQuery] int userId, CancellationToken ct)
    {
        try
        {
            if (userId <= 0) return BadRequest(new { message = "userId zorunlu." });
            return Ok(await _repo.InboxAsync(userId, ct));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(new { needsUpdate = true, message = ex.Message, items = Array.Empty<object>() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    public sealed class SelectColumnsRequest
    {
        public string? Sql { get; set; }
    }

    [HttpPost("columns")]
    public async Task<IActionResult> Columns([FromBody] SelectColumnsRequest body, CancellationToken ct)
    {
        try
        {
            var columns = await _repo.DescribeSelectAsync(body.Sql ?? "", ct);
            return Ok(new { columns });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("source/test")]
    public async Task<IActionResult> SourceTest([FromBody] ProcessSourceRequest body, CancellationToken ct)
    {
        try
        {
            return Ok(await ProcessSource.TestAsync(body, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { ok = false, message = ex.Message, databases = Array.Empty<string>() });
        }
    }

    [HttpPost("source/columns")]
    public async Task<IActionResult> SourceColumns([FromBody] ProcessSourceRequest body, CancellationToken ct)
    {
        try
        {
            if (body.SourceType == 0)
                return Ok(new { columns = await _repo.DescribeSelectAsync(body.Sql ?? "", ct) });
            return Ok(new { columns = await ProcessSource.ColumnsAsync(body, ct) });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("bank/columns")]
    public async Task<IActionResult> BankColumns([FromBody] ProcessBank.Request body, CancellationToken ct)
    {
        try
        {
            return Ok(new { columns = await _repo.DescribeBankAsync(body, ct) });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("scan")]
    public async Task<IActionResult> Scan([FromQuery] int? defId, CancellationToken ct)
    {
        try
        {
            var startedBy = User.UserId() > 0 ? User.UserId() : (int?)null;
            return Ok(await _repo.RunDbScansAsync(defId, startedBy, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] ProcessStartRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.StartAsync(req, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Tetik tipine göre eşleşen aktif Onay Tanımlarını başlatır
    /// (fiş kaydı, e-belge, kart ekleme vb.).
    /// </summary>
    [HttpPost("start-by-trigger")]
    public async Task<IActionResult> StartByTrigger([FromBody] ProcessTriggerStartRequest req, CancellationToken ct)
    {
        try
        {
            if (req.TriggerType <= 0)
                return BadRequest(new { message = "TriggerType zorunlu." });
            if (string.IsNullOrWhiteSpace(req.SourceTable) || req.SourceId <= 0)
                return BadRequest(new { message = "SourceTable ve SourceId zorunlu." });
            var started = await _repo.StartByTriggerAsync(req, ct);
            return Ok(new { ok = true, count = started.Count, items = started });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("tasks/{taskId:int}/approve")]
    public async Task<IActionResult> Approve(int taskId, [FromBody] ProcessTaskActionRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ApproveTaskAsync(taskId, req, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("tasks/{taskId:int}/reject")]
    public async Task<IActionResult> Reject(int taskId, [FromBody] ProcessTaskActionRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.RejectTaskAsync(taskId, req, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("transfer-talep")]
    public async Task<IActionResult> TransferTalep([FromBody] TalepTransferRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.TransferTalepAsync(req, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("link-egov")]
    public async Task<IActionResult> LinkEgov([FromBody] EgovLinkRequest req, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.LinkEgovAsync(req, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("egov/{id:int}/pdf")]
    [RequestSizeLimit(32_000_000)]
    public async Task<IActionResult> UploadPdf(int id, IFormFile file, CancellationToken ct)
    {
        try
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "PDF dosyası gerekli." });
            await using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            var ctType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/pdf" : file.ContentType;
            await _repo.SaveEgovPdfAsync(id, ms.ToArray(), file.FileName, ctType, ct);
            return Ok(new { ok = true, fileName = file.FileName, size = file.Length });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("egov/{id:int}/pdf")]
    public async Task<IActionResult> DownloadPdf(int id, CancellationToken ct)
    {
        try
        {
            var pdf = await _repo.GetEgovPdfAsync(id, ct);
            if (pdf is null) return NotFound(new { message = "PDF bulunamadı." });
            return File(pdf.Value.Content, pdf.Value.ContentType, pdf.Value.FileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpGet("links")]
    public async Task<IActionResult> Links([FromQuery] string? table, [FromQuery] int? id, CancellationToken ct)
    {
        try
        {
            return Ok(await _repo.ListLinksAsync(table, id, ct));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(new { needsUpdate = true, message = ex.Message, items = Array.Empty<object>() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
