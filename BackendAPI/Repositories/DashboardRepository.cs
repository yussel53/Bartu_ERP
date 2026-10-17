using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

public sealed class DashboardSummaryDto
{
    public CustomerSummaryDto Customer { get; set; } = new();
    public ProductSummaryDto Product { get; set; } = new();
    public BankSummaryDto Bank { get; set; } = new();
    public SafeSummaryDto Safe { get; set; } = new();
    public string? Warning { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

public sealed class CustomerSummaryDto
{
    public int CardCount { get; set; }
    public decimal DebitTotal { get; set; }
    public decimal CreditTotal { get; set; }
    public decimal Balance => DebitTotal - CreditTotal;
}

public sealed class ProductSummaryDto
{
    public int CardCount { get; set; }
    public decimal LastPurchaseTotal { get; set; }
    public int LastPurchaseLineCount { get; set; }
}

public sealed class BankSummaryDto
{
    public int AccountCount { get; set; }
    public decimal InTotal { get; set; }
    public decimal OutTotal { get; set; }
    public decimal Balance => InTotal - OutTotal;
}

public sealed class SafeSummaryDto
{
    public int CardCount { get; set; }
    public decimal AmountTotal { get; set; }
}

public sealed class DashboardRepository
{
    private readonly IDbConnection _db;

    public DashboardRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<DashboardSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        var dto = new DashboardSummaryDto();
        var warnings = new List<string>();

        if (_db.State != ConnectionState.Open) _db.Open();

        try
        {
            dto.Customer = await LoadCustomerAsync(ct);
        }
        catch (Exception ex)
        {
            warnings.Add("Cari: " + Short(ex.Message));
        }

        try
        {
            dto.Product = await LoadProductAsync(ct);
        }
        catch (Exception ex)
        {
            warnings.Add("Malzeme: " + Short(ex.Message));
        }

        try
        {
            dto.Bank = await LoadBankAsync(ct);
        }
        catch (Exception ex)
        {
            warnings.Add("Banka: " + Short(ex.Message));
        }

        try
        {
            dto.Safe = await LoadSafeAsync(ct);
        }
        catch (Exception ex)
        {
            warnings.Add("Kasa: " + Short(ex.Message));
        }

        if (warnings.Count > 0)
            dto.Warning = string.Join(" · ", warnings);

        return dto;
    }

    private async Task<bool> TableExistsAsync(string table, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT CASE WHEN OBJECT_ID(@name, N'U') IS NULL THEN 0 ELSE 1 END",
            new { name = "dbo." + table },
            cancellationToken: ct));
        return n == 1;
    }

    private async Task<bool> ColExistsAsync(string table, string column, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + table, c = column },
            cancellationToken: ct));
        return n == 1;
    }

    private async Task<CustomerSummaryDto> LoadCustomerAsync(CancellationToken ct)
    {
        var r = new CustomerSummaryDto();
        if (!await TableExistsAsync("CustomerCard", ct)) return r;

        r.CardCount = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.CustomerCard",
            cancellationToken: ct));

        if (!await TableExistsAsync("CustomerTrans", ct)) return r;

        var amountExpr = await ColExistsAsync("CustomerTrans", "Amount", ct)
            ? "ISNULL(Amount, ISNULL(LocalAmount, 0))"
            : "ISNULL(LocalAmount, 0)";

        // Type: borç ağırlıklı 1,3,8,11 · alacak 2,4,12 (fiş tipleriyle uyumlu; aksi halde yarı yarıya)
        var sql = $@"
SELECT
  CAST(ISNULL(SUM(CASE WHEN [Type] IN (1,3,8,11,13) THEN {amountExpr} ELSE 0 END), 0) AS decimal(18,2)) AS DebitTotal,
  CAST(ISNULL(SUM(CASE WHEN [Type] IN (2,4,12,14) THEN {amountExpr} ELSE 0 END), 0) AS decimal(18,2)) AS CreditTotal
