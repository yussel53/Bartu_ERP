using BartuERP.Backend.Repositories;

namespace BartuERP.Backend.Services;

public sealed class EGovResponseState
{
    public int EGovDocumentID { get; set; }
    public string? DocumentNo { get; set; }
    public string? CustomerTitle { get; set; }
    public string? ProfileId { get; set; }
    /// <summary>1 Gelen · 2 Giden</summary>
    public byte Direction { get; set; }
    public byte DocKind { get; set; }
    public int? InvoiceID { get; set; }
    public string? Status { get; set; }
    /// <summary>KABUL / RED için son gün (belge tarihi + 8 gün)</summary>
    public DateTime? Deadline { get; set; }
    public int? DaysLeft { get; set; }
    public bool CanRespond { get; set; }
    public string? RespondBlockReason { get; set; }
    public bool IsLive { get; set; }
    public string? ResponseCode { get; set; }
    public string? ResponseNote { get; set; }
    public DateTime? ResponseAt { get; set; }
    public string? ResponseStatus { get; set; }
    public string? ResponseError { get; set; }
    public List<EGovObjectionRow> Objections { get; set; } = new();
    /// <summary>Etkin itiraz / iptal ya da gönderilmiş RED varken programdaki kayıtlı faturaya uyarı</summary>
    public string? InvoiceWarning { get; set; }
}

/// <summary>Kabul / red reddi (409): süre, senaryo, kilit</summary>
public sealed class EGovResponseBlockedException(string message) : Exception(message);

/// <summary>
/// Gelen TİCARİ faturaya KABUL / RED (e-Logo uygulama yanıtı) ve harici itiraz / iptal kaydı.
/// GİB: yanıt yalnız TICARIFATURA'da, belgenin alınmasından itibaren 8 gün içinde verilir; sonrası TTK 18/3 yolları
/// (KEP · noter · telgraf · taahhütlü mektup) ile yapılır ve programa kayıt olarak girilir.
/// </summary>
public sealed class EGovResponseService
{
    public const int ResponseDays = 8;

    private readonly EGovResponseRepository _repo;
    private readonly EGovOutgoingService _outgoing;
    private readonly ELogoDocumentSyncService _elogo;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<EGovResponseService> _log;

    public EGovResponseService(EGovResponseRepository repo, EGovOutgoingService outgoing, ELogoDocumentSyncService elogo,
        IHttpClientFactory httpFactory, ILogger<EGovResponseService> log)
    {
        _repo = repo;
        _outgoing = outgoing;
        _elogo = elogo;
        _httpFactory = httpFactory;
        _log = log;
    }

    public async Task<EGovResponseState> StateAsync(int id, CancellationToken ct)
    {
        var d = await _repo.GetAsync(id, ct) ?? throw new KeyNotFoundException("Belge bulunamadı.");
        var s = new EGovResponseState
        {
            EGovDocumentID = d.EGovDocumentID, DocumentNo = d.DocumentNo, CustomerTitle = d.CustomerTitle, ProfileId = d.ProfileId,
            Direction = d.Direction, DocKind = d.DocKind, InvoiceID = d.InvoiceID, Status = d.Status,
            ResponseCode = d.ResponseCode, ResponseNote = d.ResponseNote, ResponseAt = d.ResponseAt,
            ResponseStatus = d.ResponseStatus, ResponseError = d.ResponseError,
            Objections = await _repo.ListObjectionsAsync(id, ct),
        };

        var day = d.DocumentDate ?? d.CreatedAt;
        if (day is DateTime start)
        {
            s.Deadline = start.Date.AddDays(ResponseDays);
            s.DaysLeft = (s.Deadline.Value - DateTime.Today).Days;
        }

        var cred = await _elogo.FindELogoCompanyAsync(ct);
        var (_, live, lockWhy) = await _outgoing.IntegratorLockAsync(cred?.CompanyId, ct);
        s.IsLive = live;

        string? why = null;
        if (d.Direction != 1 || d.DocKind != 1) why = "Kabul / red yalnız gelen e-faturada verilir.";
        else if (!string.Equals(d.ProfileId, "TICARIFATURA", StringComparison.OrdinalIgnoreCase))
            why = "Kabul / red yalnız TİCARİ faturada verilir (TEMEL faturada yanıt yoktur).";
        else if (d.ResponseStatus == "Gönderildi") why = $"Faturaya {d.ResponseCode} yanıtı verildi.";
        else if (s.Objections.Any(o => o.IsActive)) why = "Belgede harici itiraz / iptal kaydı var.";
        else if (string.IsNullOrWhiteSpace(d.UUID)) why = "Belgenin ETTN'si yok.";
        else if (s.Deadline is DateTime dl && DateTime.Now.Date > dl)
            why = $"8 günlük yanıt süresi {dl:dd.MM.yyyy} tarihinde doldu; itiraz KEP / noter / telgraf / taahhütlü mektupla yapılıp «İtiraz kaydet» ile girilir.";
        else if (lockWhy != null) why = lockWhy.Replace("gönderim", "kabul / red");
        s.CanRespond = why == null;
        s.RespondBlockReason = why;

        var rejected = d.ResponseStatus == "Gönderildi" && d.ResponseCode == "RED";
        if (d.InvoiceID is int inv && (rejected || s.Objections.Any(o => o.IsActive)))
            s.InvoiceWarning = $"Bu belge programa fatura #{inv} olarak kaydedilmiş. Fatura ve muhasebe kaydı iade / iptal fişiyle düzeltilmeli.";
        return s;
    }

