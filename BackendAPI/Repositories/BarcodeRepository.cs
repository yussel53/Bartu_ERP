using System.Data;
using System.Text.Json;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class BarcodeConflict
{
    public string Barcode { get; set; } = "";
    public int? ProductCardID { get; set; }
    public string? ProductCode { get; set; }
    public string? ProductTitle { get; set; }
    public string Reason { get; set; } = "";
}

public sealed class BarcodeResolveResult
{
    public bool Found { get; set; }
    public int ProductCardID { get; set; }
    public string? ProductCode { get; set; }
    public string? ProductTitle { get; set; }
    public int? UnitID { get; set; }
    public byte? Type { get; set; }
    /// <summary>Birim barkodundan okunan miktar (bölen uygulanmış)</summary>
    public double? Quantity { get; set; }
}

/// <summary>
/// Malzeme barkodu kuralları (SqlUpdates/77): barkod benzersizdir; birim barkodu (Type 5) sondaki
/// QtyDigits haneyi miktar olarak taşır (27000000|500 → 500, QtyDivisor ile bölünür).
/// </summary>
public sealed class BarcodeRepository
{
    public const byte TypeUnit = 5;

    private readonly IDbConnection _db;

    public BarcodeRepository(IDbConnection db)
    {
        _db = db;
    }

    private sealed class Row
    {
        public int ProductBarcodeID { get; set; }
        public string Barcode { get; set; } = "";
        public int? ProductCardID { get; set; }
        public int? UnitID { get; set; }
        public byte? Type { get; set; }
        public byte? QtyDigits { get; set; }
        public int? QtyDivisor { get; set; }
        public bool? HasCheckDigit { get; set; }
        public string? ProductCode { get; set; }
        public string? ProductTitle { get; set; }
    }

    private async Task<bool> HasUnitColumnsAsync() =>
        await _db.ExecuteScalarAsync<int>(
            "SELECT CASE WHEN COL_LENGTH(N'dbo.ProductBarcode', N'QtyDigits') IS NULL THEN 0 ELSE 1 END") == 1;

