using System.Data;
using System.Globalization;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class RiskInfo
{
    public int CustomerCardID { get; set; }
    public string? RiskGroup { get; set; }
    /// <summary>Geçerli limit (cari limiti, yoksa grup limiti); null → limit yok</summary>
    public decimal? Limit { get; set; }
    /// <summary>0 izle · 1 uyar · 2 yönetici onayı · 3 engelle</summary>
    public int Action { get; set; }
    public decimal Balance { get; set; }
    public decimal OpenOrders { get; set; }
    public decimal Dispatches { get; set; }
    public decimal Bounds { get; set; }
    public decimal Total { get; set; }
    public decimal? Available { get; set; }
    /// <summary>Faturalanmamış irsaliyeler riske dahil mi (grup ayarı)</summary>
    public bool IncDispatches { get; set; }
}

public sealed class RiskCheckResult
{
    /// <summary>0 sorun yok / izle · 1 uyar · 2 yönetici onayı · 3 engelle</summary>
    public int Action { get; set; }
    public string? Message { get; set; }
}

/// <summary>
/// Y-12: cari risk = bakiye + (açık satış siparişleri) + (faturalanmamış satış irsaliyeleri) + (portföy / ciro / tahsil / teminattaki müşteri çek-senetleri).
/// Limit: CustomerCard.RiskLimit, yoksa RiskGroup.RiskLimit. Satış siparişi (Type_ 1), satış irsaliyesi (VoucherType 3) ve satış faturası
/// (InvoiceType 1, 7) kaydında, düzenlenen belgenin eski tutarı düşülüp yeni tutar eklenerek kontrol edilir.
/// </summary>
public sealed class RiskService
{
    private readonly IDbConnection _db;
    private readonly CardStatementRepository _statement;

