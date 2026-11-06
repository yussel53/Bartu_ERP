using System.Data;
using System.Globalization;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class SaveRuleDto
{
    public int SaveRuleID { get; set; }
    public string Name { get; set; } = "";
    public string Scope { get; set; } = "data";
    public string TableName { get; set; } = "";
    public string? WhenField { get; set; }
    public string WhenOp { get; set; } = "eq";
    public string? WhenValue { get; set; }
    public string MustField { get; set; } = "";
    public string MustOp { get; set; } = "notempty";
    public string? MustValue { get; set; }
    public bool OnLine { get; set; }
    public string? Message { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Kayıt kuralları — koşul tutunca alan zorunluluğu. Tutmazsa Kaydet engellenir.</summary>
public sealed class SaveRuleService
{
    private readonly IDbConnection _db;

    public SaveRuleService(IDbConnection db) => _db = db;

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private bool TableExists()
    {
        try
        {
            return _db.ExecuteScalar<int>("SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_SaveRule', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IReadOnlyList<SaveRuleDto>> ListAsync(CancellationToken ct = default)
    {
        Open();
        if (!TableExists()) return [];
        var rows = await _db.QueryAsync<SaveRuleDto>(new CommandDefinition(
            @"SELECT SaveRuleID, Name, Scope, TableName, WhenField, WhenOp, WhenValue,
  MustField, MustOp, MustValue, OnLine, Message, IsActive
FROM dbo.SYS_SaveRule ORDER BY TableName, Name", cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<int> SaveAsync(SaveRuleDto dto, CancellationToken ct = default)
    {
        Open();
        if (!TableExists()) throw new InvalidOperationException("SYS_SaveRule yok — Veritabanı Güncelleme uygulayın.");
        var name = (dto.Name ?? "").Trim();
        var table = (dto.TableName ?? "").Trim();
        var must = (dto.MustField ?? "").Trim();
        if (name.Length == 0 || table.Length == 0 || must.Length == 0)
            throw new InvalidOperationException("Ad, tablo ve zorunlu alan gerekli.");
        var scope = dto.Scope?.Equals("einvoice", StringComparison.OrdinalIgnoreCase) == true ? "einvoice" : "data";
        var p = new
        {
            dto.SaveRuleID,
            Name = name,
            Scope = scope,
            TableName = table,
            WhenField = NullIfEmpty(dto.WhenField),
            WhenOp = Op(dto.WhenOp),
            WhenValue = NullIfEmpty(dto.WhenValue),
            MustField = must,
            MustOp = Op(dto.MustOp),
            MustValue = NullIfEmpty(dto.MustValue),
            dto.OnLine,
            Message = NullIfEmpty(dto.Message),
            dto.IsActive,
        };
        if (dto.SaveRuleID > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.SYS_SaveRule SET Name=@Name, Scope=@Scope, TableName=@TableName,
  WhenField=@WhenField, WhenOp=@WhenOp, WhenValue=@WhenValue,
  MustField=@MustField, MustOp=@MustOp, MustValue=@MustValue,
  OnLine=@OnLine, Message=@Message, IsActive=@IsActive, UpdatedAt=SYSDATETIME()
WHERE SaveRuleID=@SaveRuleID", p, cancellationToken: ct));
            return dto.SaveRuleID;
        }
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.SYS_SaveRule
  (Name, Scope, TableName, WhenField, WhenOp, WhenValue, MustField, MustOp, MustValue, OnLine, Message, IsActive)
OUTPUT INSERTED.SaveRuleID
VALUES (@Name, @Scope, @TableName, @WhenField, @WhenOp, @WhenValue, @MustField, @MustOp, @MustValue, @OnLine, @Message, @IsActive)",
            p, cancellationToken: ct));
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        Open();
        if (!TableExists()) return;
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SaveRule WHERE SaveRuleID=@id", new { id }, cancellationToken: ct));
    }

    /// <summary>Tutmayan kural varsa hata metni; yoksa null. Şablon kayıt (ID&lt;0) çağıran tarafta atlanır.</summary>
    public async Task<string?> CheckAsync(
        string tableName,
        IDictionary<string, object?> header,
        IList<Dictionary<string, object?>>? lines,
        CancellationToken ct = default)
    {
        Open();
        if (!TableExists()) return null;
        var rules = (await _db.QueryAsync<SaveRuleDto>(new CommandDefinition(
            @"SELECT SaveRuleID, Name, Scope, TableName, WhenField, WhenOp, WhenValue,
  MustField, MustOp, MustValue, OnLine, Message, IsActive
FROM dbo.SYS_SaveRule
WHERE IsActive = 1 AND TableName = @table",
            new { table = tableName }, cancellationToken: ct))).ToList();
        if (rules.Count == 0) return null;

        var einvoice = await IsOutgoingEInvoiceAsync(tableName, header, ct);
        var errors = new List<string>();
        foreach (var rule in rules)
        {
            if (rule.Scope.Equals("einvoice", StringComparison.OrdinalIgnoreCase))
            {
                if (!einvoice) continue;
            }
            if (rule.OnLine)
            {
                var i = 0;
                foreach (var line in lines ?? [])
                {
                    i++;
                    if (!WhenHolds(rule, header, line)) continue;
                    if (!MustHolds(rule, header, line))
                        errors.Add(FailText(rule, i));
                }
            }
            else
            {
                if (!WhenHolds(rule, header, null)) continue;
                if (!MustHolds(rule, header, null))
                    errors.Add(FailText(rule, null));
            }
        }
        return errors.Count == 0 ? null : string.Join(" · ", errors.Distinct());
    }

    private async Task<bool> IsOutgoingEInvoiceAsync(
        string tableName,
        IDictionary<string, object?> header,
        CancellationToken ct)
    {
        if (tableName.Equals("EGovDocument", StringComparison.OrdinalIgnoreCase))
        {
            var dir = Val(header, null, "Direction");
            return dir is "2";
        }
        if (!tableName.Equals("Invoice", StringComparison.OrdinalIgnoreCase)) return false;
        var customerId = Val(header, null, "CustomerID");
        if (!int.TryParse(customerId, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) || id <= 0)
            return false;
        try
        {
            var t = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                "SELECT EinvoiceType FROM dbo.CustomerCard WHERE CustomerCardID = @id",
                new { id }, cancellationToken: ct));
            return t is 1 or 2;
        }
        catch
        {
            return false;
        }
    }

    private static bool WhenHolds(SaveRuleDto rule, IDictionary<string, object?> header, IDictionary<string, object?>? line)
    {
        if (string.IsNullOrWhiteSpace(rule.WhenField)) return true;
        var actual = Val(header, line, rule.WhenField);
        return Compare(rule.WhenOp, actual, rule.WhenValue);
    }

    private static bool MustHolds(SaveRuleDto rule, IDictionary<string, object?> header, IDictionary<string, object?>? line)
    {
        var actual = Val(header, line, rule.MustField);
        return Compare(rule.MustOp, actual, rule.MustValue);
    }

    private static string FailText(SaveRuleDto rule, int? lineNo)
    {
        var custom = (rule.Message ?? "").Trim();
        var where = lineNo is int n ? $" (satır {n})" : "";
        if (custom.Length > 0) return custom + where;
        return $"«{rule.Name}»: {rule.MustField} kuralı sağlanmadı{where}";
    }

    private static string? Val(IDictionary<string, object?> header, IDictionary<string, object?>? line, string field)
    {
        if (line != null)
        {
            var onLine = Raw(line, field);
            if (onLine != null) return Norm(onLine);
        }
        return Norm(Raw(header, field));
    }

    private static object? Raw(IDictionary<string, object?> row, string field) =>
        row.FirstOrDefault(kv => kv.Key.Equals(field, StringComparison.OrdinalIgnoreCase)).Value;

    private static string? Norm(object? v)
    {
        if (v == null) return null;
        var s = Convert.ToString(v, CultureInfo.InvariantCulture)?.Trim();
        return string.IsNullOrEmpty(s) ? null : s;
    }

    private static bool Compare(string? op, string? actual, string? expected)
    {
        var a = actual ?? "";
        var e = (expected ?? "").Trim();
        return (op ?? "eq").ToLowerInvariant() switch
        {
            "ne" => !a.Equals(e, StringComparison.OrdinalIgnoreCase),
            "contains" => a.Contains(e, StringComparison.OrdinalIgnoreCase),
            "starts" => a.StartsWith(e, StringComparison.OrdinalIgnoreCase),
            "empty" => a.Length == 0,
            "notempty" => a.Length > 0,
            _ => a.Equals(e, StringComparison.OrdinalIgnoreCase),
        };
    }

    private static string Op(string? op)
    {
        var o = (op ?? "eq").Trim().ToLowerInvariant();
        return o is "eq" or "ne" or "contains" or "starts" or "empty" or "notempty" ? o : "eq";
    }

    private static string? NullIfEmpty(string? s)
    {
        var t = (s ?? "").Trim();
        return t.Length == 0 ? null : t;
    }
}
