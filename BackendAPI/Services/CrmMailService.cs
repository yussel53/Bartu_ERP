using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Text.RegularExpressions;
using BartuERP.Backend.Repositories;

namespace BartuERP.Backend.Services;

/// <summary>Teklif maili ekranındaki taslak (Nova OfferMailDraft karşılığı).</summary>
public sealed class CrmMailDraft
{
    public int OfferId { get; set; }
    public int? ActionId { get; set; }
    public int OpportunityId { get; set; }
    public string DocNumber { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string To { get; set; } = "";
    public string Cc { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Body { get; set; } = "";
    public bool IncludeOfferTable { get; set; } = true;
    public bool AttachOfferHtml { get; set; } = true;
    public bool CopyToMe { get; set; } = true;
    public string SenderName { get; set; } = "";
    public string SenderEmail { get; set; } = "";
    public string Tag { get; set; } = "";
    public List<string> SuggestedAddresses { get; set; } = new();
    public int UserId { get; set; }
    /// <summary>Geçerli mail tanımının kaynağı (Kullanıcı / Birim / Bölüm / Firma / Genel)</summary>
    public string? ProfileSource { get; set; }
    public bool SmtpReady { get; set; }
}

public sealed class CrmMailResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public int? MailLogId { get; set; }
    public byte[]? FileBytes { get; set; }
    public string? FileName { get; set; }
}

/// <summary>
/// Outlook CRM entegrasyonu (Outlook_Entegrasyon/CRM_API_SOZLESMESI.md v1.1) için yardımcılar:
/// konu etiketi /#ÖNEK-ID#/, Outlook'ta açılacak .eml taslağı (X-Unsent: 1), SMTP gönderimi ve teklif HTML çıktısı.
/// </summary>
public sealed class CrmMailService
{
    public const string DefaultTagPrefix = "KS";
    private static readonly Regex TagRegex = new(@"/#\s*(?<code>[^#/]+?)\s*#/", RegexOptions.Compiled);
    private static readonly Regex EmailRegex = new(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", RegexOptions.Compiled);
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private readonly CrmRepository _repo;
    private readonly CrmMailProfileRepository _profiles;
    private readonly ILogger<CrmMailService> _log;

    public CrmMailService(CrmRepository repo, CrmMailProfileRepository profiles, ILogger<CrmMailService> log)
    {
        _repo = repo;
        _profiles = profiles;
        _log = log;
    }

    /// <summary>
    /// Kullanıcının geçerli mail tanımı (Kullanıcı → Birim → Bölüm → Firma → Genel).
    /// Hiç tanım yoksa eski CRM_Setting Smtp* değerleri "Genel" kabul edilir.
    /// </summary>
    public async Task<CrmResolvedMailProfile> ResolveProfileAsync(int userId)
    {
        var r = await _profiles.ResolveAsync(userId);
        if (r.SmtpReady) return r;
        Dictionary<string, string?> s;
        try { s = await _repo.GetSettingsAsync(); }
        catch { return r; }
        var host = s.GetValueOrDefault("SmtpHost");
        if (string.IsNullOrWhiteSpace(host)) return r;
        r.Profile ??= new CrmMailProfileDto { ScopeType = 0, ScopeName = "Genel" };
        r.Profile.SmtpHost = host;
        r.Profile.SmtpPort = int.TryParse(s.GetValueOrDefault("SmtpPort"), out var port) ? port : null;
        r.Profile.SmtpSsl = !string.Equals(s.GetValueOrDefault("SmtpSsl"), "false", StringComparison.OrdinalIgnoreCase);
        r.Profile.SmtpUser = s.GetValueOrDefault("SmtpUser");
        r.Profile.SmtpPassword = s.GetValueOrDefault("SmtpPassword");
        r.Profile.FromAddress ??= s.GetValueOrDefault("SmtpFrom");
        r.Source = string.IsNullOrEmpty(r.Source) ? "Genel (eski SMTP ayarı)" : r.Source + " · SMTP: Genel (eski ayar)";
        return r;
    }

    // ─── Etiket ───────────────────────────────────────────────────────────
    public async Task<string> GetPrefixAsync()
    {
        var p = await _repo.GetSettingAsync("TagPrefix");
        return string.IsNullOrWhiteSpace(p) ? DefaultTagPrefix : p.Trim().ToUpperInvariant();
    }

    public static string BuildTag(int opportunityId, string prefix) =>
        opportunityId <= 0 ? "" : $"/#{(string.IsNullOrWhiteSpace(prefix) ? "" : prefix.Trim() + "-")}{opportunityId}#/";

    public static string? ExtractCode(string? subjectOrCode)
    {
        if (string.IsNullOrWhiteSpace(subjectOrCode)) return null;
        var m = TagRegex.Match(subjectOrCode);
        return (m.Success ? m.Groups["code"].Value : subjectOrCode).Trim();
    }

    /// <summary>"KS-12" → 12 · "12" → 12 · başka önek ("NS-12") → null.</summary>
    public static int? ParseId(string? code, string prefix)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        code = code.Trim();
        var p = prefix.Trim() + "-";
        if (code.StartsWith(p, StringComparison.OrdinalIgnoreCase)) code = code[p.Length..];
        else if (code.Contains('-')) return null;
        return int.TryParse(code, out var id) && id > 0 ? id : null;
    }

