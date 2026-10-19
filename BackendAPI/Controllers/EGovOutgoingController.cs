using System.Text;
using System.Text.RegularExpressions;
using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// E-03 giden e-fatura: faturadan UBL önizleme / indirme / doğrulama, gönderim (canlı adreste kilitli),
/// durum sorgusu ve firma bazında gönderim ayarları (seri önekleri, numara sayacı).
/// </summary>
[ApiController]
[Route("api/egov/outgoing")]
public sealed class EGovOutgoingController : ControllerBase
{
    private readonly EGovOutgoingService _svc;
    private readonly EGovOutgoingRepository _repo;
    private readonly DataScopeService _scope;

    public EGovOutgoingController(EGovOutgoingService svc, EGovOutgoingRepository repo, DataScopeService scope)
    {
        _svc = svc;
        _repo = repo;
        _scope = scope;
    }

    public sealed class SettingDto
    {
        public string? EInvoicePrefix { get; set; }
        public string? EArchivePrefix { get; set; }
        public string? EDespatchPrefix { get; set; }
        public string? DefaultProfile { get; set; }
        public string? EArchiveWebAddress { get; set; }
        public string? EArchiveSendType { get; set; }
    }

    public sealed class CounterDto
    {
        public string Prefix { get; set; } = "";
        public int Year { get; set; }
        public long LastValue { get; set; }
    }

    private static readonly Regex PrefixRx = new("^[A-Z0-9]{3}$");

    private static string? CleanPrefix(string? p, string label, out string? error)
    {
        error = null;
        if (string.IsNullOrWhiteSpace(p)) return null;
        var v = p.Trim().ToUpperInvariant();
        if (!PrefixRx.IsMatch(v)) error = $"{label} öneki 3 karakter (A–Z, 0–9) olmalı.";
        return v;
    }

    [HttpGet("settings/{companyId:int}")]
    public async Task<IActionResult> GetSettings(int companyId, CancellationToken ct)
    {
        var s = await _repo.GetSettingAsync(companyId, ct);
        var counters = await _repo.ListCountersAsync(companyId, ct);
        return Ok(new { setting = s, counters });
    }

    [HttpPut("settings/{companyId:int}")]
    [Authorize(Policy = AuthClaims.AdminPolicy)]
    public async Task<IActionResult> SaveSettings(int companyId, [FromBody] SettingDto dto, CancellationToken ct)
    {
        var s = new EGovSendSetting
        {
            CompanyId = companyId,
            EInvoicePrefix = CleanPrefix(dto.EInvoicePrefix, "e-Fatura", out var e1),
            EArchivePrefix = CleanPrefix(dto.EArchivePrefix, "e-Arşiv", out var e2),
            EDespatchPrefix = CleanPrefix(dto.EDespatchPrefix, "e-İrsaliye", out var e3),
            DefaultProfile = (dto.DefaultProfile ?? "TICARIFATURA").Trim().ToUpperInvariant(),
            EArchiveWebAddress = string.IsNullOrWhiteSpace(dto.EArchiveWebAddress) ? null : dto.EArchiveWebAddress.Trim(),
            EArchiveSendType = (dto.EArchiveSendType ?? "ELEKTRONIK").Trim().ToUpperInvariant(),
        };
        if ((e1 ?? e2 ?? e3) is { } err) return BadRequest(new { message = err });
        if (s.DefaultProfile is not ("TEMELFATURA" or "TICARIFATURA")) return BadRequest(new { message = "Senaryo TEMELFATURA ya da TICARIFATURA olmalı." });
        if (s.EArchiveSendType is not ("ELEKTRONIK" or "KAGIT")) return BadRequest(new { message = "Gönderim şekli ELEKTRONIK ya da KAGIT olmalı." });
        if (s.EInvoicePrefix != null && s.EInvoicePrefix == s.EArchivePrefix) return BadRequest(new { message = "e-Fatura ve e-Arşiv önekleri farklı olmalı." });
        await _repo.SaveSettingAsync(s, User.UserId() > 0 ? User.UserId() : null, ct);
        return Ok(new { message = "Kaydedildi." });
    }

    /// <summary>Sayaç başlangıcı: entegratörde son kullanılan numara (geri alınması numara çakışması yaratır)</summary>
    [HttpPut("settings/{companyId:int}/counter")]
    [Authorize(Policy = AuthClaims.AdminPolicy)]
    public async Task<IActionResult> SetCounter(int companyId, [FromBody] CounterDto dto, CancellationToken ct)
    {
        var p = (dto.Prefix ?? "").Trim().ToUpperInvariant();
        if (!PrefixRx.IsMatch(p)) return BadRequest(new { message = "Önek 3 karakter olmalı." });
        if (dto.Year < 2000 || dto.Year > 2100) return BadRequest(new { message = "Yıl hatalı." });
        if (dto.LastValue < 0 || dto.LastValue > 999_999_999) return BadRequest(new { message = "Sıra 0 – 999.999.999 arasında olmalı." });
        var cur = (await _repo.ListCountersAsync(companyId, ct)).FirstOrDefault(c => c.Prefix == p && c.Year == dto.Year);
        if (cur != null && dto.LastValue < cur.LastValue)
            return BadRequest(new { message = $"Sayaç geri alınamaz (şu an {cur.LastValue}); aynı numara iki kez kullanılır." });
        await _repo.SetCounterAsync(companyId, p, dto.Year, dto.LastValue, ct);
        return Ok(new { message = "Sayaç güncellendi." });
    }

