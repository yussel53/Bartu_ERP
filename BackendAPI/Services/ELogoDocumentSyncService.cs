using System.Data;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class ELogoSyncRequest
{
    public int? CompanyId { get; set; }
    public DateTime BeginDate { get; set; }
    public DateTime EndDate { get; set; }
    /// <summary>Bartu: 1 Gelen · 2 Giden</summary>
    public byte Direction { get; set; } = 1;
    /// <summary>1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye</summary>
    public byte DocKind { get; set; } = 1;
    public bool DownloadPdf { get; set; } = true;
    public bool DownloadXml { get; set; } = true;
    /// <summary>Gelen belgeler için süreç örneği başlat</summary>
    public bool StartProcess { get; set; } = true;
    public int? StartedBy { get; set; }
}

public sealed class ELogoSyncItemResult
{
    public string Uuid { get; set; } = "";
    public string? DocumentNo { get; set; }
    public int? EGovDocumentId { get; set; }
    public string Action { get; set; } = ""; // inserted | updated | skipped
    public bool PdfSaved { get; set; }
    public bool ProcessStarted { get; set; }
    public string? Error { get; set; }
}

public sealed class ELogoSyncResult
{
    public bool Ok { get; set; }
    public string Message { get; set; } = "";
    public int Fetched { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int PdfSaved { get; set; }
    public int ProcessStarted { get; set; }
    public List<ELogoSyncItemResult> Items { get; set; } = new();
}

public sealed class ELogoCompanyCredentials
{
    public int CompanyId { get; set; }
    public string Title { get; set; } = "";
    public string? IntegratorName { get; set; }
    public string? IntegratorWsUrl { get; set; }
    public string? IntegratorUser { get; set; }
    public string? IntegratorPassword { get; set; }
    public string? IntegratorVkN { get; set; }
}

/// <summary>
/// e-Logo GetDocumentList → EGovDocument upsert + PDF/XML + süreç kuyruğu.
/// </summary>
public sealed class ELogoDocumentSyncService
{
    private readonly IDbConnection _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ProcessRepository _process;
    private readonly ILogger<ELogoDocumentSyncService> _log;

    public ELogoDocumentSyncService(
        IDbConnection db,
        IHttpClientFactory httpFactory,
        ProcessRepository process,
        ILogger<ELogoDocumentSyncService> log)
    {
        _db = db;
        _httpFactory = httpFactory;
        _process = process;
        _log = log;
    }

    private void EnsureOpen()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<IReadOnlyList<ELogoCompanyCredentials>> ListCompaniesAsync(CancellationToken ct)
    {
        EnsureOpen();
        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_Companies', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 0)
            return Array.Empty<ELogoCompanyCredentials>();

        // CompanyId / CompanyID farkı için sys.columns üzerinden seç
        var idCol = await _db.ExecuteScalarAsync<string?>(new CommandDefinition("""
            SELECT TOP 1 name FROM sys.columns
            WHERE object_id = OBJECT_ID(N'dbo.SYS_Companies')
              AND name IN (N'CompanyId', N'CompanyID')
            ORDER BY CASE WHEN name = N'CompanyId' THEN 0 ELSE 1 END
            """, cancellationToken: ct));
        if (string.IsNullOrWhiteSpace(idCol)) return Array.Empty<ELogoCompanyCredentials>();

        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorUser') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 0)
        {
            return (await _db.QueryAsync<ELogoCompanyCredentials>(new CommandDefinition($"""
                SELECT [{idCol}] AS CompanyId, ISNULL(Title, CompanyCode) AS Title
                FROM dbo.SYS_Companies
                WHERE ISNULL(IsActive, 1) = 1
                ORDER BY [{idCol}]
                """, cancellationToken: ct))).ToList();
        }

        return (await _db.QueryAsync<ELogoCompanyCredentials>(new CommandDefinition($"""
            SELECT
              [{idCol}] AS CompanyId,
              ISNULL(Title, CompanyCode) AS Title,
              IntegratorName, IntegratorWsUrl, IntegratorUser, IntegratorPassword, IntegratorVkN
            FROM dbo.SYS_Companies
            WHERE ISNULL(IsActive, 1) = 1
            ORDER BY [{idCol}]
            """, cancellationToken: ct))).ToList();
    }

