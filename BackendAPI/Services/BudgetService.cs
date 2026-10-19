using System.Data;
using System.Globalization;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class BudgetLineInput
{
    public int? ProductCardID { get; set; }
    public decimal Amount { get; set; }
}

public sealed class BudgetCheckRequest
{
    public int InvoiceType { get; set; }
    public DateTime? Date { get; set; }
    public int InvoiceId { get; set; }
    public List<BudgetLineInput> Lines { get; set; } = new();
}

public sealed class BudgetBarDto
{
    public int BudgetID { get; set; }
    public string Title { get; set; } = "";
    public int Kind { get; set; }
    public int OverAction { get; set; }
    public int Month { get; set; }
    public decimal MonthBudget { get; set; }
    /// <summary>Bu belge hariç ay içi gerçekleşen</summary>
    public decimal MonthActual { get; set; }
    public decimal DocAmount { get; set; }
    /// <summary>Düzenlenen faturanın kayıtlı halinin bu bütçeye düşen tutarı (artmayan düzenleme engellenmez)</summary>
    public decimal PrevDocAmount { get; set; }
    public decimal YearBudget { get; set; }
    public decimal YearActual { get; set; }
    public bool Over => MonthBudget > 0 && MonthActual + DocAmount > MonthBudget;
}

public sealed class BudgetReportRow
{
    public int BudgetID { get; set; }
    public string? Code { get; set; }
    public string Title { get; set; } = "";
    public int Kind { get; set; }
    public string? Target { get; set; }
    public decimal[] Budget { get; set; } = new decimal[12];
    public decimal[] Actual { get; set; } = new decimal[12];
    public decimal YearBudget => Budget.Sum();
    public decimal YearActual => Actual.Sum();
}

/// <summary>
/// Y-17: bütçe / gerçekleşen. Malzeme bütçesi: faturalar (KDV hariç; gider = alış 2, 5, 6 − alış iade 4 · gelir = satış 1, 7 − satış iade 3).
/// Hesap bütçesi: muhasebe fişleri, hesap ve alt hesapları (kod öneki) — gider borç − alacak, gelir alacak − borç.
/// Faturada her satırın malzemesi doğrudan malzeme bütçesine, Muhasebe Bağlantısı üzerinden de hesap bütçesine düşer.
/// </summary>
public sealed class BudgetService
{
    private readonly IDbConnection _db;