FROM dbo.CustomerTrans";

        var row = await _db.QuerySingleAsync<(decimal DebitTotal, decimal CreditTotal)>(
            new CommandDefinition(sql, cancellationToken: ct));
        r.DebitTotal = row.DebitTotal;
        r.CreditTotal = row.CreditTotal;

        // Hiç sınıflanamadıysa tutarların yarısını göstermek yerine toplam hareketi borçta tut
        if (r.DebitTotal == 0 && r.CreditTotal == 0)
        {
            var all = await _db.ExecuteScalarAsync<decimal?>(new CommandDefinition(
                $"SELECT CAST(ISNULL(SUM({amountExpr}), 0) AS decimal(18,2)) FROM dbo.CustomerTrans",
                cancellationToken: ct));
            r.DebitTotal = all ?? 0;
        }

        return r;
    }

    private async Task<ProductSummaryDto> LoadProductAsync(CancellationToken ct)
    {
        var r = new ProductSummaryDto();
        if (!await TableExistsAsync("ProductCard", ct)) return r;

        r.CardCount = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.ProductCard",
            cancellationToken: ct));

        if (!await TableExistsAsync("ProductTrans", ct)) return r;

        // Son satınalma: her malzeme için en son alış hareketi (VoucherType=2 Alım veya Invoice alış)
        var hasVoucherType = await ColExistsAsync("ProductTrans", "VoucherType", ct);
        var hasTotalPrice = await ColExistsAsync("ProductTrans", "TotalPrice", ct);
        var hasPrice = await ColExistsAsync("ProductTrans", "Price", ct);
        var hasQty = await ColExistsAsync("ProductTrans", "Quantity", ct);
        var hasInvoiceId = await ColExistsAsync("ProductTrans", "InvoiceID", ct);
        var hasInvoice = await TableExistsAsync("Invoice", ct) && await ColExistsAsync("Invoice", "InvoiceType", ct);

        var valueExpr = hasTotalPrice
            ? "ISNULL(pt.TotalPrice, 0)"
            : hasPrice && hasQty
                ? "ISNULL(pt.Price, 0) * ISNULL(pt.Quantity, 0)"
                : "0";

        var purchaseFilter = "1=0";
        if (hasVoucherType)
            purchaseFilter = "pt.VoucherType IN (2, 8)"; // Alım / Alış iade dışı alım kodları
        if (hasInvoiceId && hasInvoice)
            purchaseFilter = $"({purchaseFilter}) OR EXISTS (SELECT 1 FROM dbo.Invoice i WHERE i.InvoiceID = pt.InvoiceID AND i.InvoiceType IN (2, 4, 5))";

        // VoucherType yoksa tüm satırlardan son hareketi al (yaklaşık)
        if (!hasVoucherType && !(hasInvoiceId && hasInvoice))
            purchaseFilter = "1=1";

        var sql = $@"
;WITH ranked AS (
  SELECT
    pt.ProductCardID,
    {valueExpr} AS LineValue,
    ROW_NUMBER() OVER (
      PARTITION BY pt.ProductCardID
      ORDER BY ISNULL(pt.TransDate, '19000101') DESC, pt.ProductTransID DESC
    ) AS rn
  FROM dbo.ProductTrans pt
  WHERE pt.ProductCardID IS NOT NULL AND ({purchaseFilter})
)
SELECT
  CAST(ISNULL(SUM(LineValue), 0) AS decimal(18,2)) AS LastPurchaseTotal,
  COUNT(1) AS LastPurchaseLineCount
FROM ranked
WHERE rn = 1";

        var row = await _db.QuerySingleAsync<(decimal LastPurchaseTotal, int LastPurchaseLineCount)>(
            new CommandDefinition(sql, cancellationToken: ct));
        r.LastPurchaseTotal = row.LastPurchaseTotal;
        r.LastPurchaseLineCount = row.LastPurchaseLineCount;
        return r;
    }

    private async Task<BankSummaryDto> LoadBankAsync(CancellationToken ct)
    {
        var r = new BankSummaryDto();
        if (await TableExistsAsync("BankAccountCard", ct))
        {
            r.AccountCount = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.BankAccountCard",
                cancellationToken: ct));
        }
        else if (await TableExistsAsync("BankCard", ct))
        {
            r.AccountCount = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.BankCard",
                cancellationToken: ct));
        }

        if (!await TableExistsAsync("BankTrans", ct)) return r;

        // Type_: 1 giriş / 2 çıkış (yaygın); aksi tüm tutar giriş
        var sql = @"