    public RiskService(IDbConnection db, CardStatementRepository statement)
    {
        _db = db;
        _statement = statement;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private sealed class Cfg
    {
        public string? GroupTitle { get; set; }
        public double? CardLimit { get; set; }
        public double? GroupLimit { get; set; }
        public int? RiskAction { get; set; }
        public bool? IncOrders { get; set; }
        public bool? IncDispatches { get; set; }
        public bool? IncBounds { get; set; }
    }

    private async Task<Cfg?> ConfigAsync(int customerId)
    {
        if (await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN COL_LENGTH('dbo.RiskGroup', 'RiskAction') IS NULL THEN 0 ELSE 1 END") == 0) return null;
        return await _db.QueryFirstOrDefaultAsync<Cfg>(
            @"SELECT g.Title AS GroupTitle, c.RiskLimit AS CardLimit, g.RiskLimit AS GroupLimit, g.RiskAction, g.IncOrders, g.IncDispatches, g.IncBounds
FROM dbo.CustomerCard c LEFT JOIN dbo.RiskGroup g ON g.RiskGroupID = c.RiskGroupID AND ISNULL(g.IsActive, 1) = 1
WHERE c.CustomerCardID = @customerId", new { customerId });
    }

    /// <summary>Satış siparişi satır toplamı (KDV dahil): «SELECT … FROM OrderVoucher o JOIN OrderTrans t» + koşul</summary>
    private const string OrderSum = "SELECT CAST(SUM(COALESCE(t.NetTotal, ISNULL(t.TotalPrice, 0) + ISNULL(t.TotalTax, 0))) AS decimal(19,2)) FROM dbo.OrderVoucher o JOIN dbo.OrderTrans t ON t.OrderVoucherID = o.OrderVoucherID WHERE o.Type_ = 1 AND ISNULL(o.Status_, 1) IN (1, 2) AND ";

    public async Task<RiskInfo> InfoAsync(int customerId, CancellationToken ct = default)
    {
        Open();
        var cfg = await ConfigAsync(customerId) ?? new Cfg();
        var (debit, credit) = await _statement.CustomerBalanceAsync(customerId, ct);
        var info = new RiskInfo
        {
            CustomerCardID = customerId,
            RiskGroup = cfg.GroupTitle,
            Limit = (decimal?)(cfg.CardLimit ?? cfg.GroupLimit),
            Action = cfg.RiskAction ?? 1,
            Balance = debit - credit,
            IncDispatches = cfg.IncDispatches ?? false,
        };
        if (cfg.IncOrders ?? true)
            info.OpenOrders = await _db.ExecuteScalarAsync<decimal?>(
                OrderSum + "o.CustomerID = @customerId",
                new { customerId }) ?? 0;
        if (info.IncDispatches)
            info.Dispatches = await _db.ExecuteScalarAsync<decimal?>(
                @"SELECT CAST(SUM(COALESCE(t.NetTotal, ISNULL(t.TotalPrice, 0) + ISNULL(t.TotalTax, 0))) AS decimal(19,2))
FROM dbo.ProductTrans t JOIN dbo.ProductVoucher v ON v.ProductVoucherID = t.ProductVoucherID
WHERE v.CustomerID = @customerId AND v.VoucherType = 3 AND t.InvoiceID IS NULL", new { customerId }) ?? 0;
        if ((cfg.IncBounds ?? true) && await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID('dbo.BoundRoll') IS NULL THEN 0 ELSE 1 END") == 1)
            info.Bounds = await _db.ExecuteScalarAsync<decimal?>(
                "SELECT CAST(SUM(Amount) AS decimal(19,2)) FROM dbo.BoundCard WHERE CustomerID = @customerId AND ISNULL(IsOwn, 0) = 0 AND Status_ IN (1, 2, 3, 4)",
                new { customerId }) ?? 0;
        info.Total = info.Balance + info.OpenOrders + info.Dispatches + info.Bounds;
        info.Available = info.Limit is decimal l ? l - info.Total : null;
        return info;
    }

    private static decimal Num(object? v) =>
        decimal.TryParse(Convert.ToString(v, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0;

    private static object? Get(IDictionary<string, object?> d, params string[] keys) =>
        keys.Select(k => d.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value).FirstOrDefault(v => v != null && Convert.ToString(v) != "");

    /// <summary>Satış belgesi kaydı öncesi risk kontrolü. Satış belgesi değilse ya da limit yoksa Action = 0.</summary>
    public async Task<RiskCheckResult> CheckAsync(string table, int recordId, IDictionary<string, object?> fields,
        IEnumerable<Dictionary<string, object?>>? lines, CancellationToken ct = default)
    {
        var none = new RiskCheckResult();
        int? Int(params string[] keys) => int.TryParse(Convert.ToString(Get(fields, keys)), out var i) ? i : null;
        var customerId = Int("CustomerID");
        if (customerId is not > 0) return none;

        // Belge türü ve düzenlenen belgenin riskteki eski tutarı
        string? oldSql;
        switch (table.ToLowerInvariant())
        {
            case "ordervoucher" when Int("Type_") == 1:
                oldSql = OrderSum + "o.OrderVoucherID = @recordId";
                break;
            case "productvoucher" when Int("VoucherType") == 3:
                oldSql = "SELECT CAST(SUM(COALESCE(NetTotal, ISNULL(TotalPrice, 0) + ISNULL(TotalTax, 0))) AS decimal(19,2)) FROM dbo.ProductTrans WHERE ProductVoucherID = @recordId AND InvoiceID IS NULL";
                break;
            case "invoice" when Int("InvoiceType") is 1 or 7:
                oldSql = "SELECT CAST(SUM(COALESCE(NetTotal, ISNULL(TotalPrice, 0) + ISNULL(TotalTax, 0))) AS decimal(19,2)) FROM dbo.ProductTrans WHERE InvoiceID = @recordId";
                break;
            default:
                return none;
        }

        Open();
        var info = await InfoAsync(customerId.Value, ct);
        if (info.Limit is not decimal limit || info.Action == 0) return none;

        // İrsaliye tutarı riske yalnız grup ayarı açıksa girer
        if (table.Equals("ProductVoucher", StringComparison.OrdinalIgnoreCase) && !info.IncDispatches) return none;

        var old = recordId > 0 ? await _db.ExecuteScalarAsync<decimal?>(oldSql, new { recordId }) ?? 0 : 0;
        var amount = (lines ?? Enumerable.Empty<Dictionary<string, object?>>()).Sum(l =>
        {
            var net = Num(Get(l, "NetTotal"));
            return net != 0 ? net : Num(Get(l, "TotalPrice")) + Num(Get(l, "TotalTax"));
        });
        // Düzenlenen belge tutarı artmıyorsa risk artmaz — kontrol edilmez
        if (recordId > 0 && amount <= old) return none;
        var after = info.Total - old + amount;
        if (after <= limit) return none;

        string F(decimal v) => v.ToString("N2", CultureInfo.GetCultureInfo("tr-TR"));
        var parts = new List<string> { $"bakiye {F(info.Balance)}" };
        if (info.OpenOrders != 0) parts.Add($"açık sipariş {F(info.OpenOrders)}");
        if (info.Dispatches != 0) parts.Add($"irsaliye {F(info.Dispatches)}");
        if (info.Bounds != 0) parts.Add($"portföy çek/senet {F(info.Bounds)}");
        return new RiskCheckResult
        {
            Action = info.Action,
            Message = $"Risk limiti aşılıyor: limit {F(limit)}, bu belgeyle risk {F(after)} ({string.Join(", ", parts)}, belge {F(amount)}) — aşım {F(after - limit)}.",
        };
    }
}
