using System.Text;
using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

public sealed class EGovDesignUpdateDto
{
    public string Title { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    /// <summary>EFATURA · EARSIV · EIRSALIYE · EMM · ESMM (boş = değişmez)</summary>
    public string? DocGroup { get; set; }
    /// <summary>true: içerikle uyuşmayan belge grubu yine de kaydedilir</summary>
    public bool Force { get; set; }
}

/// <summary>E-Devlet → Tanımlar → Tasarım Şablonları → Tasarımlar (XSLT kütüphanesi).</summary>
[ApiController]
[Route("api/egov/designs")]
public sealed class EGovDesignsController : ControllerBase
{
    private readonly EGovDesignRepository _repo;

    public EGovDesignsController(EGovDesignRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!await _repo.ReadyAsync(ct))
            return Ok(new { ready = false, message = EGovDesignRepository.MissingTableMessage, rows = Array.Empty<object>() });
        return Ok(new { ready = true, rows = await _repo.ListDesignsAsync(ct) });
    }

    [HttpPost]
    [RequestSizeLimit(EGovXsltService.MaxXsltBytes + 64_000)]
    public async Task<IActionResult> Upload([FromForm] string? title, [FromForm] string? notes, [FromForm] string? docGroup, [FromForm] bool force,
        IFormFile? file, CancellationToken ct)
    {
        if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovDesignRepository.MissingTableMessage });
        var (content, error) = await ReadXsltAsync(file, ct);
        if (error != null) return BadRequest(new { message = error });

        var name = string.IsNullOrWhiteSpace(title) ? file!.FileName : title.Trim();
        if (name.Length > 150) name = name[..150];
        var group = string.IsNullOrWhiteSpace(docGroup) ? EGovDesignCodes.GuessDocGroup($"{name} {file!.FileName}", content!) : docGroup.Trim().ToUpperInvariant();
        if (!EGovDesignCodes.DocGroups.ContainsKey(group)) return BadRequest(new { message = "Geçersiz belge grubu." });
        if (!force && Mismatch(content!, group) is { } mismatch) return mismatch;
        var id = await _repo.CreateDesignAsync(name, file!.FileName, content!, EGovXsltService.Sha256Hex(content!), notes?.Trim(), group, ct);
        return Ok(new { success = true, id, message = $"«{name}» yüklendi." });
    }

    /// <summary>GİB standart görünümlerini (e-Fatura, e-Arşiv, e-İrsaliye) kütüphaneye ekler; aynısı varsa atlar</summary>
    [HttpPost("standard")]
    public async Task<IActionResult> LoadStandard(CancellationToken ct)
    {
        if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovDesignRepository.MissingTableMessage });
        var added = new List<string>();
        var skipped = new List<string>();
        foreach (var item in EGovStandardDesigns.Items)
        {
            var content = EGovStandardDesigns.Read(item.File);
            var hash = EGovXsltService.Sha256Hex(content);
            if (await _repo.ExistsAsync(hash, item.DocGroup, ct))
            {
                skipped.Add(item.Title);
                continue;
            }
            if (EGovXsltService.Validate(content) is { } error)
                return BadRequest(new { message = $"{item.Title}: {error}" });
            await _repo.CreateDesignAsync(item.Title, item.File, content, hash, EGovStandardDesigns.Notes, item.DocGroup, ct);
            added.Add(item.Title);
        }
        var message = added.Count > 0
            ? $"Yüklendi: {string.Join(", ", added)}." + (skipped.Count > 0 ? $" Zaten vardı: {string.Join(", ", skipped)}." : "")
            : "Standart şablonların hepsi zaten yüklü.";
        return Ok(new { success = true, added = added.Count, skipped = skipped.Count, message });
    }

    /// <summary>Kayıtlı tasarımın içerikten anlaşılan belge grupları (EFATURA · EARSIV · EIRSALIYE)</summary>
    [HttpGet("{id:int}/doc-groups")]
    public async Task<IActionResult> DocGroups(int id, CancellationToken ct)
    {
        var t = await _repo.GetDesignAsync(id, ct);
        if (t is null) return NotFound(new { message = $"Tasarım #{id} bulunamadı." });
        return Ok(new { groups = EGovXsltService.DetectDocGroups(t.XsltContent) });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] EGovDesignUpdateDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Title)) return BadRequest(new { message = "Tasarım adı zorunlu." });
        var group = string.IsNullOrWhiteSpace(dto.DocGroup) ? null : dto.DocGroup.Trim().ToUpperInvariant();
        if (group != null)
        {
            if (!EGovDesignCodes.DocGroups.ContainsKey(group)) return BadRequest(new { message = "Geçersiz belge grubu." });
            if (await _repo.DocGroupConflictAsync(id, group, ct) is { } conflict) return BadRequest(new { message = conflict });
            if (!dto.Force && await _repo.GetDesignAsync(id, ct) is { } cur && cur.DocGroup != group && Mismatch(cur.XsltContent, group) is { } mismatch)
                return mismatch;
        }
        var ok = await _repo.UpdateDesignAsync(id, dto.Title.Trim(), dto.IsActive, dto.Notes?.Trim(), group, ct);
        return ok ? Ok(new { success = true, message = "Tasarım güncellendi." }) : NotFound(new { message = $"Tasarım #{id} bulunamadı." });
    }

    [HttpPost("{id:int}/content")]
    [RequestSizeLimit(EGovXsltService.MaxXsltBytes + 64_000)]
    public async Task<IActionResult> ReplaceContent(int id, IFormFile? file, [FromForm] bool force, CancellationToken ct)
    {
        var (content, error) = await ReadXsltAsync(file, ct);
        if (error != null) return BadRequest(new { message = error });
        if (!force && await _repo.GetDesignAsync(id, ct) is { DocGroup: { } g } && Mismatch(content!, g) is { } mismatch) return mismatch;
        var ok = await _repo.ReplaceContentAsync(id, file!.FileName, content!, EGovXsltService.Sha256Hex(content!), ct);
        return ok ? Ok(new { success = true, message = "XSLT dosyası değiştirildi." }) : NotFound(new { message = $"Tasarım #{id} bulunamadı." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var (ok, message) = await _repo.DeleteDesignAsync(id, ct);
        return ok ? Ok(new { success = true, message }) : BadRequest(new { message });
    }

    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        var t = await _repo.GetDesignAsync(id, ct);
        if (t is null) return NotFound(new { message = $"Tasarım #{id} bulunamadı." });
        var fileName = string.IsNullOrWhiteSpace(t.FileName) ? $"tasarim-{id}.xslt" : t.FileName;
        return File(Encoding.UTF8.GetBytes(t.XsltContent), "application/xslt+xml", fileName);
    }

    /// <summary>
    /// HTML önizleme. egovDocumentId → o belgenin UBL'i; yoksa sample (invoice | earsiv | despatch),
    /// o da yoksa tasarımdan tahmin edilen örnek.
    /// </summary>
    [HttpGet("{id:int}/preview")]
    public async Task<IActionResult> Preview(int id, [FromQuery] string? sample, [FromQuery] int? egovDocumentId, CancellationToken ct)
    {
        var t = await _repo.GetDesignAsync(id, ct);
        if (t is null) return NotFound(new { message = $"Tasarım #{id} bulunamadı." });

        string xml;
        if (egovDocumentId is int docId && docId > 0)
        {
            xml = await _repo.GetEgovXmlAsync(docId, ct) ?? "";
            if (string.IsNullOrWhiteSpace(xml))
                return BadRequest(new { message = $"e-Belge #{docId} için kayıtlı UBL/XML yok." });
        }
        else
        {
            // Otomatik örnek tasarımın belge türüne göre: e-Arşiv tasarımı EARSIVFATURA örneğiyle önizlenir
            var auto = t.DocGroup switch
            {
                "EARSIV" => "earsiv",
                "EIRSALIYE" => "despatch",
                _ => EGovXsltService.DetectSampleKind(t.XsltContent),
            };
            xml = EGovXsltService.SampleXml(string.IsNullOrWhiteSpace(sample) ? auto : sample);
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

    /// <summary>Seçilen dosyanın içerikten anlaşılan belge grupları ve önerilen grup (yükleme ekranı için)</summary>
    [HttpPost("detect")]
    [RequestSizeLimit(EGovXsltService.MaxXsltBytes + 64_000)]
    public async Task<IActionResult> Detect(IFormFile? file, CancellationToken ct)
    {
        var (content, error) = await ReadXsltAsync(file, ct);
        if (error != null) return BadRequest(new { message = error });
        var groups = EGovXsltService.DetectDocGroups(content!);
        var suggested = groups.Count == 1 ? groups[0]
            : groups.Contains("EFATURA") && groups.Contains("EARSIV")
                ? EGovDesignCodes.GuessDocGroup(file!.FileName, content!) is "EARSIV" ? "EARSIV" : "EFATURA"
                : EGovDesignCodes.GuessDocGroup(file!.FileName, content!);
        return Ok(new { groups, suggested });
    }

    /// <summary>
    /// İçerik seçilen grupla uyuşmuyorsa 409 (istemci «yine de» onayıyla force gönderir).
    /// İçerikten grup anlaşılamazsa (e-Müstahsil vb.) denetlenmez.
    /// </summary>
    private ConflictObjectResult? Mismatch(string xslt, string group)
    {
        var detected = EGovXsltService.DetectDocGroups(xslt);
        if (detected.Count == 0 || detected.Contains(group)) return null;
        var names = string.Join(" / ", detected.Select(g => EGovDesignCodes.DocGroups.GetValueOrDefault(g, g)));
        return Conflict(new
        {
            code = "docgroup-mismatch",
            detected,
            message = $"Bu XSLT içerikten bakıldığında bir {names} tasarımı; {EGovDesignCodes.DocGroups[group]} olarak kaydedilirse "
                      + "şablonlarda yanlış belgede kullanılabilir.",
        });
    }

    private static async Task<(string? Content, string? Error)> ReadXsltAsync(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return (null, "XSLT dosyası gerekli.");
        if (file.Length > EGovXsltService.MaxXsltBytes)
            return (null, $"Dosya çok büyük (en fazla {EGovXsltService.MaxXsltBytes / 1024 / 1024} MB).");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".xslt" or ".xsl"))
            return (null, "Yalnızca .xslt / .xsl dosyası yüklenebilir.");
        await using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var content = EGovXsltService.ReadText(ms.ToArray());
        var error = EGovXsltService.Validate(content);
        return error != null ? (null, error) : (content, null);
    }
}
