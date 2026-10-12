using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// Outlook CRM eklentisinin (Outlook_Entegrasyon / CrmComAddin) konuştuğu uç nokta.
/// Sözleşme: Outlook_Entegrasyon/CRM_API_SOZLESMESI.md v1.1 — ana kayıt = CRM_Opportunity (Fırsat).
///   GET  /api/mailler/ping
///   POST /api/mailler                 konusunda /#KS-{FırsatID}#/ olan maili kaydeder
///   GET  /api/mailler/{kod}           CRM Kartı (firma, kişiler, fırsat, aksiyonlar, teklifler, yazışmalar)
///   GET  /api/mailler/kayit/{id}      tek yazışma
///   GET  /api/mailler/kayit/{id}/dosya ham .msg/.eml
/// Kimlik: CRM_Setting.ApiKey doluysa "X-Api-Key" başlığı zorunlu.
/// </summary>
[ApiController]
[Route("api/mailler")]
public sealed class MaillerController : ControllerBase
{
    private readonly CrmRepository _repo;
    private readonly CrmMailService _mail;
    private readonly ILogger<MaillerController> _log;

    public MaillerController(CrmRepository repo, CrmMailService mail, ILogger<MaillerController> log)
    {
        _repo = repo;
        _mail = mail;
        _log = log;
    }

    public sealed class MailPostRequest
    {
        public string? CrmKodu { get; set; }
        public string? Konu { get; set; }
        public string? Kimden { get; set; }
        public string? Yon { get; set; }
        public string? Kime { get; set; }
        public string? Bilgi { get; set; }
        public string? Govde { get; set; }
        public bool GovdeHtml { get; set; }
        public DateTime? Tarih { get; set; }
        public string? MessageId { get; set; }
        public string? Ekler { get; set; }
        public string? DosyaAdi { get; set; }
        public string? DosyaBase64 { get; set; }
        public string? Kaynak { get; set; }
    }

    private async Task<(bool Ok, string Prefix)> CheckKeyAsync()
    {
        var prefix = await _mail.GetPrefixAsync();
        var key = (await _repo.GetSettingAsync("ApiKey"))?.Trim();
        if (string.IsNullOrEmpty(key)) return (true, prefix);
        var given = Request.Headers["X-Api-Key"].FirstOrDefault()?.Trim();
        return (string.Equals(given, key, StringComparison.Ordinal), prefix);
    }

    private static string StatusText(byte s) => s switch { 0 => "Açık", 1 => "Kazanıldı", 2 => "Kaybedildi", 3 => "İptal", _ => "?" };

    [HttpGet("ping")]
    public async Task<IActionResult> Ping()
    {
        var (ok, prefix) = await CheckKeyAsync();
        if (!ok) return Unauthorized(new { ok = false, mesaj = "API anahtarı geçersiz." });
        return Ok(new { ok = true, sistem = "KaviSoft ERP", onek = prefix, zaman = DateTime.Now });
    }

