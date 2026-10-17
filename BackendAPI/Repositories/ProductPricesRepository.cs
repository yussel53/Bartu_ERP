using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class PriceSuggestionDto
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public string Group { get; set; } = "";
    public double? Price { get; set; }
    public DateTime? DocDate { get; set; }
    public string? Source { get; set; }
    public bool VatIncluded { get; set; }
    public bool IsPreferred { get; set; }
}

public sealed class ProductPriceSuggestionsDto
{
    public int ProductCardId { get; set; }
    public int? CustomerId { get; set; }
    public string Direction { get; set; } = "sales";
    public IReadOnlyList<PriceSuggestionDto> Suggestions { get; set; } = Array.Empty<PriceSuggestionDto>();
}

public sealed class ProductPricesRepository
{
    private readonly IDbConnection _db;

    public ProductPricesRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<ProductPriceSuggestionsDto> GetSuggestionsAsync(
        int productCardId,
        int? customerId,
        string? direction,
        CancellationToken ct = default)
    {
        var dir = string.Equals(direction, "purchase", StringComparison.OrdinalIgnoreCase)
            ? "purchase"
            : "sales";

        var result = new ProductPriceSuggestionsDto
        {
            ProductCardId = productCardId,
            CustomerId = customerId,
            Direction = dir,
        };

        if (productCardId <= 0)
            return result;

        if (_db.State != ConnectionState.Open) _db.Open();

        var list = new List<PriceSuggestionDto>();

        try { await AddCatalogAsync(list, productCardId, customerId, type: 1, ct); } catch { /* ignore */ }
        try { await AddCatalogAsync(list, productCardId, customerId, type: 2, ct); } catch { /* ignore */ }
        try { await AddHistoryAsync(list, productCardId, customerId, sales: true, ct); } catch { /* ignore */ }
        try { await AddHistoryAsync(list, productCardId, customerId, sales: false, ct); } catch { /* ignore */ }

        // Tercih sırası: belge yönüne göre cari özel → liste → son hareket (cari) → son hareket
        var preferredKey = dir == "purchase"
            ? FirstAvailable(list, "catalog_purchase_customer", "catalog_purchase", "last_purchase_customer", "last_purchase", "last_purchase_net_customer")
            : FirstAvailable(list, "catalog_sales_customer", "catalog_sales", "last_sale_customer", "last_sale", "last_sale_net_customer");

        foreach (var s in list)
            s.IsPreferred = s.Key == preferredKey;

        result.Suggestions = list
            .OrderBy(s => GroupOrder(s.Group))
            .ThenBy(s => s.Label)
            .ToList();

        return result;
    }

    private static string? FirstAvailable(List<PriceSuggestionDto> list, params string[] keys)
    {
        foreach (var k in keys)
        {
            var hit = list.FirstOrDefault(x => x.Key == k && x.Price != null);
            if (hit != null) return hit.Key;
        }
        return null;
    }

    private static int GroupOrder(string group) => group switch
    {
        "Liste" => 0,
        "Son hareket" => 1,
        "Net" => 2,
        _ => 9,
    };

