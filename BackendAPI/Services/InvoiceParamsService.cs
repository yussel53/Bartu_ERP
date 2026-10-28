using System.Data;
using System.Globalization;
using Dapper;

namespace BartuERP.Backend.Services;

/// <summary>Fatura parametreleri — muhasebe kodu, ödeme, fiyat, ambar, malzeme uygunluk.</summary>
public sealed class InvoiceParamsService
{
    private readonly IDbConnection _db;
    private readonly ModuleParamsService _settings;

    public InvoiceParamsService(IDbConnection db, ModuleParamsService settings)
    {
        _db = db;
        _settings = settings;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    static string? F(IDictionary<string, object?> d, string k) =>
        Convert.ToString(d.FirstOrDefault(kv => kv.Key.Equals(k, StringComparison.OrdinalIgnoreCase)).Value);

    static decimal D(string? v) =>
        decimal.TryParse(v, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;

    static int? I(string? v) => int.TryParse(v, out var n) && n > 0 ? n : null;

    public async Task<string?> ValidateBeforeSaveAsync(
        int invoiceId,
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>>? lines,
        IList<Dictionary<string, object?>>? paymentPlans,
        CancellationToken ct = default)
    {
        // Ödeme tutarı > fatura neti
        var payMode = (await _settings.GetAsync("FAT_PAY_OVER")) ?? "block";
        if (payMode is "block" or "warn" && paymentPlans is { Count: > 0 } && lines is { Count: > 0 })
        {
            var net = lines.Sum(l =>
            {
                var tax = D(F(l, "TotalTax"));
                var tot = D(F(l, "TotalPrice"));
                var n = D(F(l, "NetTotal"));
                return n > 0 ? n : tot + tax;
            });
            var pay = paymentPlans.Sum(p => D(F(p, "Amount")));
            if (pay > net + 0.05m && payMode == "block")
                return $"Ödeme tutarı ({pay:N2}) fatura netinden ({net:N2}) fazla. Kayıt engellendi.";
        }

        // Birim fiyat boş / sıfır
        var priceMode = (await _settings.GetAsync("FAT_PRICE_CTRL")) ?? "warn";
        if (priceMode == "block" && lines is { Count: > 0 })
        {
            var bad = lines.Count(l =>
            {
                var pid = F(l, "ProductCardID") ?? F(l, "ItemsID");
                if (string.IsNullOrWhiteSpace(pid) || pid == "0") return false;
                return D(F(l, "Price")) <= 0;
            });
            if (bad > 0)
                return $"{bad} satırda birim fiyat 0 veya boş — kayıt engellendi.";
        }

        // Ambar zorunlu
        var wpMode = (await _settings.GetAsync("FAT_WP_CTRL")) ?? "warn";
        if (wpMode is "block" or "warn")
        {
            var wh = I(F(header, "WhouseID"));
            var lineMissing = lines?.Count(l =>
            {
                var pid = F(l, "ProductCardID") ?? F(l, "ItemsID");
                if (string.IsNullOrWhiteSpace(pid) || pid == "0") return false;
                var lw = I(F(l, "WhouseID"));
                return wh is null && lw is null;
            }) ?? 0;
            if (wh is null && (lines is null || lines.Count == 0 || lineMissing > 0) && wpMode == "block")
                return "Ambar seçilmedi — kayıt engellendi (İşyeri/Ambar Kontrolü).";
        }

        // Malzeme satış/alış kullanım uygunluğu
        var custProd = (await _settings.GetAsync("FAT_CUST_PROD"))
                       ?? (await _settings.GetAsync("STK_CUST_PROD"))
                       ?? "warn";
        if (custProd is "block" or "warn" && lines is { Count: > 0 })
        {
            var invType = I(F(header, "InvoiceType")) ?? 1;
            // 2/5/6 alış tarafı — diğerleri satış
            var purchaseSide = invType is 2 or 5 or 6;
            var badCodes = await FindUnsuitableProductsAsync(lines, purchaseSide, ct);
            if (badCodes.Count > 0 && custProd == "block")
            {
                var side = purchaseSide ? "satınalma" : "satış";
                return $"Malzeme {side} için uygun değil: {string.Join(", ", badCodes.Take(8))} — kayıt engellendi.";
            }
        }

        return null;
    }

    /// <summary>warn mesajı (kayıt devam eder).</summary>
    public async Task<string?> WarningAfterValidateAsync(
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>>? lines,
        IList<Dictionary<string, object?>>? paymentPlans,
        CancellationToken ct = default)
    {
        var msgs = new List<string>();
        var payMode = (await _settings.GetAsync("FAT_PAY_OVER")) ?? "block";
        if (payMode == "warn" && paymentPlans is { Count: > 0 } && lines is { Count: > 0 })
        {
            var net = lines.Sum(l =>
            {
                var tax = D(F(l, "TotalTax"));
                var tot = D(F(l, "TotalPrice"));
                var n = D(F(l, "NetTotal"));
                return n > 0 ? n : tot + tax;
            });
            var pay = paymentPlans.Sum(p => D(F(p, "Amount")));
            if (pay > net + 0.05m)
                msgs.Add($"Ödeme tutarı ({pay:N2}) fatura netinden ({net:N2}) fazla.");
        }

        var priceMode = (await _settings.GetAsync("FAT_PRICE_CTRL")) ?? "warn";
        if (priceMode == "warn" && lines is { Count: > 0 })
        {
            var bad = lines.Count(l =>
            {
                var pid = F(l, "ProductCardID") ?? F(l, "ItemsID");
                if (string.IsNullOrWhiteSpace(pid) || pid == "0") return false;
                return D(F(l, "Price")) <= 0;
            });
            if (bad > 0) msgs.Add($"{bad} satırda birim fiyat boş/sıfır.");
        }

        var wpMode = (await _settings.GetAsync("FAT_WP_CTRL")) ?? "warn";
        if (wpMode == "warn")
        {
            var wh = I(F(header, "WhouseID"));
            var lineMissing = lines?.Count(l =>
            {
                var pid = F(l, "ProductCardID") ?? F(l, "ItemsID");
                if (string.IsNullOrWhiteSpace(pid) || pid == "0") return false;
                return wh is null && I(F(l, "WhouseID")) is null;
            }) ?? 0;
            if (wh is null && (lines is null || lines.Count == 0 || lineMissing > 0))
                msgs.Add("Ambar seçilmedi.");
        }

        var custProd = (await _settings.GetAsync("FAT_CUST_PROD"))
                       ?? (await _settings.GetAsync("STK_CUST_PROD"))
                       ?? "warn";
        if (custProd == "warn" && lines is { Count: > 0 })
        {
            var invType = I(F(header, "InvoiceType")) ?? 1;
            var purchaseSide = invType is 2 or 5 or 6;
            var badCodes = await FindUnsuitableProductsAsync(lines, purchaseSide, ct);
            if (badCodes.Count > 0)
            {
                var side = purchaseSide ? "satınalma" : "satış";
                msgs.Add($"Malzeme {side} için işaretli değil: {string.Join(", ", badCodes.Take(5))}.");
            }
        }

        return msgs.Count > 0 ? string.Join(" · ", msgs) : null;
    }

    public async Task FillEmptyAccountCodesAsync(
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>> lines,
        CancellationToken ct = default)
    {
        if (!await _settings.IsOnAsync("FAT_FILL_ACC") || lines.Count == 0) return;
        Open();
        var invType = I(F(header, "InvoiceType")) ?? 1;
        var productLinkType = invType is 2 or 5 or 6 ? 2 : 3;

        foreach (var line in lines)
        {
            if (I(F(line, "AccountCardID")) is int existing && existing > 0) continue;
            var productId = I(F(line, "ProductCardID")) ?? I(F(line, "ItemsID"));
            var acc = await ResolveLinkAsync(1, productLinkType, productId, ct)
                      ?? await ResolveLinkAsync(7, invType, null, ct);
            if (acc is int a)
            {
                var key = line.Keys.FirstOrDefault(k => k.Equals("AccountCardID", StringComparison.OrdinalIgnoreCase))
                          ?? "AccountCardID";
                line[key] = a;
            }
        }
    }

    private async Task<List<string>> FindUnsuitableProductsAsync(
        IList<Dictionary<string, object?>> lines,
        bool purchaseSide,
        CancellationToken ct)
    {
        Open();
        var ids = lines
            .Select(l => I(F(l, "ProductCardID")) ?? I(F(l, "ItemsID")))
            .Where(x => x is int)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0) return [];

        var flagCol = purchaseSide ? "UseInPurchase" : "UseInSales";
        // NULL = eski kayıt → uygun say
        var rows = (await _db.QueryAsync<(int ProductCardID, string? Code, bool? Flag)>(new CommandDefinition(
            $@"SELECT ProductCardID, Code, CAST({flagCol} AS bit) AS Flag
FROM dbo.ProductCard WHERE ProductCardID IN @ids",
            new { ids }, cancellationToken: ct))).ToList();

        return rows
            .Where(r => r.Flag == false)
            .Select(r => string.IsNullOrWhiteSpace(r.Code) ? r.ProductCardID.ToString() : r.Code!)
            .ToList();
    }

    private async Task<int?> ResolveLinkAsync(int module, int? type, int? sourceCardId, CancellationToken ct)
    {
        var raw = await _db.QueryAsync<int>(new CommandDefinition(
            @"SELECT AccountID FROM dbo.AccountLinkDetail
WHERE Module = @module AND (@type IS NULL OR Type = @type) AND SourceCardID IN (@src, -1)
  AND AccountID IS NOT NULL AND AccountID <> 0
ORDER BY CASE WHEN SourceCardID = @src THEN 0 ELSE 1 END, AccountLinkDetailID",
            new { module, type, src = sourceCardId ?? -1 }, cancellationToken: ct));
        foreach (var acc in raw)
        {
            var id = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                @"SELECT TOP 1 AccountCardID FROM dbo.AccountCard
WHERE AccountCardID = @acc OR Code = CAST(@acc AS nvarchar(50))
ORDER BY CASE WHEN AccountCardID = @acc THEN 0 ELSE 1 END",
                new { acc }, cancellationToken: ct));
            if (id is int found) return found;
        }
        return null;
    }
}
