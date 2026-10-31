using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// CRM / Teklif Yönetimi ekranı (Fırsat → Aksiyon → Teklif · Görüşmeler · Mailler).
/// Kullanıcı: "X-User-Id" başlığı veya ?userId= sorgusu.
/// </summary>
[ApiController]
[Route("api/crm")]
public sealed class CrmController : ControllerBase
{
    private readonly CrmRepository _repo;
    private readonly CrmMailService _mail;
    private readonly CrmMailProfileRepository _profiles;
    private readonly CrmOrderRepository _orders;

    public CrmController(CrmRepository repo, CrmMailService mail, CrmMailProfileRepository profiles, CrmOrderRepository orders)
    {
        _repo = repo;
        _mail = mail;
        _profiles = profiles;
        _orders = orders;
    }

    private int UserId
    {
        get
        {
            if (int.TryParse(Request.Headers["X-User-Id"].FirstOrDefault(), out var h) && h > 0) return h;
            if (int.TryParse(Request.Query["userId"].FirstOrDefault(), out var q) && q > 0) return q;
            return 0;
        }
    }

    private async Task<IActionResult> Run(Func<Task<object?>> fn)
    {
        try
        {
            var r = await fn();
            return r is null ? NotFound(new { message = "Kayıt bulunamadı." }) : Ok(r);
        }
        catch (CrmNeedsUpdateException ex)
        {
            return StatusCode(409, new { needsUpdate = true, message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // ─── Ayarlar / lookup ─────────────────────────────────────────────────
    [HttpGet("lookups")]
    public Task<IActionResult> Lookups() => Run(async () =>
    {
        var prof = await _mail.ResolveProfileAsync(UserId);
        return new
        {
            actionTypes = await _repo.ListActionTypesAsync(),
            users = await _repo.ListUsersAsync(),
            currencies = await _repo.ListCurrenciesAsync(),
            tagPrefix = await _mail.GetPrefixAsync(),
            smtpReady = prof.SmtpReady,
            mailProfileSource = prof.Profile == null ? null : prof.Source,
        };
    });

    [HttpGet("settings")]
    public Task<IActionResult> GetSettings() => Run(async () =>
    {
        var s = await _repo.GetSettingsAsync();
        if (s.ContainsKey("SmtpPassword") && !string.IsNullOrEmpty(s["SmtpPassword"])) s["SmtpPassword"] = "********";
        return new
        {
            settings = s,
            actionTypes = await _repo.ListActionTypesAsync(includeInactive: true),
            users = await _repo.ListUsersAsync(),
            apiUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/mailler",
        };
    });

    public sealed class SettingsSaveRequest
    {
        public Dictionary<string, string?> Settings { get; set; } = new();
        public List<CrmActionTypeDto>? ActionTypes { get; set; }
        public Dictionary<int, string?>? UserEmails { get; set; }
    }

    [HttpPost("settings")]
    public Task<IActionResult> SaveSettings([FromBody] SettingsSaveRequest req) => Run(async () =>
    {
        var vals = req.Settings.Where(kv => !(kv.Key == "SmtpPassword" && kv.Value == "********"))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
        if (vals.TryGetValue("TagPrefix", out var pfx))
        {
            pfx = (pfx ?? "").Trim().ToUpperInvariant();
            if (pfx.Length is < 1 or > 10 || pfx.Any(c => !char.IsLetterOrDigit(c)))
                throw new ArgumentException("Konu etiketi öneki 1-10 harf/rakam olmalı (örn. KS).");
            vals["TagPrefix"] = pfx;
        }
        await _repo.SaveSettingsAsync(vals);
        if (req.ActionTypes != null)
            foreach (var t in req.ActionTypes.Where(t => !string.IsNullOrWhiteSpace(t.Title)))
                await _repo.SaveActionTypeAsync(t);
        if (req.UserEmails != null)
            foreach (var kv in req.UserEmails)
                await _repo.SaveUserEmailAsync(kv.Key, string.IsNullOrWhiteSpace(kv.Value) ? null : kv.Value.Trim());
        return new { ok = true };
    });

    // ─── Mail tanımları (Genel / Firma / Bölüm / Birim / Kullanıcı) ──────
    [HttpGet("mail-profiles")]
    public Task<IActionResult> MailProfiles() => Run(async () => new
    {
        profiles = await _profiles.ListAsync(),
        companies = await _profiles.ListCompaniesAsync(),
        orgUnits = await _profiles.ListOrgUnitsAsync(),
        users = await _repo.ListUsersAsync(),
    });

    [HttpPost("mail-profiles")]
    public Task<IActionResult> SaveMailProfile([FromBody] CrmMailProfileDto dto) =>
        Run(async () => new { id = await _profiles.SaveAsync(dto) });

    [HttpDelete("mail-profiles/{id:int}")]
    public Task<IActionResult> DeleteMailProfile(int id) => Run(async () => new { ok = await _profiles.DeleteAsync(id) > 0 });

    /// <summary>Seçilen kullanıcı için hangi mail tanımının kullanılacağını gösterir.</summary>
    [HttpGet("mail-profiles/resolve")]
    public Task<IActionResult> ResolveMailProfile([FromQuery] int forUserId) => Run(async () =>
    {
        var r = await _mail.ResolveProfileAsync(forUserId);
        if (r.Profile != null && !string.IsNullOrEmpty(r.Profile.SmtpPassword)) r.Profile.SmtpPassword = CrmMailProfileRepository.PasswordMask;
        return new { source = r.Source, chain = r.Chain, smtpReady = r.SmtpReady, profile = r.Profile };
    });

    public sealed class TestMailRequest
    {
        public string? To { get; set; }
    }

    [HttpPost("mail-profiles/{id:int}/test")]
    public async Task<IActionResult> TestMailProfile(int id, [FromBody] TestMailRequest req)
    {
        try
        {
            var p = await _profiles.GetAsync(id);
            if (p == null) return NotFound(new { message = "Tanım bulunamadı." });
            var err = await CrmMailService.SendTestAsync(p, req.To ?? "");
            return err == null ? Ok(new { ok = true }) : BadRequest(new { message = err });
        }
        catch (CrmNeedsUpdateException ex) { return StatusCode(409, new { needsUpdate = true, message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("stats")]
    public Task<IActionResult> Stats([FromQuery] int? ownerId) => Run(async () => await _repo.GetStatsAsync(ownerId));

    [HttpGet("customers")]
    public Task<IActionResult> Customers([FromQuery] string? q) => Run(async () => await _repo.SearchCustomersAsync(q));

    [HttpGet("customers/{id:int}/contacts")]
    public Task<IActionResult> Contacts(int id) => Run(async () => await _repo.ListContactsAsync(id));

    [HttpGet("products")]
    public Task<IActionResult> Products([FromQuery] string? q, [FromQuery] int? customerId) =>
        Run(async () => await _repo.SearchProductsAsync(q, customerId));

    // ─── Fırsatlar ────────────────────────────────────────────────────────
    [HttpGet("opportunities")]
    public Task<IActionResult> ListOpportunities([FromQuery] int? status, [FromQuery] string? q, [FromQuery] int? ownerId,
        [FromQuery] int? customerId, [FromQuery] int page = 1, [FromQuery] int pageSize = 30) =>
        Run(async () => await _repo.ListOpportunitiesAsync(status, q, ownerId, customerId, page, pageSize));

    [HttpGet("opportunities/{id:int}")]
    public Task<IActionResult> GetOpportunity(int id) => Run(async () =>
    {
        var o = await _repo.GetOpportunityAsync(id);
        if (o == null) return null;
        var prefix = await _mail.GetPrefixAsync();
        return new { opportunity = o, tag = CrmMailService.BuildTag(id, prefix) };
    });

    [HttpPost("opportunities")]
    public Task<IActionResult> SaveOpportunity([FromBody] CrmOpportunityDto dto) =>
        Run(async () => new { id = await _repo.SaveOpportunityAsync(dto, UserId) });

    public sealed class CloseRequest
    {
        public byte Status { get; set; }
        public string? Note { get; set; }
    }

    [HttpPost("opportunities/{id:int}/status")]
    public Task<IActionResult> SetOpportunityStatus(int id, [FromBody] CloseRequest req) =>
        Run(async () => new { ok = await _repo.CloseOpportunityAsync(id, req.Status, req.Note) > 0 });

    [HttpDelete("opportunities/{id:int}")]
    public Task<IActionResult> DeleteOpportunity(int id) =>
        Run(async () => new { ok = await _repo.DeleteOpportunityAsync(id) > 0 });

    // ─── Aksiyonlar ───────────────────────────────────────────────────────
    [HttpGet("opportunities/{id:int}/actions")]
    public Task<IActionResult> ListActions(int id) => Run(async () => await _repo.ListActionsAsync(id));

    /// <summary>Belgeye bağlı aksiyonlar (Invoice/123 …)</summary>
    [HttpGet("actions/by-source")]
    public Task<IActionResult> ListActionsBySource([FromQuery] string table, [FromQuery] int id) =>
        Run(async () => await _repo.ListActionsBySourceAsync(table ?? "", id));

    /// <summary>CRM → Aksiyonlar listesi (fırsat + belge)</summary>
    [HttpGet("actions")]
    public Task<IActionResult> ListAllActions([FromQuery] string? q, [FromQuery] bool? openOnly, [FromQuery] int take = 200) =>
        Run(async () => await _repo.ListAllActionsAsync(q, openOnly, take));

    [HttpPost("actions")]
    public Task<IActionResult> SaveAction([FromBody] CrmActionDto dto) => Run(async () =>
    {
        var isNew = dto.ActionID <= 0;
        var id = await _repo.SaveActionAsync(dto, UserId);
        int? offerId = null;
        if (isNew && dto.NewOffer != null && dto.NewOffer.Lines.Count > 0 && dto.OpportunityID is > 0)
        {
            dto.NewOffer.OpportunityID = dto.OpportunityID.Value;
            dto.NewOffer.ActionID = id;
            offerId = await _repo.SaveOfferAsync(dto.NewOffer, UserId);
        }
        string? closed = null;
        if (dto.ActionTypeID is int tid && dto.OpportunityID is int oppId && oppId > 0)
        {
            var type = await _repo.GetActionTypeAsync(tid);
            if (type != null && type.CloseKind is 1 or 2)
            {
                await _repo.CloseOpportunityAsync(oppId, type.CloseKind, $"{type.Title} — {dto.Description}".Trim(' ', '—'));
                await _repo.SetActionDoneAsync(id, true);
                closed = type.CloseKind == 1 ? "won" : "lost";
            }
        }
        return new { id, offerId, closed };
    });

    /// <summary>Outlook / Graph: konu+gövde → belge aksiyonu (OutlookItemId ile tekilleştirilir)</summary>
    [HttpPost("actions/from-outlook")]
    public Task<IActionResult> ActionFromOutlook([FromBody] CrmActionDto dto) => Run(async () =>
    {
        if (string.IsNullOrWhiteSpace(dto.OutlookItemId) && string.IsNullOrWhiteSpace(dto.Title) && string.IsNullOrWhiteSpace(dto.Description))
            throw new ArgumentException("Outlook öğesi veya açıklama gerekli.");
        if (string.IsNullOrWhiteSpace(dto.Title) && !string.IsNullOrWhiteSpace(dto.Description))
            dto.Title = dto.Description!.Length > 80 ? dto.Description[..80] : dto.Description;
        var id = await _repo.SaveActionAsync(dto, UserId);
        return new { id };
    });

    [HttpPost("actions/{id:int}/done")]
    public Task<IActionResult> ActionDone(int id, [FromQuery] bool done = true) =>
        Run(async () => new { ok = await _repo.SetActionDoneAsync(id, done) > 0 });

    [HttpDelete("actions/{id:int}")]
    public Task<IActionResult> DeleteAction(int id) => Run(async () => new { ok = await _repo.DeleteActionAsync(id) > 0 });

    // ─── Teklifler ────────────────────────────────────────────────────────
    [HttpGet("opportunities/{id:int}/offers")]
    public Task<IActionResult> ListOffers(int id, [FromQuery] int? actionId) => Run(async () => await _repo.ListOffersAsync(id, actionId));

    [HttpGet("offers/{id:int}")]
    public Task<IActionResult> GetOffer(int id) => Run(async () => await _repo.GetOfferAsync(id));

    [HttpPost("offers")]
    public Task<IActionResult> SaveOffer([FromBody] CrmOfferDto dto) =>
        Run(async () => new { id = await _repo.SaveOfferAsync(dto, UserId) });

    [HttpPost("offers/{id:int}/revise")]
    public Task<IActionResult> Revise(int id) => Run(async () => new { id = await _repo.ReviseOfferAsync(id, UserId) });

    [HttpPost("offers/{id:int}/copy")]
    public Task<IActionResult> Copy(int id, [FromQuery] int? targetOpportunityId) =>
        Run(async () => new { id = await _repo.CopyOfferAsync(id, targetOpportunityId, UserId) });

    [HttpPost("offers/{id:int}/status")]
    public Task<IActionResult> OfferStatus(int id, [FromBody] CloseRequest req) =>
        Run(async () => new { ok = await _repo.SetOfferStatusAsync(id, req.Status) > 0 });

    /// <summary>Teklif → satış siparişi (OrderVoucher). Fırsat kazanıldı, müşteri cariye döner.</summary>
    [HttpPost("offers/{id:int}/to-order")]
    public Task<IActionResult> ToOrder(int id, [FromBody] CrmOfferToOrderRequest? req) =>
        Run(async () => await _orders.ConvertAsync(id, req ?? new CrmOfferToOrderRequest(), UserId));

    [HttpDelete("offers/{id:int}")]
    public Task<IActionResult> DeleteOffer(int id) => Run(async () => new { ok = await _repo.DeleteOfferAsync(id) > 0 });

    /// <summary>Yazdırılabilir teklif (tarayıcıdan "PDF olarak kaydet").</summary>
    [HttpGet("offers/{id:int}/print")]
    public async Task<IActionResult> Print(int id)
    {
        try
        {
            var o = await _repo.GetOfferAsync(id);
            if (o == null) return NotFound("Teklif bulunamadı.");
            var opp = await _repo.GetOpportunityAsync(o.OpportunityID);
            var html = CrmMailService.BuildOfferDocumentHtml(o, opp, await _repo.GetSettingsAsync(), forPrint: true);
            return Content(html, "text/html; charset=utf-8");
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    // ─── Görüşmeler ───────────────────────────────────────────────────────
    [HttpGet("opportunities/{id:int}/meetings")]
    public Task<IActionResult> ListMeetings(int id) => Run(async () => await _repo.ListMeetingsAsync(id));

    [HttpPost("meetings")]
    public Task<IActionResult> SaveMeeting([FromBody] CrmMeetingDto dto) =>
        Run(async () => new { id = await _repo.SaveMeetingAsync(dto, UserId) });

    [HttpDelete("meetings/{id:int}")]
    public Task<IActionResult> DeleteMeeting(int id) => Run(async () => new { ok = await _repo.DeleteMeetingAsync(id) > 0 });

    // ─── Mailler ──────────────────────────────────────────────────────────
    [HttpGet("opportunities/{id:int}/mails")]
    public Task<IActionResult> ListMails(int id, [FromQuery] int? offerId) => Run(async () => await _repo.ListMailsAsync(id, offerId));

    [HttpGet("mails/{id:int}")]
    public Task<IActionResult> GetMail(int id) => Run(async () => await _repo.GetMailAsync(id));

    [HttpGet("mails/{id:int}/file")]
    public async Task<IActionResult> MailFile(int id)
    {
        var (raw, name) = await _repo.GetMailRawAsync(id);
        if (raw == null) return NotFound();
        name = string.IsNullOrWhiteSpace(name) ? $"mail_{id}.msg" : name;
        var mime = name.EndsWith(".eml", StringComparison.OrdinalIgnoreCase) ? "message/rfc822" : "application/vnd.ms-outlook";
        return File(raw, mime, name);
    }

    [HttpGet("offers/{id:int}/mail-draft")]
    public Task<IActionResult> MailDraft(int id) => Run(async () => await _mail.PrepareAsync(id, UserId));

    [HttpPost("mail/send")]
    public async Task<IActionResult> SendMail([FromBody] CrmMailDraft draft)
    {
        try
        {
            draft.UserId = UserId > 0 ? UserId : draft.UserId;
            draft.Tag = CrmMailService.BuildTag(draft.OpportunityId, await _mail.GetPrefixAsync());
            var r = await _mail.SendSmtpAsync(draft);
            return r.Success ? Ok(new { ok = true, id = r.MailLogId }) : BadRequest(new { message = r.Error });
        }
        catch (CrmNeedsUpdateException ex) { return StatusCode(409, new { needsUpdate = true, message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    /// <summary>Outlook'ta açılacak .eml dosyası (X-Unsent: 1) — mail kullanıcının kendi Outlook hesabından gider.</summary>
    [HttpPost("mail/outlook")]
    public async Task<IActionResult> OutlookDraft([FromBody] CrmMailDraft draft)
    {
        try
        {
            draft.UserId = UserId > 0 ? UserId : draft.UserId;
            draft.Tag = CrmMailService.BuildTag(draft.OpportunityId, await _mail.GetPrefixAsync());
            var r = await _mail.BuildOutlookDraftAsync(draft);
            if (!r.Success || r.FileBytes == null) return BadRequest(new { message = r.Error });
            return File(r.FileBytes, "message/rfc822", r.FileName);
        }
        catch (CrmNeedsUpdateException ex) { return StatusCode(409, new { needsUpdate = true, message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }
}
