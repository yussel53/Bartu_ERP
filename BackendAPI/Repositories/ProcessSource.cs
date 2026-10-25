using System.Data.Common;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using MySqlConnector;

namespace BartuERP.Backend.Repositories;

/// <summary>
/// Süreçteki Veri Çek işi: bu veritabanı, SQL Server, MySQL veya REST.
/// Kolon başlıkları aktarım işinin kullandığı aynı listeye yazılır.
/// </summary>
public sealed class ProcessSourceRequest
{
    public int SourceType { get; set; }
    public string? Sql { get; set; }
    public string? Server { get; set; }
    public string? Port { get; set; }
    public string? Database { get; set; }
    public string? User { get; set; }
    public string? Password { get; set; }
    public bool WindowsAuth { get; set; }
    public bool TrustCertificate { get; set; } = true;
    public string? ApiUrl { get; set; }
    public string? ApiMethod { get; set; }
    public string? ApiHeaders { get; set; }
    public string? JsonPath { get; set; }
    public string? Body { get; set; }
}

public sealed class ProcessSourceTest
{
    public bool Ok { get; set; }
    public string Message { get; set; } = "";
    public List<string> Databases { get; set; } = new();
}

internal static class ProcessSource
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(25) };

    public static async Task<ProcessSourceTest> TestAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        if (req.SourceType == 0)
            return new ProcessSourceTest { Ok = true, Message = "Bu veritabanı kullanılacak." };
        if (req.SourceType == 3)
            return await TestRestAsync(req, ct);

        var result = new ProcessSourceTest();
        try
        {
            await using var conn = OpenExternal(req, withDatabase: false);
            await conn.OpenAsync(ct);
            result.Ok = true;
            result.Message = req.SourceType == 2 ? "MySQL bağlantısı kuruldu." : "SQL Server bağlantısı kuruldu.";
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = req.SourceType == 2
                ? "SHOW DATABASES"
                : "SELECT name FROM sys.databases WHERE HAS_DBACCESS(name) = 1 ORDER BY name";
            cmd.CommandTimeout = 15;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Databases.Add(reader.GetString(0));
        }
        catch (Exception ex)
        {
            result.Ok = false;
            result.Message = "Bağlanılamadı: " + (ex.InnerException?.Message ?? ex.Message);
        }
        return result;
    }

    public static async Task<List<Dictionary<string, object?>>> RowsAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        if (req.SourceType == 3)
        {
            var rows = new List<Dictionary<string, object?>>();
            foreach (var row in await RestRowsAsync(req, ct))
                rows.Add(row.ToDictionary(kv => kv.Key, kv => (object?)kv.Value, StringComparer.OrdinalIgnoreCase));
            return rows;
        }
        var sql = req.Sql?.Trim() ?? "";
        if (!ProcessContextData.IsSafeSelect(sql))
            throw new InvalidOperationException("Yalnızca tek bir SELECT yazılabilir.");
        await using var conn = OpenExternal(req, withDatabase: true);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandTimeout = 60;
        cmd.CommandText = req.SourceType == 2
            ? $"SELECT * FROM ({sql}) AS scan_q LIMIT 200"
            : $"SELECT TOP (200) * FROM ({sql}) AS scan_q";
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var names = NamesOf(reader);
        var list = new List<Dictionary<string, object?>>();
        while (list.Count < 200 && await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < names.Count && i < reader.FieldCount; i++)
                row[names[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            list.Add(row);
        }
        return list;
    }

    public static async Task<IReadOnlyList<string>> ColumnsAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        if (req.SourceType == 3) return await RestColumnsAsync(req, ct);
        if (req.SourceType is not (1 or 2))
            throw new InvalidOperationException("Kaynak tipi seçilmedi.");
        var sql = req.Sql?.Trim() ?? "";
        if (!ProcessContextData.IsSafeSelect(sql))
            throw new InvalidOperationException("Yalnızca tek bir SELECT yazılabilir.");

        await using var conn = OpenExternal(req, withDatabase: true);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandTimeout = 30;
        cmd.CommandText = req.SourceType == 2
            ? $"SELECT * FROM ({sql}) AS scan_q LIMIT 0"
            : $"SELECT TOP (0) * FROM ({sql}) AS scan_q";
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return NamesOf(reader);
    }

    private static DbConnection OpenExternal(ProcessSourceRequest req, bool withDatabase)
    {
        if (string.IsNullOrWhiteSpace(req.Server))
            throw new InvalidOperationException("Sunucu yazın.");
        if (req.SourceType == 2)
        {
            var b = new MySqlConnectionStringBuilder
            {
                Server = req.Server.Trim(),
                Port = uint.TryParse(req.Port, out var p) ? p : 3306u,
                UserID = req.User ?? "",
                Password = req.Password ?? "",
            };
            if (withDatabase && !string.IsNullOrWhiteSpace(req.Database))
                b.Database = req.Database.Trim();
            return new MySqlConnection(b.ConnectionString);
        }

        var sb = new SqlConnectionStringBuilder
        {
            DataSource = string.IsNullOrWhiteSpace(req.Port) ? req.Server.Trim() : $"{req.Server.Trim()},{req.Port.Trim()}",
            TrustServerCertificate = req.TrustCertificate,
            ConnectTimeout = 15,
        };
        if (withDatabase && !string.IsNullOrWhiteSpace(req.Database))
            sb.InitialCatalog = req.Database.Trim();
        if (req.WindowsAuth)
            sb.IntegratedSecurity = true;
        else
        {
            sb.UserID = req.User ?? "";
            sb.Password = req.Password ?? "";
        }
        return new SqlConnection(sb.ConnectionString);
    }

    private static List<string> NamesOf(DbDataReader reader)
    {
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
        {
            var name = reader.GetName(i);
            if (string.IsNullOrWhiteSpace(name) || !seen.Add(name)) continue;
            names.Add(name);
        }
        return names;
    }

    private static async Task<ProcessSourceTest> TestRestAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        try
        {
            using var resp = await SendRestAsync(req, ct);
            var ok = resp.IsSuccessStatusCode;
            return new ProcessSourceTest
            {
                Ok = ok,
                Message = ok ? $"API yanıtı {(int)resp.StatusCode}." : $"API hata döndü: {(int)resp.StatusCode}."
            };
        }
        catch (Exception ex)
        {
            return new ProcessSourceTest { Ok = false, Message = ex.InnerException?.Message ?? ex.Message };
        }
    }

    private static async Task<IReadOnlyList<string>> RestColumnsAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        var rows = await RestRowsAsync(req, ct);
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            foreach (var key in row.Keys)
                if (seen.Add(key)) names.Add(key);
        }
        if (names.Count == 0) throw new InvalidOperationException("JSON içinde alan bulunamadı.");
        return names;
    }

    private static async Task<List<Dictionary<string, string?>>> RestRowsAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        using var resp = await SendRestAsync(req, ct);
        var body = await ReadLimitedAsync(resp, ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"API hata döndü: {(int)resp.StatusCode}. {(body.Length > 240 ? body[..240] : body)}");
        using var doc = JsonDocument.Parse(body);
        var node = Walk(doc.RootElement, req.JsonPath);
        var rows = new List<Dictionary<string, string?>>();
        var items = node.ValueKind == JsonValueKind.Array ? node.EnumerateArray().Take(200) : new[] { node };
        foreach (var item in items)
        {
            var row = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            Flatten(item, "", row);
            rows.Add(row);
        }
        return rows;
    }

    private static async Task<HttpResponseMessage> SendRestAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.ApiUrl))
            throw new InvalidOperationException("API adresi boş.");
        if (!Uri.TryCreate(req.ApiUrl.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            throw new InvalidOperationException("Adres http veya https olmalı.");
        var method = string.Equals(req.ApiMethod, "POST", StringComparison.OrdinalIgnoreCase) ? HttpMethod.Post : HttpMethod.Get;
        using var msg = new HttpRequestMessage(method, uri);
        foreach (var line in (req.ApiHeaders ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries).Take(20))
        {
            var idx = line.IndexOf(':');
            if (idx <= 0) continue;
            var key = line[..idx].Trim();
            var val = line[(idx + 1)..].Trim();
            if (key.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)) continue;
            msg.Headers.TryAddWithoutValidation(key, val);
        }
        if (method == HttpMethod.Post)
            msg.Content = new StringContent(req.Body ?? req.Sql ?? "", Encoding.UTF8, "application/json");
        return await Http.SendAsync(msg, ct);
    }

    private static async Task<string> ReadLimitedAsync(HttpResponseMessage resp, CancellationToken ct)
    {
        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var mem = new MemoryStream();
        var buf = new byte[8192];
        int n;
        while ((n = await stream.ReadAsync(buf, ct)) > 0)
        {
            if (mem.Length + n > 1_000_000)
                throw new InvalidOperationException("API yanıtı çok büyük.");
            mem.Write(buf, 0, n);
        }
        return Encoding.UTF8.GetString(mem.ToArray());
    }

    private static JsonElement Walk(JsonElement node, string? path)
    {
        foreach (var part in (path ?? "").Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (node.ValueKind == JsonValueKind.Object)
            {
                JsonElement? found = null;
                foreach (var p in node.EnumerateObject())
                {
                    if (!p.Name.Equals(part, StringComparison.OrdinalIgnoreCase)) continue;
                    found = p.Value;
                    break;
                }
                if (found is null) throw new InvalidOperationException($"JSON yolunda '{part}' bulunamadı.");
                node = found.Value;
            }
            else if (node.ValueKind == JsonValueKind.Array && int.TryParse(part, out var ix) && ix >= 0 && ix < node.GetArrayLength())
                node = node[ix];
            else
                throw new InvalidOperationException($"JSON yolunda '{part}' bulunamadı.");
        }
        return node;
    }

    private static void Flatten(JsonElement el, string prefix, Dictionary<string, string?> row)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var p in el.EnumerateObject())
                    Flatten(p.Value, string.IsNullOrEmpty(prefix) ? p.Name : prefix + "." + p.Name, row);
                break;
            case JsonValueKind.Array:
                break;
            default:
                row[string.IsNullOrEmpty(prefix) ? "deger" : prefix] = el.ValueKind switch
                {
                    JsonValueKind.String => el.GetString(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    JsonValueKind.Null => null,
                    _ => el.GetRawText(),
                };
                break;
        }
    }
}