    public async Task<ELogoSyncResult> SyncAsync(ELogoSyncRequest req, CancellationToken ct)
    {
        var result = new ELogoSyncResult();
        EnsureOpen();

        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.EGovDocument', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 0)
        {
            result.Message = "EGovDocument tablosu yok.";
            return result;
        }

        var cred = await ResolveCredentialsAsync(req.CompanyId, ct);
        if (cred is null)
        {
            result.Message = "e-Logo entegratör bilgisi olan firma bulunamadı (SYS_Companies.Integrator*).";
            return result;
        }

        var name = (cred.IntegratorName ?? "").Trim().ToUpperInvariant();
        if (name is not ("ELOGO" or "LOGO" or "E-LOGO"))
        {
            result.Message = $"Firma '{cred.Title}' entegratörü e-Logo değil ({cred.IntegratorName}).";
            return result;
        }

        if (string.IsNullOrWhiteSpace(cred.IntegratorUser) || string.IsNullOrWhiteSpace(cred.IntegratorPassword))
        {
            result.Message = "e-Logo kullanıcı/şifre eksik (firma kartı → Entegratör).";
            return result;
        }

        // Bartu Direction 1 Gelen → e-Logo OPTYPE 2; 2 Giden → 1
        var opType = req.Direction == 2 ? 1 : 2;
        var (listType, dataType) = MapDocTypes(req.DocKind);

        var wsUrl = ResolvePostBoxUrl(cred.IntegratorWsUrl);
        var http = _httpFactory.CreateClient("IntegratorEFatura");
        await using var client = new ELogoPostBoxClient(
            http,
            wsUrl,
            cred.IntegratorUser!,
            cred.IntegratorPassword!,
            ownsHttp: false);

        try
        {
            await client.LoginAsync(ct);
            var docs = await client.GetDocumentListAsync(req.BeginDate, req.EndDate, opType, listType, ct: ct);
            result.Fetched = docs.Count;

            foreach (var d in docs)
            {
                var item = new ELogoSyncItemResult
                {
                    Uuid = d.Uuid,
                    DocumentNo = d.ElementId
                };
                try
                {
                    if (string.IsNullOrWhiteSpace(d.Uuid) && string.IsNullOrWhiteSpace(d.ElementId))
                    {
                        item.Action = "skipped";
                        item.Error = "UUID/belge no yok";
                        result.Items.Add(item);
                        continue;
                    }

                    var (egovId, action) = await UpsertEgovAsync(d, req.DocKind, req.Direction, ct);
                    item.EGovDocumentId = egovId;
                    item.Action = action;
                    if (action == "inserted") result.Inserted++;
                    else if (action == "updated") result.Updated++;

                    if (req.DownloadXml && !string.IsNullOrWhiteSpace(d.Uuid))
                    {
                        try
                        {
                            var (xmlBytes, _) = await client.GetDocumentDataAsync(d.Uuid, dataType, "UBL", ct);
                            var xml = System.Text.Encoding.UTF8.GetString(xmlBytes);
                            await _db.ExecuteAsync(new CommandDefinition("""
                                UPDATE dbo.EGovDocument SET XmlContent = @xml WHERE EGovDocumentID = @id
                                """, new { xml, id = egovId }, cancellationToken: ct));
                        }
                        catch (Exception ex)
                        {
                            _log.LogDebug(ex, "UBL indirilemedi {Uuid}", d.Uuid);
                        }
                    }

                    if (req.DownloadPdf && !string.IsNullOrWhiteSpace(d.Uuid)
                        && await ColumnExistsAsync("EGovDocument", "PdfContent", ct))
                    {
                        try
                        {
                            var (pdfBytes, fileName) = await client.GetDocumentDataAsync(d.Uuid, dataType, "PDF", ct);
                            await _db.ExecuteAsync(new CommandDefinition("""
                                UPDATE dbo.EGovDocument
                                SET PdfContent = @pdf, PdfFileName = @fileName, PdfContentType = N'application/pdf',
                                    PdfStoredAt = SYSUTCDATETIME()
                                WHERE EGovDocumentID = @id
                                """, new { pdf = pdfBytes, fileName, id = egovId }, cancellationToken: ct));
                            item.PdfSaved = true;
                            result.PdfSaved++;
                        }
                        catch (Exception ex)
                        {
                            _log.LogDebug(ex, "PDF indirilemedi {Uuid}", d.Uuid);
                            item.Error = (item.Error is null ? "" : item.Error + " · ") + "PDF: " + Truncate(ex.Message, 120);
                        }
                    }

                    // Gelen belgeler → Onay Tanımları (TriggerType=3 OnEGovReceive)
                    if (req.StartProcess && req.Direction == 1 && egovId > 0)
                    {
                        var hasProcess = await _db.ExecuteScalarAsync<int?>(new CommandDefinition("""
                            SELECT ProcessInstanceID FROM dbo.EGovDocument WHERE EGovDocumentID = @id
                            """, new { id = egovId }, cancellationToken: ct));
                        if (hasProcess is null or 0)
                        {
                            var docLabel = req.DocKind == 3 ? "e-İrsaliye"
                                : req.DocKind == 2 ? "e-Arşiv"
                                : "e-Fatura";
                            try
                            {
                                var started = await _process.StartByTriggerAsync(new ProcessTriggerStartRequest
                                {
                                    TriggerType = 3,
                                    SourceTable = "EGovDocument",
                                    SourceId = egovId,
                                    Title = $"{docLabel} {d.ElementId} onay",
                                    StartedBy = req.StartedBy,
                                    Context = new Dictionary<string, string?>
                                    {
                                        ["docKind"] = req.DocKind.ToString(),
                                        ["direction"] = req.Direction.ToString()
                                    }
                                }, ct);
                                if (started.Count > 0)
                                {
                                    item.ProcessStarted = true;
                                    result.ProcessStarted += started.Count;
                                }
                            }
                            catch (Exception ex)
                            {
                                _log.LogDebug(ex, "Süreç başlatılamadı {Id}", egovId);
                                item.Error = (item.Error is null ? "" : item.Error + " · ") + "Süreç: " + Truncate(ex.Message, 100);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    item.Action = "error";
                    item.Error = Truncate(ex.Message, 200);
                    _log.LogWarning(ex, "e-Logo belge işlenemedi {Uuid}", d.Uuid);
                }

                result.Items.Add(item);
            }

            result.Ok = true;
            result.Message =
                $"e-Logo ({wsUrl}): {result.Fetched} belge · {result.Inserted} yeni · {result.Updated} güncellendi · {result.PdfSaved} PDF · {result.ProcessStarted} süreç";
            return result;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "e-Logo senkron başarısız");
            result.Message = "e-Logo senkron hatası: " + ex.Message;
            return result;
        }
    }

    private async Task<ELogoCompanyCredentials?> ResolveCredentialsAsync(int? companyId, CancellationToken ct)
    {
        var companies = await ListCompaniesAsync(ct);
        if (companyId is > 0)
            return companies.FirstOrDefault(c => c.CompanyId == companyId.Value);

        return companies.FirstOrDefault(c =>
        {
            var n = (c.IntegratorName ?? "").Trim().ToUpperInvariant();
            return n is "ELOGO" or "LOGO" or "E-LOGO"
                   && !string.IsNullOrWhiteSpace(c.IntegratorUser)
                   && !string.IsNullOrWhiteSpace(c.IntegratorPassword);
        }) ?? companies.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.IntegratorUser));
    }

