using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services.EGovRules;

namespace BartuERP.Backend.Services;

public sealed class OutgoingPrepareOptions
{
    /// <summary>TEMELFATURA · TICARIFATURA (e-Arşiv'de yok sayılır)</summary>
    public string? Profile { get; set; }
    public string? ReturnInvoiceNo { get; set; }
    public DateTime? ReturnInvoiceDate { get; set; }
    /// <summary>true: önizleme HTML'i üretilsin</summary>
    public bool Html { get; set; } = true;
}

public sealed class OutgoingRoundTrip
{
    public bool Ok { get; set; }
    public List<string> Diffs { get; set; } = new();
}

public sealed class OutgoingPrepareResult
{
    public int InvoiceId { get; set; }
    public string? DocumentNumber { get; set; }
    public int? CompanyId { get; set; }
    /// <summary>1 e-Fatura · 2 e-Arşiv</summary>
    public byte DocKind { get; set; }
    public string ProfileId { get; set; } = "";
    public string TypeCode { get; set; } = "";
    public string InvoiceNo { get; set; } = "";
    public bool InvoiceNoIsProjected { get; set; }
    public string? ReceiverAlias { get; set; }
    /// <summary>cari · gib · yok</summary>
    public string ReceiverAliasSource { get; set; } = "yok";
    public UblInvoiceWriter.Totals Totals { get; set; } = new(0, 0, 0, 0, 0, 0, 0);
    public decimal ProgramTax { get; set; }
    public decimal ProgramTotal { get; set; }
    public OutgoingRoundTrip RoundTrip { get; set; } = new();
    public List<UblIssue> Issues { get; set; } = new();
    public List<RuleStepResult> RuleSteps { get; set; } = new();
    public string? DesignTitle { get; set; }
    public string Xml { get; set; } = "";
    public string? Html { get; set; }
    public string? HtmlError { get; set; }
    public bool IsLive { get; set; }
    public string? IntegratorUrl { get; set; }
    public bool SendAllowed { get; set; }
    public string? SendBlockReason { get; set; }
    public int? EGovDocumentId { get; set; }
    public string? SendStatus { get; set; }
    public DateTime? SentAt { get; set; }
}

/// <summary>Gönderim reddi (409): canlı adres kilidi, eksik ayar ya da doğrulama hatası</summary>
public sealed class OutgoingSendBlockedException(string message) : Exception(message);

/// <summary>
/// E-03 giden e-fatura: fatura → UBL-TR → belge kuralları → XSLT → doğrulama → (kilitli) e-Logo gönderimi.
/// Önizleme hiçbir şeyi kalıcı yapmaz (numara ayrılmaz, kurallar önizleme kipinde çalışır).
/// </summary>
public sealed class EGovOutgoingService
{
    private readonly EGovOutgoingRepository _repo;
    private readonly EGovRuleEngine _rules;
    private readonly EGovDesignRepository _designs;
    private readonly UblValidator _validator;
    private readonly ELogoDocumentSyncService _elogo;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<EGovOutgoingService> _log;

    public EGovOutgoingService(EGovOutgoingRepository repo, EGovRuleEngine rules, EGovDesignRepository designs, UblValidator validator,
        ELogoDocumentSyncService elogo, IHttpClientFactory httpFactory, ILogger<EGovOutgoingService> log)
    {
        _repo = repo;
        _rules = rules;
        _designs = designs;
        _validator = validator;
        _elogo = elogo;
        _httpFactory = httpFactory;
        _log = log;
    }

    /// <summary>Test / demo adresi değilse canlı sayılır (bilinmeyen adres de canlıdır)</summary>
    public static bool IsLiveUrl(string? url)
    {
        var u = (url ?? "").ToLowerInvariant();
        return !(u.Contains("test") || u.Contains("demo") || u.Contains("localhost") || u.Contains("127.0.0.1"));
    }

    public async Task<OutgoingPrepareResult> PreviewAsync(int invoiceId, OutgoingPrepareOptions o, CancellationToken ct)
    {
        var d = await _repo.LoadAsync(invoiceId, ct) ?? throw new KeyNotFoundException("Fatura bulunamadı.");
        var r = await BuildAsync(d, o, number: null, forSend: false, ct);
        await FillSendStateAsync(d, r, ct);
        return r;
    }