    private async Task<IActionResult?> DenyAsync(int invoiceId, CancellationToken ct) =>
        await _scope.CanSeeRecordAsync("Invoice", "InvoiceID", invoiceId, ct) ? null : StatusCode(403, new { message = "Bu faturayı görme yetkiniz yok." });

    [HttpPost("invoice/{id:int}/preview")]
    public async Task<IActionResult> Preview(int id, [FromBody] OutgoingPrepareOptions? o, CancellationToken ct)
    {
        if (await DenyAsync(id, ct) is { } deny) return deny;
        try
        {
            var r = await _svc.PreviewAsync(id, o ?? new OutgoingPrepareOptions(), ct);
            // XML ayrı uçtan indirilir; yanıt hafif kalsın
            r.Xml = "";
            return Ok(r);
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("invoice/{id:int}/ubl")]
    public async Task<IActionResult> Ubl(int id, [FromBody] OutgoingPrepareOptions? o, CancellationToken ct)
    {
        if (await DenyAsync(id, ct) is { } deny) return deny;
        try
        {
            var opt = o ?? new OutgoingPrepareOptions();
            opt.Html = false;
            var r = await _svc.PreviewAsync(id, opt, ct);
            return File(new UTF8Encoding(false).GetBytes(r.Xml), "application/xml", $"{(r.InvoiceNoIsProjected ? "TASLAK-" : "")}{r.InvoiceNo}.xml");
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpPost("invoice/{id:int}/send")]
    public async Task<IActionResult> Send(int id, [FromBody] OutgoingPrepareOptions? o, CancellationToken ct)
    {
        if (await DenyAsync(id, ct) is { } deny) return deny;
        try
        {
            var r = await _svc.SendAsync(id, o ?? new OutgoingPrepareOptions(), User.UserId() > 0 ? User.UserId() : null, ct);
            r.Xml = "";
            return Ok(r);
        }
        catch (OutgoingSendBlockedException ex) { return Conflict(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    /// <summary>E-04: faturanın e-Arşiv bilgilerini kaydeder (gönderim şekli, e-posta, internet satışı)</summary>
    [HttpPut("invoice/{id:int}/earchive")]
    public async Task<IActionResult> SaveEArchive(int id, [FromBody] EGovInvoiceEArchiveRow dto, CancellationToken ct)
    {
        if (await DenyAsync(id, ct) is { } deny) return deny;
        static string? T(string? v, int max) => string.IsNullOrWhiteSpace(v) ? null : v.Trim().Length > max ? v.Trim()[..max] : v.Trim();
        dto.InvoiceID = id;
        dto.SendType = (dto.SendType ?? "ELEKTRONIK").Trim().ToUpperInvariant();
        if (dto.SendType is not ("ELEKTRONIK" or "KAGIT")) return BadRequest(new { message = "Gönderim şekli ELEKTRONIK ya da KAGIT olmalı." });
        dto.PaymentMethod = T(dto.PaymentMethod, 30)?.ToUpperInvariant();
        if (dto.PaymentMethod != null && !UblEArchiveInfo.PaymentMethods.Contains(dto.PaymentMethod))
            return BadRequest(new { message = "Ödeme şekli: " + string.Join(", ", UblEArchiveInfo.PaymentMethods) });
        dto.Email = T(dto.Email, 200);
        dto.WebAddress = T(dto.WebAddress, 250);
        dto.PaymentNote = T(dto.PaymentNote, 200);
        dto.PaymentAgent = T(dto.PaymentAgent, 150);
        dto.CarrierTaxNr = T(dto.CarrierTaxNr, 11);
        dto.CarrierName = T(dto.CarrierName, 150);
        if (!dto.IsInternetSale)
        {
            // İnternet satışı kapatılınca bu alanlar UBL'e yazılmaz; kayıtta da tutulmaz
            dto.PaymentMethod = dto.PaymentNote = dto.PaymentAgent = dto.CarrierTaxNr = dto.CarrierName = null;
            dto.PaymentDate = dto.DespatchDate = null;
        }
        await _repo.SaveEArchiveAsync(dto, User.UserId() > 0 ? User.UserId() : null, ct);
        return Ok(new { message = "e-Arşiv bilgileri kaydedildi." });
    }

    public sealed class CancelDto
    {
        public string? Reason { get; set; }
    }

    /// <summary>E-04: gönderilmiş e-Arşiv faturanın iptali (canlı adreste kilitli)</summary>
    [HttpPost("invoice/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] CancelDto dto, CancellationToken ct)
    {
        if (await DenyAsync(id, ct) is { } deny) return deny;
        try
        {
            var r = await _svc.CancelAsync(id, dto.Reason ?? "", User.UserId() > 0 ? User.UserId() : null, ct);
            r.Xml = "";
            return Ok(r);
        }
        catch (OutgoingSendBlockedException ex) { return Conflict(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("document/{id:int}/status")]
    public async Task<IActionResult> Status(int id, CancellationToken ct)
    {
        try
        {
            return Ok(await _svc.StatusAsync(id, ct));
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(502, new { message = ex.Message }); }
    }
}