    /// <summary>KABUL / RED — kilit ve süre e-Logo çağrısından önce denetlenir</summary>
    public async Task<EGovResponseState> RespondAsync(int id, string code, string? note, int? userId, CancellationToken ct)
    {
        code = (code ?? "").Trim().ToUpperInvariant();
        if (code is not ("KABUL" or "RED")) throw new EGovResponseBlockedException("Yanıt KABUL ya da RED olmalı.");
        note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (code == "RED" && note == null) throw new EGovResponseBlockedException("Red gerekçesi yazın.");
        if (note is { Length: > 500 }) throw new EGovResponseBlockedException("Açıklama en fazla 500 karakter olmalı.");

        var s = await StateAsync(id, ct);
        if (!s.CanRespond) throw new EGovResponseBlockedException(s.RespondBlockReason ?? "Yanıt verilemez.");
        var d = (await _repo.GetAsync(id, ct))!;
        var cred = (await _elogo.FindELogoCompanyAsync(ct))!;

        string? error = null;
        try
        {
            var http = _httpFactory.CreateClient("IntegratorEFatura");
            await using var client = new ELogoPostBoxClient(http, ELogoDocumentSyncService.ResolvePostBoxUrl(cred.IntegratorWsUrl),
                cred.IntegratorUser!, cred.IntegratorPassword!, ownsHttp: false);
            await client.LoginAsync(ct);
            var (ok, rc, msg) = await client.CreateApplicationResponseAsync(d.UUID!, code, note ?? "KABUL EDİLMİŞTİR", ct);
            if (!ok) error = $"e-Logo resultCode={rc}: {msg}";
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _log.LogWarning(ex, "Uygulama yanıtı gönderilemedi: {Id}", id);
            error = ex.Message;
        }
        await _repo.MarkResponseAsync(id, code, note, error == null, error, userId, ct);
        if (error != null) throw new EGovResponseBlockedException("Yanıt gönderilemedi: " + error);
        return await StateAsync(id, ct);
    }

    public async Task<EGovResponseState> AddObjectionAsync(int id, string? kind, string? method, DateTime? date, string? docNo,
        string? description, int? userId, CancellationToken ct)
    {
        var d = await _repo.GetAsync(id, ct) ?? throw new KeyNotFoundException("Belge bulunamadı.");
        kind = (kind ?? "ITIRAZ").Trim().ToUpperInvariant();
        method = (method ?? "").Trim().ToUpperInvariant();
        if (!EGovResponseRepository.Kinds.Contains(kind)) throw new EGovResponseBlockedException("Tür İTİRAZ ya da İPTAL olmalı.");
        if (!EGovResponseRepository.Methods.Contains(method)) throw new EGovResponseBlockedException("Yöntem: KEP, NOTER, TELGRAF, TAAHHUTLU_MEKTUP ya da GIB_PORTAL.");
        if (date is not DateTime dt) throw new EGovResponseBlockedException("İtiraz / iptal belgesinin tarihi zorunlu.");
        if (dt.Date > DateTime.Today) throw new EGovResponseBlockedException("Belge tarihi ileri bir tarih olamaz.");
        if (d.DocumentDate is DateTime dd && dt.Date < dd.Date) throw new EGovResponseBlockedException("İtiraz tarihi fatura tarihinden önce olamaz.");
        if (string.IsNullOrWhiteSpace(description)) throw new EGovResponseBlockedException("Açıklama (itiraz / iptal gerekçesi) zorunlu.");
        if (method != "GIB_PORTAL" && string.IsNullOrWhiteSpace(docNo))
            throw new EGovResponseBlockedException("KEP / noter / telgraf / mektup belgesinin numarası zorunlu.");
        if (await _repo.HasActiveObjectionAsync(id, ct))
            throw new EGovResponseBlockedException("Bu belgede etkin bir itiraz / iptal kaydı var; önce onu geri alın.");

        await _repo.AddObjectionAsync(id, kind, method, dt, docNo?.Trim() is { Length: > 100 } l ? l[..100] : docNo?.Trim(),
            description.Trim() is { Length: > 500 } t ? t[..500] : description.Trim(), userId, ct);
        return await StateAsync(id, ct);
    }

    public async Task<EGovResponseState> CancelObjectionAsync(int id, int objectionId, int? userId, CancellationToken ct)
    {
        if (!await _repo.CancelObjectionAsync(id, objectionId, userId, ct))
            throw new KeyNotFoundException("Etkin itiraz / iptal kaydı bulunamadı.");
        return await StateAsync(id, ct);
    }

    /// <summary>Kayıtta engel: gönderilmiş RED ya da etkin itiraz / iptal varsa belge programa fatura olarak kaydedilmez</summary>
    public async Task<string?> SaveBlockReasonAsync(int id, CancellationToken ct)
    {
        var d = await _repo.GetAsync(id, ct);
        if (d == null) return null;
        if (d.ResponseStatus == "Gönderildi" && d.ResponseCode == "RED") return "Bu faturaya GİB üzerinden RED yanıtı verildi; programa kaydedilemez.";
        if (await _repo.HasActiveObjectionAsync(id, ct)) return "Bu faturada harici itiraz / iptal kaydı var; programa kaydedilemez.";
        return null;
    }
}
