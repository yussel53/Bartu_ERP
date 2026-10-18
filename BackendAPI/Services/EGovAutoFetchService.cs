using System.Collections.Concurrent;
using System.Data;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class EGovAutoFetchSettingDto
{
    public int CompanyId { get; set; }
    public string? CompanyTitle { get; set; }
    public string? IntegratorName { get; set; }
    /// <summary>Firma kartında e-Logo kullanıcı / şifre girili mi (şifre dönmez)</summary>
    public bool HasCredentials { get; set; }
    public bool IsEnabled { get; set; }
    public int IntervalMinutes { get; set; } = 30;
    public int DaysBack { get; set; } = 3;
    public bool FetchEInvoice { get; set; } = true;
    public bool FetchEArchive { get; set; }
    public bool FetchEDespatch { get; set; }
    public bool DownloadPdf { get; set; } = true;
    public bool DownloadXml { get; set; } = true;
    public bool AutoSendToApproval { get; set; } = true;
    public int? ApprovalGroupId { get; set; }
    public DateTime? LastRunAt { get; set; }
    public DateTime? LastSuccessAt { get; set; }
    public string? LastError { get; set; }
    public DateTime? NextRunAt { get; set; }
}

public sealed class EGovAutoFetchLogRow
{
    public int EGovAutoFetchLogID { get; set; }
    public int CompanyId { get; set; }
    public string? CompanyTitle { get; set; }
    public byte DocKind { get; set; }
    public string TriggerKind { get; set; } = "";
    public int? StartedBy { get; set; }
    public string? StartedByName { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public bool Ok { get; set; }
    public int Fetched { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int QueuedForApproval { get; set; }
    public string? Message { get; set; }
}

public sealed class EGovAutoFetchRunResult
{
    public bool Ok { get; set; }
    public string Message { get; set; } = "";
    public int Fetched { get; set; }
    public int Inserted { get; set; }
    public int QueuedForApproval { get; set; }
}

/// <summary>
/// Gelen e-belgeleri otomatik çekme (yol haritası E-02): firma bazında ayar (EGovAutoFetchSetting), e-Logo'dan
/// son N günün gelen belgeleri (ELogoDocumentSyncService), yeni gelen faturaları onay grubuna gönderme
/// (EGovIncomingRepository.SendAsync — «Sistem» adına) ve günlük (EGovAutoFetchLog). SqlUpdates/83_egov_auto_fetch.sql.
/// Zamanlanmış çalıştırma: EGovAutoFetchJob. e-Logo tarafında yalnız liste / belge okuma yapılır.
/// </summary>
public sealed class EGovAutoFetchService
{
    public const string MissingSetupMessage =
        "Otomatik çekme tabloları yok — Veritabanı Güncelleme ekranından 83_egov_auto_fetch.sql uygulayın.";
    private const string AutoNote = "Otomatik çekme: e-Logo'dan alındı";
    private static readonly string[] DocKindNames = { "", "e-Fatura", "e-Arşiv", "e-İrsaliye" };

    /// <summary>Aynı veritabanı + firmada aynı anda tek çekme (bu süreç içinde; süreçler arası sp_getapplock)</summary>
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> Locks = new();

    private readonly IDbConnection _db;
    private readonly ELogoDocumentSyncService _sync;
    private readonly EGovIncomingRepository _incoming;
    private readonly CurrentDatabase _current;
    private readonly ILogger<EGovAutoFetchService> _log;

    public EGovAutoFetchService(
        IDbConnection db,
        ELogoDocumentSyncService sync,
        EGovIncomingRepository incoming,
        CurrentDatabase current,
        ILogger<EGovAutoFetchService> log)
    {
        _db = db;
        _sync = sync;
        _incoming = incoming;
        _current = current;
        _log = log;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            SELECT CASE WHEN OBJECT_ID(N'dbo.EGovAutoFetchSetting', N'U') IS NOT NULL
                         AND OBJECT_ID(N'dbo.EGovAutoFetchLog', N'U') IS NOT NULL THEN 1 ELSE 0 END
            """, cancellationToken: ct)) == 1;
    }

    // ─── Ayarlar ────────────────────────────────────────────────────────────

    /// <summary>Tüm aktif firmalar + kayıtlı ayarları (ayarı olmayan firma varsayılanlarla, kapalı döner)</summary>
    public async Task<List<EGovAutoFetchSettingDto>> ListSettingsAsync(CancellationToken ct = default)
    {
        var companies = await _sync.ListCompaniesAsync(ct);
        Open();
        var saved = (await _db.QueryAsync<EGovAutoFetchSettingDto>(new CommandDefinition(
            "SELECT * FROM dbo.EGovAutoFetchSetting", cancellationToken: ct))).ToDictionary(s => s.CompanyId);
        return companies.Select(c =>
        {
            var s = saved.TryGetValue(c.CompanyId, out var x) ? x : new EGovAutoFetchSettingDto { CompanyId = c.CompanyId };
            s.CompanyTitle = c.Title;
            s.IntegratorName = c.IntegratorName;
            s.HasCredentials = !string.IsNullOrWhiteSpace(c.IntegratorUser) && !string.IsNullOrWhiteSpace(c.IntegratorPassword);
            return s;
        }).ToList();
    }

    public async Task<(bool Ok, string Message)> SaveSettingAsync(EGovAutoFetchSettingDto s, int userId, CancellationToken ct = default)
    {
        if (s.IntervalMinutes is < 5 or > 1440) return (false, "Çekme aralığı 5 – 1440 dakika olmalı.");
        if (s.DaysBack is < 1 or > 30) return (false, "Geriye dönük gün 1 – 30 olmalı.");
        if (s.IsEnabled && !s.FetchEInvoice && !s.FetchEArchive && !s.FetchEDespatch)
            return (false, "En az bir belge türü seçin.");
        var companies = await _sync.ListCompaniesAsync(ct);
        if (companies.All(c => c.CompanyId != s.CompanyId)) return (false, $"Firma #{s.CompanyId} bulunamadı.");

        Open();
        // Açıldığında / aralık değiştiğinde sıradaki çalışma: hemen (NextRunAt NULL → ilk turda çalışır)
        await _db.ExecuteAsync(new CommandDefinition(
            """
            MERGE dbo.EGovAutoFetchSetting AS t
            USING (SELECT @CompanyId AS CompanyId) AS src ON t.CompanyId = src.CompanyId
            WHEN MATCHED THEN UPDATE SET
              NextRunAt = CASE WHEN @IsEnabled = 1 AND (t.IsEnabled = 0 OR t.IntervalMinutes <> @IntervalMinutes) THEN NULL ELSE t.NextRunAt END,
              IsEnabled = @IsEnabled, IntervalMinutes = @IntervalMinutes, DaysBack = @DaysBack,
              FetchEInvoice = @FetchEInvoice, FetchEArchive = @FetchEArchive, FetchEDespatch = @FetchEDespatch,
              DownloadPdf = @DownloadPdf, DownloadXml = @DownloadXml,
              AutoSendToApproval = @AutoSendToApproval, ApprovalGroupId = @ApprovalGroupId,
              UpdatedAt = SYSDATETIME(), UpdatedBy = @userId
            WHEN NOT MATCHED THEN INSERT
              (CompanyId, IsEnabled, IntervalMinutes, DaysBack, FetchEInvoice, FetchEArchive, FetchEDespatch,
               DownloadPdf, DownloadXml, AutoSendToApproval, ApprovalGroupId, UpdatedAt, UpdatedBy)
              VALUES (@CompanyId, @IsEnabled, @IntervalMinutes, @DaysBack, @FetchEInvoice, @FetchEArchive, @FetchEDespatch,
               @DownloadPdf, @DownloadXml, @AutoSendToApproval, @ApprovalGroupId, SYSDATETIME(), @userId);
            """,
            new
            {
                s.CompanyId, s.IsEnabled, s.IntervalMinutes, s.DaysBack, s.FetchEInvoice, s.FetchEArchive, s.FetchEDespatch,
                s.DownloadPdf, s.DownloadXml, s.AutoSendToApproval,
                ApprovalGroupId = s.ApprovalGroupId is > 0 ? s.ApprovalGroupId : null,
                userId = userId > 0 ? userId : (int?)null,
            }, cancellationToken: ct));
        return (true, s.IsEnabled ? "Kaydedildi — otomatik çekme açık, ilk çekme bir dakika içinde başlar." : "Kaydedildi — otomatik çekme kapalı.");
    }

    public async Task<List<EGovAutoFetchLogRow>> ListLogsAsync(int? companyId, int take, CancellationToken ct = default)
    {
        Open();
        var titles = (await _sync.ListCompaniesAsync(ct)).ToDictionary(c => c.CompanyId, c => c.Title);
        var rows = (await _db.QueryAsync<EGovAutoFetchLogRow>(new CommandDefinition(
            """
            SELECT TOP (@take) l.*, COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.Name, N' ', u.Surname))), N''), u.NickName) AS StartedByName
            FROM dbo.EGovAutoFetchLog l
            LEFT JOIN dbo.SystemUser u ON u.SystemUserID = l.StartedBy
            WHERE @companyId IS NULL OR l.CompanyId = @companyId
            ORDER BY l.EGovAutoFetchLogID DESC
            """, new { companyId, take = Math.Clamp(take, 1, 500) }, cancellationToken: ct))).ToList();
        foreach (var r in rows) r.CompanyTitle = titles.TryGetValue(r.CompanyId, out var t) ? t : $"#{r.CompanyId}";
        return rows;
    }

    // ─── Çalıştırma ─────────────────────────────────────────────────────────

    /// <summary>Zamanı gelmiş (açık, NextRunAt boş ya da geçmiş) firmaları çeker — EGovAutoFetchJob her dakika çağırır.</summary>
    public async Task RunDueAsync(CancellationToken ct)
    {
        if (!await ReadyAsync(ct)) return;
        var due = (await _db.QueryAsync<int>(new CommandDefinition(
            """
            SELECT CompanyId FROM dbo.EGovAutoFetchSetting
            WHERE IsEnabled = 1 AND (NextRunAt IS NULL OR NextRunAt <= SYSDATETIME())
            ORDER BY CompanyId
            """, cancellationToken: ct))).ToList();
        foreach (var companyId in due)
        {
            if (ct.IsCancellationRequested) break;
            var r = await RunAsync(companyId, "auto", null, ct);
            if (!r.Ok) _log.LogWarning("Otomatik e-belge çekme hatası ({Db} / firma {Company}): {Msg}", _current.Name, companyId, r.Message);
        }
        if (due.Count > 0)
        {
            // Günlük 90 günden eski satırlar
            await _db.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.EGovAutoFetchLog WHERE StartedAt < DATEADD(DAY, -90, SYSDATETIME())", cancellationToken: ct));
        }
    }

    /// <summary>Bir firma için çekme (otomatik ya da «Şimdi çek»). Hata fırlatmaz; sonucu günlüğe ve ayara yazar.</summary>
    public async Task<EGovAutoFetchRunResult> RunAsync(int companyId, string trigger, int? userId, CancellationToken ct)
    {
        var result = new EGovAutoFetchRunResult();
        if (!await ReadyAsync(ct))
        {
            result.Message = MissingSetupMessage;
            return result;
        }
        var setting = (await ListSettingsAsync(ct)).FirstOrDefault(s => s.CompanyId == companyId);
        if (setting is null)
        {
            result.Message = $"Firma #{companyId} bulunamadı.";
            return result;
        }

        var gate = Locks.GetOrAdd($"{_current.Name}|{companyId}", _ => new SemaphoreSlim(1, 1));
        if (!await gate.WaitAsync(0, ct))
        {
            result.Message = "Bu firma için çekme zaten çalışıyor.";
            return result;
        }
        try
        {
            Open();
            // Birden fazla backend aynı veritabanında çalışıyorsa (ör. güncelleme sırasında) tek çekme
            var lockName = $"EGovAutoFetch_{companyId}";
            var got = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "DECLARE @r int; EXEC @r = sp_getapplock @Resource = @lockName, @LockMode = 'Exclusive', @LockOwner = 'Session', @LockTimeout = 0; SELECT @r;",
                new { lockName }, cancellationToken: ct));
            if (got < 0)
            {
                result.Message = "Bu firma için çekme başka bir sunucu sürecinde çalışıyor.";
                return result;
            }
            try
            {
                return await RunLockedAsync(setting, trigger, userId, ct);
            }
            finally
            {
                await _db.ExecuteAsync(new CommandDefinition(
                    "EXEC sp_releaseapplock @Resource = @lockName, @LockOwner = 'Session';", new { lockName }));
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<EGovAutoFetchRunResult> RunLockedAsync(EGovAutoFetchSettingDto s, string trigger, int? userId, CancellationToken ct)
    {
        var result = new EGovAutoFetchRunResult { Ok = true };
        await _db.ExecuteAsync(new CommandDefinition(
            """
            IF EXISTS (SELECT 1 FROM dbo.EGovAutoFetchSetting WHERE CompanyId = @CompanyId)
              UPDATE dbo.EGovAutoFetchSetting SET LastRunAt = SYSDATETIME() WHERE CompanyId = @CompanyId
            ELSE
              INSERT INTO dbo.EGovAutoFetchSetting (CompanyId, LastRunAt) VALUES (@CompanyId, SYSDATETIME())
            """, new { s.CompanyId }, cancellationToken: ct));

        var kinds = new List<byte>();
        if (s.FetchEInvoice) kinds.Add(1);
        if (s.FetchEArchive) kinds.Add(2);
        if (s.FetchEDespatch) kinds.Add(3);
        if (kinds.Count == 0) kinds.Add(1);

        var errors = new List<string>();
        var groupId = s.AutoSendToApproval ? await ResolveGroupAsync(s.ApprovalGroupId, ct) : null;

        foreach (var kind in kinds)
        {
            var logId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                """
                INSERT INTO dbo.EGovAutoFetchLog (CompanyId, DocKind, TriggerKind, StartedBy, StartedAt)
                OUTPUT INSERTED.EGovAutoFetchLogID
                VALUES (@CompanyId, @kind, @trigger, @userId, SYSDATETIME())
                """, new { s.CompanyId, kind, trigger, userId }, cancellationToken: ct));

            int fetched = 0, inserted = 0, updated = 0, queued = 0;
            var ok = true;
            var notes = new List<string>();
            try
            {
                var today = DateTime.Today;
                // e-Arşiv listesinde başlangıç = bitiş zorunlu: gün gün
                var ranges = kind == 2
                    ? Enumerable.Range(0, s.DaysBack + 1).Select(i => (today.AddDays(-i), today.AddDays(-i))).ToList()
                    : new List<(DateTime, DateTime)> { (today.AddDays(-s.DaysBack), today) };
                var newIds = new List<int>();
                foreach (var (from, to) in ranges)
                {
                    var r = await _sync.SyncAsync(new ELogoSyncRequest
                    {
                        CompanyId = s.CompanyId,
                        BeginDate = from,
                        EndDate = to,
                        Direction = 1,
                        DocKind = kind,
                        DownloadPdf = s.DownloadPdf,
                        DownloadXml = s.DownloadXml,
                        // Gelen fatura onayı EGOV_GELEN_FATURA_ONAY ile (aşağıda); genel tetikleyici süreçleri başlatılmaz
                        StartProcess = false,
                        StartedBy = userId,
                        SkipExistingContent = true,
                    }, ct);
                    if (!r.Ok)
                    {
                        ok = false;
                        notes.Add(r.Message);
                        break;
                    }
                    fetched += r.Fetched;
                    inserted += r.Inserted;
                    updated += r.Updated;
                    newIds.AddRange(r.Items.Where(i => i.Action == "inserted" && i.EGovDocumentId is > 0).Select(i => i.EGovDocumentId!.Value));
                    var itemErrors = r.Items.Count(i => i.Action == "error");
                    if (itemErrors > 0) notes.Add($"{itemErrors} belge işlenemedi");
                }

                // Yeni gelen faturalar onay kuyruğuna (yalnız e-Fatura / e-Arşiv — onay akışı faturalar için)
                if (ok && s.AutoSendToApproval && kind is 1 or 2 && newIds.Count > 0)
                {
                    if (groupId is null && await EGovIncomingRepository.HasGroupsAsync(_db, ct))
                    {
                        notes.Add("Onay grubu yok (varsayılan grup tanımlayın) — yeni belgeler Gelen kutusunda kaldı");
                    }
                    else
                    {
                        foreach (var id in newIds)
                        {
                            var (sent, msg) = await _incoming.SendAsync(id, 0, AutoNote, groupId, ct);
                            if (sent) queued++;
                            else notes.Add($"#{id} onaya gönderilemedi: {msg}");
                        }
                    }
                }
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                ok = false;
                notes.Add(ex.Message);
                _log.LogWarning(ex, "Otomatik e-belge çekme ({Db} / firma {Company} / tür {Kind})", _current.Name, s.CompanyId, kind);
            }

            var message = $"{fetched} belge · {inserted} yeni · {updated} güncellendi" +
                          (s.AutoSendToApproval && kind is 1 or 2 ? $" · {queued} onaya gönderildi" : "") +
                          (notes.Count > 0 ? " · " + string.Join(" · ", notes) : "");
            Open();
            await _db.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.EGovAutoFetchLog
                SET FinishedAt = SYSDATETIME(), Ok = @ok, Fetched = @fetched, Inserted = @inserted, Updated = @updated,
                    QueuedForApproval = @queued, Message = LEFT(@message, 2000)
                WHERE EGovAutoFetchLogID = @logId
                """, new { ok, fetched, inserted, updated, queued, message, logId }, cancellationToken: CancellationToken.None));

            result.Fetched += fetched;
            result.Inserted += inserted;
            result.QueuedForApproval += queued;
            if (!ok)
            {
                result.Ok = false;
                errors.Add($"{DocKindNames[kind]}: {string.Join(" · ", notes)}");
            }
        }

        result.Message = result.Ok
            ? $"{result.Fetched} belge · {result.Inserted} yeni · {result.QueuedForApproval} onaya gönderildi"
            : string.Join(" | ", errors);
        await _db.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.EGovAutoFetchSetting
            SET LastSuccessAt = CASE WHEN @ok = 1 THEN SYSDATETIME() ELSE LastSuccessAt END,
                LastError = CASE WHEN @ok = 1 THEN NULL ELSE LEFT(@error, 1000) END,
                NextRunAt = DATEADD(MINUTE, IntervalMinutes, SYSDATETIME())
            WHERE CompanyId = @CompanyId
            """, new { ok = result.Ok, error = result.Message, s.CompanyId }, cancellationToken: CancellationToken.None));
        return result;
    }

    /// <summary>Ayardaki grup (aktifse), yoksa varsayılan onay grubu; grup tabloları yoksa null</summary>
    private async Task<int?> ResolveGroupAsync(int? groupId, CancellationToken ct)
    {
        if (!await EGovIncomingRepository.HasGroupsAsync(_db, ct)) return null;
        return await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            """
            SELECT TOP 1 ApprovalGroupID FROM dbo.SYS_ApprovalGroup
            WHERE IsActive = 1 AND (ApprovalGroupID = @groupId OR (@groupId IS NULL AND IsDefault = 1))
            ORDER BY CASE WHEN ApprovalGroupID = @groupId THEN 0 ELSE 1 END
            """, new { groupId = groupId is > 0 ? groupId : null }, cancellationToken: ct));
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