    /// <summary>Gönderim: kilit ve ayar kontrolleri numara / kalıcı kurallardan ÖNCE yapılır</summary>
    public async Task<OutgoingPrepareResult> SendAsync(int invoiceId, OutgoingPrepareOptions o, int? userId, CancellationToken ct)
    {
        var d = await _repo.LoadAsync(invoiceId, ct) ?? throw new KeyNotFoundException("Fatura bulunamadı.");

        // 1) Önizleme kipinde hazırla: doğrulama hatası, kilit, eksik ayar varsa hiçbir şey kalıcı olmadan dur
        var check = await BuildAsync(d, new OutgoingPrepareOptions
        {
            Profile = o.Profile, ReturnInvoiceNo = o.ReturnInvoiceNo, ReturnInvoiceDate = o.ReturnInvoiceDate, Html = false,
        }, number: null, forSend: false, ct);
        await FillSendStateAsync(d, check, ct);
        if (!check.SendAllowed) throw new OutgoingSendBlockedException(check.SendBlockReason ?? "Gönderim yapılamaz.");

        var cred = (await _elogo.ListCompaniesAsync(ct)).First(c => c.CompanyId == d.CompanyId);
        var setting = await _repo.GetSettingAsync(d.CompanyId!.Value, ct);

        // 2) Numara: hatalı gönderimin yeniden denenmesinde aynı numara / ETTN kullanılır
        string number;
        if (d.SendStatus == "Hata" && !string.IsNullOrWhiteSpace(d.SentDocumentNo) && !string.IsNullOrWhiteSpace(d.SentUuid))
        {
            number = d.SentDocumentNo!;
            d.Invoice.Uuid = d.SentUuid!;
        }
        else
        {
            var prefix = Prefix(setting, check.DocKind)!;
            using var tx = OpenTx();
            number = await _repo.NextNumberAsync(d.CompanyId.Value, prefix, d.Invoice.IssueDate.Year, tx, ct);
            tx.Commit();
        }

        // 3) Kalıcı kurallar + XSLT + doğrulama
        var r = await BuildAsync(d, new OutgoingPrepareOptions
        {
            Profile = o.Profile, ReturnInvoiceNo = o.ReturnInvoiceNo, ReturnInvoiceDate = o.ReturnInvoiceDate, Html = false,
        }, number, forSend: true, ct);
        r.IsLive = check.IsLive;
        r.IntegratorUrl = check.IntegratorUrl;
        if (r.Issues.Any(i => i.Level == "error"))
        {
            await _repo.SaveSentAsync(d, number, d.Invoice.Uuid, r.DocKind, r.Xml, "Hata", "Doğrulama: " + string.Join(" · ", r.Issues.Where(i => i.Level == "error").Select(i => i.Message)), userId, null, ct);
            throw new OutgoingSendBlockedException("Belge kurallarından sonra doğrulama hatası çıktı; numara ayrıldı, düzeltip yeniden gönderin.");
        }

        // 4) e-Logo
        string status;
        string? error = null;
        try
        {
            var http = _httpFactory.CreateClient("IntegratorEFatura");
            await using var client = new ELogoPostBoxClient(http, ELogoDocumentSyncService.ResolvePostBoxUrl(cred.IntegratorWsUrl),
                cred.IntegratorUser!, cred.IntegratorPassword!, ownsHttp: false);
            await client.LoginAsync(ct);
            var (ok, code, msg) = await client.SendDocumentAsync(r.Xml, d.Invoice.Uuid, r.DocKind == 2 ? "EARCHIVE" : "EINVOICE", r.ReceiverAlias, ct);
            status = ok ? "Gönderildi" : "Hata";
            if (!ok) error = $"e-Logo resultCode={code}: {msg}";
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "e-Fatura gönderimi başarısız: {InvoiceId}", invoiceId);
            status = "Hata";
            error = ex.Message;
        }