    private async Task AddCatalogAsync(
        List<PriceSuggestionDto> list,
        int productCardId,
        int? customerId,
        int type,
        CancellationToken ct)
    {
        if (!await TableExistsAsync("ProductPrice", ct)) return;

        var isSales = type == 1;
        var group = "Liste";

        // Genel liste fiyatı (cariye özel değil)
        var genel = await _db.QueryFirstOrDefaultAsync<CatalogRow>(new CommandDefinition(
            @"
SELECT TOP 1
  p.Price,
  CAST(ISNULL(p.VatIncluded, 0) AS bit) AS VatIncluded,
  CAST(p.ValidFrom AS datetime2) AS DocDate,
  COALESCE(NULLIF(LTRIM(RTRIM(p.Code)), N''), NULLIF(LTRIM(RTRIM(p.Title)), N''), N'ProductPrice') AS Source
FROM dbo.ProductPrice p
WHERE p.ProductCardID = @productCardId
  AND p.Type_ = @type
  AND ISNULL(p.IsActive, 1) = 1
  AND p.CustomerCardID IS NULL
  AND (p.ValidFrom IS NULL OR p.ValidFrom <= CAST(SYSUTCDATETIME() AS date))
  AND (p.ValidTo IS NULL OR p.ValidTo >= CAST(SYSUTCDATETIME() AS date))
ORDER BY p.CreatedAt DESC, p.ProductPriceID DESC",
            new { productCardId, type },
            cancellationToken: ct));

        if (genel?.Price != null)
        {
            list.Add(new PriceSuggestionDto
            {
                Key = isSales ? "catalog_sales" : "catalog_purchase",
                Label = isSales ? "Liste satış fiyatı" : "Liste alış fiyatı",
                Group = group,
                Price = genel.Price,
                DocDate = genel.DocDate,
                Source = genel.Source,
                VatIncluded = genel.VatIncluded,
            });
        }

        if (customerId is > 0)
        {
            var cari = await _db.QueryFirstOrDefaultAsync<CatalogRow>(new CommandDefinition(
                @"
SELECT TOP 1
  p.Price,
  CAST(ISNULL(p.VatIncluded, 0) AS bit) AS VatIncluded,
  CAST(p.ValidFrom AS datetime2) AS DocDate,
  COALESCE(NULLIF(LTRIM(RTRIM(p.Code)), N''), NULLIF(LTRIM(RTRIM(p.Title)), N''), N'ProductPrice') AS Source
FROM dbo.ProductPrice p
WHERE p.ProductCardID = @productCardId
  AND p.Type_ = @type
  AND ISNULL(p.IsActive, 1) = 1
  AND p.CustomerCardID = @customerId
  AND (p.ValidFrom IS NULL OR p.ValidFrom <= CAST(SYSUTCDATETIME() AS date))
  AND (p.ValidTo IS NULL OR p.ValidTo >= CAST(SYSUTCDATETIME() AS date))
ORDER BY p.CreatedAt DESC, p.ProductPriceID DESC",
                new { productCardId, type, customerId },
                cancellationToken: ct));

            if (cari?.Price != null)
            {
                list.Add(new PriceSuggestionDto
                {
                    Key = isSales ? "catalog_sales_customer" : "catalog_purchase_customer",
                    Label = isSales ? "Cari satış fiyatı" : "Cari alış fiyatı",
                    Group = group,
                    Price = cari.Price,
                    DocDate = cari.DocDate,
                    Source = cari.Source,
                    VatIncluded = cari.VatIncluded,
                });
            }
        }
    }

