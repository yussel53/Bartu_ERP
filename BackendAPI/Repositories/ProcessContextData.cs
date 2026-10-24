using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using Dapper;

namespace BartuERP.Backend.Repositories;

/// <summary>
/// Her süreç aynı nesneyi taşır: belge, cari, adres ve satır.
/// SELECT satırı veya kaynak kayıt (e-fatura, fiş, kart) bu şekle yazılır.
/// </summary>
internal static class ProcessContextData
{
    private static readonly Regex SafeName = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);
    private static readonly HashSet<string> SkipCols = new(StringComparer.OrdinalIgnoreCase)
    {
        "XmlContent", "PdfContent", "Password", "Image", "Picture", "Logo"
    };

    public static async Task<string> BuildAsync(
        IDbConnection db,
        string? table,
        int id,
        IDictionary<string, object?>? preset,
        CancellationToken ct,
        IReadOnlyList<IDictionary<string, object?>>? tableRows = null,
        string tableName = "Satirlar")
    {
        var row = preset ?? await LoadRowAsync(db, table, id, ct);
        if (row != null && string.Equals(table, "EGovDocument", StringComparison.OrdinalIgnoreCase))
            await FillEgovAddressAsync(db, id, row, ct);
        else if (row != null)
        {
            try { await FillCustomerAsync(db, row, ct); }
            catch { /* cari / adres yoksa nesne yine yazılır */ }
        }

        var belge = new Dictionary<string, object?>
        {
            ["no"] = Pick(row, "belgeNo", "faturaNo", "documentNo", "invoiceNo", "documentNumber", "slipNo", "orderSlipNo", "voucherNo"),
            ["tarih"] = DateText(Pick(row, "tarih", "documentDate", "issueDate", "invoiceDate", "voucherDate", "orderDate", "transDate")),
            ["tur"] = Pick(row, "tur", "profileId", "docKind", "invoiceType", "voucherType"),
            ["tutar"] = Num(Pick(row, "tutar", "amount", "netTotal", "grandTotal", "total")),
            ["vergi"] = Num(Pick(row, "vergi", "taxAmount", "totalTax")),
            ["doviz"] = Pick(row, "doviz", "currencyCode", "currency"),
        };
        var cari = new Dictionary<string, object?>
        {
            ["kod"] = Pick(row, "cariKod", "customerCode", "code"),
            ["unvan"] = Pick(row, "cariUnvan", "customerTitle", "title", "name"),
            ["vergiNo"] = Pick(row, "vergiNo", "taxNr", "taxNumber", "vkn", "tckn"),
        };
        var adres = new Dictionary<string, object?>
        {
            ["satir"] = Pick(row, "adres", "adress", "address", "street"),
            ["ilce"] = Pick(row, "ilce", "town", "district"),
            ["il"] = Pick(row, "il", "city"),
            ["ulke"] = Pick(row, "ulke", "country"),
        };

        if (string.Equals(table, "CustomerCard", StringComparison.OrdinalIgnoreCase))
        {
            cari["kod"] ??= Pick(row, "code");
            cari["unvan"] ??= Pick(row, "title");
        }

        var payload = new Dictionary<string, object?>
        {
            ["belge"] = belge,
            ["cari"] = cari,
            ["adres"] = adres,
            ["kaynak"] = new Dictionary<string, object?> { ["tablo"] = table, ["id"] = id },
            ["satir"] = row ?? new Dictionary<string, object?>(),
            ["alanlar"] = ScalarBag(row),
        };
        if (tableRows is { Count: > 0 })
        {
            payload["tablolar"] = new Dictionary<string, object?>
            {
                [string.IsNullOrWhiteSpace(tableName) ? "Satirlar" : tableName] =
                    tableRows.Select(ScalarBag).ToList()
            };
        }
        return JsonSerializer.Serialize(payload);
    }

    public static bool TryReadSql(string? json, out string sql)
    {
        sql = "";
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("sql", out var el)) return false;
            sql = el.GetString()?.Trim() ?? "";
            return sql.Length > 0;
        }
        catch
        {
            return false;
        }
    }

    public static bool IsSafeSelect(string sql)
    {
        var t = sql.Trim();
        if (!t.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase)) return false;
        if (t.Contains(';')) return false;
        return !Regex.IsMatch(t, @"\b(INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|EXECUTE|MERGE|TRUNCATE|INTO)\b", RegexOptions.IgnoreCase);
    }

    public static (string Table, int Id) SourceOf(IDictionary<string, object?> row, string json)
    {
        foreach (var pair in new (string Col, string Table)[]
        {
            ("EGovDocumentID", "EGovDocument"),
            ("InvoiceID", "Invoice"),
            ("OrderVoucherID", "OrderVoucher"),
            ("ProductVoucherID", "ProductVoucher"),
            ("CustomerCardID", "CustomerCard"),
            ("ProductCardID", "ProductCard"),
        })
        {
            var n = AsInt(Pick(row, pair.Col));
            if (n is > 0) return (pair.Table, n.Value);
        }
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        var id = BitConverter.ToInt32(hash, 0) & 0x7fffffff;
        return ("Scan", id == 0 ? 1 : id);
    }

    public static string? TitleOf(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var belge = doc.RootElement.TryGetProperty("belge", out var b) ? b : default;
            var cari = doc.RootElement.TryGetProperty("cari", out var c) ? c : default;
            var no = belge.ValueKind == JsonValueKind.Object && belge.TryGetProperty("no", out var n) ? n.ToString() : "";
            var unvan = cari.ValueKind == JsonValueKind.Object && cari.TryGetProperty("unvan", out var u) ? u.ToString() : "";
            var text = string.Join(" · ", new[] { no, unvan }.Where(s => !string.IsNullOrWhiteSpace(s) && s != "null"));
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }
        catch
        {
            return null;
        }
    }

    private static async Task<Dictionary<string, object?>?> LoadRowAsync(IDbConnection db, string? table, int id, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(table) || id <= 0 || !SafeName.IsMatch(table)) return null;
        var pk = await db.ExecuteScalarAsync<string?>(new CommandDefinition("""
            SELECT c.name
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
            INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            INNER JOIN sys.tables t ON t.object_id = i.object_id
            WHERE i.is_primary_key = 1 AND t.name = @table AND SCHEMA_NAME(t.schema_id) = N'dbo'
            """, new { table }, cancellationToken: ct));
        if (string.IsNullOrWhiteSpace(pk) || !SafeName.IsMatch(pk)) return null;
        var raw = await db.QueryFirstOrDefaultAsync(new CommandDefinition(
            $"SELECT * FROM dbo.{table} WHERE {pk} = @id", new { id }, cancellationToken: ct));
        return raw is null ? null : ToDict(raw);
    }

    private static async Task FillEgovAddressAsync(IDbConnection db, int id, IDictionary<string, object?> row, CancellationToken ct)
    {
        if (Pick(row, "adres", "street", "city") != null) return;
        var xml = await db.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT XmlContent FROM dbo.EGovDocument WHERE EGovDocumentID = @id",
            new { id }, cancellationToken: ct));
        if (string.IsNullOrWhiteSpace(xml)) return;
        try
        {
            var doc = XDocument.Parse(xml);
            var addr = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "PostalAddress");
            if (addr is null) return;
            row["adres"] = Text(addr, "StreetName");
            row["ilce"] = Text(addr, "CitySubdivisionName");
            row["il"] = Text(addr, "CityName");
            row["ulke"] = addr.Elements().FirstOrDefault(e => e.Name.LocalName == "Country") is { } country
                ? Text(country, "Name")
                : null;
        }
        catch
        {
            /* xml bozuksa adres boş kalır */
        }
    }

    private static async Task FillCustomerAsync(IDbConnection db, IDictionary<string, object?> row, CancellationToken ct)
    {
        var cid = AsInt(Pick(row, "CustomerCardID", "CustomerID"));
        if (cid is not > 0) return;
        if (Pick(row, "customerTitle", "cariUnvan") == null)
        {
            var card = await db.QueryFirstOrDefaultAsync(new CommandDefinition(
                "SELECT * FROM dbo.CustomerCard WHERE CustomerCardID = @id",
                new { id = cid }, cancellationToken: ct));
            if (card != null)
            {
                var c = ToDict(card);
                row["cariKod"] = Pick(c, "Code");
                row["cariUnvan"] = Pick(c, "Title");
                row["vergiNo"] = Pick(c, "TaxNr");
            }
        }
        if (Pick(row, "adres", "street", "city") != null) return;
        if (await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.CustomerAdress', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) != 1) return;
        var addr = await db.QueryFirstOrDefaultAsync(new CommandDefinition("""
            SELECT TOP 1 * FROM dbo.CustomerAdress WHERE CustomerCardID = @id
            """, new { id = cid }, cancellationToken: ct));
        if (addr == null) return;
        var a = ToDict(addr);
        row["adres"] = Pick(a, "Adress", "Address", "Street");
        row["ilce"] = Pick(a, "Town", "District");
        row["il"] = Pick(a, "City");
        row["ulke"] = Pick(a, "Country");
    }

    private static Dictionary<string, object?> ScalarBag(IDictionary<string, object?>? row)
    {
        var map = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (row == null) return map;
        foreach (var kv in row)
        {
            if (kv.Value is string) { map[kv.Key] = kv.Value; continue; }
            if (kv.Value is System.Collections.IEnumerable) continue;
            map[kv.Key] = kv.Value;
        }
        return map;
    }

    private static Dictionary<string, object?> ToDict(object raw)
    {
        var map = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (raw is not IDictionary<string, object> src) return map;
        foreach (var kv in src)
        {
            if (SkipCols.Contains(kv.Key)) continue;
            if (kv.Value is byte[] or null) continue;
            var v = kv.Value is DBNull ? null : kv.Value;
            if (v is string s && s.Length > 4000) continue;
            map[kv.Key] = v;
        }
        return map;
    }

    private static object? Pick(IDictionary<string, object?>? row, params string[] keys)
    {
        if (row == null) return null;
        foreach (var key in keys)
        {
            if (!row.TryGetValue(key, out var v) || v is null) continue;
            var s = Convert.ToString(v, CultureInfo.InvariantCulture);
            if (!string.IsNullOrWhiteSpace(s)) return v;
        }
        return null;
    }

    private static string? DateText(object? v)
    {
        if (v is null) return null;
        if (v is DateTime dt) return dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var s = Convert.ToString(v, CultureInfo.InvariantCulture);
        return string.IsNullOrWhiteSpace(s) ? null : s;
    }

    private static object? Num(object? v)
    {
        if (v is null) return null;
        if (v is decimal or double or float or int or long) return v;
        if (decimal.TryParse(Convert.ToString(v, CultureInfo.InvariantCulture), NumberStyles.Any, CultureInfo.InvariantCulture, out var n))
            return n;
        return v;
    }

    private static int? AsInt(object? v)
    {
        if (v is null) return null;
        if (v is int i) return i;
        if (int.TryParse(Convert.ToString(v, CultureInfo.InvariantCulture), out var n)) return n;
        return null;
    }

    private static string? Text(XElement parent, string local)
    {
        var v = parent.Elements().FirstOrDefault(e => e.Name.LocalName == local)?.Value?.Trim();
        return string.IsNullOrWhiteSpace(v) ? null : v;
    }
}
