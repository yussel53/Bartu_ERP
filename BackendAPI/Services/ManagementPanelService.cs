using System.Data;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class PanelItem
{
    public string? Label { get; set; }
    public string? Sub { get; set; }
    public decimal Amount { get; set; }
    public int? Days { get; set; }
    public int? Id { get; set; }
}

public sealed class ManagementPanelDto
{
    // Alacak / borç vadeleri (FIFO açık kalemler)
    public decimal ReceivableOverdue { get; set; }
    public int ReceivableOverdueCustomers { get; set; }
    public decimal ReceivableDue7 { get; set; }
    public decimal PayableOverdue { get; set; }
    public decimal PayableDue7 { get; set; }
    public List<PanelItem> TopOverdue { get; set; } = new();
    // Çek / senet
    public decimal BoundsIn7 { get; set; }
    public decimal BoundsIn30 { get; set; }
    public decimal BoundsOut30 { get; set; }
    public decimal BoundsOverdue { get; set; }
    // Satış
    public decimal SalesToday { get; set; }
    public decimal SalesMonth { get; set; }
    public decimal SalesPrevMonth { get; set; }
    public int OpenOrders { get; set; }
    public decimal OpenOrdersAmount { get; set; }
    public List<PanelItem> SalesLast7 { get; set; } = new();
    // Stok
    public List<PanelItem> CriticalStock { get; set; } = new();
    public int CriticalStockCount { get; set; }
    // Onay
    public int PendingApprovals { get; set; }
    public List<PanelItem> Approvals { get; set; } = new();
    // Döviz
    public List<PanelItem> Rates { get; set; } = new();
    public List<PanelItem> CashByCurrency { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

/// <summary>
/// Y-14: yönetim paneli — vadesi gelen / geçen alacak-borç (Y-10 açık kalemler), çek / senet vadeleri (Y-11), günlük / aylık satış,
/// açık siparişler, kritik stok (ProductCard.MinStock), bekleyen onaylar, döviz kurları ve para birimine göre kasa / banka bakiyeleri.
/// Her bölüm ayrı denenir; biri hata verirse diğerleri yine döner (Warnings).
/// </summary>
public sealed class ManagementPanelService
{
    private readonly IDbConnection _db;
    private readonly CustomerAgingService _aging;
    private readonly CardStatementRepository _statement;
    private readonly ProcessRepository _process;

    public ManagementPanelService(IDbConnection db, CustomerAgingService aging, CardStatementRepository statement, ProcessRepository process)
    {
        _db = db;
        _aging = aging;
        _statement = statement;
        _process = process;
    }

    private async Task<bool> HasAsync(string table) =>
        await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(@t) IS NULL THEN 0 ELSE 1 END", new { t = "dbo." + table }) == 1;

    private async Task<bool> HasColAsync(string table, string col) =>
        await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END", new { t = "dbo." + table, c = col }) == 1;

    public async Task<ManagementPanelDto> GetAsync(int userId, Func<int, bool> canSeeCustomer, CancellationToken ct = default)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var dto = new ManagementPanelDto();
        var today = DateTime.Today;

        async Task Part(string name, Func<Task> f)
        {
            try { await f(); }
            catch (Exception ex) { dto.Warnings.Add($"{name}: {ex.Message}"); }
        }

        await Part("Vadeler", async () =>
        {
            var items = (await _aging.OpenItemsAsync(null, today, ct)).Where(i => canSeeCustomer(i.CustomerCardID)).ToList();
            var overdue = items.Where(i => i.DaysOverdue > 0 && i.Open > 0).ToList();
            dto.ReceivableOverdue = overdue.Sum(i => i.Open);
            dto.ReceivableOverdueCustomers = overdue.Select(i => i.CustomerCardID).Distinct().Count();
            dto.ReceivableDue7 = items.Where(i => i.Open > 0 && i.DaysOverdue <= 0 && i.DaysOverdue >= -7).Sum(i => i.Open);
            dto.PayableOverdue = -items.Where(i => i.Open < 0 && i.DaysOverdue > 0).Sum(i => i.Open);
            dto.PayableDue7 = -items.Where(i => i.Open < 0 && i.DaysOverdue <= 0 && i.DaysOverdue >= -7).Sum(i => i.Open);
            var titles = (await _db.QueryAsync<(int Id, string? Title)>(
                "SELECT CustomerCardID, Title FROM dbo.CustomerCard WHERE CustomerCardID IN @ids",
                new { ids = overdue.Select(i => i.CustomerCardID).Distinct().DefaultIfEmpty(0) })).ToDictionary(x => x.Id, x => x.Title);
            dto.TopOverdue = overdue.GroupBy(i => i.CustomerCardID)
                .Select(g => new PanelItem { Id = g.Key, Label = titles.GetValueOrDefault(g.Key), Amount = g.Sum(i => i.Open), Days = g.Max(i => i.DaysOverdue) })
                .OrderByDescending(x => x.Amount).Take(5).ToList();
        });

        await Part("Çek / senet", async () =>
        {
            if (!await HasColAsync("BoundCard", "IsOwn")) return;
            var r = await _db.QueryFirstAsync(
                @"SELECT
  SUM(CASE WHEN ISNULL(IsOwn, 0) = 0 AND Status_ IN (1, 3, 4) AND DueDate >= @today AND DueDate < DATEADD(DAY, 8, @today) THEN Amount ELSE 0 END) AS In7,
  SUM(CASE WHEN ISNULL(IsOwn, 0) = 0 AND Status_ IN (1, 3, 4) AND DueDate >= @today AND DueDate < DATEADD(DAY, 31, @today) THEN Amount ELSE 0 END) AS In30,
  SUM(CASE WHEN IsOwn = 1 AND Status_ = 8 AND DueDate < DATEADD(DAY, 31, @today) THEN Amount ELSE 0 END) AS Out30,
  SUM(CASE WHEN ISNULL(IsOwn, 0) = 0 AND Status_ IN (1, 3, 4) AND DueDate < @today THEN Amount ELSE 0 END) AS Overdue
FROM dbo.BoundCard", new { today });
            dto.BoundsIn7 = (decimal)(double)(r.In7 ?? 0d);
            dto.BoundsIn30 = (decimal)(double)(r.In30 ?? 0d);
            dto.BoundsOut30 = (decimal)(double)(r.Out30 ?? 0d);
            dto.BoundsOverdue = (decimal)(double)(r.Overdue ?? 0d);
        });

        await Part("Satış", async () =>
        {
            const string line = "COALESCE(t.NetTotal, ISNULL(t.TotalPrice, 0) + ISNULL(t.TotalTax, 0))";
            var monthStart = new DateTime(today.Year, today.Month, 1);
            var rows = (await _db.QueryAsync<(DateTime Day, decimal Amount)>(
                $@"SELECT CAST(i.InvoiceDate AS date) AS Day,
  CAST(SUM(CASE WHEN i.InvoiceType = 3 THEN -1 ELSE 1 END * ISNULL(t.TotalPrice, 0)) AS decimal(19,2)) AS Amount
FROM dbo.Invoice i JOIN dbo.ProductTrans t ON t.InvoiceID = i.InvoiceID
WHERE i.InvoiceType IN (1, 3, 7) AND i.InvoiceDate >= @from AND i.InvoiceDate < DATEADD(DAY, 1, @today)
GROUP BY CAST(i.InvoiceDate AS date)", new { from = monthStart.AddMonths(-1), today })).ToList();
            dto.SalesToday = rows.Where(r => r.Day == today).Sum(r => r.Amount);
            dto.SalesMonth = rows.Where(r => r.Day >= monthStart).Sum(r => r.Amount);
            dto.SalesPrevMonth = rows.Where(r => r.Day < monthStart && r.Day.Day <= today.Day).Sum(r => r.Amount);
            dto.SalesLast7 = Enumerable.Range(0, 7).Select(i => today.AddDays(i - 6))
                .Select(d => new PanelItem { Label = d.ToString("dd.MM"), Amount = rows.Where(r => r.Day == d).Sum(r => r.Amount) }).ToList();
            var o = await _db.QueryFirstAsync(
                $@"SELECT COUNT(DISTINCT o.OrderVoucherID) AS Cnt, CAST(SUM({line}) AS decimal(19,2)) AS Amount
FROM dbo.OrderVoucher o LEFT JOIN dbo.OrderTrans t ON t.OrderVoucherID = o.OrderVoucherID
WHERE o.Type_ = 1 AND ISNULL(o.Status_, 1) IN (1, 2)");
            dto.OpenOrders = (int)o.Cnt;
            dto.OpenOrdersAmount = (decimal)(o.Amount ?? 0m);
        });

        await Part("Kritik stok", async () =>
        {
            var hasMin = await HasColAsync("ProductCard", "MinStock");
            var rows = (await _db.QueryAsync<PanelItem>(
                $@"WITH s AS (
  SELECT t.ProductCardID,
    SUM(CASE WHEN COALESCE(t.VoucherType, p.VoucherType) IN (1, 2, 5, 9) THEN 1 WHEN COALESCE(t.VoucherType, p.VoucherType) IN (3, 4, 8, 10) THEN -1 ELSE 0 END
        * CAST(ISNULL(NULLIF(t.MainUnitQuantity, 0), ISNULL(t.Quantity, 0)) AS float)) AS OnHand
  FROM dbo.ProductTrans t JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
  WHERE t.ProductCardID IS NOT NULL AND ISNULL(p.Status_, 1) <> 3
  GROUP BY t.ProductCardID
)
SELECT TOP 50 pc.ProductCardID AS Id, pc.Code AS Label, pc.Title AS Sub, CAST(ISNULL(s.OnHand, 0) AS decimal(19,3)) AS Amount,
  {(hasMin ? "CAST(pc.MinStock AS int)" : "CAST(NULL AS int)")} AS Days
FROM dbo.ProductCard pc LEFT JOIN s ON s.ProductCardID = pc.ProductCardID
WHERE ISNULL(s.OnHand, 0) < 0 {(hasMin ? "OR (pc.MinStock > 0 AND ISNULL(s.OnHand, 0) <= pc.MinStock)" : "")}
ORDER BY ISNULL(s.OnHand, 0) - {(hasMin ? "ISNULL(pc.MinStock, 0)" : "0")}")).ToList();
            dto.CriticalStockCount = rows.Count;
            dto.CriticalStock = rows.Take(8).ToList();
        });

        await Part("Onaylar", async () =>
        {
            var tasks = (await _process.InboxAsync(userId, ct)).Where(t => string.Equals(t.Status, "Pending", StringComparison.OrdinalIgnoreCase)).ToList();
            dto.PendingApprovals = tasks.Count;
            dto.Approvals = tasks.Take(5).Select(t => new PanelItem
            {
                Id = t.ProcessInstanceID,
                Label = t.InstanceTitle ?? t.StepTitle ?? $"Süreç #{t.ProcessInstanceID}",
                Sub = t.StepTitle,
                Days = (int)(DateTime.Now - t.CreatedAt).TotalDays,
            }).ToList();
        });

        await Part("Döviz", async () =>
        {
            if (await HasAsync("SYS_CurrencyRate") && await HasAsync("SYS_Currency"))
                dto.Rates = (await _db.QueryAsync<PanelItem>(
                    @"SELECT c.Code AS Label, CONVERT(nvarchar(10), r.RateDate, 104) AS Sub, CAST(r.SellRate AS decimal(19,4)) AS Amount
FROM dbo.SYS_Currency c
CROSS APPLY (SELECT TOP 1 RateDate, SellRate FROM dbo.SYS_CurrencyRate x WHERE x.CurrencyID = c.CurrencyID AND x.SellRate > 0 ORDER BY x.RateDate DESC) r
WHERE ISNULL(c.IsLocal, 0) = 0 AND c.Code IN (N'USD', N'EUR', N'GBP', N'CHF')
ORDER BY CASE c.Code WHEN N'USD' THEN 1 WHEN N'EUR' THEN 2 WHEN N'GBP' THEN 3 ELSE 4 END")).ToList();

            // Para birimine göre kasa ve banka hesabı bakiyeleri (ekstre kapanışı)
            var codes = (await _db.QueryAsync<(int Id, string Code)>("SELECT CurrencyID, Code FROM dbo.SYS_Currency")).ToDictionary(x => x.Id, x => x.Code);
            var local = await _db.ExecuteScalarAsync<string?>("SELECT TOP 1 Code FROM dbo.SYS_Currency WHERE IsLocal = 1") ?? "TL";
            var byCur = new Dictionary<string, decimal>();
            foreach (var (kind, sql) in new[]
                     {
                         ("safe", "SELECT SafeCardID AS Id, Currency FROM dbo.SafeCard WHERE SafeCardID > 0"),
                         ("bankAccount", "SELECT BankAccountCardID AS Id, Currency FROM dbo.BankAccountCard WHERE BankAccountCardID > 0"),
                     })
            {
                foreach (var c in await _db.QueryAsync<(int Id, int? Currency)>(sql))
                {
                    var st = await _statement.GetAsync(kind, c.Id, null, null, ct);
                    var code = c.Currency is int cid && codes.TryGetValue(cid, out var cc) ? cc : local;
                    byCur[code] = byCur.GetValueOrDefault(code) + st.Closing;
                }
            }
            dto.CashByCurrency = byCur.Where(x => x.Value != 0).OrderBy(x => x.Key == local ? 0 : 1).ThenBy(x => x.Key)
                .Select(x => new PanelItem { Label = x.Key, Amount = x.Value }).ToList();
        });

        return dto;
    }
}
