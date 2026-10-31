using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/doc-files")]
public sealed class DocumentFilesController : ControllerBase
{
    private readonly DocumentFileService _svc;

    public DocumentFilesController(DocumentFileService svc) => _svc = svc;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string table, [FromQuery] int id, CancellationToken ct)
    {
        try
        {
            return Ok(await _svc.ListAsync(table, id, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    [RequestSizeLimit(DocumentFileService.MaxBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = DocumentFileService.MaxBytes)]
    public async Task<IActionResult> Upload(
        [FromQuery] string table,
        [FromQuery] int id,
        IFormFile? file,
        [FromForm] string? title,
        [FromForm] string? note,
        CancellationToken ct)
    {
        try
        {
            if (file is null) return BadRequest(new { message = "Dosya gerekli." });
            var row = await _svc.UploadAsync(table, id, file, User.UserId(), title, note, ct);
            return Ok(row);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{fileId:int}/download")]
    public async Task<IActionResult> Download(int fileId, CancellationToken ct)
    {
        try
        {
            var file = await _svc.OpenAsync(fileId, ct);
            if (file is null) return NotFound(new { message = "Dosya bulunamadı." });
            return File(file.Value.Content, file.Value.ContentType, file.Value.FileName);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpDelete("{fileId:int}")]
    public async Task<IActionResult> Delete(int fileId, CancellationToken ct)
    {
        try
        {
            var ok = await _svc.DeleteAsync(fileId, ct);
            if (!ok) return NotFound(new { message = "Dosya bulunamadı." });
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