        r.EGovDocumentId = await _repo.SaveSentAsync(d, number, d.Invoice.Uuid, r.DocKind, r.Xml, status, error, userId, null, ct);
        r.SendStatus = status;
        r.SendAllowed = false;
        r.SendBlockReason = status == "Gönderildi" ? "Belge gönderildi." : error;
        return r;
    }

    /// <summary>Gönderilmiş belgenin e-Logo / GİB durumu (yalnız okuma — canlı adreste de çalışır)</summary>
    public async Task<Dictionary<string, string>> StatusAsync(int egovDocumentId, CancellationToken ct)
    {
        var doc = await _repo.GetDocumentAsync(egovDocumentId, ct) ?? throw new KeyNotFoundException("Belge bulunamadı.");
        if (string.IsNullOrWhiteSpace(doc.Uuid)) throw new InvalidOperationException("Belgenin ETTN'si yok.");
        var companies = await _elogo.ListCompaniesAsync(ct);
        var cred = (doc.CompanyId is int cid ? companies.FirstOrDefault(c => c.CompanyId == cid) : null)
                   ?? await _elogo.FindELogoCompanyAsync(ct)
                   ?? throw new InvalidOperationException("e-Logo kullanıcısı tanımlı firma yok.");
        var http = _httpFactory.CreateClient("IntegratorEFatura");
        await using var client = new ELogoPostBoxClient(http, ELogoDocumentSyncService.ResolvePostBoxUrl(cred.IntegratorWsUrl),
            cred.IntegratorUser!, cred.IntegratorPassword!, ownsHttp: false);
        await client.LoginAsync(ct);
        var type = doc.DocKind switch { 2 => "EARCHIVE", 3 => "EDESPATCH", _ => "EINVOICE" };
        return await client.GetDocumentStatusAsync(doc.Uuid!, type, ct);
    }

    private System.Data.IDbTransaction OpenTx() => _repo.BeginTransaction();

    private static string? Prefix(EGovSendSetting s, byte docKind)
    {
        var p = docKind == 2 ? s.EArchivePrefix : s.EInvoicePrefix;
        return string.IsNullOrWhiteSpace(p) ? null : p.Trim().ToUpperInvariant();
    }

    private async Task<OutgoingPrepareResult> BuildAsync(OutgoingInvoiceData d, OutgoingPrepareOptions o, string? number, bool forSend, CancellationToken ct)
    {
        var inv = d.Invoice;
        var r = new OutgoingPrepareResult
        {
            InvoiceId = d.InvoiceId, DocumentNumber = d.DocumentNumber, CompanyId = d.CompanyId,
            ProgramTax = d.ProgramTax, ProgramTotal = d.ProgramTotal,
        };
        if (!EGovOutgoingRepository.IsOutgoingType(d.InvoiceType))
            r.Issues.Add(new UblIssue { Message = "Bu fatura tipi e-belge olarak gönderilmez (yalnız satış, satış iade ve alış iade)." });
        var setting = d.CompanyId is int cid ? await _repo.GetSettingAsync(cid, ct) : new EGovSendSetting();

        // Alıcı etiketi: cari adresi → GİB mükellef listesi → yoksa e-Arşiv
        if (!string.IsNullOrWhiteSpace(d.PostLabel))
        {
            r.ReceiverAlias = d.PostLabel;
            r.ReceiverAliasSource = "cari";
        }
        else if (!string.IsNullOrWhiteSpace(inv.Customer.TaxNr) && await _repo.FindPostLabelAsync(inv.Customer.TaxNr, ct) is { } alias)
        {
            r.ReceiverAlias = alias;
            r.ReceiverAliasSource = "gib";
        }
        r.DocKind = r.ReceiverAlias == null ? (byte)2 : (byte)1;

        // Tip: iade → IADE; tevkifatlı satır → TEVKIFAT; istisna kodlu (351 dışı) satır → ISTISNA
        var isReturn = d.InvoiceType is 3 or 4;
        inv.TypeCode = isReturn ? "IADE"
            : inv.Lines.Any(l => !string.IsNullOrWhiteSpace(l.WithholdingCode)) ? "TEVKIFAT"
            : inv.Lines.Any(l => l.TaxRate == 0 && !string.IsNullOrWhiteSpace(l.ExemptionCode) && l.ExemptionCode != "351") ? "ISTISNA"
            : "SATIS";
        if (r.DocKind == 2) inv.ProfileId = "EARSIVFATURA";
        else
        {
            var p = (o.Profile ?? setting.DefaultProfile ?? "TICARIFATURA").Trim().ToUpperInvariant();
            inv.ProfileId = p is "TEMELFATURA" or "TICARIFATURA" ? p : "TICARIFATURA";
            // İade TICARIFATURA ile gönderilemez
            if (isReturn && o.Profile == null) inv.ProfileId = "TEMELFATURA";
        }
        inv.ReturnInvoiceNo = string.IsNullOrWhiteSpace(o.ReturnInvoiceNo) ? null : o.ReturnInvoiceNo.Trim();
        inv.ReturnInvoiceDate = o.ReturnInvoiceDate;

        // Numara: önizlemede sayaçtan öngörülen (ayrılmaz)
        var prefix = Prefix(setting, r.DocKind);
        if (number != null) inv.InvoiceNo = number;
        else
        {
            r.InvoiceNoIsProjected = true;
            if (prefix == null)
            {
                r.Issues.Add(new UblIssue { Message = $"{(r.DocKind == 2 ? "e-Arşiv" : "e-Fatura")} seri öneki tanımlı değil (E-Devlet → Tanımlar → Gönderim Ayarları)." });
                inv.InvoiceNo = "XXX" + inv.IssueDate.Year + "000000000";
            }
            else
            {
                var last = d.CompanyId is int c2
                    ? (await _repo.ListCountersAsync(c2, ct)).FirstOrDefault(x => x.Prefix == prefix && x.Year == inv.IssueDate.Year)?.LastValue ?? 0
                    : 0;
                inv.InvoiceNo = $"{prefix}{inv.IssueDate.Year}{last + 1:000000000}";
            }
        }
        r.InvoiceNo = inv.InvoiceNo;
        r.ProfileId = inv.ProfileId;
        r.TypeCode = inv.TypeCode;

        r.Issues.AddRange(UblValidator.CheckRules(inv, numberRequired: number != null));
        r.Totals = UblInvoiceWriter.Calc(inv);

        // UBL → belge kuralları (gönderimde kalıcı, önizlemede değil)
        var xml = UblInvoiceWriter.Write(inv);
        try
        {
            var rr = forSend
                ? await _rules.ApplyForSendAsync(xml, r.DocKind, d.InvoiceId, null, d.CompanyId, ct)
                : await _rules.RunAsync(new RuleRunRequest { Xml = xml, DocKind = r.DocKind, Direction = 2, InvoiceId = d.InvoiceId, CompanyId = d.CompanyId }, ct);
            r.RuleSteps = rr.Steps;
            if (!string.IsNullOrWhiteSpace(rr.Xml)) xml = rr.Xml!;
            foreach (var s in rr.Steps.Where(s => s.Status == "error"))
                r.Issues.Add(new UblIssue { Level = "warning", Source = "kural", Message = $"Belge kuralı «{s.RuleName}» hata verdi: {s.Message}" });
        }
        catch (Exception ex)
        {
            r.Issues.Add(new UblIssue { Level = "warning", Source = "kural", Message = "Belge kuralları çalıştırılamadı: " + ex.Message });
        }

        // XSLT tasarımı (E-Devlet → Tanımlar → Tasarımlar kuralları); yoksa e-Logo varsayılanı
        string? xslt = null;
        try
        {
            short docType = r.DocKind == 2 ? (short)(isReturn ? 13 : 3) : (short)(isReturn ? 2 : 1);
            var ctxDesign = new EGovDesignContext { ReceiverTaxNr = inv.Customer.TaxNr, CustomerCode = d.CustomerCode };
            var res = await _designs.ResolveAsync(docType, ctxDesign, ct)
                      ?? (isReturn ? await _designs.ResolveAsync(r.DocKind == 2 ? (short)3 : (short)1, ctxDesign, ct) : null);
            if (res != null && await _designs.GetDesignAsync(res.EGovXsltDesignID, ct) is { } design)
            {
                xslt = design.XsltContent;
                r.DesignTitle = design.Title;
                xml = UblInvoiceWriter.EmbedXslt(xml, design.XsltContent, design.FileName ?? design.Title);
            }
            else r.Issues.Add(new UblIssue { Level = "info", Message = "Tasarım kuralı yok; e-Logo varsayılan tasarımı kullanılır." });
        }
        catch (Exception ex)
        {
            r.Issues.Add(new UblIssue { Level = "warning", Message = "XSLT tasarımı gömülemedi: " + ex.Message });
        }
        r.Xml = xml;

        r.Issues.AddRange(_validator.CheckXsd(xml));
        r.RoundTrip = RoundTrip(xml, r.Totals, d);

        if (o.Html && xslt != null)
        {
            try { r.Html = EGovXsltService.Transform(xslt, xml); }
            catch (Exception ex) { r.HtmlError = ex.Message; }
        }
        return r;
    }

    /// <summary>Yaz → oku: UblInvoiceReader toplamları üretici ve programdaki fatura toplamlarıyla aynı olmalı</summary>
    private static OutgoingRoundTrip RoundTrip(string xml, UblInvoiceWriter.Totals t, OutgoingInvoiceData d)
    {
        var rt = new OutgoingRoundTrip();
        try
        {
            var back = UblInvoiceReader.Read(xml);
            void Cmp(string what, decimal a, decimal b, decimal tol)
            {
                if (Math.Abs(a - b) > tol) rt.Diffs.Add($"{what}: {a:N2} ≠ {b:N2}");
            }
            Cmp("Mal / hizmet toplamı (UBL okuma)", back.LineExtensionAmount, t.LineExtension, 0.001m);
            Cmp("KDV (UBL okuma)", back.TaxTotal, t.Tax, 0.001m);
            Cmp("Ödenecek (UBL okuma)", back.PayableAmount, t.Payable, 0.001m);
            Cmp("Satır sayısı (UBL okuma)", back.Lines.Count, d.Invoice.Lines.Count, 0);
            // Program satır bazında yuvarlıyor olabilir: satır başına 1 kuruş tolerans
            var tol = 0.01m * Math.Max(1, d.Invoice.Lines.Count);
            Cmp("KDV (faturadaki)", t.Tax, d.ProgramTax, tol);
            Cmp("KDV dahil toplam (faturadaki)", t.TaxInclusive, d.ProgramTotal, tol);
        }
        catch (Exception ex)
        {
            rt.Diffs.Add("UBL geri okunamadı: " + ex.Message);
        }
        rt.Ok = rt.Diffs.Count == 0;
        return rt;
    }

    private async Task FillSendStateAsync(OutgoingInvoiceData d, OutgoingPrepareResult r, CancellationToken ct)
    {
        r.EGovDocumentId = d.EGovDocumentId;
        r.SendStatus = d.SendStatus;
        r.SentAt = d.SentAt;
        if (d.SendStatus == "Gönderildi" && d.SentDocumentNo != null)
        {
            r.InvoiceNo = d.SentDocumentNo;
            r.InvoiceNoIsProjected = false;
        }

        var cred = d.CompanyId is int cid ? (await _elogo.ListCompaniesAsync(ct)).FirstOrDefault(c => c.CompanyId == cid) : null;
        r.IntegratorUrl = cred?.IntegratorWsUrl;
        r.IsLive = IsLiveUrl(cred?.IntegratorWsUrl);
        var setting = d.CompanyId is int c2 ? await _repo.GetSettingAsync(c2, ct) : new EGovSendSetting();

        string? why = null;
        if (d.SendStatus == "Gönderildi") why = "Belge daha önce gönderildi.";
        else if (cred == null || string.IsNullOrWhiteSpace(cred.IntegratorUser) || string.IsNullOrWhiteSpace(cred.IntegratorPassword))
            why = "Firmada e-Logo kullanıcısı tanımlı değil.";
        else if ((cred.IntegratorName ?? "").Trim().ToUpperInvariant() is not ("ELOGO" or "LOGO" or "E-LOGO"))
            why = "Gönderim yalnız e-Logo entegratörüyle yapılabilir.";
        else if (r.IsLive && !setting.AllowLiveSend)
            why = "Canlı entegratör hesabında gönderim kapalı (test hesabıyla deneyin).";
        else if (r.Issues.Any(i => i.Level == "error")) why = "Doğrulama hataları giderilmeden gönderilemez.";
        r.SendAllowed = why == null;
        r.SendBlockReason = why;
    }
}