SELECT
  CAST(ISNULL(SUM(CASE WHEN Type_ IN (1, 3) THEN ISNULL(Amount, 0) ELSE 0 END), 0) AS decimal(18,2)) AS InTotal,
  CAST(ISNULL(SUM(CASE WHEN Type_ IN (2, 4) THEN ISNULL(Amount, 0) ELSE 0 END), 0) AS decimal(18,2)) AS OutTotal
FROM dbo.BankTrans";

        var row = await _db.QuerySingleAsync<(decimal InTotal, decimal OutTotal)>(
            new CommandDefinition(sql, cancellationToken: ct));
        r.InTotal = row.InTotal;
        r.OutTotal = row.OutTotal;

        if (r.InTotal == 0 && r.OutTotal == 0)
        {
            r.InTotal = await _db.ExecuteScalarAsync<decimal>(new CommandDefinition(
                "SELECT CAST(ISNULL(SUM(ISNULL(Amount, 0)), 0) AS decimal(18,2)) FROM dbo.BankTrans",
                cancellationToken: ct));
        }

        return r;
    }

    private async Task<SafeSummaryDto> LoadSafeAsync(CancellationToken ct)
    {
        var r = new SafeSummaryDto();
        if (!await TableExistsAsync("SafeCard", ct)) return r;

        r.CardCount = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.SafeCard",
            cancellationToken: ct));

        // Kasa bakiyesi için ayrı hareket yoksa 0
        if (await TableExistsAsync("PaymentTrans", ct) && await ColExistsAsync("PaymentTrans", "Amount", ct))
        {
            r.AmountTotal = await _db.ExecuteScalarAsync<decimal>(new CommandDefinition(
                "SELECT CAST(ISNULL(SUM(ISNULL(Amount, 0)), 0) AS decimal(18,2)) FROM dbo.PaymentTrans",
                cancellationToken: ct));
        }

        return r;
    }

    private static string Short(string msg) =>
        msg.Length <= 120 ? msg : msg[..117] + "...";

    // ── Genel Durum sekmeleri ──────────────────────────────────────────

    public async Task<IReadOnlyList<DashboardTabDto>> ListTabsAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        if (!await TableExistsAsync("SYS_DashboardTab", ct))
            return Array.Empty<DashboardTabDto>();

        if (_db.State != ConnectionState.Open) _db.Open();

        var tabs = (await _db.QueryAsync<DashboardTabDto>(new CommandDefinition(
            @"
SELECT Id, ExportKey, Title, SortOrder, IsActive, ShowBuiltInSummary, CreatedAt, UpdatedAt
FROM dbo.SYS_DashboardTab
WHERE (@includeInactive = 1 OR IsActive = 1)
ORDER BY SortOrder, Id",
            new { includeInactive = includeInactive ? 1 : 0 },
            cancellationToken: ct))).ToList();

        if (tabs.Count == 0 || !await TableExistsAsync("SYS_DashboardTabItem", ct))
            return tabs;

        var hasReport = await TableExistsAsync("SYS_SqlReport", ct);
        var showDt = hasReport && await ColExistsAsync("SYS_SqlReport", "ShowDataTable", ct);
        var showPivot = hasReport && await ColExistsAsync("SYS_SqlReport", "ShowPivotTable", ct);
        var showCal = hasReport && await ColExistsAsync("SYS_SqlReport", "ShowCalendar", ct);
        var pivotCfg = hasReport && await ColExistsAsync("SYS_SqlReport", "PivotConfig", ct);
        var calCfg = hasReport && await ColExistsAsync("SYS_SqlReport", "CalendarConfig", ct);
        var sim = hasReport && await ColExistsAsync("SYS_SqlReport", "AllowSimulation", ct);
        var cond = hasReport && await ColExistsAsync("SYS_SqlReport", "ConditionalFormattingConfig", ct);

        var reportJoin = hasReport
            ? "LEFT JOIN dbo.SYS_SqlReport r ON r.Id = i.SqlReportId"
            : "";
        var reportCols = hasReport
            ? $@"
  r.Name AS ReportName,
  r.FiltersConfig AS ReportFiltersConfig,
  r.KpiConfig AS ReportKpiConfig,
  r.ChartConfig AS ReportChartConfig,
  r.ColumnFormats AS ReportColumnFormats,
  {(showDt ? "r.ShowDataTable" : "CAST(1 AS bit)")} AS ReportShowDataTable,
  {(showPivot ? "r.ShowPivotTable" : "CAST(0 AS bit)")} AS ReportShowPivotTable,
  {(showCal ? "r.ShowCalendar" : "CAST(0 AS bit)")} AS ReportShowCalendar,
  {(pivotCfg ? "r.PivotConfig" : "CAST(NULL AS nvarchar(max))")} AS ReportPivotConfig,
  {(calCfg ? "r.CalendarConfig" : "CAST(NULL AS nvarchar(max))")} AS ReportCalendarConfig,
  {(sim ? "r.AllowSimulation" : "CAST(0 AS bit)")} AS ReportAllowSimulation,
  {(cond ? "r.ConditionalFormattingConfig" : "CAST(NULL AS nvarchar(max))")} AS ReportConditionalFormatting"
            : @"
  CAST(NULL AS nvarchar(150)) AS ReportName,
  CAST(NULL AS nvarchar(max)) AS ReportFiltersConfig,
  CAST(NULL AS nvarchar(max)) AS ReportKpiConfig,
  CAST(NULL AS nvarchar(max)) AS ReportChartConfig,
  CAST(NULL AS nvarchar(max)) AS ReportColumnFormats,
  CAST(1 AS bit) AS ReportShowDataTable,
  CAST(0 AS bit) AS ReportShowPivotTable,
  CAST(0 AS bit) AS ReportShowCalendar,
  CAST(NULL AS nvarchar(max)) AS ReportPivotConfig,
  CAST(NULL AS nvarchar(max)) AS ReportCalendarConfig,
  CAST(0 AS bit) AS ReportAllowSimulation,
  CAST(NULL AS nvarchar(max)) AS ReportConditionalFormatting";

        var items = (await _db.QueryAsync<DashboardTabItemDto>(new CommandDefinition(
            $@"
SELECT
  i.Id, i.TabId, i.SqlReportId, i.DisplayName, i.QueryTemplate,
  i.KpiConfig, i.ChartConfig, i.ShowDataTable, i.ColSpan, i.SortOrder, i.IsActive,
  {reportCols}
FROM dbo.SYS_DashboardTabItem i
{reportJoin}
WHERE (@includeInactive = 1 OR i.IsActive = 1)
ORDER BY i.TabId, i.SortOrder, i.Id",
            new { includeInactive = includeInactive ? 1 : 0 },
            cancellationToken: ct))).ToList();

        var byTab = items.GroupBy(x => x.TabId).ToDictionary(g => g.Key, g => (IReadOnlyList<DashboardTabItemDto>)g.ToList());
        foreach (var t in tabs)
            t.Items = byTab.TryGetValue(t.Id, out var list) ? list : Array.Empty<DashboardTabItemDto>();

        return tabs;
    }

    public async Task<DashboardTabDto> UpsertTabAsync(int? id, DashboardTabSaveDto dto, CancellationToken ct = default)
    {
        if (!await TableExistsAsync("SYS_DashboardTab", ct))
            throw new InvalidOperationException("SYS_DashboardTab yok — Veritabanı Güncelleme (58) uygulayın.");

        if (_db.State != ConnectionState.Open) _db.Open();

        var key = string.IsNullOrWhiteSpace(dto.ExportKey)
            ? Guid.NewGuid().ToString("N")[..12]
            : dto.ExportKey.Trim();
        var title = (dto.Title ?? "").Trim();
        if (string.IsNullOrEmpty(title))
            throw new ArgumentException("Sekme başlığı gerekli");

        if (id is > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                @"
UPDATE dbo.SYS_DashboardTab
SET ExportKey = @ExportKey, Title = @Title, SortOrder = @SortOrder,
    IsActive = @IsActive, ShowBuiltInSummary = @ShowBuiltInSummary, UpdatedAt = SYSUTCDATETIME()
WHERE Id = @Id",
                new
                {
                    Id = id.Value,
                    ExportKey = key,
                    Title = title,
                    dto.SortOrder,
                    IsActive = dto.IsActive ? 1 : 0,
                    ShowBuiltInSummary = dto.ShowBuiltInSummary ? 1 : 0,
                },
                cancellationToken: ct));
        }
        else
        {
            id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"
INSERT INTO dbo.SYS_DashboardTab (ExportKey, Title, SortOrder, IsActive, ShowBuiltInSummary)
OUTPUT INSERTED.Id
VALUES (@ExportKey, @Title, @SortOrder, @IsActive, @ShowBuiltInSummary)",
                new
                {
                    ExportKey = key,
                    Title = title,
                    dto.SortOrder,
                    IsActive = dto.IsActive ? 1 : 0,
                    ShowBuiltInSummary = dto.ShowBuiltInSummary ? 1 : 0,
                },
                cancellationToken: ct));
        }

        var tabs = await ListTabsAsync(includeInactive: true, ct);
        return tabs.First(t => t.Id == id);
    }

    public async Task DeleteTabAsync(int id, CancellationToken ct = default)
    {
        if (!await TableExistsAsync("SYS_DashboardTab", ct)) return;
        if (_db.State != ConnectionState.Open) _db.Open();
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_DashboardTab WHERE Id = @id",
            new { id },
            cancellationToken: ct));
    }

    public async Task<DashboardTabItemDto> UpsertItemAsync(int? id, DashboardTabItemSaveDto dto, CancellationToken ct = default)
    {
        if (!await TableExistsAsync("SYS_DashboardTabItem", ct))
            throw new InvalidOperationException("SYS_DashboardTabItem yok — Veritabanı Güncelleme (58) uygulayın.");

        if (dto.TabId <= 0)
            throw new ArgumentException("TabId gerekli");
        if (dto.SqlReportId is null or <= 0 && string.IsNullOrWhiteSpace(dto.QueryTemplate))
            throw new ArgumentException("SQL Rapor seçin veya özel SQL girin");

        if (_db.State != ConnectionState.Open) _db.Open();

        var colSpan = dto.ColSpan is 6 or 12 ? dto.ColSpan : 12;

        if (id is > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                @"
UPDATE dbo.SYS_DashboardTabItem
SET TabId = @TabId, SqlReportId = @SqlReportId, DisplayName = @DisplayName,
    QueryTemplate = @QueryTemplate, KpiConfig = @KpiConfig, ChartConfig = @ChartConfig,
    ShowDataTable = @ShowDataTable, ColSpan = @ColSpan, SortOrder = @SortOrder, IsActive = @IsActive
WHERE Id = @Id",
                new
                {
                    Id = id.Value,
                    dto.TabId,
                    SqlReportId = dto.SqlReportId is > 0 ? dto.SqlReportId : null,
                    DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? null : dto.DisplayName.Trim(),
                    QueryTemplate = string.IsNullOrWhiteSpace(dto.QueryTemplate) ? null : dto.QueryTemplate,
                    KpiConfig = dto.KpiConfig,
                    ChartConfig = dto.ChartConfig,
                    ShowDataTable = dto.ShowDataTable ? 1 : 0,
                    ColSpan = colSpan,
                    dto.SortOrder,
                    IsActive = dto.IsActive ? 1 : 0,
                },
                cancellationToken: ct));
        }
        else
        {
            id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"
INSERT INTO dbo.SYS_DashboardTabItem
  (TabId, SqlReportId, DisplayName, QueryTemplate, KpiConfig, ChartConfig, ShowDataTable, ColSpan, SortOrder, IsActive)
OUTPUT INSERTED.Id
VALUES
  (@TabId, @SqlReportId, @DisplayName, @QueryTemplate, @KpiConfig, @ChartConfig, @ShowDataTable, @ColSpan, @SortOrder, @IsActive)",
                new
                {
                    dto.TabId,
                    SqlReportId = dto.SqlReportId is > 0 ? dto.SqlReportId : null,
                    DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? null : dto.DisplayName.Trim(),
                    QueryTemplate = string.IsNullOrWhiteSpace(dto.QueryTemplate) ? null : dto.QueryTemplate,
                    KpiConfig = dto.KpiConfig,
                    ChartConfig = dto.ChartConfig,
                    ShowDataTable = dto.ShowDataTable ? 1 : 0,
                    ColSpan = colSpan,
                    dto.SortOrder,
                    IsActive = dto.IsActive ? 1 : 0,
                },
                cancellationToken: ct));
        }

        var tabs = await ListTabsAsync(includeInactive: true, ct);
        var item = tabs.SelectMany(t => t.Items).FirstOrDefault(i => i.Id == id);
        return item ?? throw new InvalidOperationException("Kayıt okunamadı");
    }

    public async Task DeleteItemAsync(int id, CancellationToken ct = default)
    {
        if (!await TableExistsAsync("SYS_DashboardTabItem", ct)) return;
        if (_db.State != ConnectionState.Open) _db.Open();
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_DashboardTabItem WHERE Id = @id",
            new { id },
            cancellationToken: ct));
    }
}