    public BudgetService(IDbConnection db)
    {
        _db = db;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private async Task<bool> ReadyAsync() =>
        await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID('dbo.Budget') IS NULL THEN 0 ELSE 1 END") == 1;

    private sealed class BudgetRow
    {
        public int BudgetID { get; set; }
        public string? Code { get; set; }
        public string Title { get; set; } = "";
        public int Kind { get; set; }
        public int? AccountCardID { get; set; }
        public int? ProductCardID { get; set; }
        public int OverAction { get; set; }
        public string? AccountCode { get; set; }
        public string? Target { get; set; }
        public decimal? M1 { get; set; } public decimal? M2 { get; set; } public decimal? M3 { get; set; } public decimal? M4 { get; set; }
        public decimal? M5 { get; set; } public decimal? M6 { get; set; } public decimal? M7 { get; set; } public decimal? M8 { get; set; }
        public decimal? M9 { get; set; } public decimal? M10 { get; set; } public decimal? M11 { get; set; } public decimal? M12 { get; set; }

        public decimal[] Months => new[] { M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12 }.Select(x => x ?? 0).ToArray();
    }

    private Task<IEnumerable<BudgetRow>> BudgetsAsync(int year) =>
        _db.QueryAsync<BudgetRow>(
            @"SELECT b.BudgetID, b.Code, b.Title, b.Kind, b.AccountCardID, b.ProductCardID, b.OverAction, a.Code AS AccountCode,
  COALESCE(a.Code + N' ' + a.Title, p.Code + N' ' + p.Title) AS Target,
  b.M1, b.M2, b.M3, b.M4, b.M5, b.M6, b.M7, b.M8, b.M9, b.M10, b.M11, b.M12
FROM dbo.Budget b
LEFT JOIN dbo.AccountCard a ON a.AccountCardID = b.AccountCardID
LEFT JOIN dbo.ProductCard p ON p.ProductCardID = b.ProductCardID
WHERE b.BudgetYear = @year AND b.IsActive = 1 AND (b.AccountCardID IS NOT NULL OR b.ProductCardID IS NOT NULL)", new { year });

    /// <summary>Aylık gerçekleşen (12 ay) — excludeInvoiceId faturası ve onun muhasebe fişi hariç</summary>
    private async Task<decimal[]> ActualAsync(BudgetRow b, int year, int excludeInvoiceId)
    {
        var arr = new decimal[12];
        IEnumerable<(int M, decimal A)> rows;
        if (b.ProductCardID is int pid)
        {
            var sign = b.Kind == 2
                ? "CASE i.InvoiceType WHEN 1 THEN 1 WHEN 7 THEN 1 WHEN 3 THEN -1 ELSE 0 END"
                : "CASE i.InvoiceType WHEN 2 THEN 1 WHEN 5 THEN 1 WHEN 6 THEN 1 WHEN 4 THEN -1 ELSE 0 END";
            rows = await _db.QueryAsync<(int, decimal)>(
                $@"SELECT MONTH(i.InvoiceDate), CAST(SUM({sign} * ISNULL(t.TotalPrice, 0)) AS decimal(19,2))
FROM dbo.Invoice i JOIN dbo.ProductTrans t ON t.InvoiceID = i.InvoiceID
WHERE t.ProductCardID = @pid AND YEAR(i.InvoiceDate) = @year AND i.InvoiceID <> @ex
GROUP BY MONTH(i.InvoiceDate)", new { pid, year, ex = excludeInvoiceId });
        }
        else if (!string.IsNullOrEmpty(b.AccountCode))
        {
            var amt = b.Kind == 2 ? "ISNULL(t.Credit, 0) - ISNULL(t.Debit, 0)" : "ISNULL(t.Debit, 0) - ISNULL(t.Credit, 0)";
            rows = await _db.QueryAsync<(int, decimal)>(
                $@"SELECT MONTH(v.VoucherDate), CAST(SUM({amt}) AS decimal(19,2))
FROM dbo.AccountTrans t JOIN dbo.AccountVoucher v ON v.AccountVoucherID = t.AccountVoucherID
JOIN dbo.AccountCard a ON a.AccountCardID = t.AccountCardID
WHERE YEAR(v.VoucherDate) = @year AND (a.Code = @code OR a.Code LIKE @prefix)
  AND NOT (ISNULL(v.SourceModule, 0) = 7 AND v.SourceID = @ex)
GROUP BY MONTH(v.VoucherDate)", new { year, code = b.AccountCode, prefix = b.AccountCode + ".%", ex = excludeInvoiceId });
        }
        else return arr;
        foreach (var (m, a) in rows) if (m is >= 1 and <= 12) arr[m - 1] += a;
        return arr;
    }

    public async Task<List<BudgetReportRow>> ReportAsync(int year, CancellationToken ct = default)
    {
        Open();
        if (!await ReadyAsync()) return new();
        var list = new List<BudgetReportRow>();
        foreach (var b in await BudgetsAsync(year))
            list.Add(new BudgetReportRow
            {
                BudgetID = b.BudgetID, Code = b.Code, Title = b.Title, Kind = b.Kind, Target = b.Target,
                Budget = b.Months, Actual = await ActualAsync(b, year, 0),
            });
        return list.OrderBy(r => r.Kind).ThenBy(r => r.Code).ThenBy(r => r.Title).ToList();
    }

    /// <summary>Faturadaki satırların düştüğü bütçeler (çubuk) — yalnız tutarı olan bütçeler</summary>
    public async Task<List<BudgetBarDto>> CheckInvoiceAsync(BudgetCheckRequest req, CancellationToken ct = default)
    {
        Open();
        var result = new List<BudgetBarDto>();
        if (!await ReadyAsync() || req.Date is not DateTime date) return result;
        var kind = req.InvoiceType switch { 1 or 3 or 7 => 2, 2 or 4 or 5 or 6 => 1, _ => 0 };
        if (kind == 0) return result;
        var sign = req.InvoiceType is 3 or 4 ? -1m : 1m;
        var budgets = (await BudgetsAsync(date.Year)).Where(b => b.Kind == kind).ToList();
        if (budgets.Count == 0) return result;

        // Satır malzemesinin hesap kodu (Muhasebe Bağlantısı: kart, yoksa öndeğer; yoksa fatura türü bağlantısı)
        var linkType = req.InvoiceType switch { 2 or 5 or 6 => 2, 3 => 5, 4 => 4, _ => 3 };
        var accountOf = new Dictionary<int, string?>();
        foreach (var pid in req.Lines.Where(l => l.ProductCardID > 0).Select(l => l.ProductCardID!.Value).Distinct())
            accountOf[pid] = await _db.ExecuteScalarAsync<string?>(
                @"SELECT TOP 1 a.Code FROM dbo.AccountLinkDetail d
JOIN dbo.AccountCard a ON a.AccountCardID = d.AccountID OR a.Code = CAST(d.AccountID AS nvarchar(50))
WHERE (d.Module = 1 AND d.Type = @linkType AND d.SourceCardID IN (@pid, -1)) OR (d.Module = 7 AND d.Type = @invType)
ORDER BY CASE WHEN d.Module = 1 AND d.SourceCardID = @pid THEN 0 WHEN d.Module = 1 THEN 1 ELSE 2 END",
                new { linkType, pid, invType = req.InvoiceType });

        var saved = req.InvoiceId > 0
            ? (await _db.QueryAsync<BudgetLineInput>(
                "SELECT ProductCardID, CAST(ISNULL(TotalPrice, 0) AS decimal(19,2)) AS Amount FROM dbo.ProductTrans WHERE InvoiceID = @id", new { id = req.InvoiceId })).ToList()
            : new List<BudgetLineInput>();
        foreach (var pid in saved.Where(l => l.ProductCardID > 0 && !accountOf.ContainsKey(l.ProductCardID!.Value)).Select(l => l.ProductCardID!.Value).Distinct())
            accountOf[pid] = null;

        var month = date.Month;
        foreach (var b in budgets)
        {
            bool Hits(BudgetLineInput l) => l.ProductCardID is int pid && (b.ProductCardID == pid ||
                (!string.IsNullOrEmpty(b.AccountCode) && accountOf.GetValueOrDefault(pid) is { } code &&
                 (code == b.AccountCode || code.StartsWith(b.AccountCode + ".", StringComparison.Ordinal))));
            var doc = req.Lines.Where(Hits).Sum(l => l.Amount) * sign;
            var prev = saved.Where(Hits).Sum(l => l.Amount) * sign;
            if (doc == 0) continue;
            var actual = await ActualAsync(b, date.Year, req.InvoiceId);
            var months = b.Months;
            result.Add(new BudgetBarDto
            {
                BudgetID = b.BudgetID, Title = b.Title, Kind = b.Kind, OverAction = b.OverAction, Month = month,
                MonthBudget = months[month - 1], MonthActual = actual[month - 1], DocAmount = doc, PrevDocAmount = prev,
                YearBudget = months.Sum(), YearActual = actual.Sum(),
            });
        }
        return result;
    }

    public static string Message(BudgetBarDto b)
    {
        var tr = CultureInfo.GetCultureInfo("tr-TR");
        return $"«{b.Title}» {tr.DateTimeFormat.GetMonthName(b.Month)} bütçesi {b.MonthBudget.ToString("N2", tr)} aşılıyor " +
               $"(gerçekleşen {b.MonthActual.ToString("N2", tr)} + bu belge {b.DocAmount.ToString("N2", tr)}).";
    }
}
