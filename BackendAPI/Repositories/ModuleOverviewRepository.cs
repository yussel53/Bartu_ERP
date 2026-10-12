using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class OverviewKpiDto
{
    public string Key { get; set; } = "";
    public string Title { get; set; } = "";
    public string Value { get; set; } = "";
    public string? Subtitle { get; set; }
    public string Tone { get; set; } = "slate"; // slate | blue | emerald | amber | rose | violet
}

public sealed class OverviewSliceDto
{
    public string Label { get; set; } = "";
    public int Count { get; set; }
    public decimal Amount { get; set; }
    public string? Color { get; set; }
}

public sealed class OverviewBarDto
{
    public string Label { get; set; } = "";
    public decimal Value { get; set; }
    public int? Count { get; set; }
}

public sealed class OverviewPanelDto
{
    public string Title { get; set; } = "";
    public List<OverviewBarDto> Bars { get; set; } = new();
}

public sealed class ModuleOverviewDto
{
    public string ModulePath { get; set; } = "";
    public string? GroupKey { get; set; }
    public string Title { get; set; } = "";
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public List<OverviewKpiDto> Kpis { get; set; } = new();
    public List<OverviewSliceDto> StatusSlices { get; set; } = new();
    public List<OverviewBarDto> MonthlyBars { get; set; } = new();
    public List<OverviewPanelDto> RankPanels { get; set; } = new();
    public string? Warning { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ModuleOverviewRepository
{
    private readonly IDbConnection _db;

    private static readonly string[] StatusColors =
    {
        "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#64748b", "#ec4899"
    };

    private static readonly Dictionary<byte, string> OrderStatusLabels = new()
    {
        [0] = "Taslak",
        [1] = "Açık",
        [2] = "Kapalı",
        [3] = "Sevk",
        [4] = "Bekleyen",
        [5] = "Öneri",
        [6] = "Sevk edilemez",
        [9] = "İptal",
    };

    public ModuleOverviewRepository(IDbConnection db) => _db = db;

    public async Task<ModuleOverviewDto> GetAsync(
        string modulePath,
        string? groupKey,
        DateTime? dateFrom,
        DateTime? dateTo,
        int? typeFilter,
        CancellationToken ct)
    {
        var mod = (modulePath ?? "").Trim().ToLowerInvariant();
        var group = string.IsNullOrWhiteSpace(groupKey) ? null : groupKey.Trim().ToLowerInvariant();
        var from = dateFrom ?? new DateTime(DateTime.Today.Year, 1, 1);
        var to = dateTo ?? DateTime.Today.Date.AddDays(1).AddTicks(-1);

        var dto = new ModuleOverviewDto
        {
            ModulePath = mod,
            GroupKey = group,
            Title = ResolveTitle(mod, group, typeFilter),
            DateFrom = from.ToString("yyyy-MM-dd"),
            DateTo = to.ToString("yyyy-MM-dd"),
        };

        if (_db.State != ConnectionState.Open) _db.Open();

        try
        {
            switch (mod)
            {
                case "satis":
                    await FillOrderOverviewAsync(dto, new[] { 1, 3, 6 }, from, to, typeFilter, ct);
                    break;
                case "satinalma":
                    await FillOrderOverviewAsync(dto, new[] { 2, 4, 5 }, from, to, typeFilter, ct);
                    break;
                case "finans":
                    await FillFinansAsync(dto, group, ct);
                    break;
                case "malzeme":
                    await FillMalzemeAsync(dto, group, from, to, ct);
                    break;
                case "surec":
                    await FillSurecAsync(dto, group, from, to, ct);
                    break;
                case "muhasebe":
                    await FillMuhasebeAsync(dto, group, ct);
                    break;
                case "edevlet":
                    await FillEdevletAsync(dto, group, from, to, ct);
                    break;
                default:
                    await FillGenericCountsAsync(dto, mod, group, ct);
                    break;
            }
        }
        catch (Exception ex)
        {
            dto.Warning = Truncate(ex.Message, 240);
        }

        if (dto.Kpis.Count == 0 && string.IsNullOrEmpty(dto.Warning))
        {
            dto.Kpis.Add(new OverviewKpiDto
            {
                Key = "empty",
                Title = "Özet",
                Value = "—",
                Subtitle = "Bu modül için henüz özet veri yok",
                Tone = "slate",
            });
        }

        return dto;
    }

    private static string ResolveTitle(string mod, string? group, int? typeFilter)
    {
        var baseTitle = mod switch
        {
            "satis" => typeFilter is 1 ? "Satış Sipariş Takip"
                : typeFilter is 6 ? "Satış Talep Takip"
                : "Satış Özeti",
            "satinalma" => typeFilter is 2 ? "Alış Sipariş Takip"
                : typeFilter is 5 ? "Alış Talep Takip"
                : "Satınalma Özeti",
            "finans" => "Finans Özeti",
            "malzeme" => "Malzeme Özeti",
            "surec" => "Süreç Özeti",
            "muhasebe" => "Muhasebe Özeti",
            "edevlet" => "e-Devlet Özeti",
            _ => "Modül Özeti",
        };

        if (string.IsNullOrEmpty(group)) return baseTitle;
        var g = group switch
        {
            "ana-kayitlar" => "Ana Kayıtlar",
            "hareketler" => "Hareketler",
            "islemler" => "İşlemler",
            "raporlar" => "Raporlar",
            _ => group,
        };
        return $"{baseTitle} · {g}";
    }

    private async Task FillOrderOverviewAsync(
        ModuleOverviewDto dto,
        int[] defaultTypes,
        DateTime from,
        DateTime to,
        int? typeFilter,
        CancellationToken ct)
    {
        if (!await TableExistsAsync("OrderVoucher", ct))
        {
            dto.Warning = "OrderVoucher tablosu yok.";
            return;
        }

        var types = typeFilter is > 0 ? new[] { typeFilter.Value } : defaultTypes;
        var hasTrans = await TableExistsAsync("OrderTrans", ct);
        var hasNet = hasTrans && await ColExistsAsync("OrderTrans", "NetTotal", ct);
        var hasTotal = hasTrans && await ColExistsAsync("OrderTrans", "TotalPrice", ct);
        var hasQty = hasTrans && await ColExistsAsync("OrderTrans", "Quantity", ct);
        var hasPrice = hasTrans && await ColExistsAsync("OrderTrans", "Price", ct);
        var hasOvFk = hasTrans && await ColExistsAsync("OrderTrans", "OrderVoucherID", ct);
        var joinKey = hasOvFk ? "t.OrderVoucherID" : "t.OrderSlipID";

        var lineAmt = hasNet
            ? "ISNULL(t.NetTotal, 0)"
            : hasTotal
                ? "ISNULL(t.TotalPrice, 0)"
                : hasQty && hasPrice
                    ? "ISNULL(t.Quantity,0)*ISNULL(t.Price,0)"
                    : "0";

        var amountSql = hasTrans
            ? $@"(SELECT CAST(ISNULL(SUM({lineAmt}),0) AS decimal(18,2)) FROM dbo.OrderTrans t WHERE {joinKey} = v.OrderVoucherID)"
            : "CAST(0 AS decimal(18,2))";

        var lineCntSql = hasTrans
            ? $@"(SELECT COUNT(1) FROM dbo.OrderTrans t WHERE {joinKey} = v.OrderVoucherID)"
            : "0";

        var qtySql = hasTrans && hasQty
            ? $@"(SELECT CAST(ISNULL(SUM(ISNULL(t.Quantity,0)),0) AS decimal(18,2)) FROM dbo.OrderTrans t WHERE {joinKey} = v.OrderVoucherID)"
            : "CAST(0 AS decimal(18,2))";

        var rows = (await _db.QueryAsync<(
            int OrderVoucherID,
            byte? Status_,
            byte? Type_,
            DateTime? OrderDate,
            int? CustomerID,
            decimal Amount,
            int LineCount,
            decimal Qty
        )>(new CommandDefinition($@"
SELECT
  v.OrderVoucherID,
  CAST(v.Status_ AS tinyint) AS Status_,
  CAST(v.Type_ AS tinyint) AS Type_,
  v.OrderDate,
  v.CustomerID,
  {amountSql} AS Amount,
  {lineCntSql} AS LineCount,
  {qtySql} AS Qty
FROM dbo.OrderVoucher v
WHERE v.Type_ IN @types
  AND (@from IS NULL OR v.OrderDate IS NULL OR v.OrderDate >= @from)
  AND (@to IS NULL OR v.OrderDate IS NULL OR v.OrderDate <= @to)
", new { types, from, to }, cancellationToken: ct))).ToList();

        var totalAmt = rows.Sum(r => r.Amount);
        var totalLines = rows.Sum(r => r.LineCount);
        var open = rows.Where(r => r.Status_ is null or 0 or 1 or 4 or 5).ToList();
        var openAmt = open.Sum(r => r.Amount);
        var openQty = open.Sum(r => r.Qty);
        var shipped = rows.Where(r => r.Status_ is 3).ToList();
        var shippedAmt = shipped.Sum(r => r.Amount);
        var closed = rows.Where(r => r.Status_ is 2).ToList();

        dto.Kpis =
        [
            new()
            {
                Key = "total",
                Title = "Toplam Sipariş",
                Value = FormatInt(rows.Count),
                Subtitle = $"{FormatInt(totalLines)} sipariş satırı",
                Tone = "blue",
            },
            new()
            {
                Key = "amount",
                Title = "Toplam Tutar (TL)",
                Value = FormatMoney(totalAmt),
                Subtitle = "Net (satır toplamı)",
                Tone = "violet",
            },
            new()
            {
                Key = "open",
                Title = "Açık Sipariş",
                Value = FormatInt(open.Count),
                Subtitle = $"{FormatMoney(openAmt)} · bekleyen / açık",
                Tone = "amber",
            },
            new()
            {
                Key = "openQty",
                Title = "Bekleyen Miktar",
                Value = FormatInt((int)Math.Round(openQty)),
                Subtitle = "Açık siparişlerde miktar",
                Tone = "slate",
            },
            new()
            {
                Key = "shipped",
                Title = "Sevk / Kapalı",
                Value = FormatMoney(shippedAmt + closed.Sum(r => r.Amount)),
                Subtitle = totalAmt > 0
                    ? $"Toplamın %{((shippedAmt + closed.Sum(r => r.Amount)) / totalAmt * 100):0.#}"
                    : "—",
                Tone = "emerald",
            },
            new()
            {
                Key = "shippedCnt",
                Title = "Sevk Edilen Adet",
                Value = FormatInt(shipped.Count),
                Subtitle = $"{FormatInt(closed.Count)} kapalı",
                Tone = "rose",
            },
        ];

        var byStatus = rows
            .GroupBy(r => r.Status_ ?? 0)
            .OrderByDescending(g => g.Count())
            .Select((g, i) => new OverviewSliceDto
            {
                Label = OrderStatusLabels.TryGetValue(g.Key, out var lb) ? lb : $"Durum {g.Key}",
                Count = g.Count(),
                Amount = g.Sum(x => x.Amount),
                Color = StatusColors[i % StatusColors.Length],
            })
            .ToList();
        dto.StatusSlices = byStatus;

        dto.MonthlyBars = rows
            .Where(r => r.OrderDate.HasValue)
            .GroupBy(r => new DateTime(r.OrderDate!.Value.Year, r.OrderDate.Value.Month, 1))
            .OrderBy(g => g.Key)
            .Select(g => new OverviewBarDto
            {
                Label = g.Key.ToString("MMM yyyy", new System.Globalization.CultureInfo("tr-TR")),
                Value = g.Sum(x => x.Amount),
                Count = g.Count(),
            })
            .ToList();

        // Top müşteriler
        var custIds = rows.Where(r => r.CustomerID is > 0).Select(r => r.CustomerID!.Value).Distinct().ToArray();
        var titles = new Dictionary<int, string>();
        if (custIds.Length > 0 && await TableExistsAsync("CustomerCard", ct))
        {
            var nameCol = await ColExistsAsync("CustomerCard", "Title", ct) ? "Title"
                : await ColExistsAsync("CustomerCard", "Definition", ct) ? "Definition"
                : "Code";
            var map = await _db.QueryAsync<(int CustomerCardID, string? Title)>(new CommandDefinition(
                $"SELECT CustomerCardID, CAST({nameCol} AS nvarchar(200)) AS Title FROM dbo.CustomerCard WHERE CustomerCardID IN @ids",
                new { ids = custIds }, cancellationToken: ct));
            foreach (var m in map)
                titles[m.CustomerCardID] = string.IsNullOrWhiteSpace(m.Title) ? $"#{m.CustomerCardID}" : m.Title!;
        }

        dto.RankPanels.Add(new OverviewPanelDto
        {
            Title = "En Yüksek Müşteriler",
            Bars = rows
                .Where(r => r.CustomerID is > 0)
                .GroupBy(r => r.CustomerID!.Value)
                .Select(g => new OverviewBarDto
                {
                    Label = titles.TryGetValue(g.Key, out var t) ? t : $"Cari #{g.Key}",
                    Value = g.Sum(x => x.Amount),
                    Count = g.Count(),
                })
                .OrderByDescending(b => b.Value)
                .Take(10)
                .ToList(),
        });

        dto.RankPanels.Add(new OverviewPanelDto
        {
            Title = "Durum Dağılımı (adet)",
            Bars = byStatus.Select(s => new OverviewBarDto
            {
                Label = s.Label,
                Value = s.Count,
                Count = s.Count,
            }).ToList(),
        });
    }

    private async Task FillFinansAsync(ModuleOverviewDto dto, string? group, CancellationToken ct)
    {
        var cust = await CountAsync("CustomerCard", ct);
        var bank = await CountAsync("BankAccountCard", ct);
        if (bank == 0) bank = await CountAsync("BankCard", ct);
        var safe = await CountAsync("SafeCard", ct);

        dto.Kpis =
        [
            new() { Key = "cari", Title = "Cari Kart", Value = FormatInt(cust), Tone = "blue" },
            new() { Key = "banka", Title = "Banka Hesabı", Value = FormatInt(bank), Tone = "violet" },
            new() { Key = "kasa", Title = "Kasa", Value = FormatInt(safe), Tone = "emerald" },
        ];

        if (group is "hareketler")
        {
            var ct_ = await CountAsync("CustomerTrans", ct);
            var bt = await CountAsync("BankTrans", ct);
            dto.Kpis.Add(new() { Key = "ctrans", Title = "Cari Hareket", Value = FormatInt(ct_), Tone = "amber" });
            dto.Kpis.Add(new() { Key = "btrans", Title = "Banka Hareket", Value = FormatInt(bt), Tone = "rose" });
        }
    }

    private async Task FillMalzemeAsync(ModuleOverviewDto dto, string? group, DateTime from, DateTime to, CancellationToken ct)
    {
        var cards = await CountAsync("ProductCard", ct);
        dto.Kpis.Add(new() { Key = "urun", Title = "Malzeme Kartı", Value = FormatInt(cards), Tone = "blue" });

        if (await TableExistsAsync("ProductVoucher", ct))
        {
            var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT COUNT(1) FROM dbo.ProductVoucher
WHERE (@from IS NULL OR VoucherDate IS NULL OR VoucherDate >= @from)
  AND (@to IS NULL OR VoucherDate IS NULL OR VoucherDate <= @to)",
                new { from, to }, cancellationToken: ct));
            dto.Kpis.Add(new() { Key = "fis", Title = "Malzeme Fişi", Value = FormatInt(n), Subtitle = "Seçili tarih aralığı", Tone = "violet" });
        }
    }

    private async Task FillSurecAsync(ModuleOverviewDto dto, string? group, DateTime from, DateTime to, CancellationToken ct)
    {
        if (!await TableExistsAsync("SYS_ProcessDef", ct))
        {
            dto.Warning = "Süreç tabloları yok. Veritabanı güncellemesi uygulayın.";
            return;
        }

        var defs = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.SYS_ProcessDef WHERE IsActive = 1", cancellationToken: ct));
        var inst = 0;
        var pending = 0;
        if (await TableExistsAsync("SYS_ProcessInstance", ct))
        {
            inst = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT COUNT(1) FROM dbo.SYS_ProcessInstance
WHERE StartedAt >= @from AND StartedAt <= @to", new { from, to }, cancellationToken: ct));
            pending = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
SELECT COUNT(1) FROM dbo.SYS_ProcessInstance WHERE Status IN (N'Pending', N'InProgress')",
                cancellationToken: ct));
        }

        var tasks = 0;
        if (await TableExistsAsync("SYS_ProcessTask", ct))
        {
            tasks = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.SYS_ProcessTask WHERE Status = N'Pending'", cancellationToken: ct));
        }

        dto.Kpis =
        [
            new() { Key = "defs", Title = "Aktif Süreç", Value = FormatInt(defs), Tone = "blue" },
            new() { Key = "inst", Title = "Süreç Örneği", Value = FormatInt(inst), Subtitle = "Tarih aralığı", Tone = "violet" },
            new() { Key = "open", Title = "Açık Süreç", Value = FormatInt(pending), Tone = "amber" },
            new() { Key = "tasks", Title = "Bekleyen Görev", Value = FormatInt(tasks), Tone = "rose" },
        ];

        if (await TableExistsAsync("SYS_ProcessInstance", ct))
        {
            var slices = (await _db.QueryAsync<(string Status, int Cnt)>(new CommandDefinition(@"
SELECT Status, COUNT(1) AS Cnt FROM dbo.SYS_ProcessInstance
WHERE StartedAt >= @from AND StartedAt <= @to
GROUP BY Status ORDER BY Cnt DESC", new { from, to }, cancellationToken: ct))).ToList();
            dto.StatusSlices = slices.Select((s, i) => new OverviewSliceDto
            {
                Label = s.Status,
                Count = s.Cnt,
                Amount = s.Cnt,
                Color = StatusColors[i % StatusColors.Length],
            }).ToList();
        }
    }

    private async Task FillMuhasebeAsync(ModuleOverviewDto dto, string? group, CancellationToken ct)
    {
        dto.Kpis.Add(new() { Key = "hesap", Title = "Hesap Kartı", Value = FormatInt(await CountAsync("AccountCard", ct)), Tone = "blue" });
        dto.Kpis.Add(new() { Key = "fis", Title = "Muhasebe Fişi", Value = FormatInt(await CountAsync("AccountVoucher", ct)), Tone = "violet" });
    }

    private async Task FillEdevletAsync(ModuleOverviewDto dto, string? group, DateTime from, DateTime to, CancellationToken ct)
    {
        if (!await TableExistsAsync("EGovDocument", ct))
        {
            dto.Warning = "EGovDocument tablosu yok.";
            return;
        }

        var hasDate = await ColExistsAsync("EGovDocument", "DocumentDate", ct);
        var dateFilter = hasDate
            ? "AND (@from IS NULL OR DocumentDate IS NULL OR DocumentDate >= @from) AND (@to IS NULL OR DocumentDate IS NULL OR DocumentDate <= @to)"
            : "";

        var total = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(1) FROM dbo.EGovDocument WHERE 1=1 {dateFilter}",
            new { from, to }, cancellationToken: ct));

        dto.Kpis.Add(new() { Key = "docs", Title = "e-Belge", Value = FormatInt(total), Subtitle = "Tarih aralığı", Tone = "blue" });

        if (await ColExistsAsync("EGovDocument", "DocKind", ct))
        {
            var slices = (await _db.QueryAsync<(byte DocKind, int Cnt)>(new CommandDefinition($@"
SELECT CAST(DocKind AS tinyint) AS DocKind, COUNT(1) AS Cnt
FROM dbo.EGovDocument WHERE 1=1 {dateFilter}
GROUP BY DocKind ORDER BY Cnt DESC", new { from, to }, cancellationToken: ct))).ToList();

            dto.StatusSlices = slices.Select((s, i) => new OverviewSliceDto
            {
                Label = s.DocKind switch { 1 => "e-Fatura", 2 => "e-Arşiv", 3 => "e-İrsaliye", _ => $"Tür {s.DocKind}" },
                Count = s.Cnt,
                Amount = s.Cnt,
                Color = StatusColors[i % StatusColors.Length],
            }).ToList();
        }
    }

    private async Task FillGenericCountsAsync(ModuleOverviewDto dto, string mod, string? group, CancellationToken ct)
    {
        dto.Kpis.Add(new()
        {
            Key = "mod",
            Title = mod,
            Value = group ?? "özet",
            Subtitle = "Özel özet henüz tanımlı değil",
            Tone = "slate",
        });
        await Task.CompletedTask;
    }

    private async Task<int> CountAsync(string table, CancellationToken ct)
    {
        if (!await TableExistsAsync(table, ct)) return 0;
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(1) FROM dbo.[{table}]", cancellationToken: ct));
    }

    private async Task<bool> TableExistsAsync(string table, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(@name, N'U') IS NULL THEN 0 ELSE 1 END",
            new { name = "dbo." + table }, cancellationToken: ct));
        return n == 1;
    }

    private async Task<bool> ColExistsAsync(string table, string column, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + table, c = column }, cancellationToken: ct));
        return n == 1;
    }

    private static string FormatInt(int n) => n.ToString("N0", new System.Globalization.CultureInfo("tr-TR"));

    private static string FormatMoney(decimal n)
    {
        var abs = Math.Abs(n);
        if (abs >= 1_000_000_000m) return $"{(n / 1_000_000_000m):0.##} Mr TL";
        if (abs >= 1_000_000m) return $"{(n / 1_000_000m):0.##} Mn TL";
        return n.ToString("N2", new System.Globalization.CultureInfo("tr-TR")) + " TL";
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) || s.Length <= max ? s : s[..max] + "…";
}