    [HttpPost]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> Post([FromBody] MailPostRequest req)
    {
        try
        {
            var (ok, prefix) = await CheckKeyAsync();
            if (!ok) return Unauthorized(new { ok = false, mesaj = "API anahtarı geçersiz." });
            if (req == null) return BadRequest(new { ok = false, mesaj = "Boş istek." });

            var code = !string.IsNullOrWhiteSpace(req.CrmKodu) ? req.CrmKodu!.Trim() : CrmMailService.ExtractCode(req.Konu);
            var oppId = CrmMailService.ParseId(code, prefix);
            if (oppId is not int id)
                return BadRequest(new { ok = false, mesaj = $"Konu etiketi çözülemedi veya bu sisteme ait değil: '{code}'" });
            if (!await _repo.OpportunityExistsAsync(id))
                return NotFound(new { ok = false, mesaj = $"Fırsat #{id} bulunamadı." });

            var messageId = CrmMailService.NormalizeMessageId(req.MessageId);
            var outgoing = string.Equals(req.Yon, "giden", StringComparison.OrdinalIgnoreCase);

            if (!string.IsNullOrEmpty(messageId) && await _repo.FindMailByMessageIdAsync(messageId) is int dup)
                return Ok(new { ok = true, id = dup, jobId = id, tekrar = true });

            var subj = (req.Konu ?? "").Trim();
            int? draftId = null;
            if (outgoing)
            {
                draftId = await _repo.FindDraftAsync(id, subj);
                if (draftId == null && !string.IsNullOrEmpty(subj) && await _repo.FindRecentSmtpCopyAsync(id, subj) is int smtp)
                    return Ok(new { ok = true, id = smtp, jobId = id, tekrar = true });
            }

            var w = new CrmRepository.MailLogWrite
            {
                MailLogID = draftId ?? 0,
                OpportunityID = id,
                Direction = (byte)(outgoing ? 1 : 2),
                Status = (byte)(outgoing ? 1 : 3),
                Channel = "OUTLOOK",
                TagCode = CrmMailService.Cut(code, 50),
                Subject = CrmMailService.Cut(req.Konu, 500),
                MailFrom = CrmMailService.Cut(req.Kimden, 320),
                MailTo = CrmMailService.Cut(req.Kime, 2000),
                MailCc = CrmMailService.Cut(req.Bilgi, 2000),
                Body = string.IsNullOrEmpty(req.Govde) ? null : req.Govde,
                IsHtml = req.GovdeHtml,
                MailDate = req.Tarih ?? DateTime.Now,
                MessageId = CrmMailService.Cut(messageId, 500),
                AttachmentNames = CrmMailService.Cut(req.Ekler, 1000),
                Source = CrmMailService.Cut(req.Kaynak, 100) ?? "Outlook",
            };
            if (!string.IsNullOrEmpty(req.DosyaBase64))
            {
                try
                {
                    w.RawMessage = Convert.FromBase64String(req.DosyaBase64);
                    w.RawFileName = CrmMailService.Cut(req.DosyaAdi, 260);
                }
                catch (FormatException) { /* bozuk ek → yok say */ }
            }

            int logId;
            if (draftId is int d)
            {
                await _repo.UpdateMailFromOutlookAsync(w);
                logId = d;
            }
            else
            {
                var (offerId, actionId) = await _repo.LastOfferLinkAsync(id);
                w.OfferID = offerId;
                w.ActionID = actionId;
                logId = await _repo.InsertMailAsync(w);
            }
            _log.LogInformation("Outlook mail kaydı: Fırsat={Id} Yön={Yon} Log={Log}", id, outgoing ? "giden" : "gelen", logId);
            return Ok(new { ok = true, id = logId, jobId = id });
        }
        catch (CrmNeedsUpdateException ex)
        {
            return StatusCode(503, new { ok = false, mesaj = ex.Message });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Outlook mail kaydı hatası");
            return StatusCode(500, new { ok = false, mesaj = ex.Message });
        }
    }

