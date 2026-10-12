using System.Data;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

public sealed class PostSaveActionDto
{
    public string Type { get; set; } = "sql"; // sql | api
    public string Command { get; set; } = "";
    public string? Title { get; set; }
}

public sealed class PostSaveRunResult
{
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public bool Success { get; set; }
    public string Message { get; set; } = "";
}

public sealed class PostSaveRepository
{
    private static readonly Regex Placeholder = new(@"\{([A-Za-z_][A-Za-z0-9_]*)\}", RegexOptions.Compiled);
    private static readonly Regex DangerousSql = new(
        @"\b(DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE\s+LOGIN|xp_|sp_executesql)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IDbConnection _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    public PostSaveRepository(IDbConnection db, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db = db;
        _httpFactory = httpFactory;
        _config = config;
    }

    public async Task<List<PostSaveActionDto>> LoadFromDbAsync(string formCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(formCode)) return new();
        if (_db.State != ConnectionState.Open) _db.Open();

        var exists = await _db.ExecuteScalarAsync<int>(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_FormPostSave', N'U') IS NULL THEN 0 ELSE 1 END");
        if (exists == 0) return new();

        var rows = await _db.QueryAsync<(string ActionType, string CommandText, string? Title)>(
            new CommandDefinition(
                @"SELECT ActionType, CommandText, Title
                  FROM dbo.SYS_FormPostSave
                  WHERE FormCode = @FormCode AND IsActive = 1
                  ORDER BY ActionOrder, FormPostSaveID",
                new { FormCode = formCode },
                cancellationToken: ct));

        return rows.Select(r => new PostSaveActionDto
        {
            Type = string.IsNullOrWhiteSpace(r.ActionType) ? "sql" : r.ActionType.Trim().ToLowerInvariant(),
            Command = r.CommandText ?? "",
            Title = r.Title,
        }).ToList();
    }

    public async Task<List<PostSaveRunResult>> RunAsync(
        IEnumerable<PostSaveActionDto> actions,
        int recordId,
        Dictionary<string, object?> fields,
        CancellationToken ct = default)
    {
        var results = new List<PostSaveRunResult>();
        var tokens = BuildTokens(recordId, fields);

        foreach (var action in actions)
        {
            if (string.IsNullOrWhiteSpace(action.Command)) continue;
            var type = string.IsNullOrWhiteSpace(action.Type) ? "sql" : action.Type.Trim().ToLowerInvariant();
            var title = string.IsNullOrWhiteSpace(action.Title) ? type : action.Title!;

            try
            {
                if (type == "api")
                {
                    var msg = await RunApiAsync(action.Command, tokens, ct);
                    results.Add(new PostSaveRunResult { Type = type, Title = title, Success = true, Message = msg });
                }
                else
                {
                    var msg = await RunSqlAsync(action.Command, tokens, ct);
                    results.Add(new PostSaveRunResult { Type = type, Title = title, Success = true, Message = msg });
                }
            }
            catch (Exception ex)
            {
                results.Add(new PostSaveRunResult
                {
                    Type = type,
                    Title = title,
                    Success = false,
                    Message = ex.Message,
                });
                // İlk hatada dur
                break;
            }
        }

        return results;
    }

