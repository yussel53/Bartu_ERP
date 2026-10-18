using System.Data;
using System.Globalization;
using System.Text.Json;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class AuditChange
{
    public string f { get; set; } = "";
    public string? o { get; set; }
    public string? n { get; set; }
}

public sealed class AuditEntry
{
    public long Id { get; set; }
    public string Action { get; set; } = "";
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime At { get; set; }
    public List<AuditChange> Changes { get; set; } = new();
}

/// <summary>
/// Y-15: değişiklik geçmişi (SYS_AuditLog, SqlUpdates/91). RecordsController kayıttan önce / sonra kaydın standart alanlarını
/// karşılaştırır; yalnız değişen alanlar yazılır. Satırlar sayı + tutar özeti olarak izlenir. Gizli alanlar (şifre vb.) yazılmaz.
/// Günlük hatası kaydı engellemez.
/// </summary>
public sealed class AuditService
{
    private static readonly HashSet<string> Skip = new(StringComparer.OrdinalIgnoreCase)
    {
        "id", "Id", "status", "UpdatedAt", "CreatedAt", "ModifiedAt", "Password", "PasswordSet", "PasswordHash",
        "SmtpPassword", "ApiPassword", "Token", "Secret",
    };

    private readonly IDbConnection _db;

    public AuditService(IDbConnection db)
    {
        _db = db;
    }

    private async Task<bool> ReadyAsync() =>
        await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID('dbo.SYS_AuditLog') IS NULL THEN 0 ELSE 1 END") == 1;

    private static string? Str(object? v)
    {
        if (v is JsonElement je)
            v = je.ValueKind switch
            {
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                JsonValueKind.String => je.GetString(),
                _ => je.ToString(),
            };
        return v switch
        {
            null => null,
            DateTime d => d.TimeOfDay == TimeSpan.Zero ? d.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture) : d.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
            bool b => b ? "Evet" : "Hayır",
            IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
            _ => Convert.ToString(v, CultureInfo.InvariantCulture),
        };
    }

    /// <summary>Karşılaştırma için normal biçim: boş = null, sayılar ve tarihler tek biçimde.</summary>
    private static string? Norm(object? v)
    {
        var s = Str(v)?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d)) return d.ToString("0.########", CultureInfo.InvariantCulture);
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt)) return dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        if (s.Equals("true", StringComparison.OrdinalIgnoreCase) || s == "Evet") return "1";
        if (s.Equals("false", StringComparison.OrdinalIgnoreCase) || s == "Hayır") return "0";
        return s;
    }

    private static string LinesSummary(List<Dictionary<string, object?>>? lines)
    {
        if (lines == null || lines.Count == 0) return "0 satır";
        decimal total = 0;
        foreach (var l in lines)
        {
            var v = l.FirstOrDefault(kv => kv.Key.Equals("TotalPrice", StringComparison.OrdinalIgnoreCase) || kv.Key.Equals("Amount", StringComparison.OrdinalIgnoreCase)).Value;
            if (decimal.TryParse(Str(v), NumberStyles.Any, CultureInfo.InvariantCulture, out var d)) total += d;
        }
        return $"{lines.Count} satır · {total.ToString("N2", CultureInfo.GetCultureInfo("tr-TR"))}";
    }

    public static List<AuditChange> Diff(RecordGetResult? before, RecordGetResult? after)
    {
        var list = new List<AuditChange>();
        var b = before?.StandardFields ?? new();
        var a = after?.StandardFields ?? new();
        foreach (var key in b.Keys.Union(a.Keys, StringComparer.OrdinalIgnoreCase).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (Skip.Contains(key) || key.Contains("Password", StringComparison.OrdinalIgnoreCase)) continue;
            if (key.Length > 0 && char.IsLower(key[0]) && (a.ContainsKey(char.ToUpperInvariant(key[0]) + key[1..]) || b.ContainsKey(char.ToUpperInvariant(key[0]) + key[1..]))) continue; // camelCase kopyalar
            var ov = b.FirstOrDefault(kv => kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase)).Value;
            var nv = a.FirstOrDefault(kv => kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase)).Value;
            if (Norm(ov) == Norm(nv)) continue;
            list.Add(new AuditChange { f = key, o = Trim(Str(ov)), n = Trim(Str(nv)) });
        }
        var bl = LinesSummary(before?.Lines);
        var al = LinesSummary(after?.Lines);
        if ((before?.Lines != null || after?.Lines != null) && bl != al) list.Add(new AuditChange { f = "#Satır", o = bl, n = al });
        return list;
    }

    private static string? Trim(string? s) => s is { Length: > 300 } ? s[..300] + "…" : s;

    public async Task LogAsync(string table, int recordId, char action, RecordGetResult? before, RecordGetResult? after, int? userId, string? userName)
    {
        try
        {
            if (_db.State != ConnectionState.Open) _db.Open();
            if (!await ReadyAsync()) return;
            var changes = action == 'D' ? Diff(before, null) : Diff(before, after);
            if (action == 'U' && changes.Count == 0) return;
            await _db.ExecuteAsync(
                "INSERT INTO dbo.SYS_AuditLog (TableName, RecordId, Action, UserId, UserName, ChangesJson) VALUES (@table, @recordId, @action, @userId, @userName, @json)",
                new { table, recordId, action = action.ToString(), userId, userName, json = JsonSerializer.Serialize(changes) });
        }
        catch
        {
            /* günlük hatası kaydı etkilemez */
        }
    }

    public async Task<List<AuditEntry>> HistoryAsync(string table, int recordId)
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        if (!await ReadyAsync()) return new();
        var rows = await _db.QueryAsync<(long Id, string Action, int? UserId, string? UserName, DateTime At, string? ChangesJson)>(
            "SELECT TOP 200 Id, Action, UserId, UserName, At, ChangesJson FROM dbo.SYS_AuditLog WHERE TableName = @table AND RecordId = @recordId ORDER BY At DESC, Id DESC",
            new { table, recordId });
        // Silinen kaydın numarası yeni kayda verilmiş olabilir (MAX+1 numaralı tablolar): geçmiş bir önceki silmede kesilir
        var own = new List<(long Id, string Action, int? UserId, string? UserName, DateTime At, string? ChangesJson)>();
        foreach (var r in rows)
        {
            if (r.Action == "D" && own.Count > 0) break;
            own.Add(r);
        }
        return own.Select(r => new AuditEntry
        {
            Id = r.Id,
            Action = r.Action,
            UserId = r.UserId,
            UserName = r.UserName,
            At = r.At,
            Changes = string.IsNullOrEmpty(r.ChangesJson) ? new() : JsonSerializer.Deserialize<List<AuditChange>>(r.ChangesJson) ?? new(),
        }).ToList();
    }
}