    private static (string ListType, string DataType) MapDocTypes(byte docKind) => docKind switch
    {
        2 => ("EARCHIVEDETAIL", "EARCHIVE"),
        3 => ("EDESPATCHDETAIL", "EDESPATCH"),
        _ => ("EINVOICEDETAIL", "EINVOICE")
    };

    /// <summary>
    /// Firma kartında bazen EdocumentService.svc yazılıyor; liste/PDF için PostBoxService gerekir
    /// (eftaura_elogo_kontrol ServiceUrlProbe / MainForm).
    /// </summary>
    internal static string ResolvePostBoxUrl(string? raw)
    {
        var url = (raw ?? "").Trim();
        if (string.IsNullOrWhiteSpace(url))
            return "https://pb.elogo.com.tr/PostBoxService.svc";

        // EdocumentService (gönderim) ve connect.elogo PostBox adresi liste/PDF için çalışmaz:
        // connect.elogo.com.tr/services/PostBoxService.svc → 302/404. Prod PostBox: pb.elogo.com.tr
        if (url.Contains("EdocumentService", StringComparison.OrdinalIgnoreCase)
            || url.Contains("connect.elogo.com.tr", StringComparison.OrdinalIgnoreCase))
            return "https://pb.elogo.com.tr/PostBoxService.svc";

        return url;
    }

    private async Task<(int Id, string Action)> UpsertEgovAsync(
        ELogoDocumentRecord d,
        byte docKind,
        byte direction,
        CancellationToken ct)
    {
        // Gelen: karşı taraf tedarikçi; Giden: müşteri
        var tax = direction == 1
            ? (d.SupplierVknTckn ?? "")
            : (d.CustomerVknTckn ?? "");
        var title = direction == 1
            ? (d.SupplierName ?? "")
            : (d.CustomerName ?? "");
        if (string.IsNullOrWhiteSpace(title))
            title = direction == 1 ? d.CustomerName : d.SupplierName;

        int? existingId = null;
        if (!string.IsNullOrWhiteSpace(d.Uuid))
        {
            existingId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition("""
                SELECT TOP 1 EGovDocumentID FROM dbo.EGovDocument
                WHERE UUID = @uuid AND DocKind = @docKind AND Direction = @direction
                """, new { uuid = d.Uuid, docKind, direction }, cancellationToken: ct));
        }