    [HttpGet("{kod}")]
    public async Task<IActionResult> Kart(string kod)
    {
        try
        {
            var (ok, prefix) = await CheckKeyAsync();
            if (!ok) return Unauthorized(new { ok = false, mesaj = "API anahtarı geçersiz." });
            var id = CrmMailService.ParseId(CrmMailService.ExtractCode(kod), prefix);
            if (id is not int oppId) return BadRequest(new { ok = false, mesaj = "Geçersiz kod." });
            var opp = await _repo.GetOpportunityAsync(oppId);
            if (opp == null) return NotFound(new { ok = false, mesaj = $"Fırsat #{oppId} bulunamadı." });

            CrmLookupItem? cust = opp.CustomerCardID is int cid ? await _repo.GetCustomerAsync(cid) : null;
            var contacts = cust != null ? await _repo.ListContactsAsync(cust.Id) : new List<CrmContactDto>();
            var kisiler = new List<object>();
            if (!string.IsNullOrWhiteSpace(opp.ContactName) || !string.IsNullOrWhiteSpace(opp.ContactEmail))
                kisiler.Add(new { tur = "Fırsat kişisi", ad = opp.ContactName ?? "", tip = "İlgili kişi", iletisim = opp.ContactEmail ?? opp.ContactPhone, email = opp.ContactEmail, telefon = opp.ContactPhone });
            foreach (var c in contacts)
            {
                var email = c.Email ?? ((c.Contact ?? "").Contains('@') ? c.Contact : null);
                kisiler.Add(new { tur = "İletişim", ad = c.Name ?? "", tip = c.ContactTitle ?? (email != null ? "E-posta" : "İletişim"), iletisim = email ?? c.Phone ?? c.Contact, email, telefon = c.Phone });
            }

            var others = cust != null ? await _repo.ListCustomerOpportunitiesAsync(cust.Id) : new List<CrmOpportunityDto> { opp };
            if (!others.Any(x => x.OpportunityID == opp.OpportunityID)) others.Insert(0, opp);
            var actions = await _repo.ListActionsAsync(oppId);
            var offers = await _repo.ListOffersAsync(oppId, null);
            var mails = await _repo.ListMailsForOpportunitiesAsync(others.Select(x => x.OpportunityID), 200);
            var baseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}";

            return Ok(new
            {
                ok = true,
                jobId = oppId,
                kod = CrmMailService.BuildTag(oppId, prefix),
                novaAdres = $"{baseUrl}/#/crm/islemler/aksiyonlar/{oppId}",
                musteri = opp.CustomerTitle,
                sorumlu = opp.OwnerName,
                durum = StatusText(opp.Status),
                tarih = opp.CreateDate,
                not = opp.Description,
                firma = cust == null ? null : new
                {
                    id = cust.Id,
                    kod = cust.Code,
                    unvan = cust.Title,
                    erpKod = cust.Code,
                    vergiNo = cust.Extra,
                    email = kisiler.Count > 0 ? contacts.Select(c => c.Email).FirstOrDefault(e => !string.IsNullOrWhiteSpace(e)) ?? opp.ContactEmail : opp.ContactEmail,
                    aktif = true,
                },
                kisiler,
                sozlesmeler = Array.Empty<object>(),
                firsat = new
                {
                    id = opp.OpportunityID,
                    tarih = opp.CreateDate,
                    durum = StatusText(opp.Status),
                    tur = opp.OppType,
                    oncelik = (int)opp.Priority,
                    not = string.IsNullOrWhiteSpace(opp.Description) ? opp.Title : $"{opp.Title}\n{opp.Description}",
                    kisi = opp.ContactName ?? opp.ContactEmail,
                    olusturan = opp.CreateUserName,
                    kapanis = opp.CloseDate,
                    hatirlatma = opp.ReminderDate,
                    maliyet = opp.ExpectedAmount
                },
                aksiyonlar = actions.Select(a => new
                {
                    id = a.ActionID,
                    tarih = a.ActionDate,
                    vade = a.DueDate,
                    tip = a.ActionTypeTitle,
                    aciklama = a.Description,
                    aktif = !a.IsDone,
                    olusturan = a.CreateUserName
                }),
                isler = others.Select(j => new
                {
                    id = j.OpportunityID,
                    tarih = j.CreateDate,
                    durum = StatusText(j.Status),
                    tur = j.OppType,
                    not = j.Title,
                    olusturan = j.CreateUserName,
                    buIs = j.OpportunityID == oppId
                }),
                teklifler = offers.Select(o => new
                {
                    id = o.OfferID,
                    docNum = o.DocNum,
                    date = o.OfferDate,
                    gecerlilik = o.ValidityDate,
                    description = o.Description,
                    toplam = o.GrandTotal,
                    kalem = o.Lines.Count,
                    olusturan = o.CreateUserName
                }),
                mailler = mails.Select(x => new
                {
                    id = x.MailLogID,
                    jobId = x.OpportunityID,
                    offerId = x.OfferID,
                    yon = x.Direction == 2 ? "gelen" : "giden",
                    durum = x.Status,
                    kanal = x.Channel,
                    konu = x.Subject,
                    kimden = x.MailFrom,
                    kime = x.MailTo,
                    bilgi = x.MailCc,
                    tarih = x.MailDate ?? x.CreateDate,
                    ekler = x.AttachmentNames,
                    onizleme = x.Body == null ? null : x.Body[..Math.Min(300, x.Body.Length)],
                    hamVar = x.HasRaw,
                    kaynak = x.Source
                })
            });
        }
        catch (CrmNeedsUpdateException ex)
        {
            return StatusCode(503, new { ok = false, mesaj = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { ok = false, mesaj = ex.Message });
        }
    }

    [HttpGet("kayit/{id:int}")]
    public async Task<IActionResult> Kayit(int id)
    {
        var (ok, _) = await CheckKeyAsync();
        if (!ok) return Unauthorized(new { ok = false, mesaj = "API anahtarı geçersiz." });
        var m = await _repo.GetMailAsync(id);
        if (m == null) return NotFound(new { ok = false });
        return Ok(new
        {
            id = m.MailLogID, jobId = m.OpportunityID, offerId = m.OfferID,
            yon = m.Direction == 2 ? "gelen" : "giden", durum = m.Status, kanal = m.Channel, konu = m.Subject,
            kimden = m.MailFrom, kime = m.MailTo, bilgi = m.MailCc, tarih = m.MailDate ?? m.CreateDate,
            govde = m.Body, govdeHtml = m.IsHtml, ekler = m.AttachmentNames, hata = m.ErrorMessage,
            hamVar = m.HasRaw, dosyaAdi = m.RawFileName
        });
    }

    [HttpGet("kayit/{id:int}/dosya")]
    public async Task<IActionResult> KayitDosya(int id)
    {
        var (ok, _) = await CheckKeyAsync();
        if (!ok) return Unauthorized();
        var (raw, name) = await _repo.GetMailRawAsync(id);
        if (raw == null) return NotFound();
        name = string.IsNullOrWhiteSpace(name) ? $"mail_{id}.msg" : name;
        var mime = name.EndsWith(".eml", StringComparison.OrdinalIgnoreCase) ? "message/rfc822" : "application/vnd.ms-outlook";
        return File(raw, mime, name);
    }
}
