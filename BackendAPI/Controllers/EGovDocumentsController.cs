using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>E-Devlet kutuları: e-Fatura / e-Arşiv / e-İrsaliye gelen-giden-arşiv listeleri.</summary>
[ApiController]
[Route("api/egov/documents")]
public sealed class EGovDocumentsController : ControllerBase
{
    private readonly EGovDocumentRepository _repo;
    private readonly EGovDesignRepository _designs;

    public EGovDocumentsController(EGovDocumentRepository repo, EGovDesignRepository designs)
    {
        _repo = repo;
        _designs = designs;
    }

    /// <summary>
    /// Belge görünümü (HTML): source=auto → UBL'e gömülü gönderen tasarımı, olmazsa Tasarım Şablonları öndeğeri.
    /// source=embedded | design ile zorlanabilir. Kullanılan tasarım X-View-Source başlığında döner.
    /// Gömülü XSLT dış kaynaklıdır: script / document() kapalı derlenir, yanıt CSP sandbox ile döner.
    /// </summary>
    [HttpGet("{id:int}/view")]
    public async Task<IActionResult> View(int id, [FromQuery] string? source, CancellationToken ct)
    {
        var d = await _repo.GetViewDataAsync(id, ct);
        if (d is null) return NotFound(new { message = $"e-Belge #{id} bulunamadı." });
        if (string.IsNullOrWhiteSpace(d.XmlContent))
            return NotFound(new { message = "Belgenin UBL/XML içeriği yok — görünüm oluşturulamaz (PDF varsa PDF sekmesini kullanın)." });

        var mode = (source ?? "auto").Trim().ToLowerInvariant();
        var errors = new List<string>();

        if (mode is "auto" or "embedded")
        {
            try
            {
                var embedded = EGovXsltService.ExtractEmbeddedXslt(d.XmlContent);
                if (embedded is { } e)
                    return Html(EGovXsltService.Transform(e.Xslt, d.XmlContent), $"embedded;{e.FileName}");
                errors.Add("Belgede gömülü tasarım yok.");
            }
            catch (Exception ex)
            {
                errors.Add($"Gömülü tasarım çalıştırılamadı: {ex.Message}");
            }
        }

        if (mode is "auto" or "design" && await _designs.ReadyAsync(ct))
        {
            // EGovDocument.DocKind → tasarım şablonu belge türü (1 e-Fatura · 3 e-Arşiv · 5 e-İrsaliye)
            short docType = d.DocKind switch { 2 => 3, 3 => 5, _ => 1 };
            var rule = await _designs.ResolveAsync(docType, new EGovDesignContext(), ct);
            if (rule is null)
            {
                errors.Add("Tasarım Şablonları'nda bu belge türü için öndeğer yok.");
            }
            else
            {
                var design = await _designs.GetDesignAsync(rule.EGovXsltDesignID, ct);
                try
                {
                    if (design != null)
                        return Html(EGovXsltService.Transform(design.XsltContent, d.XmlContent), $"design;{design.Title}");
                }
                catch (Exception ex)
                {
                    errors.Add($"«{design!.Title}» tasarımı çalıştırılamadı: {ex.Message}");
                }
            }
        }

        return BadRequest(new { message = string.Join(" ", errors) });
    }

    /// <summary>PDF'i tarayıcıda göstermek için (inline; indirme değil).</summary>
    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> Pdf(int id, CancellationToken ct)
    {
        var pdf = await _repo.GetPdfAsync(id, ct);
        if (pdf is null) return NotFound(new { message = "Bu belgenin PDF'i yok." });
        var name = string.IsNullOrWhiteSpace(pdf.PdfFileName) ? $"e-belge-{id}.pdf" : pdf.PdfFileName;
        Response.Headers.ContentDisposition = new System.Net.Mime.ContentDisposition { Inline = true, FileName = name }.ToString();
        return File(pdf.PdfContent, string.IsNullOrWhiteSpace(pdf.PdfContentType) ? "application/pdf" : pdf.PdfContentType);
    }

    private ContentResult Html(string html, string source)
    {
        // Gönderen tasarımı da dahil: script yalnız opak kökende (QR kod çizimi), uygulama kökenine erişemez
        Response.Headers["Content-Security-Policy"] = "sandbox allow-scripts";
        Response.Headers["X-View-Source"] = Uri.EscapeDataString(source);
        Response.Headers["Access-Control-Expose-Headers"] = "X-View-Source";
        return Content(html, "text/html; charset=utf-8");
    }

    /// <summary>docKind: 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye — direction: 1 Gelen · 2 Giden</summary>
    [HttpGet]
    public async Task<ActionResult<EGovDocumentListResult>> List(
        [FromQuery] byte docKind,
        [FromQuery] byte direction,
        [FromQuery] bool archived = false,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? stage = null,
        [FromQuery] int take = 500,
        CancellationToken ct = default)
    {
        if (docKind is < 1 or > 3 || direction is < 1 or > 2)
            return BadRequest(new { message = "docKind 1-3, direction 1-2 olmalı" });
        try
        {
            return Ok(await _repo.ListAsync(new EGovDocumentListQuery
            {
                DocKind = docKind,
                Direction = direction,
                Archived = archived,
                From = from,
                To = to,
                Search = search,
                Status = status,
                Stage = stage,
                Take = take,
            }, ct));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