    private async Task<List<Row>> AllAsync()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        var unitCols = await HasUnitColumnsAsync();
        return (await _db.QueryAsync<Row>($@"
SELECT b.ProductBarcodeID, LTRIM(RTRIM(b.Barcode)) AS Barcode, b.ProductCardID, b.UnitID, CAST(b.Type AS tinyint) AS Type,
       {(unitCols ? "b.QtyDigits, b.QtyDivisor, b.HasCheckDigit" : "CAST(NULL AS tinyint) AS QtyDigits, CAST(NULL AS int) AS QtyDivisor, CAST(NULL AS bit) AS HasCheckDigit")},
       p.Code AS ProductCode, p.Title AS ProductTitle
FROM dbo.ProductBarcode b
LEFT JOIN dbo.ProductCard p ON p.ProductCardID = b.ProductCardID
WHERE b.Barcode IS NOT NULL AND LTRIM(RTRIM(b.Barcode)) <> ''")).ToList();
    }

    /// <summary>Birim barkodunun sabit kısmı (miktar ve kontrol hanesi hariç) — geçersizse null</summary>
    private static string? UnitPrefix(string barcode, byte? qtyDigits, bool? checkDigit)
    {
        var q = qtyDigits ?? 0;
        var tail = q + (checkDigit == true ? 1 : 0);
        return q > 0 && barcode.Length > tail ? barcode[..^tail] : null;
    }

    private static string? Str(object? v) => v switch
    {
        null => null,
        JsonElement { ValueKind: JsonValueKind.String } j => j.GetString(),
        JsonElement { ValueKind: JsonValueKind.Number } j => j.GetRawText(),
        JsonElement { ValueKind: JsonValueKind.Null or JsonValueKind.Undefined } => null,
        JsonElement j => j.ToString(),
        _ => v.ToString(),
    };

    private static int? Int(object? v) => int.TryParse(Str(v)?.Trim(), out var i) ? i : null;
    private static bool Bool(object? v) => Str(v)?.Trim().ToLowerInvariant() is "true" or "1";

    /// <summary>
    /// Kaydedilecek barkodları denetle: aynı listede tekrar, başka malzemede kullanım ve birim barkodu
    /// önek çakışması. productId: kaydedilen malzeme (yeni kartta 0).
    /// </summary>
    public async Task<List<BarcodeConflict>> ValidateAsync(int productId, IEnumerable<Dictionary<string, object?>> rows)
    {
        var mine = rows
            .Select(r =>
            {
                string? Get(string k) => Str(r.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value);
                return new
                {
                    Barcode = (Get("Barcode") ?? "").Trim(),
                    Type = (byte)(Int(Get("Type")) ?? 0),
                    QtyDigits = (byte?)Int(Get("QtyDigits")),
                    Check = Bool(r.FirstOrDefault(kv => kv.Key.Equals("HasCheckDigit", StringComparison.OrdinalIgnoreCase)).Value),
                };
            })
            .Where(x => x.Barcode.Length > 0)
            .ToList();
        var conflicts = new List<BarcodeConflict>();

        foreach (var g in mine.GroupBy(x => x.Barcode).Where(g => g.Count() > 1))
            conflicts.Add(new BarcodeConflict { Barcode = g.Key, Reason = "Bu kartta birden fazla satırda girilmiş" });

        foreach (var x in mine.Where(x => x.Type == TypeUnit && (x.QtyDigits ?? 0) <= 0))
            conflicts.Add(new BarcodeConflict { Barcode = x.Barcode, Reason = "Birim barkodu için «Miktar hanesi» girilmeli" });

        var others = (await AllAsync()).Where(o => o.ProductCardID != productId || productId <= 0).ToList();
        foreach (var x in mine)
        {
            var hit = others.FirstOrDefault(o => o.Barcode == x.Barcode);
            if (hit != null)
            {
                conflicts.Add(new BarcodeConflict
                {
                    Barcode = x.Barcode, ProductCardID = hit.ProductCardID, ProductCode = hit.ProductCode,
                    ProductTitle = hit.ProductTitle, Reason = "Başka malzemede kayıtlı",
                });
                continue;
            }
            // Birim barkodu önek çakışması (iki yönlü)
            var myPrefix = x.Type == TypeUnit ? UnitPrefix(x.Barcode, x.QtyDigits, x.Check) : null;
            var clash = others.FirstOrDefault(o =>
            {
                var op = o.Type == TypeUnit ? UnitPrefix(o.Barcode, o.QtyDigits, o.HasCheckDigit) : null;
                return (op != null && x.Barcode.Length == o.Barcode.Length && x.Barcode.StartsWith(op, StringComparison.Ordinal))
                       || (myPrefix != null && o.Barcode.Length == x.Barcode.Length && o.Barcode.StartsWith(myPrefix, StringComparison.Ordinal));
            });
            if (clash != null)
                conflicts.Add(new BarcodeConflict
                {
                    Barcode = x.Barcode, ProductCardID = clash.ProductCardID, ProductCode = clash.ProductCode,
                    ProductTitle = clash.ProductTitle, Reason = $"Birim barkodu {clash.Barcode} ile çakışıyor",
                });
        }
        return conflicts;
    }

    public static string Describe(IEnumerable<BarcodeConflict> list) =>
        "Barkod benzersiz olmalı — " + string.Join(" · ", list.Select(c =>
            c.ProductCardID is null
                ? $"{c.Barcode}: {c.Reason}"
                : $"{c.Barcode}: {c.Reason} ({c.ProductCode} {c.ProductTitle})".Trim()));

    /// <summary>Okutulan barkod → malzeme (+ birim barkodunda miktar)</summary>
    public async Task<BarcodeResolveResult> ResolveAsync(string code)
    {
        code = (code ?? "").Trim();
        var res = new BarcodeResolveResult();
        if (code.Length == 0) return res;
        var all = await AllAsync();
        var exact = all.FirstOrDefault(b => b.Barcode == code);
        Row? hit = exact;
        double? qty = null;
        if (hit == null)
        {
            foreach (var b in all.Where(b => b.Type == TypeUnit && b.Barcode.Length == code.Length))
            {
                var prefix = UnitPrefix(b.Barcode, b.QtyDigits, b.HasCheckDigit);
                if (prefix == null || !code.StartsWith(prefix, StringComparison.Ordinal)) continue;
                var digits = code.Substring(prefix.Length, b.QtyDigits!.Value);
                if (!long.TryParse(digits, out var raw)) continue;
                hit = b;
                qty = raw / (double)(b.QtyDivisor is > 0 ? b.QtyDivisor.Value : 1);
                break;
            }
        }
        if (hit?.ProductCardID is not int pid) return res;
        res.Found = true;
        res.ProductCardID = pid;
        res.ProductCode = hit.ProductCode;
        res.ProductTitle = hit.ProductTitle;
        res.UnitID = hit.UnitID;
        res.Type = hit.Type;
        res.Quantity = qty;
        return res;
    }
}
