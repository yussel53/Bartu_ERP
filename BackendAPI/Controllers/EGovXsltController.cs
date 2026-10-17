using System.Text;
using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

public sealed class EGovXsltUpdateDto
{
    public string Title { get; set; } = "";
    public int? CompanyId { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public sealed class EGovXsltDefaultDto
{
    public bool IsDefault { get; set; } = true;
}

/// <summary>E-Devlet → Tanımlar → XSLT Tasarımları (e-Fatura / e-Arşiv / e-İrsaliye görünüm şablonları).</summary>
[ApiController]
[Route("api/egov/xslt")]
public sealed class EGovXsltController : ControllerBase
{
    private readonly EGovXsltRepository _repo;

    public EGovXsltController(EGovXsltRepository repo)
    {
        _repo = repo;
    }

    /// <summary>docKind: 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye</summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] byte docKind, CancellationToken ct)
    {
        if (!ValidKind(docKind)) return BadRequest(new { message = "docKind 1-3 olmalı" });
        if (!await _repo.ReadyAsync(ct)) return Ok(new { ready = false, message = EGovXsltRepository.MissingTableMessage, rows = Array.Empty<object>() });
        return Ok(new { ready = true, rows = await _repo.ListAsync(docKind, ct) });
    }

    [HttpPost]
    [RequestSizeLimit(EGovXsltService.MaxXsltBytes + 64_000)]
    public async Task<IActionResult> Upload(
        [FromForm] byte docKind,
        [FromForm] string? title,
        [FromForm] int? companyId,
        [FromForm] bool isDefault,
        [FromForm] string? notes,
        IFormFile? file,
        CancellationToken ct)
    {
        if (!ValidKind(docKind)) return BadRequest(new { message = "docKind 1-3 olmalı" });
        if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovXsltRepository.MissingTableMessage });
        var (content, error) = await ReadXsltAsync(file, ct);
        if (error != null) return BadRequest(new { message = error });

        var name = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file!.FileName) : title.Trim();
        if (name.Length > 150) name = name[..150];
        var id = await _repo.CreateAsync(docKind, NullIfZero(companyId), name, file!.FileName,
            content!, EGovXsltService.Sha256Hex(content!), isDefault, notes?.Trim(), ct);
        return Ok(new { success = true, id, message = $"«{name}» yüklendi." });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] EGovXsltUpdateDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) return BadRequest(new { message = "Tasarım adı zorunlu." });
        var ok = await _repo.UpdateAsync(id, dto.Title.Trim(), NullIfZero(dto.CompanyId), dto.IsActive, dto.Notes?.Trim(), ct);
        return ok ? Ok(new { success = true }) : NotFound(new { message = $"Şablon #{id} bulunamadı." });
    }

    [HttpPost("{id:int}/content")]
    [RequestSizeLimit(EGovXsltService.MaxXsltBytes + 64_000)]
    public async Task<IActionResult> ReplaceContent(int id, IFormFile? file, CancellationToken ct)
    {
        var (content, error) = await ReadXsltAsync(file, ct);
        if (error != null) return BadRequest(new { message = error });
        var ok = await _repo.ReplaceContentAsync(id, file!.FileName, content!, EGovXsltService.Sha256Hex(content!), ct);
        return ok ? Ok(new { success = true, message = "XSLT dosyası değiştirildi." }) : NotFound(new { message = $"Şablon #{id} bulunamadı." });
    }

    [HttpPost("{id:int}/default")]
    public async Task<IActionResult> SetDefault(int id, [FromBody] EGovXsltDefaultDto dto, CancellationToken ct)
    {
        var (ok, message) = await _repo.SetDefaultAsync(id, dto.IsDefault, ct);
        return ok ? Ok(new { success = true, message }) : BadRequest(new { message });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var ok = await _repo.DeleteAsync(id, ct);
        return ok ? Ok(new { success = true }) : NotFound(new { message = $"Şablon #{id} bulunamadı." });
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        var t = await _repo.GetContentAsync(id, ct);
        if (t is null) return NotFound(new { message = $"Şablon #{id} bulunamadı." });
        var fileName = string.IsNullOrWhiteSpace(t.FileName) ? $"tasarim-{id}.xslt" : t.FileName;
        return File(Encoding.UTF8.GetBytes(t.XsltContent), "application/xslt+xml", fileName);
    }

    /// <summary>
    /// HTML önizleme. egovDocumentId verilirse o belgenin UBL'i (EGovDocument.XmlContent),
    /// verilmezse belge türüne uygun örnek UBL kullanılır.
    /// </summary>
    [HttpGet("{id:int}/preview")]
    public async Task<IActionResult> Preview(int id, [FromQuery] int? egovDocumentId, CancellationToken ct)
    {
        var t = await _repo.GetContentAsync(id, ct);
        if (t is null) return NotFound(new { message = $"Şablon #{id} bulunamadı." });

        var xml = EGovXsltService.SampleXml(t.DocKind);
        if (egovDocumentId is int docId && docId > 0)
        {
            xml = await _repo.GetSampleXmlAsync(docId, ct) ?? "";
            if (string.IsNullOrWhiteSpace(xml))
                return BadRequest(new { message = $"e-Belge #{docId} için kayıtlı UBL/XML yok." });
        }
        try
        {
            var html = EGovXsltService.Transform(t.XsltContent, xml);
            // Doğrudan açılırsa da opak kökende çalışsın: QR kod script'i çalışır, uygulama kökenine erişemez
            Response.Headers["Content-Security-Policy"] = "sandbox allow-scripts";
            return Content(html, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Gönderimde kullanılacak tasarım (firma varsayılanı → genel varsayılan → e-Logo varsayılanı).</summary>
    [HttpGet("resolve")]
    public async Task<IActionResult> Resolve([FromQuery] byte docKind, [FromQuery] int? companyId, CancellationToken ct)
    {
        if (!ValidKind(docKind)) return BadRequest(new { message = "docKind 1-3 olmalı" });
        if (!await _repo.ReadyAsync(ct)) return Ok(new { found = false, message = EGovXsltRepository.MissingTableMessage });
        var t = await _repo.ResolveAsync(docKind, NullIfZero(companyId), ct);
        return Ok(t is null
            ? new { found = false, id = (int?)null, title = (string?)null, message = (string?)"Varsayılan tasarım yok — e-Logo varsayılan tasarımı kullanılır." }
            : new { found = true, id = (int?)t.EGovXsltTemplateID, title = (string?)t.Title, message = (string?)null });
    }

    private static async Task<(string? Content, string? Error)> ReadXsltAsync(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return (null, "XSLT dosyası gerekli.");
        if (file.Length > EGovXsltService.MaxXsltBytes)
            return (null, $"Dosya çok büyük (en fazla {EGovXsltService.MaxXsltBytes / 1024 / 1024} MB).");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".xslt" or ".xsl" or ".xml"))
            return (null, "Yalnızca .xslt / .xsl dosyası yüklenebilir.");
        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var content = EGovXsltService.ReadText(ms.ToArray());
        var error = EGovXsltService.Validate(content);
        return error != null ? (null, error) : (content, null);
    }

    private static bool ValidKind(byte docKind) => docKind is >= 1 and <= 3;

    private static int? NullIfZero(int? v) => v is > 0 ? v : null;
}