    public static string EnsureTag(string? subject, string tag)
    {
        subject = (subject ?? "").Trim();
        if (string.IsNullOrEmpty(tag) || subject.Contains(tag, StringComparison.OrdinalIgnoreCase)) return subject;
        subject = TagRegex.Replace(subject, "").Trim();
        return $"{subject} {tag}".Trim();
    }

    public static string? NormalizeMessageId(string? id) =>
        string.IsNullOrWhiteSpace(id) ? null : id.Trim().Trim('<', '>');

    // ─── Taslak ───────────────────────────────────────────────────────────
    public async Task<CrmMailDraft?> PrepareAsync(int offerId, int userId)
    {
        var offer = await _repo.GetOfferAsync(offerId);
        if (offer == null) return null;
        var opp = await _repo.GetOpportunityAsync(offer.OpportunityID);
        var me = userId > 0 ? await _repo.GetUserAsync(userId) : null;
        var prefix = await GetPrefixAsync();
        var prof = await ResolveProfileAsync(userId);

        var addresses = new List<string>();
        void Add(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            foreach (Match m in EmailRegex.Matches(text))
                if (!addresses.Contains(m.Value, StringComparer.OrdinalIgnoreCase)) addresses.Add(m.Value);
        }
        Add(opp?.ContactEmail);
        if (offer.ActionID is int aid)
        {
            var act = await _repo.GetActionAsync(aid);
            if (act?.CustomerContactID is int acid && opp?.CustomerCardID is int c0)
                foreach (var c in (await _repo.ListContactsAsync(c0)).Where(x => x.CustomerContactID == acid)) { Add(c.Email); Add(c.Contact); }
        }
        if (opp?.CustomerCardID is int cid)
        {
            var contacts = await _repo.ListContactsAsync(cid);
            foreach (var c in contacts.Where(x => x.CustomerContactID == opp.CustomerContactID)) { Add(c.Email); Add(c.Contact); }
            foreach (var c in contacts) { Add(c.Email); Add(c.Contact); }
        }

        var docNo = DocLabel(offer);
        var customer = opp?.CustomerTitle ?? "";
        var senderName = prof.Profile?.FromName ?? me?.FullName ?? "";
        var senderEmail = me?.Email ?? prof.Profile?.ReplyTo ?? prof.Profile?.FromAddress ?? "";
        var signature = prof.Profile?.Signature;
        var tag = BuildTag(offer.OpportunityID, prefix);
        var desc = string.IsNullOrWhiteSpace(offer.Description) ? "" : " - " + Cut(offer.Description.Replace("\r", " ").Replace("\n", " "), 80);
        var greet = string.IsNullOrWhiteSpace(opp?.ContactName) ? (string.IsNullOrWhiteSpace(customer) ? "Yetkili" : customer) : opp!.ContactName!;
        return new CrmMailDraft
        {
            OfferId = offer.OfferID,
            ActionId = offer.ActionID,
            OpportunityId = offer.OpportunityID,
            DocNumber = docNo,
            CustomerName = customer,
            Tag = tag,
            SenderName = senderName,
            SenderEmail = senderEmail,
            ProfileSource = prof.Profile == null ? null : prof.Source,
            SmtpReady = prof.SmtpReady,
            SuggestedAddresses = addresses,
            To = addresses.FirstOrDefault() ?? "",
            Subject = EnsureTag($"Teklif No: {docNo}{desc}", tag),
            Body =
                $"Sayın {greet},\n\n" +
                $"{docNo} numaralı teklifimizi bilgilerinize sunarız." +
                (offer.ValidityDate.HasValue ? $" Teklifimiz {offer.ValidityDate:dd.MM.yyyy} tarihine kadar geçerlidir." : "") +
                "\n\nSorularınız için bu maile yanıt verebilirsiniz.\n\n" +
                (string.IsNullOrWhiteSpace(signature) ? "Saygılarımızla,\n" + senderName : signature.Trim()),
            UserId = userId
        };
    }