public sealed class DashboardTabDto
{
    public int Id { get; set; }
    public string ExportKey { get; set; } = "";
    public string Title { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public bool ShowBuiltInSummary { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public IReadOnlyList<DashboardTabItemDto> Items { get; set; } = Array.Empty<DashboardTabItemDto>();
}

public sealed class DashboardTabItemDto
{
    public int Id { get; set; }
    public int TabId { get; set; }
    public int? SqlReportId { get; set; }
    public string? DisplayName { get; set; }
    public string? QueryTemplate { get; set; }
    public string? KpiConfig { get; set; }
    public string? ChartConfig { get; set; }
    public bool ShowDataTable { get; set; }
    public int ColSpan { get; set; } = 12;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }

    public string? ReportName { get; set; }
    public string? ReportFiltersConfig { get; set; }
    public string? ReportKpiConfig { get; set; }
    public string? ReportChartConfig { get; set; }
    public string? ReportColumnFormats { get; set; }
    public bool? ReportShowDataTable { get; set; }
    public bool? ReportShowPivotTable { get; set; }
    public bool? ReportShowCalendar { get; set; }
    public string? ReportPivotConfig { get; set; }
    public string? ReportCalendarConfig { get; set; }
    public bool? ReportAllowSimulation { get; set; }
    public string? ReportConditionalFormatting { get; set; }
}

public sealed class DashboardTabSaveDto
{
    public string ExportKey { get; set; } = "";
    public string Title { get; set; } = "";
    public int SortOrder { get; set; } = 10;
    public bool IsActive { get; set; } = true;
    public bool ShowBuiltInSummary { get; set; }
}

public sealed class DashboardTabItemSaveDto
{
    public int TabId { get; set; }
    public int? SqlReportId { get; set; }
    public string? DisplayName { get; set; }
    public string? QueryTemplate { get; set; }
    public string? KpiConfig { get; set; }
    public string? ChartConfig { get; set; }
    public bool ShowDataTable { get; set; }
    public int ColSpan { get; set; } = 12;
    public int SortOrder { get; set; } = 10;
    public bool IsActive { get; set; } = true;
}
