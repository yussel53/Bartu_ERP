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
        string Opt(string col, string fallback) => cols.Contains(col) ? $"[{col}]" : $"{fallback} AS [{col}]";
        var hasPdf = cols.Contains("PdfContent") ? "CAST(CASE WHEN PdfContent IS NULL THEN 0 ELSE 1 END AS bit)" : "CAST(0 AS bit)";

        var where = new List<string> { "DocKind = @DocKind", "Direction = @Direction" };
        var p = new DynamicParameters();
        p.Add("DocKind", q.DocKind);
        p.Add("Direction", q.Direction);
        if (cols.Contains("IsArchived"))
        {
            where.Add("IsArchived = @Archived");
            p.Add("Archived", q.Archived);
        }
        else if (q.Archived)
        {
            return new EGovDocumentListResult { Warning = "IsArchived kolonu yok — 15_egov_irsaliye_archive_box.sql uygulayın." };
        }
        if (q.From is DateTime from)
        {
            where.Add("DocumentDate >= @From");
            p.Add("From", from.Date);
        }
        if (q.To is DateTime to)
        {
            where.Add("DocumentDate < @ToNext");
            p.Add("ToNext", to.Date.AddDays(1));
        }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            where.Add("(DocumentNo LIKE @Search OR CustomerTitle LIKE @Search OR TaxNr LIKE @Search OR UUID LIKE @Search)");
            p.Add("Search", $"%{q.Search.Trim()}%");
        }
        var baseWhere = string.Join(" AND ", where);

        // Durum sayıları durum filtresinden önce (filtre çipleri için)
        var counts = (await _db.QueryAsync<EGovStatusCount>(new CommandDefinition(
            $@"SELECT ISNULL(Status, N'') AS Status, COUNT(*) AS Count
               FROM dbo.EGovDocument WHERE {baseWhere}
               GROUP BY ISNULL(Status, N'') ORDER BY COUNT(*) DESC",
            p, cancellationToken: ct))).ToList();

        var fullWhere = baseWhere;
        if (!string.IsNullOrWhiteSpace(q.Status))
        {
            fullWhere += " AND ISNULL(Status, N'') = @Status";
            p.Add("Status", q.Status.Trim());
        }
        p.Add("Take", Math.Clamp(q.Take, 1, 2000));

        var rows = (await _db.QueryAsync<EGovDocumentListRow>(new CommandDefinition(
            $@"SELECT TOP (@Take)
                 EGovDocumentID, DocumentNo, UUID, DocumentDate, CustomerCode, CustomerTitle, TaxNr,
                 ProfileId, Amount, TaxAmount, CurrencyCode, Status, IsActive, InvoiceID,
                 {Opt("OrderVoucherID", "CAST(NULL AS int)")}, {Opt("ProcessInstanceID", "CAST(NULL AS int)")},
                 {hasPdf} AS HasPdf,
                 CAST(CASE WHEN XmlContent IS NULL THEN 0 ELSE 1 END AS bit) AS HasXml
               FROM dbo.EGovDocument
               WHERE {fullWhere}
               ORDER BY DocumentDate DESC, EGovDocumentID DESC",
            p, cancellationToken: ct))).ToList();

        var total = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(*) FROM dbo.EGovDocument WHERE {fullWhere}", p, cancellationToken: ct));

        return new EGovDocumentListResult { Total = total, Rows = rows, StatusCounts = counts };
    }
}