    private async Task AddHistoryAsync(
        List<PriceSuggestionDto> list,
        int productCardId,
        int? customerId,
        bool sales,
        CancellationToken ct)
    {
        var rows = new List<HistoryRow>();

        // Fatura satırları (ProductTrans.InvoiceID)
        if (await TableExistsAsync("ProductTrans", ct) && await TableExistsAsync("Invoice", ct))
        {
            var invTypes = sales ? "1" : "2, 5"; // 1 satış / 2 alış + 5 alınan hizmet (iade, fiyat farkı hariç)
            var inv = await _db.QueryAsync<HistoryRow>(new CommandDefinition(
                $@"
SELECT TOP 1
  t.Price,
  t.Quantity,
  t.TotalPrice,
  t.TotalTax,
  t.NetTotal,
  i.InvoiceDate AS DocDate,
  CAST(i.InvoiceID AS nvarchar(30)) AS DocNo,
  N'Fatura' AS Source
FROM dbo.ProductTrans t
INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE t.ProductCardID = @productCardId
  AND i.InvoiceType IN ({invTypes})
  AND (@customerId IS NULL OR i.CustomerID = @customerId)
  AND t.Price IS NOT NULL
ORDER BY i.InvoiceDate DESC, t.ProductTransID DESC",
                new { productCardId, customerId = (int?)null },
                cancellationToken: ct));
            rows.AddRange(inv);

            if (customerId is > 0)
            {
                var invC = await _db.QueryAsync<HistoryRow>(new CommandDefinition(
                    $@"
SELECT TOP 1
  t.Price,
  t.Quantity,
  t.TotalPrice,
  t.TotalTax,
  t.NetTotal,
  i.InvoiceDate AS DocDate,
  CAST(i.InvoiceID AS nvarchar(30)) AS DocNo,
  N'Fatura' AS Source
FROM dbo.ProductTrans t
INNER JOIN dbo.Invoice i ON i.InvoiceID = t.InvoiceID
WHERE t.ProductCardID = @productCardId
  AND i.InvoiceType IN ({invTypes})
  AND i.CustomerID = @customerId
  AND t.Price IS NOT NULL
ORDER BY i.InvoiceDate DESC, t.ProductTransID DESC",
                    new { productCardId, customerId },
                    cancellationToken: ct));
                foreach (var r in invC) { r.CustomerScoped = true; rows.Add(r); }
            }
        }

        // İrsaliye (ProductVoucher)
        if (await TableExistsAsync("ProductTrans", ct) && await TableExistsAsync("ProductVoucher", ct))
        {
            // DispatchType: Alış=2, Satış=3
            var vt = sales ? "3" : "2";
            var pv = await _db.QueryAsync<HistoryRow>(new CommandDefinition(
                $@"
SELECT TOP 1
  t.Price,
  t.Quantity,
  t.TotalPrice,
  t.TotalTax,
  t.NetTotal,
  v.VoucherDate AS DocDate,
  v.DocumentNumber AS DocNo,
  N'İrsaliye' AS Source
FROM dbo.ProductTrans t
INNER JOIN dbo.ProductVoucher v ON v.ProductVoucherID = t.ProductVoucherID
WHERE t.ProductCardID = @productCardId
  AND v.VoucherType IN ({vt})
  AND t.InvoiceID IS NULL
  AND t.Price IS NOT NULL
ORDER BY v.VoucherDate DESC, t.ProductTransID DESC",
                new { productCardId },
                cancellationToken: ct));
            rows.AddRange(pv);

            if (customerId is > 0)
            {
                var pvc = await _db.QueryAsync<HistoryRow>(new CommandDefinition(
                    $@"
SELECT TOP 1
  t.Price,
  t.Quantity,
  t.TotalPrice,
  t.TotalTax,
  t.NetTotal,
  v.VoucherDate AS DocDate,
  v.DocumentNumber AS DocNo,
  N'İrsaliye' AS Source
FROM dbo.ProductTrans t
INNER JOIN dbo.ProductVoucher v ON v.ProductVoucherID = t.ProductVoucherID
WHERE t.ProductCardID = @productCardId
  AND v.VoucherType IN ({vt})
  AND v.CustomerID = @customerId
  AND t.InvoiceID IS NULL
  AND t.Price IS NOT NULL
ORDER BY v.VoucherDate DESC, t.ProductTransID DESC",
                    new { productCardId, customerId },
                    cancellationToken: ct));
                foreach (var r in pvc) { r.CustomerScoped = true; rows.Add(r); }
            }
        }

        // Sipariş (OrderTrans.ItemsID)
        if (await TableExistsAsync("OrderTrans", ct) && await TableExistsAsync("OrderVoucher", ct))
        {
            var ot = sales ? "1" : "2";
            var hasNet = await ColumnExistsAsync("OrderTrans", "NetTotal", ct);
            var netCol = hasNet ? "t.NetTotal" : "CAST(NULL AS float)";
            var hasTax = await ColumnExistsAsync("OrderTrans", "TotalTax", ct);
            var taxCol = hasTax ? "t.TotalTax" : "CAST(NULL AS float)";
            var hasOvFk = await ColumnExistsAsync("OrderTrans", "OrderVoucherID", ct);
            var joinOn = hasOvFk
                ? "v.OrderVoucherID = COALESCE(t.OrderVoucherID, t.OrderSlipID)"
                : "v.OrderVoucherID = t.OrderSlipID";

            var ov = await _db.QueryAsync<HistoryRow>(new CommandDefinition(
                $@"
SELECT TOP 1
  t.Price,
  t.Quantity,
  t.TotalPrice,
  {taxCol} AS TotalTax,
  {netCol} AS NetTotal,
  v.OrderDate AS DocDate,
  v.OrderSlipNo AS DocNo,
  N'Sipariş' AS Source
FROM dbo.OrderTrans t
INNER JOIN dbo.OrderVoucher v ON {joinOn}
WHERE t.ItemsID = @productCardId
  AND v.Type_ IN ({ot})
  AND t.Price IS NOT NULL
ORDER BY v.OrderDate DESC, t.OrderTransID DESC",
                new { productCardId },
                cancellationToken: ct));
            rows.AddRange(ov);

            if (customerId is > 0)
            {
                var ovc = await _db.QueryAsync<HistoryRow>(new CommandDefinition(
                    $@"
SELECT TOP 1
  t.Price,
  t.Quantity,
  t.TotalPrice,
  {taxCol} AS TotalTax,
  {netCol} AS NetTotal,
  v.OrderDate AS DocDate,
  v.OrderSlipNo AS DocNo,
  N'Sipariş' AS Source
FROM dbo.OrderTrans t
INNER JOIN dbo.OrderVoucher v ON {joinOn}
WHERE t.ItemsID = @productCardId
  AND v.Type_ IN ({ot})
  AND v.CustomerID = @customerId
  AND t.Price IS NOT NULL
ORDER BY v.OrderDate DESC, t.OrderTransID DESC",
                    new { productCardId, customerId },
                    cancellationToken: ct));
                foreach (var r in ovc) { r.CustomerScoped = true; rows.Add(r); }
            }
        }

        // En güncel genel / cari satırı seç
        HistoryRow? Pick(bool customerScoped) =>
            rows.Where(r => r.CustomerScoped == customerScoped && r.Price != null)
                .OrderByDescending(r => r.DocDate ?? DateTime.MinValue)
                .FirstOrDefault();

        void AddPair(HistoryRow? row, bool customerScoped)
        {
            if (row?.Price == null) return;
            var prefix = sales ? "last_sale" : "last_purchase";
            var labelBase = sales ? "Son satış" : "Son alım";
            var scope = customerScoped ? " (bu cari)" : "";
            var key = customerScoped ? $"{prefix}_customer" : prefix;
            var src = string.IsNullOrWhiteSpace(row.DocNo)
                ? row.Source
                : $"{row.Source} {row.DocNo}";

            list.Add(new PriceSuggestionDto
            {
                Key = key,
                Label = labelBase + scope,
                Group = "Son hareket",
                Price = row.Price,
                DocDate = row.DocDate,
                Source = src,
            });

            var net = ResolveNetUnit(row);
            if (net != null)
            {
                list.Add(new PriceSuggestionDto
                {
                    Key = customerScoped ? $"{prefix}_net_customer" : $"{prefix}_net",
                    Label = (sales ? "Son satış net" : "Son alım net") + scope,
                    Group = "Net",
                    Price = net,
                    DocDate = row.DocDate,
                    Source = src,
                    VatIncluded = true,
                });
            }
        }

        AddPair(Pick(false), false);
        if (customerId is > 0)
            AddPair(Pick(true), true);
    }