    private static Dictionary<string, string> BuildTokens(int recordId, Dictionary<string, object?> fields)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["recId"] = recordId.ToString(),
            ["RecId"] = recordId.ToString(),
            ["recordId"] = recordId.ToString(),
            ["RecordId"] = recordId.ToString(),
            ["id"] = recordId.ToString(),
            ["ID"] = recordId.ToString(),
        };

        foreach (var kv in fields)
        {
            if (string.IsNullOrWhiteSpace(kv.Key)) continue;
            map[kv.Key] = FormatToken(kv.Value);
        }

        // Yaygın ID / Kod / Fiş eşlemeleri (form alanı farklı adla gelse bile {Code}, {VoucherNo} çalışsın)
        AddAlias(map, "Code",
            "Code", "CompanyCode", "WhouseCode", "AccountCode", "ProductCode", "CustomerCode",
            "BankCode", "SafeCode", "TaxCode", "CurrencyCode");
        AddAlias(map, "Title",
            "Title", "Name", "ProductName", "CustomerName", "AccountName");
        AddAlias(map, "DocumentNumber",
            "DocumentNumber", "VoucherNo", "InvoiceNo", "FicheNo", "SerialNo", "DocNo", "Number");
        AddAlias(map, "VoucherNo",
            "VoucherNo", "DocumentNumber", "InvoiceNo", "FicheNo", "DocNo", "Number");
        AddAlias(map, "InvoiceNo",
            "InvoiceNo", "DocumentNumber", "VoucherNo", "FicheNo");
        AddAlias(map, "FicheNo",
            "FicheNo", "DocumentNumber", "VoucherNo", "InvoiceNo");
        AddAlias(map, "VoucherDate",
            "VoucherDate", "InvoiceDate", "DocumentDate", "Date_", "TransDate", "OrderDate");
        AddAlias(map, "DocumentDate",
            "DocumentDate", "VoucherDate", "InvoiceDate", "Date_", "TransDate");
        AddAlias(map, "CustomerID", "CustomerID", "CustomerCardID", "CariID");
        AddAlias(map, "ProductID", "ProductID", "ProductCardID", "ItemsID");
        AddAlias(map, "WhouseID", "WhouseID", "WarehouseID", "DepoID");
        AddAlias(map, "CompanyID", "CompanyID", "CompanyId");
        AddAlias(map, "WorkplaceID", "WorkplaceID", "WorkplaceId");
        AddAlias(map, "Status", "Status_", "Status", "InvoiceStatus");

        // PK adı formdan gelmişse (InvoiceID, ProductVoucherID…) → {pk} / {primaryKey}
        foreach (var kv in map.ToList())
        {
            if (kv.Key.EndsWith("ID", StringComparison.OrdinalIgnoreCase)
                && string.Equals(kv.Value, recordId.ToString(), StringComparison.Ordinal))
            {
                map["pk"] = kv.Value;
                map["primaryKey"] = kv.Value;
                map["PrimaryKey"] = kv.Value;
                break;
            }
        }

        return map;
    }

    private static void AddAlias(Dictionary<string, string> map, string alias, params string[] sources)
    {
        if (map.TryGetValue(alias, out var existing) && !string.IsNullOrWhiteSpace(existing))
            return;
        foreach (var src in sources)
        {
            if (map.TryGetValue(src, out var val) && !string.IsNullOrWhiteSpace(val))
            {
                map[alias] = val;
                return;
            }
        }
    }

    private static string FormatToken(object? v)
    {
        if (v is null or DBNull) return "";
        if (v is bool b) return b ? "1" : "0";
        if (v is DateTime dt) return dt.ToString("yyyy-MM-dd HH:mm:ss");
        if (v is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => je.GetString() ?? "",
                JsonValueKind.Number => je.ToString(),
                JsonValueKind.True => "1",
                JsonValueKind.False => "0",
                JsonValueKind.Null => "",
                _ => je.ToString(),
            };
        }
        return Convert.ToString(v) ?? "";
    }

    private async Task<string> RunSqlAsync(string template, Dictionary<string, string> tokens, CancellationToken ct)
    {
        var sql = template.Trim();
        if (DangerousSql.IsMatch(sql))
            throw new InvalidOperationException("SQL komutu güvenlik nedeniyle reddedildi");

        // Sadece UPDATE / INSERT / EXEC ile başlasın
        var head = sql.Length > 12 ? sql[..12] : sql;
        if (!Regex.IsMatch(head, @"^\s*(UPDATE|INSERT|EXEC|EXECUTE)\b", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Post-save SQL yalnızca UPDATE / INSERT / EXEC olabilir");

        if (_db.State != ConnectionState.Open) _db.Open();

        var parameters = new DynamicParameters();
        var i = 0;
        var sqlWithParams = Placeholder.Replace(sql, m =>
        {
            var key = m.Groups[1].Value;
            var pname = $"p{i++}";
            tokens.TryGetValue(key, out var val);
            // sayısal mı?
            if (int.TryParse(val, out var n))
                parameters.Add(pname, n);
            else if (decimal.TryParse(val, System.Globalization.NumberStyles.Any,
                         System.Globalization.CultureInfo.InvariantCulture, out var d))
                parameters.Add(pname, d);
            else
                parameters.Add(pname, val ?? "");
            return "@" + pname;
        });

        var affected = await _db.ExecuteAsync(new CommandDefinition(sqlWithParams, parameters, cancellationToken: ct, commandTimeout: 60));
        return $"SQL OK (rows={affected})";
    }

    private async Task<string> RunApiAsync(string template, Dictionary<string, string> tokens, CancellationToken ct)
    {
        // "POST https://..." veya "GET /api/..." veya düz URL (POST)
        var raw = Placeholder.Replace(template.Trim(), m =>
        {
            tokens.TryGetValue(m.Groups[1].Value, out var val);
            return Uri.EscapeDataString(val ?? "");
        });

        var method = HttpMethod.Post;
        var url = raw;
        var mth = Regex.Match(raw, @"^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$", RegexOptions.IgnoreCase);
        if (mth.Success)
        {
            method = new HttpMethod(mth.Groups[1].Value.ToUpperInvariant());
            url = mth.Groups[2].Value.Trim();
        }

        if (url.StartsWith('/'))
        {
            var baseUrl = _config["PostSave:ApiBaseUrl"]
                          ?? _config["Urls"]
                          ?? "http://localhost:5205";
            // Kestrel self-call: absolute olmayan yolu tamamla
            url = baseUrl.TrimEnd('/') + url;
        }

        var client = _httpFactory.CreateClient("PostSave");
        using var req = new HttpRequestMessage(method, url);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        // Body: token JSON (POST/PUT)
        if (method == HttpMethod.Post || method == HttpMethod.Put || method.Method == "PATCH")
        {
            var body = JsonSerializer.Serialize(tokens);
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        using var res = await client.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"API {(int)res.StatusCode}: {text}");
        return $"API OK ({(int)res.StatusCode})";
    }
}
