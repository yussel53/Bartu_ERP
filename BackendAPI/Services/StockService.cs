using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class StockCostRow
{
    public int ProductCardID { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public double Qty { get; set; }
    public double AvgCost { get; set; }
    public double StockValue { get; set; }
    public double SalesQty { get; set; }
    public double SalesAmount { get; set; }
    public double SalesCost { get; set; }
    public double GrossProfit { get; set; }
}

public sealed class CostRecalcResult
{
    public int Products { get; set; }
    public int Lines { get; set; }
    public double Seconds { get; set; }
    public string Message { get; set; } = "";
}

/// <summary>
/// Stok işlemleri (Y-06 / Y-07): ağırlıklı ortalama maliyet (kronolojik; ProductTransCostCalc Type = 1'e yazılır),
/// stok değeri / brüt kâr raporu ve eksi stok kontrolü (Setting STK_NEG_CTRL: 0 izin · 1 uyar · 2 engelle).
/// Stok yönü ekstre ile aynı: 1 devir, 2 alış, 5 satış iade, 9 üretimden giriş (+) · 3 satış, 4 alış iade, 8 sarf, 10 fire (−) ·
/// 6 transfer (ambar bazında çıkış / hedef ambara giriş) · 7 sayım, 11 maliyet dağıtım stoğu değiştirmez.
/// </summary>
public sealed class StockService
{
    public const int CostTypeAverage = 1;
    private static readonly int[] InTypes = [1, 2, 5, 9];
    private static readonly int[] OutTypes = [3, 4, 8, 10];

    private readonly IDbConnection _db;

    public StockService(IDbConnection db)
    {
        _db = db;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private async Task<bool> HasColAsync(string table, string col) =>
        await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END", new { t = "dbo." + table, c = col }) == 1;

    public async Task<string> SettingAsync(string code, string def)
    {
        Open();
        try
        {
            return await _db.ExecuteScalarAsync<string?>("SELECT TOP 1 Value FROM dbo.Setting WHERE Code = @code", new { code }) ?? def;
        }
        catch
        {
            return def;
        }
    }

    private sealed class Move
    {
        public int ProductTransID { get; set; }
        public int ProductCardID { get; set; }
        public int VoucherType { get; set; }
        public int? WhouseID { get; set; }
        public int? AimWhouseID { get; set; }
        public double Qty { get; set; }
        public double LineTotal { get; set; }
        public DateTime? Dt { get; set; }
    }

    private async Task<List<Move>> MovesAsync(IEnumerable<int>? productIds)
    {
        var hasMain = await HasColAsync("ProductTrans", "MainUnitQuantity");
        var hasVt = await HasColAsync("ProductTrans", "VoucherType");
        var hasAim = await HasColAsync("ProductTrans", "AimWhouseID");
        var hasNet = await HasColAsync("ProductTrans", "NetTotal");
        var qty = hasMain ? "CAST(ISNULL(NULLIF(t.MainUnitQuantity, 0), ISNULL(t.Quantity, 0)) AS float)" : "CAST(ISNULL(t.Quantity, 0) AS float)";
        var total = hasNet
            ? "CAST(COALESCE(NULLIF(t.NetTotal, 0), NULLIF(t.TotalPrice, 0), ISNULL(t.Price, 0) * ISNULL(t.Quantity, 0)) AS float)"
            : "CAST(COALESCE(NULLIF(t.TotalPrice, 0), ISNULL(t.Price, 0) * ISNULL(t.Quantity, 0)) AS float)";
        var ids = productIds?.ToList();
        return (await _db.QueryAsync<Move>($@"
SELECT t.ProductTransID, t.ProductCardID, CAST({(hasVt ? "COALESCE(t.VoucherType, p.VoucherType)" : "p.VoucherType")} AS int) AS VoucherType,
       COALESCE(t.WhouseID, p.WhouseID) AS WhouseID, {(hasAim ? "COALESCE(t.AimWhouseID, p.AimWhouseID)" : "CAST(NULL AS int)")} AS AimWhouseID,
       {qty} AS Qty, {total} AS LineTotal, COALESCE(t.TransDate, p.VoucherDate) AS Dt
FROM dbo.ProductTrans t
JOIN dbo.ProductVoucher p ON p.ProductVoucherID = t.ProductVoucherID
WHERE t.ProductCardID IS NOT NULL AND ISNULL(p.Status_, 1) <> 3
  {(ids is { Count: > 0 } ? "AND t.ProductCardID IN @ids" : "")}
ORDER BY t.ProductCardID, COALESCE(t.TransDate, p.VoucherDate), CASE WHEN COALESCE({(hasVt ? "t.VoucherType, " : "")}p.VoucherType) IN (1, 2, 5, 9) THEN 0 ELSE 1 END, t.ProductTransID",
            new { ids })).ToList();
    }

    // ── Y-07: Ağırlıklı ortalama maliyet ────────────────────────────────

    /// <summary>
    /// Tüm (ya da verilen) malzemeler için kronolojik ağırlıklı ortalama: giriş maliyeti satır tutarından (satış iadesi o anki
    /// ortalama ile), çıkışlar o anki ortalama ile değerlenir. Satır maliyetleri ProductTransCostCalc (Type 1) olarak yeniden yazılır.
    /// </summary>
    public async Task<CostRecalcResult> RecalculateAsync(IEnumerable<int>? productIds = null, CancellationToken ct = default)
    {
        var started = DateTime.UtcNow;
        Open();
        var perWhouse = await SettingAsync("STK_COST_SCOPE", "0") == "1";
        var moves = await MovesAsync(productIds);
        var costs = new List<(int TransId, double Amount)>();

        foreach (var g in moves.GroupBy(m => m.ProductCardID))
        {
            var qty = new Dictionary<int, double>();
            var val = new Dictionary<int, double>();
            var lastAvg = new Dictionary<int, double>();
            int Key(int? wh) => perWhouse ? wh ?? 0 : 0;
            // Stok yoksa (ya da eksideyse) son bilinen ortalama kullanılır
            double Avg(int k) => qty.TryGetValue(k, out var q) && q > 0.000001 ? val[k] / q : lastAvg.TryGetValue(k, out var la) ? la : 0;
            void Remember(int k)
            {
                if (qty[k] > 0.000001) lastAvg[k] = val[k] / qty[k];
            }

            foreach (var m in g)
            {
                var k = Key(m.WhouseID);
                qty.TryAdd(k, 0);
                val.TryAdd(k, 0);
                if (InTypes.Contains(m.VoucherType))
                {
                    // Satış iadesi stoğa o anki ortalama maliyetle döner; diğer girişler satır tutarıyla
                    var cost = m.VoucherType == 5 ? Avg(k) * m.Qty : m.LineTotal;
                    qty[k] += m.Qty;
                    val[k] += cost;
                    Remember(k);
                    costs.Add((m.ProductTransID, Math.Round(cost, 4)));
                }
                else if (OutTypes.Contains(m.VoucherType))
                {
                    var cost = Avg(k) * m.Qty;
                    qty[k] -= m.Qty;
                    val[k] -= cost;
                    costs.Add((m.ProductTransID, Math.Round(cost, 4)));
                }
                else if (m.VoucherType == 6 && perWhouse && m.AimWhouseID is int aim)
                {
                    // Ambar bazında: transfer kaynak ortalamasıyla hedefe taşınır
                    var cost = Avg(k) * m.Qty;
                    qty[k] -= m.Qty;
                    val[k] -= cost;
                    var ak = Key(aim);
                    qty.TryAdd(ak, 0);
                    val.TryAdd(ak, 0);
                    qty[ak] += m.Qty;
                    val[ak] += cost;
                    Remember(ak);
                    costs.Add((m.ProductTransID, Math.Round(cost, 4)));
                }
                // Stok sıfırlanınca yuvarlama kalıntısı birikmesin
                if (Math.Abs(qty[k]) <= 0.000001) val[k] = 0;
            }
        }

        // Yaz: ilgili satırların ortalama maliyet kayıtlarını yenile
        var transIds = moves.Select(m => m.ProductTransID).Distinct().ToList();
        using (var tx = _db.BeginTransaction())
        {
            foreach (var chunk in transIds.Chunk(1000))
                await _db.ExecuteAsync("DELETE FROM dbo.ProductTransCostCalc WHERE Type = @t AND MtransID IN @ids",
                    new { t = CostTypeAverage, ids = chunk }, tx);
            var nextId = await _db.ExecuteScalarAsync<int>(
                "SELECT ISNULL(MAX(ProductTransCostCalcID), 0) FROM dbo.ProductTransCostCalc WITH (UPDLOCK, HOLDLOCK)", transaction: tx);
            var identity = await _db.ExecuteScalarAsync<int?>(
                "SELECT COLUMNPROPERTY(OBJECT_ID(N'dbo.ProductTransCostCalc'), N'ProductTransCostCalcID', 'IsIdentity')", transaction: tx) == 1;
            foreach (var c in costs)
            {
                if (identity)
                    await _db.ExecuteAsync("INSERT INTO dbo.ProductTransCostCalc (MtransID, Type, Amount) VALUES (@m, @t, @a)",
                        new { m = c.TransId, t = CostTypeAverage, a = c.Amount }, tx);
                else
                    await _db.ExecuteAsync("INSERT INTO dbo.ProductTransCostCalc (ProductTransCostCalcID, MtransID, Type, Amount) VALUES (@id, @m, @t, @a)",
                        new { id = ++nextId, m = c.TransId, t = CostTypeAverage, a = c.Amount }, tx);
            }
            tx.Commit();
        }

        var products = moves.Select(m => m.ProductCardID).Distinct().Count();
        return new CostRecalcResult
        {
            Products = products,
            Lines = costs.Count,
            Seconds = Math.Round((DateTime.UtcNow - started).TotalSeconds, 2),
            Message = $"{products} malzemede {costs.Count} hareket satırının maliyeti hesaplandı ({(perWhouse ? "ambar bazında" : "firma geneli")} ağırlıklı ortalama).",
        };
    }

    /// <summary>Stok değeri + satış brüt kârı (son maliyet hesabına göre)</summary>
    public async Task<List<StockCostRow>> CostReportAsync(DateTime? from, DateTime? to, CancellationToken ct = default)
    {
        Open();
        var moves = await MovesAsync(null);
        var costByTrans = (await _db.QueryAsync<(int MtransID, double Amount)>(
            "SELECT MtransID, Amount FROM dbo.ProductTransCostCalc WHERE Type = @t", new { t = CostTypeAverage }))
            .GroupBy(x => x.MtransID).ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
        var titles = (await _db.QueryAsync<(int Id, string? Code, string? Title)>(
            "SELECT ProductCardID, Code, Title FROM dbo.ProductCard")).ToDictionary(x => x.Id);

        var rows = new List<StockCostRow>();
        foreach (var g in moves.GroupBy(m => m.ProductCardID))
        {
            double qty = 0, val = 0, sQty = 0, sAmt = 0, sCost = 0;
            foreach (var m in g)
            {
                var c = costByTrans.TryGetValue(m.ProductTransID, out var x) ? x : 0;
                if (InTypes.Contains(m.VoucherType))
                {
                    qty += m.Qty;
                    val += c;
                }
                else if (OutTypes.Contains(m.VoucherType))
                {
                    qty -= m.Qty;
                    val -= c;
                    var inRange = (from == null || m.Dt >= from) && (to == null || m.Dt < to.Value.AddDays(1));
                    if (m.VoucherType == 3 && inRange)
                    {
                        sQty += m.Qty;
                        sAmt += m.LineTotal;
                        sCost += c;
                    }
                }
            }
            titles.TryGetValue(g.Key, out var t);
            rows.Add(new StockCostRow
            {
                ProductCardID = g.Key,
                Code = t.Code,
                Title = t.Title,
                Qty = Math.Round(qty, 4),
                AvgCost = qty > 0.000001 ? Math.Round(val / qty, 4) : 0,
                StockValue = Math.Round(qty > 0 ? val : 0, 2),
                SalesQty = Math.Round(sQty, 4),
                SalesAmount = Math.Round(sAmt, 2),
                SalesCost = Math.Round(sCost, 2),
                GrossProfit = Math.Round(sAmt - sCost, 2),
            });
        }
        return rows.OrderBy(r => r.Code).ToList();
    }

    // ── Y-06: Eksi stok kontrolü ────────────────────────────────────────

    /// <summary>
    /// Kaydedilecek fişin çıkış satırları ambarda eksi stoğa düşürüyor mu? Düzenlenen fişin mevcut satırları hesaba katılmaz.
    /// Dönüş: (mod 0/1/2, sorunlar).
    /// </summary>
    public async Task<(string Mode, List<string> Problems)> CheckNegativeAsync(
        int voucherId, int voucherType, int? headerWhouseId, IEnumerable<Dictionary<string, object?>> lines, CancellationToken ct = default)
    {
        Open();
        var mode = await SettingAsync("STK_NEG_CTRL", "0");
        var problems = new List<string>();
        if (mode == "0" || !(OutTypes.Contains(voucherType) || voucherType == 6)) return (mode, problems);

        static int? Int(object? v) => int.TryParse(Convert.ToString(v), out var i) && i > 0 ? i : null;
        static double Num(object? v) => double.TryParse(Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture),
            System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : 0;
        static object? Get(Dictionary<string, object?> d, params string[] keys) =>
            keys.Select(k => d.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value).FirstOrDefault(v => v != null);

        var need = lines
            .Select(l => (Product: Int(Get(l, "ProductCardID", "ItemsID")), Wh: Int(Get(l, "WhouseID")) ?? headerWhouseId,
                Qty: Num(Get(l, "MainUnitQuantity")) is var mq && mq > 0 ? mq : Num(Get(l, "Quantity"))))
            .Where(x => x.Product != null && x.Qty > 0)
            .GroupBy(x => (x.Product!.Value, x.Wh))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Qty));
        if (need.Count == 0) return (mode, problems);

        var moves = await MovesAsync(need.Keys.Select(k => k.Value).Distinct());
        // Düzenlenen fişin mevcut satırları hesaba katılmaz (yeni halleri «need» içinde)
        var own = voucherId > 0
            ? (await _db.QueryAsync<int>("SELECT ProductTransID FROM dbo.ProductTrans WHERE ProductVoucherID = @voucherId", new { voucherId })).ToHashSet()
            : new HashSet<int>();
        moves = moves.Where(m => !own.Contains(m.ProductTransID)).ToList();

        var names = (await _db.QueryAsync<(int Id, string? Code)>(
            "SELECT ProductCardID, Code FROM dbo.ProductCard WHERE ProductCardID IN @ids", new { ids = need.Keys.Select(k => k.Value).Distinct() }))
            .ToDictionary(x => x.Id, x => x.Code);
        foreach (var ((pid, wh), q) in need)
        {
            double stock = 0;
            foreach (var m in moves.Where(m => m.ProductCardID == pid))
            {
                if (InTypes.Contains(m.VoucherType) && (wh == null || m.WhouseID == wh)) stock += m.Qty;
                else if (OutTypes.Contains(m.VoucherType) && (wh == null || m.WhouseID == wh)) stock -= m.Qty;
                else if (m.VoucherType == 6 && wh != null)
                {
                    if (m.WhouseID == wh) stock -= m.Qty;
                    if (m.AimWhouseID == wh) stock += m.Qty;
                }
            }
            if (stock - q < -0.000001)
                problems.Add($"{(names.TryGetValue(pid, out var c) ? c : "#" + pid)}{(wh != null ? $" (ambar {wh})" : "")}: eldeki {stock:0.####}, çıkış {q:0.####}");
        }
        return (mode, problems);
    }

}