    public static string DocLabel(CrmOfferDto o) => o.RevisionNo > 0 ? $"{o.DocNum}-R{o.RevisionNo}" : o.DocNum.ToString();

    // ─── Gönderim ─────────────────────────────────────────────────────────
    private async Task<MailMessage> BuildMessageAsync(CrmMailDraft d, CrmOfferDto offer)
    {
        d.Subject = EnsureTag(d.Subject, d.Tag);
        var to = ParseAddresses(d.To);
        if (to.Count == 0) throw new InvalidOperationException("En az bir geçerli alıcı (Kime) girin.");

        var msg = new MailMessage
        {
            Subject = d.Subject,
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8,
            HeadersEncoding = Encoding.UTF8,
        };
        foreach (var a in to) msg.To.Add(a);
        foreach (var a in ParseAddresses(d.Cc)) msg.CC.Add(a);
        msg.Headers.Add("X-KaviSoft-Tag", d.Tag);
        msg.Headers.Add("X-KaviSoft-OpportunityID", d.OpportunityId.ToString());
        msg.Headers.Add("X-KaviSoft-OfferID", d.OfferId.ToString());

        var opp = await _repo.GetOpportunityAsync(offer.OpportunityID);
        var settings = await _repo.GetSettingsAsync();
        var html = new StringBuilder();
        html.Append("<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:10.5pt;color:#1e293b\">");
        html.Append(WebUtility.HtmlEncode(d.Body ?? "").Replace("\n", "<br/>"));
        if (d.IncludeOfferTable)
        {
            html.Append("<br/><br/>");
            html.Append(OfferTableHtml(offer));
        }
        html.Append("</div>");
        msg.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(d.Body ?? "", Encoding.UTF8, "text/plain"));
        msg.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html.ToString(), Encoding.UTF8, "text/html"));

        if (d.AttachOfferHtml)
        {
            var doc = BuildOfferDocumentHtml(offer, opp, settings, forPrint: false);
            var att = new Attachment(new MemoryStream(Encoding.UTF8.GetBytes(doc)), $"Teklif_{SafeFile(DocLabel(offer))}.html", "text/html");
            msg.Attachments.Add(att);
        }
        return msg;
    }

    public async Task<CrmMailResult> SendSmtpAsync(CrmMailDraft d)
    {
        var offer = await _repo.GetOfferAsync(d.OfferId);
        if (offer == null) return Fail("Teklif bulunamadı.");
        var log = NewLog(d, "SMTP");
        try
        {
            var prof = await ResolveProfileAsync(d.UserId);
            var pr = prof.Profile;
            var host = pr?.SmtpHost?.Trim();
            var account = pr?.SmtpUser?.Trim();
            var from = pr?.FromAddress?.Trim();
            if (string.IsNullOrEmpty(from)) from = account;
            if (pr == null || string.IsNullOrEmpty(host) || string.IsNullOrEmpty(from))
                return Fail("Bu kullanıcı için geçerli bir SMTP tanımı yok. Sistem Yönetimi → Tanımlar → CRM Ayarları → Mail Tanımları'ndan Kullanıcı / Birim / Bölüm / Firma / Genel bazlı tanım yapın (veya 'Outlook'ta Aç' kullanın).");
            var port = pr.SmtpPort ?? 587;
            var ssl = pr.SmtpSsl;

            using var msg = await BuildMessageAsync(d, offer);
            msg.From = new MailAddress(from!, string.IsNullOrWhiteSpace(d.SenderName) ? (pr.FromName ?? from) : d.SenderName);
            if (!string.IsNullOrWhiteSpace(pr.BccAddress))
                foreach (var b in ParseAddresses(pr.BccAddress)) msg.Bcc.Add(b);
            if (!string.IsNullOrWhiteSpace(d.SenderEmail) && !d.SenderEmail.Equals(from, StringComparison.OrdinalIgnoreCase))
                msg.ReplyToList.Add(new MailAddress(d.SenderEmail, d.SenderName));
            if (d.CopyToMe && !string.IsNullOrWhiteSpace(d.SenderEmail))
                msg.Bcc.Add(new MailAddress(d.SenderEmail));
            var messageId = $"<{Guid.NewGuid():N}@kavisoft.crm>";
            msg.Headers.Add("Message-ID", messageId);

#pragma warning disable SYSLIB0014
            using (var client = new SmtpClient(host, port) { EnableSsl = ssl, DeliveryMethod = SmtpDeliveryMethod.Network })
            {
                if (!string.IsNullOrEmpty(account))
                    client.Credentials = new NetworkCredential(account, pr.SmtpPassword ?? "");
                await client.SendMailAsync(msg);
            }
#pragma warning restore SYSLIB0014

            log.MailFrom = from;
            log.Subject = Cut(msg.Subject, 500);
            log.MessageId = NormalizeMessageId(messageId);
            log.MailDate = DateTime.Now;
            log.Status = 1;
            log.AttachmentNames = string.Join(";", msg.Attachments.Select(a => a.Name));
            var id = await _repo.InsertMailAsync(log);
            if (offer.Status == 0) await _repo.SetOfferStatusAsync(offer.OfferID, 1);
            return new CrmMailResult { Success = true, MailLogId = id };
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Teklif maili gönderilemedi. Offer={OfferId}", d.OfferId);
            log.Status = 2;
            log.ErrorMessage = Cut(ex.InnerException?.Message ?? ex.Message, 2000);
            try { await _repo.InsertMailAsync(log); } catch { /* yut */ }
            return Fail(ex.InnerException?.Message ?? ex.Message);
        }
    }

    /// <summary>Mail tanımı testi: verilen profil ile kısa bir deneme maili gönderir.</summary>
    public static async Task<string?> SendTestAsync(CrmMailProfileDto p, string to)
    {
        if (string.IsNullOrWhiteSpace(p.SmtpHost)) return "Bu tanımda SMTP sunucusu yok.";
        var from = string.IsNullOrWhiteSpace(p.FromAddress) ? p.SmtpUser : p.FromAddress;
        if (string.IsNullOrWhiteSpace(from)) return "Gönderen adresi yok.";
        try
        {
            using var msg = new MailMessage
            {
                From = new MailAddress(from, p.FromName ?? from),
                Subject = "Kavi Soft CRM — mail tanımı testi",
                SubjectEncoding = Encoding.UTF8,
                BodyEncoding = Encoding.UTF8,
                Body = $"Bu bir test mailidir.\n\nTanım: {p.ScopeName} ({p.SmtpHost}:{p.SmtpPort ?? 587})\n\n{p.Signature}",
            };
            foreach (var a in ParseAddresses(to)) msg.To.Add(a);
            if (msg.To.Count == 0) return "Geçerli bir alıcı girin.";
#pragma warning disable SYSLIB0014
            using var client = new SmtpClient(p.SmtpHost.Trim(), p.SmtpPort ?? 587) { EnableSsl = p.SmtpSsl };
            if (!string.IsNullOrWhiteSpace(p.SmtpUser))
                client.Credentials = new NetworkCredential(p.SmtpUser.Trim(), p.SmtpPassword ?? "");
            await client.SendMailAsync(msg);
#pragma warning restore SYSLIB0014
            return null;
        }
        catch (Exception ex)
        {
            return ex.InnerException?.Message ?? ex.Message;
        }
    }

    /// <summary>Outlook'ta yeni mail penceresi olarak açılacak .eml (X-Unsent: 1). Gönderilince eklenti "Gönderildi" yapar.</summary>
    public async Task<CrmMailResult> BuildOutlookDraftAsync(CrmMailDraft d)
    {
        var offer = await _repo.GetOfferAsync(d.OfferId);
        if (offer == null) return Fail("Teklif bulunamadı.");
        try
        {
            using var msg = await BuildMessageAsync(d, offer);
            msg.From = new MailAddress(string.IsNullOrWhiteSpace(d.SenderEmail) ? "kullanici@outlook.local" : d.SenderEmail, d.SenderName);
            msg.Headers.Add("X-Unsent", "1");

            var dir = Path.Combine(Path.GetTempPath(), "KaviSoftCrm", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(dir);
            byte[] bytes;
            try
            {
#pragma warning disable SYSLIB0014
                using (var client = new SmtpClient("localhost") { DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory, PickupDirectoryLocation = dir })
                    client.Send(msg);
#pragma warning restore SYSLIB0014
                var file = Directory.GetFiles(dir, "*.eml").FirstOrDefault() ?? throw new InvalidOperationException("EML üretilemedi.");
                var text = await File.ReadAllTextAsync(file);
                // Taslakta gönderen boş kalsın: Outlook kullanıcının kendi hesabını seçer
                if (string.IsNullOrWhiteSpace(d.SenderEmail))
                    text = Regex.Replace(text, @"^(X-Sender|X-Receiver|From):.*\r?\n(\s+.*\r?\n)*", "", RegexOptions.Multiline);
                else
                    text = Regex.Replace(text, @"^(X-Sender|X-Receiver):.*\r?\n", "", RegexOptions.Multiline);
                bytes = Encoding.UTF8.GetBytes(text);
            }
            finally
            {
                try { Directory.Delete(dir, true); } catch { }
            }

            var log = NewLog(d, "OUTLOOK_DRAFT");
            log.Status = 0;
            log.Subject = Cut(msg.Subject, 500);
            log.AttachmentNames = string.Join(";", msg.Attachments.Select(a => a.Name));
            var id = await _repo.InsertMailAsync(log);
            return new CrmMailResult { Success = true, MailLogId = id, FileBytes = bytes, FileName = $"Teklif_{SafeFile(DocLabel(offer))}.eml" };
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Outlook taslağı oluşturulamadı. Offer={OfferId}", d.OfferId);
            return Fail(ex.Message);
        }
    }

    private CrmRepository.MailLogWrite NewLog(CrmMailDraft d, string channel) => new()
    {
        OpportunityID = d.OpportunityId,
        ActionID = d.ActionId,
        OfferID = d.OfferId,
        Direction = 1,
        Channel = channel,
        TagCode = d.Tag.Trim('/', '#'),
        Subject = Cut(EnsureTag(d.Subject, d.Tag), 500),
        MailFrom = d.SenderEmail,
        MailTo = Cut(d.To, 2000),
        MailCc = Cut(d.Cc, 2000),
        Body = d.Body,
        IsHtml = false,
        CreateUserID = d.UserId > 0 ? d.UserId : null,
        Source = "Kavi Soft"
    };

    // ─── Teklif HTML ──────────────────────────────────────────────────────
    private static string N(decimal v) => v.ToString("N2", Tr);
    private static string H(string? s) => WebUtility.HtmlEncode(s ?? "");

    public static string OfferTableHtml(CrmOfferDto o)
    {
        var cur = o.CurrencyCode ?? "TRY";
        var sb = new StringBuilder();
        const string th = "style=\"background:#1e3a5f;color:#fff;padding:6px 8px;font-size:9pt;text-align:left\"";
        const string td = "style=\"padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9.5pt\"";
        const string tdr = "style=\"padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9.5pt;text-align:right;white-space:nowrap\"";
        sb.Append("<table cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;width:100%;max-width:760px\">");
        sb.Append($"<tr><th {th}>#</th><th {th}>Ürün / Hizmet</th><th {th}>Miktar</th><th {th}>Birim Fiyat</th><th {th}>İsk.</th><th {th}>KDV</th><th {th}>Tutar</th></tr>");
        foreach (var l in o.Lines)
        {
            var name = string.IsNullOrWhiteSpace(l.ProductCode) ? H(l.Description) : $"<b>{H(l.ProductCode)}</b> {H(l.Description)}";
            sb.Append($"<tr><td {td}>{l.LineNr}</td><td {td}>{name}</td><td {tdr}>{l.Quantity.ToString("0.##", Tr)} {H(l.UnitName)}</td>" +
                      $"<td {tdr}>{N(l.Price)}</td><td {tdr}>{(l.DiscountAmount > 0 ? N(l.DiscountAmount) : "-")}</td>" +
                      $"<td {tdr}>%{l.VatRate.ToString("0.##", Tr)}</td><td {tdr}>{N(l.NetTotal)}</td></tr>");
        }
        void Tot(string label, decimal v, bool bold = false) =>
            sb.Append($"<tr><td colspan=\"6\" {tdr}>{(bold ? "<b>" : "")}{label}{(bold ? "</b>" : "")}</td><td {tdr}>{(bold ? "<b>" : "")}{N(v)} {H(cur)}{(bold ? "</b>" : "")}</td></tr>");
        Tot("Ara Toplam", o.SubTotal);
        if (o.GeneralDiscount != 0) Tot("Genel İskonto", -o.GeneralDiscount);
        Tot("KDV", o.VatTotal);
        Tot("Genel Toplam", o.GrandTotal, true);
        sb.Append("</table>");
        return sb.ToString();
    }

    public static string BuildOfferDocumentHtml(CrmOfferDto o, CrmOpportunityDto? opp, Dictionary<string, string?> s, bool forPrint)
    {
        var company = s.GetValueOrDefault("CompanyName") ?? "Kavi Soft";
        var companyInfo = s.GetValueOrDefault("CompanyInfo") ?? "";
        var footer = s.GetValueOrDefault("OfferFooter") ?? "";
        var sb = new StringBuilder();
        sb.Append("<!doctype html><html lang=\"tr\"><head><meta charset=\"utf-8\"/>");
        sb.Append($"<title>Teklif {H(DocLabel(o))}</title>");
        sb.Append("<style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;margin:0;background:#f1f5f9}" +
                  ".page{max-width:820px;margin:24px auto;background:#fff;padding:36px 40px;box-shadow:0 1px 4px rgba(0,0,0,.08)}" +
                  "h1{font-size:20pt;margin:0;color:#1e3a5f}.muted{color:#64748b;font-size:9pt}" +
                  ".head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px}" +
                  ".box{font-size:9.5pt;line-height:1.5}.grid{display:flex;gap:24px;margin-bottom:18px}.grid>div{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px}" +
                  ".lbl{font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#64748b}" +
                  ".terms{margin-top:18px;font-size:9pt;white-space:pre-wrap}.toolbar{max-width:820px;margin:16px auto 0;text-align:right}" +
                  ".toolbar button{background:#1e3a5f;color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:10pt}" +
                  "@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none;padding:0}.toolbar{display:none}}</style></head><body>");
        if (forPrint)
            sb.Append("<div class=\"toolbar\"><button onclick=\"window.print()\">Yazdır / PDF Kaydet</button></div>");
        sb.Append("<div class=\"page\"><div class=\"head\"><div>");
        sb.Append($"<h1>{H(company)}</h1><div class=\"muted\" style=\"white-space:pre-wrap\">{H(companyInfo)}</div></div>");
        sb.Append($"<div class=\"box\" style=\"text-align:right\"><div style=\"font-size:15pt;font-weight:700;color:#1e3a5f\">FİYAT TEKLİFİ</div>" +
                  $"<div>No: <b>{H(DocLabel(o))}</b></div><div>Tarih: {o.OfferDate:dd.MM.yyyy}</div>" +
                  (o.ValidityDate.HasValue ? $"<div>Geçerlilik: {o.ValidityDate:dd.MM.yyyy}</div>" : "") + "</div></div>");
        sb.Append("<div class=\"grid\"><div><div class=\"lbl\">Sayın</div>");
        sb.Append($"<div class=\"box\"><b>{H(opp?.CustomerTitle)}</b>");
        if (!string.IsNullOrWhiteSpace(opp?.ContactName)) sb.Append($"<br/>{H(opp!.ContactName)}");
        if (!string.IsNullOrWhiteSpace(opp?.ContactEmail)) sb.Append($"<br/>{H(opp!.ContactEmail)}");
        if (!string.IsNullOrWhiteSpace(opp?.ContactPhone)) sb.Append($"<br/>{H(opp!.ContactPhone)}");
        sb.Append("</div></div><div><div class=\"lbl\">Konu</div>");
        sb.Append($"<div class=\"box\"><b>{H(o.Description ?? opp?.Title)}</b><br/>Para birimi: {H(o.CurrencyCode ?? "TRY")}");
        if (!string.IsNullOrWhiteSpace(o.CreateUserName)) sb.Append($"<br/>Hazırlayan: {H(o.CreateUserName)}");
        sb.Append("</div></div></div>");
        sb.Append(OfferTableHtml(o));
        var terms = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(o.PaymentTerms)) terms.Append($"<b>Ödeme:</b> {H(o.PaymentTerms)}\n");
        if (!string.IsNullOrWhiteSpace(o.DeliveryTerms)) terms.Append($"<b>Teslimat:</b> {H(o.DeliveryTerms)}\n");
        if (!string.IsNullOrWhiteSpace(o.Notes)) terms.Append($"\n{H(o.Notes)}\n");
        if (!string.IsNullOrWhiteSpace(footer)) terms.Append($"\n{H(footer)}");
        if (terms.Length > 0) sb.Append($"<div class=\"terms\">{terms}</div>");
        sb.Append("</div></body></html>");
        return sb.ToString();
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────
    private static List<MailAddress> ParseAddresses(string? text)
    {
        var list = new List<MailAddress>();
        if (string.IsNullOrWhiteSpace(text)) return list;
        foreach (Match m in EmailRegex.Matches(text))
            if (!list.Any(a => a.Address.Equals(m.Value, StringComparison.OrdinalIgnoreCase)))
                list.Add(new MailAddress(m.Value));
        return list;
    }

    public static string SafeFile(string? s)
    {
        s = string.IsNullOrWhiteSpace(s) ? "Teklif" : s;
        foreach (var c in Path.GetInvalidFileNameChars()) s = s.Replace(c, '_');
        return s;
    }

    public static string? Cut(string? s, int max) =>
        string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);

    private static CrmMailResult Fail(string msg) => new() { Success = false, Error = msg };
}
