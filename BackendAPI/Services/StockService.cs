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
/// Stok işlemleri: maliyet, karttaki CostMethod ile (0 hareketli ortalama · 1 dönemsel · 2 FIFO · 3 LIFO · 4 son alış · 5 standart).
/// Satır maliyetleri ProductTransCostCalc Type = 1'e yazılır. Eksi stok: Setting STK_NEG_CTRL 0 izin · 1 uyar · 2 engelle.
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

    private sealed class CostBucket
    {
        public double Qty;
        public double Val;
        public double LastAvg;
        public double LastBuy;
        public readonly List<(double Qty, double Unit)> Layers = new();
    }

    private async Task<Dictionary<int, (int Method, double Standard)>> LoadCostMethodsAsync(IEnumerable<int>? productIds)
    {
        var map = new Dictionary<int, (int Method, double Standard)>();
        if (!await HasColAsync("ProductCard", "CostMethod")) return map;
        var hasStd = await HasColAsync("ProductCard", "StandardCost");
        var ids = productIds?.ToList();
        var rows = await _db.QueryAsync<(int ProductCardID, int Method, double StandardCost)>($@"
SELECT ProductCardID,
       CAST(ISNULL(CostMethod, 0) AS int) AS Method,
       {(hasStd ? "CAST(ISNULL(StandardCost, 0) AS float)" : "CAST(0 AS float)")} AS StandardCost
FROM dbo.ProductCard
{(ids is { Count: > 0 } ? "WHERE ProductCardID IN @ids" : "")}", new { ids });
        foreach (var r in rows)
            map[r.ProductCardID] = (r.Method, r.StandardCost);
        return map;
    }

    /// <summary>Bir malzemenin hareketlerini kart yöntemine göre değerler.</summary>
    private static void ValueMoves(
        IReadOnlyList<Move> moves, int method, double standard, bool perWhouse, List<(int TransId, double Amount)> costs)
    {
        var buckets = new Dictionary<int, CostBucket>();
        CostBucket Bucket(int? wh)
        {
            var k = perWhouse ? wh ?? 0 : 0;
            if (!buckets.TryGetValue(k, out var b))
                buckets[k] = b = new CostBucket();
            return b;
        }

        double period = 0;
        if (method == 1)
        {
            double q = 0, v = 0;
            foreach (var m in moves)
            {
                if (m.Qty <= 0.000001) continue;
                if (m.VoucherType is 1 or 2 or 9)
                {
                    q += m.Qty;
                    v += m.LineTotal;
                }
            }
            period = q > 0.000001 ? v / q : 0;
        }

        static double LineUnit(Move m) => m.Qty > 0.000001 ? m.LineTotal / m.Qty : 0;
        static double Avg(CostBucket b) => b.Qty > 0.000001 ? b.Val / b.Qty : b.LastAvg;
        static void Remember(CostBucket b)
        {
            if (b.Qty > 0.000001) b.LastAvg = b.Val / b.Qty;
        }

        static double Consume(CostBucket b, double qty, bool lifo)
        {
            var left = qty;
            double cost = 0;
            while (left > 0.000001 && b.Layers.Count > 0)
            {
                var i = lifo ? b.Layers.Count - 1 : 0;
                var layer = b.Layers[i];
                var use = Math.Min(layer.Qty, left);
                cost += use * layer.Unit;
                left -= use;
                var rest = layer.Qty - use;
                if (rest <= 0.000001) b.Layers.RemoveAt(i);
                else b.Layers[i] = (rest, layer.Unit);
            }
            if (left > 0.000001)
                cost += left * (b.LastAvg > 0 ? b.LastAvg : b.LastBuy);
            return cost;
        }

        foreach (var m in moves)
        {
            if (m.Qty <= 0.000001) continue;
            var b = Bucket(m.WhouseID);
            var lineUnit = LineUnit(m);
            if (method == 4 && m.VoucherType is 1 or 2 or 9 && lineUnit > 0)
                b.LastBuy = lineUnit;

            if (InTypes.Contains(m.VoucherType))
            {
                double cost;
                if (method == 0)
                    cost = m.VoucherType == 5 ? Avg(b) * m.Qty : m.LineTotal;
                else if (method == 1)
                    cost = period * m.Qty;
                else if (method is 2 or 3)
                {
                    var stacked = b.Layers.Sum(l => l.Qty);
                    var unit = m.VoucherType == 5
                        ? (stacked > 0.000001 ? b.Layers.Sum(l => l.Qty * l.Unit) / stacked : (b.LastAvg > 0 ? b.LastAvg : b.LastBuy))
                        : lineUnit;
                    b.Layers.Add((m.Qty, unit));
                    b.LastAvg = unit;
                    cost = unit * m.Qty;
                }
                else if (method == 4)
                    cost = m.VoucherType == 5 ? (b.LastBuy > 0 ? b.LastBuy : lineUnit) * m.Qty : m.LineTotal;
                else
                    cost = (standard > 0 ? standard : lineUnit) * m.Qty;

                b.Qty += m.Qty;
                b.Val += cost;
                Remember(b);
                costs.Add((m.ProductTransID, Math.Round(cost, 4)));
            }
            else if (OutTypes.Contains(m.VoucherType))
            {
                var cost = method switch
                {
                    1 => period * m.Qty,
                    2 => Consume(b, m.Qty, false),
                    3 => Consume(b, m.Qty, true),
                    4 => (b.LastBuy > 0 ? b.LastBuy : Avg(b)) * m.Qty,
                    5 => (standard > 0 ? standard : Avg(b)) * m.Qty,
                    _ => Avg(b) * m.Qty,
                };
                b.Qty -= m.Qty;
                b.Val -= cost;
                costs.Add((m.ProductTransID, Math.Round(cost, 4)));
            }
            else if (m.VoucherType == 6 && perWhouse && m.AimWhouseID is int aim)
            {
                var cost = method switch
                {
                    1 => period * m.Qty,
                    2 => Consume(b, m.Qty, false),
                    3 => Consume(b, m.Qty, true),
                    4 => (b.LastBuy > 0 ? b.LastBuy : Avg(b)) * m.Qty,
                    5 => (standard > 0 ? standard : Avg(b)) * m.Qty,
                    _ => Avg(b) * m.Qty,
                };
                b.Qty -= m.Qty;
                b.Val -= cost;
                var dest = Bucket(aim);
                if (method is 2 or 3)
                {
                    var unit = m.Qty > 0.000001 ? cost / m.Qty : 0;
                    dest.Layers.Add((m.Qty, unit));
                    dest.LastAvg = unit;
                }
                if (method == 4 && b.LastBuy > 0) dest.LastBuy = b.LastBuy;
                dest.Qty += m.Qty;
                dest.Val += cost;
                Remember(dest);
                costs.Add((m.ProductTransID, Math.Round(cost, 4)));
            }

            if (Math.Abs(b.Qty) <= 0.000001)
            {
                b.Qty = 0;
                b.Val = 0;
                if (method is 2 or 3) b.Layers.Clear();
            }
        }
    }

    // ── Maliyet ────────────────────────────────

    /// <summary>
    /// Malzemeler kronolojik değerlenir. Yöntem karttaki CostMethod alanındadır.
    /// Satır maliyetleri ProductTransCostCalc (Type 1) olarak yeniden yazılır.
    /// </summary>
    public async Task<CostRecalcResult> RecalculateAsync(IEnumerable<int>? productIds = null, CancellationToken ct = default)
    {
        var started = DateTime.UtcNow;
        Open();
        var perWhouse = await SettingAsync("STK_COST_SCOPE", "0") == "1";
        var moves = await MovesAsync(productIds);
        var methods = await LoadCostMethodsAsync(productIds);
        var costs = new List<(int TransId, double Amount)>();

        foreach (var g in moves.GroupBy(m => m.ProductCardID))
        {
            methods.TryGetValue(g.Key, out var spec);
            ValueMoves(g.ToList(), spec.Method, spec.Standard, perWhouse, costs);
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
            Message = $"{products} malzemede {costs.Count} hareket satırının maliyeti, karttaki yönteme göre hesaplandı ({(perWhouse ? "ambar bazında" : "firma geneli")}).",
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
