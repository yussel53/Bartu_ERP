using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using System.Data;
using System.Globalization;
using Dapper;
using Microsoft.AspNetCore.Authorization;
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
/// Kimlik: oturum açmış kullanıcı ya da CRM_Setting.ApiKey ile "X-Api-Key" başlığı (anahtar boşsa eklenti erişemez).
/// </summary>
[ApiController]
[Route("api/mailler")]
[AllowAnonymous]
public sealed class MaillerController : ControllerBase
{
    private readonly CrmRepository _repo;
    private readonly CrmMailService _mail;
    private readonly ILogger<MaillerController> _log;
    private readonly CardStatementRepository _statement;
    private readonly IDbConnection _db;

    public MaillerController(
        CrmRepository repo,
        CrmMailService mail,
        ILogger<MaillerController> log,
        CardStatementRepository statement,
        IDbConnection db)
    {
        _repo = repo;
        _mail = mail;
        _log = log;
        _statement = statement;
        _db = db;
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
        if (User.UserId() > 0) return (true, prefix);
        var key = (await _repo.GetSettingAsync("ApiKey"))?.Trim();
        if (string.IsNullOrEmpty(key)) return (false, prefix);
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
                    tur = cust == null ? null : await CustomerKindTextAsync(cust.Id),
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
                }),
                ozelSekmeler = cust == null ? null : await ErpTabsAsync(cust.Id)
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

    // ── v1.3: etiketsiz mail → firma eşleştirme ────────────────────────

    private static readonly HashSet<string> PublicMailDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.tr", "outlook.com", "outlook.com.tr", "live.com",
        "msn.com", "yahoo.com", "yahoo.com.tr", "yandex.com", "yandex.com.tr", "icloud.com", "me.com", "mail.ru",
        "aol.com", "gmx.com", "proton.me", "protonmail.com", "windowslive.com",
    };

    /// <summary>
    /// GET /api/mailler/kisi?email= — gönderen adresinden firma (cari / müşteri) + fırsatları.
    /// Önce tam adres (yetkili e-postası, fırsat kişisi), yoksa kurumsal alan adı.
    /// </summary>
    [HttpGet("kisi")]
    public async Task<IActionResult> Kisi([FromQuery] string? email)
    {
        try
        {
            var (ok, prefix) = await CheckKeyAsync();
            if (!ok) return Unauthorized(new { ok = false, mesaj = "API anahtarı geçersiz." });
            email = (email ?? "").Trim().ToLowerInvariant();
            var at = email.IndexOf('@');
            if (at <= 0 || at == email.Length - 1) return BadRequest(new { ok = false, mesaj = "Geçersiz e-posta adresi." });
            var domain = email[(at + 1)..];

            if (_db.State != ConnectionState.Open) _db.Open();
            var hasCrm = await _db.ExecuteScalarAsync<int>(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.CRM_Opportunity', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
            string Sql(string cond) => $@"
SELECT DISTINCT TOP 5 c.CustomerCardID AS Id
FROM dbo.CustomerCard c
WHERE c.CustomerCardID > 0 AND (
  EXISTS (SELECT 1 FROM dbo.CustomerContact k WHERE k.CustomerCardID = c.CustomerCardID
          AND (LOWER(LTRIM(RTRIM(k.Email))) {cond} OR LOWER(LTRIM(RTRIM(k.Contact))) {cond}))
  {(hasCrm ? $"OR EXISTS (SELECT 1 FROM dbo.CRM_Opportunity o WHERE o.CustomerCardID = c.CustomerCardID AND LOWER(LTRIM(RTRIM(o.ContactEmail))) {cond})" : "")})";

            var ids = (await _db.QueryAsync<int>(Sql("= @email"), new { email })).ToList();
            var match = "adres";
            if (ids.Count == 0 && !PublicMailDomains.Contains(domain))
            {
                ids = (await _db.QueryAsync<int>(Sql("LIKE @pattern"), new { pattern = "%@" + domain })).ToList();
                match = "alan adı";
            }

            var firmalar = new List<object>();
            foreach (var id in ids)
            {
                var cust = await _repo.GetCustomerAsync(id);
                if (cust == null) continue;
                var contacts = await _repo.ListContactsAsync(id);
                var opps = hasCrm ? await _repo.ListCustomerOpportunitiesAsync(id, 50) : new List<CrmOpportunityDto>();
                firmalar.Add(new
                {
                    id,
                    unvan = cust.Title,
                    kod = cust.Code,
                    email = contacts.Select(c => c.Email).FirstOrDefault(e => !string.IsNullOrWhiteSpace(e)),
                    tur = await CustomerKindTextAsync(id),
                    eslesme = match,
                    isler = opps
                        .OrderBy(o => o.Status == 0 ? 0 : 1)
                        .ThenByDescending(o => o.CreateDate)
                        .Take(10)
                        .Select(o => new
                        {
                            id = o.OpportunityID,
                            kod = $"{prefix}-{o.OpportunityID}",
                            tarih = o.CreateDate,
                            durum = StatusText(o.Status),
                            tur = o.OppType,
                            not = o.Title,
                        }),
                });
            }
            return Ok(new { ok = true, email, firmalar });
        }
        catch (CrmNeedsUpdateException ex)
        {
            return StatusCode(503, new { ok = false, mesaj = ex.Message });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Outlook kişi eşleştirme hatası");
            return StatusCode(500, new { ok = false, mesaj = ex.Message });
        }
    }

    private async Task<string?> CustomerKindTextAsync(int customerId)
    {
        try
        {
            if (_db.State != ConnectionState.Open) _db.Open();
            if (await _db.ExecuteScalarAsync<int>(
                    "SELECT CASE WHEN COL_LENGTH(N'dbo.CustomerCard', N'CardKind') IS NULL THEN 0 ELSE 1 END") == 0)
                return "Cari";
            var k = await _db.ExecuteScalarAsync<byte?>(
                "SELECT CardKind FROM dbo.CustomerCard WHERE CustomerCardID = @customerId", new { customerId });
            return k == CustomerKindRepository.Musteri ? "Müşteri" : "Cari";
        }
        catch
        {
            return null;
        }
    }

    // ── v1.2 özel sekmeler: ERP verisi (cari ekstre, siparişler, faturalar, ödeme planı) ──

    private static readonly CultureInfo Tr = new("tr-TR");

    private static string TabColType(string format) => format switch
    {
        "date" => "tarih",
        "money" => "para",
        "qty" => "sayi",
        _ => "metin",
    };

    private static object? TabValue(object? v) => v switch
    {
        null => null,
        DateTime dt => dt.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
        decimal or double or float or int or long or short or byte or bool => v,
        _ => v.ToString(),
    };

    private static object SectionTab(int id, string baslik, string? aciklama, int sira, CardSection s,
        Func<Dictionary<string, object?>, bool>? filter = null, int take = 300)
    {
        var rows = filter == null ? s.Rows : s.Rows.Where(filter).ToList();
        return new
        {
            id,
            baslik,
            aciklama = aciklama ?? s.Note,
            sira,
            kolonlar = s.Columns.Select(c => new { ad = c.Label, tip = TabColType(c.Format) }),
            satirlar = rows.Take(take).Select(r => s.Columns.Select(c => TabValue(r.TryGetValue(c.Key, out var v) ? v : null))),
            kisaltildi = rows.Count > take,
            hata = (string?)null,
        };
    }

    /// <summary>Outlook CRM kartı özel sekmeleri — cari/müşterinin ERP özeti.</summary>
    private async Task<List<object>> ErpTabsAsync(int customerId)
    {
        var tabs = new List<object>();
        CardStatementResult st;
        try
        {
            st = await _statement.GetAsync("customer", customerId, null, null);
        }
        catch (Exception ex)
        {
            tabs.Add(new
            {
                id = 9001, baslik = "Cari Ekstre", sira = 25,
                kolonlar = Array.Empty<object>(), satirlar = Array.Empty<object>(), kisaltildi = false, hata = ex.Message,
            });
            return tabs;
        }

        var bal = st.Closing == 0
            ? "0,00"
            : $"{Math.Abs(st.Closing).ToString("N2", Tr)} ({(st.Closing > 0 ? "B" : "A")})";
        const int take = 200;
        var recent = st.Statement.AsEnumerable().Reverse().Take(take).ToList();
        tabs.Add(new
        {
            id = 9001,
            baslik = "Cari Ekstre",
            aciklama = $"Bakiye: {bal} · Toplam borç {st.TotalDebit.ToString("N2", Tr)} · alacak {st.TotalCredit.ToString("N2", Tr)}",
            sira = 25,
            kolonlar = new object[]
            {
                new { ad = "Tarih", tip = "tarih" }, new { ad = "Belge No", tip = "metin" }, new { ad = "Belge Türü", tip = "metin" },
                new { ad = "Tür", tip = "metin" }, new { ad = "Açıklama", tip = "metin" }, new { ad = "Borç", tip = "para" },
                new { ad = "Alacak", tip = "para" }, new { ad = "Bakiye", tip = "para" },
            },
            satirlar = recent.Select(r => new object?[]
            {
                TabValue(r.Date), r.DocNo, r.Source, r.TypeLabel, r.Description, r.Debit, r.Credit, r.Balance,
            }),
            kisaltildi = st.Statement.Count > take,
            hata = (string?)null,
        });

        var orders = st.Sections.FirstOrDefault(x => x.Key == "siparisler");
        if (orders != null) tabs.Add(SectionTab(9002, "Siparişler", null, 26, orders));

        var docs = st.Sections.FirstOrDefault(x => x.Key == "hareketler");
        if (docs != null)
            tabs.Add(SectionTab(9003, "Faturalar", "Cariye kesilen / cariden gelen faturalar", 27, docs,
                r => string.Equals(r.TryGetValue("Source", out var src) ? src?.ToString() : null, "Invoice", StringComparison.OrdinalIgnoreCase)));

        var plan = st.Sections.FirstOrDefault(x => x.Key == "odeme");
        if (plan != null && plan.Rows.Count > 0) tabs.Add(SectionTab(9004, "Ödeme Planı", null, 28, plan));

        return tabs;
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
