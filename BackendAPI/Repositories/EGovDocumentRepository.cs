using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EGovDocumentListQuery
{
    public byte DocKind { get; set; }
    public byte Direction { get; set; }
    public bool Archived { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public string? Search { get; set; }
    public string? Status { get; set; }
    /// <summary>Gelen e-fatura onay aşaması: new (yeni + reddedilen) · pending · approved · saved</summary>
    public string? Stage { get; set; }
    public int Take { get; set; } = 500;
}

public sealed class EGovDocumentListRow
{
    public int EGovDocumentID { get; set; }
    public string? DocumentNo { get; set; }
    public string? UUID { get; set; }
    public DateTime? DocumentDate { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerTitle { get; set; }
    public string? TaxNr { get; set; }
    public string? ProfileId { get; set; }
    public decimal? Amount { get; set; }
    public decimal? TaxAmount { get; set; }
    public string? CurrencyCode { get; set; }
    public string? Status { get; set; }
    public bool IsActive { get; set; }
    public int? InvoiceID { get; set; }
    public int? OrderVoucherID { get; set; }
    public int? ProcessInstanceID { get; set; }
    public bool HasPdf { get; set; }
    public bool HasXml { get; set; }
    /// <summary>new · pending · approved · rejected · saved (onay süreci tabloları yoksa null)</summary>
    public string? ApprovalStage { get; set; }
    public string? ApprovalComment { get; set; }
    public int? PendingTaskID { get; set; }
    public string? PendingRoleName { get; set; }
}

public sealed class EGovStatusCount
{
    public string Status { get; set; } = "";
    public int Count { get; set; }
}

public sealed class EGovDocumentListResult
{
    public int Total { get; set; }
    public List<EGovDocumentListRow> Rows { get; set; } = new();
    public List<EGovStatusCount> StatusCounts { get; set; } = new();
    public string? Warning { get; set; }
}

/// <summary>
/// E-Devlet kutuları (Gelen / Giden / Arşiv) — EGovDocument hafif liste.
/// Genel api/records yerine: DocKind + Direction + IsArchived birlikte filtrelenir,
/// PdfContent / XmlContent çekilmez (yalnız HasPdf / HasXml).
/// </summary>
public sealed class EGovDocumentRepository
{
    private readonly IDbConnection _db;

    public EGovDocumentRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<EGovDocumentListResult> ListAsync(EGovDocumentListQuery q, CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();

        var cols = (await _db.QueryAsync<string>(new CommandDefinition(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.EGovDocument')",
            cancellationToken: ct))).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (cols.Count == 0)
            return new EGovDocumentListResult { Warning = "EGovDocument tablosu yok — 08_egov_edevlet.sql uygulayın." };

        // Sonradan eklenen kolonlar (15 / 67) yoksa NULL / 0 döner
        string Opt(string col, string fallback) => cols.Contains(col) ? $"e.[{col}]" : $"{fallback} AS [{col}]";
        var hasPdf = cols.Contains("PdfContent") ? "CAST(CASE WHEN e.PdfContent IS NULL THEN 0 ELSE 1 END AS bit)" : "CAST(0 AS bit)";

        var where = new List<string> { "e.DocKind = @DocKind", "e.Direction = @Direction" };
        var p = new DynamicParameters();
        p.Add("DocKind", q.DocKind);
        p.Add("Direction", q.Direction);
        if (cols.Contains("IsArchived"))
        {
            where.Add("e.IsArchived = @Archived");
            p.Add("Archived", q.Archived);
        }
        else if (q.Archived)
        {
            return new EGovDocumentListResult { Warning = "IsArchived kolonu yok — 15_egov_irsaliye_archive_box.sql uygulayın." };
        }
        if (q.From is DateTime from)
        {
            where.Add("e.DocumentDate >= @From");
            p.Add("From", from.Date);
        }
        if (q.To is DateTime to)
        {
            where.Add("e.DocumentDate < @ToNext");
            p.Add("ToNext", to.Date.AddDays(1));
        }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            where.Add("(e.DocumentNo LIKE @Search OR e.CustomerTitle LIKE @Search OR e.TaxNr LIKE @Search OR e.UUID LIKE @Search)");
            p.Add("Search", $"%{q.Search.Trim()}%");
        }

        // Gelen e-fatura onay aşaması (SYS_Process* + EGOV_GELEN_FATURA_ONAY; yoksa yalnız kaydedildi / kaydedilmedi)
        var hasProcess = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ProcessInstance', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_ProcessTask', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.SYS_Role', N'U') IS NOT NULL THEN 1 ELSE 0 END",
            cancellationToken: ct)) == 1;
        var from_ = hasProcess
            ? $"dbo.EGovDocument e\n{EGovIncomingRepository.StageApplySql(await EGovIncomingRepository.HasGroupsAsync(_db, ct))}"
            : "dbo.EGovDocument e";
        var stageExpr = hasProcess
            ? EGovIncomingRepository.StageExprSql
            : "CASE WHEN e.InvoiceID IS NOT NULL THEN 'saved' ELSE 'new' END";
        var stage = q.Stage?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(stage))
        {
            if (stage is not ("new" or "pending" or "approved" or "saved"))
                return new EGovDocumentListResult { Warning = $"Geçersiz aşama: {q.Stage}" };
            if (!hasProcess && stage is "pending" or "approved")
                return new EGovDocumentListResult { Warning = EGovIncomingRepository.MissingSetupMessage };
            where.Add(stage == "new" ? $"({stageExpr}) IN ('new', 'rejected')" : $"({stageExpr}) = @Stage");
            p.Add("Stage", stage);
        }
        var baseWhere = string.Join(" AND ", where);

        // Durum sayıları durum filtresinden önce (filtre çipleri için)
        var counts = (await _db.QueryAsync<EGovStatusCount>(new CommandDefinition(
            $@"SELECT ISNULL(e.Status, N'') AS Status, COUNT(*) AS Count
               FROM {from_} WHERE {baseWhere}
               GROUP BY ISNULL(e.Status, N'') ORDER BY COUNT(*) DESC",
            p, cancellationToken: ct))).ToList();

        var fullWhere = baseWhere;
        if (!string.IsNullOrWhiteSpace(q.Status))
        {
            fullWhere += " AND ISNULL(e.Status, N'') = @Status";
            p.Add("Status", q.Status.Trim());
        }
        p.Add("Take", Math.Clamp(q.Take, 1, 2000));

        var approvalCols = hasProcess
            ? $"{stageExpr} AS ApprovalStage, ap.LastComment AS ApprovalComment, pt.ProcessTaskID AS PendingTaskID, pt.RoleName AS PendingRoleName"
            : $"{stageExpr} AS ApprovalStage, CAST(NULL AS nvarchar(500)) AS ApprovalComment, CAST(NULL AS int) AS PendingTaskID, CAST(NULL AS nvarchar(150)) AS PendingRoleName";
        var rows = (await _db.QueryAsync<EGovDocumentListRow>(new CommandDefinition(
            $@"SELECT TOP (@Take)
                 e.EGovDocumentID, e.DocumentNo, e.UUID, e.DocumentDate, e.CustomerCode, e.CustomerTitle, e.TaxNr,
                 e.ProfileId, e.Amount, e.TaxAmount, e.CurrencyCode, e.Status, e.IsActive, e.InvoiceID,
                 {Opt("OrderVoucherID", "CAST(NULL AS int)")}, {Opt("ProcessInstanceID", "CAST(NULL AS int)")},
                 {hasPdf} AS HasPdf,
                 CAST(CASE WHEN e.XmlContent IS NULL THEN 0 ELSE 1 END AS bit) AS HasXml,
                 {approvalCols}
               FROM {from_}
               WHERE {fullWhere}
               ORDER BY e.DocumentDate DESC, e.EGovDocumentID DESC",
            p, cancellationToken: ct))).ToList();

        var total = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(*) FROM {from_} WHERE {fullWhere}", p, cancellationToken: ct));

        return new EGovDocumentListResult { Total = total, Rows = rows, StatusCounts = counts };
    }
}