        if (existingId is null && !string.IsNullOrWhiteSpace(d.ElementId))
        {
            existingId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition("""
                SELECT TOP 1 EGovDocumentID FROM dbo.EGovDocument
                WHERE DocumentNo = @no AND DocKind = @docKind AND Direction = @direction
                """, new { no = d.ElementId, docKind, direction }, cancellationToken: ct));
        }

        if (existingId is > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.EGovDocument SET
                  DocumentNo = COALESCE(NULLIF(@DocumentNo, N''), DocumentNo),
                  DocumentDate = COALESCE(@DocumentDate, DocumentDate),
                  IssueDate = COALESCE(@IssueDate, IssueDate),
                  CustomerCode = COALESCE(NULLIF(@CustomerCode, N''), CustomerCode),
                  CustomerTitle = COALESCE(NULLIF(@CustomerTitle, N''), CustomerTitle),
                  TaxNr = COALESCE(NULLIF(@TaxNr, N''), TaxNr),
                  Amount = COALESCE(@Amount, Amount),
                  TaxAmount = COALESCE(@TaxAmount, TaxAmount),
                  CurrencyCode = COALESCE(NULLIF(@CurrencyCode, N''), CurrencyCode),
                  ProfileId = COALESCE(NULLIF(@ProfileId, N''), ProfileId),
                  Status = COALESCE(Status, N'Bekliyor'),
                  IsActive = 1
                WHERE EGovDocumentID = @id
                """, new
            {
                id = existingId.Value,
                DocumentNo = d.ElementId,
                DocumentDate = d.IssueDate,
                IssueDate = d.IssueDate,
                CustomerCode = tax,
                CustomerTitle = title,
                TaxNr = tax,
                Amount = d.Total,
                TaxAmount = d.TaxAmount,
                CurrencyCode = d.Currency,
                ProfileId = d.ProfileId
            }, cancellationToken: ct));
            return (existingId.Value, "updated");
        }

        var hasArchived = await ColumnExistsAsync("EGovDocument", "IsArchived", ct);
        var sql = hasArchived
            ? """
              INSERT INTO dbo.EGovDocument
                (DocKind, Direction, DocumentNo, UUID, DocumentDate, IssueDate,
                 CustomerCode, CustomerTitle, TaxNr, Amount, TaxAmount, CurrencyCode,
                 Status, ProfileId, IsActive, IsArchived)
              OUTPUT INSERTED.EGovDocumentID
              VALUES
                (@DocKind, @Direction, @DocumentNo, @UUID, @DocumentDate, @IssueDate,
                 @CustomerCode, @CustomerTitle, @TaxNr, @Amount, @TaxAmount, @CurrencyCode,
                 N'Bekliyor', @ProfileId, 1, 0)
              """
            : """
              INSERT INTO dbo.EGovDocument
                (DocKind, Direction, DocumentNo, UUID, DocumentDate, IssueDate,
                 CustomerCode, CustomerTitle, TaxNr, Amount, TaxAmount, CurrencyCode,
                 Status, ProfileId, IsActive)
              OUTPUT INSERTED.EGovDocumentID
              VALUES
                (@DocKind, @Direction, @DocumentNo, @UUID, @DocumentDate, @IssueDate,
                 @CustomerCode, @CustomerTitle, @TaxNr, @Amount, @TaxAmount, @CurrencyCode,
                 N'Bekliyor', @ProfileId, 1)
              """;

        var newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(sql, new
        {
            DocKind = docKind,
            Direction = direction,
            DocumentNo = NullIfEmpty(d.ElementId),
            UUID = NullIfEmpty(d.Uuid),
            DocumentDate = d.IssueDate,
            IssueDate = d.IssueDate,
            CustomerCode = NullIfEmpty(tax),
            CustomerTitle = NullIfEmpty(title),
            TaxNr = NullIfEmpty(tax),
            Amount = d.Total,
            TaxAmount = d.TaxAmount,
            CurrencyCode = NullIfEmpty(d.Currency),
            ProfileId = NullIfEmpty(d.ProfileId)
        }, cancellationToken: ct));

        return (newId, "inserted");
    }

    private async Task<bool> ColumnExistsAsync(string table, string column, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}", c = column }, cancellationToken: ct));
        return n == 1;
    }

    private static string? NullIfEmpty(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string Truncate(string s, int n) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= n ? s : s[..n] + "…";
}