    private static double? ResolveNetUnit(HistoryRow row)
    {
        if (row.Quantity is > 0)
        {
            if (row.NetTotal is > 0)
                return Math.Round(row.NetTotal.Value / row.Quantity.Value, 6);
            if (row.TotalPrice != null)
            {
                var net = (row.TotalPrice ?? 0) + (row.TotalTax ?? 0);
                if (net > 0)
                    return Math.Round(net / row.Quantity.Value, 6);
            }
        }
        return null;
    }

    private async Task<bool> TableExistsAsync(string table, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}" },
            cancellationToken: ct));
        return n == 1;
    }

    private async Task<bool> ColumnExistsAsync(string table, string column, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}", c = column },
            cancellationToken: ct));
        return n == 1;
    }

    private sealed class CatalogRow
    {
        public double? Price { get; set; }
        public bool VatIncluded { get; set; }
        public DateTime? DocDate { get; set; }
        public string? Source { get; set; }
    }

    private sealed class HistoryRow
    {
        public double? Price { get; set; }
        public double? Quantity { get; set; }
        public double? TotalPrice { get; set; }
        public double? TotalTax { get; set; }
        public double? NetTotal { get; set; }
        public DateTime? DocDate { get; set; }
        public string? DocNo { get; set; }
        public string? Source { get; set; }
        public bool CustomerScoped { get; set; }
    }
}
