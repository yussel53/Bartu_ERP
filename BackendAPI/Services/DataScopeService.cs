using System.Data;
using System.Text.Json;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services;

/// <summary>
/// Kullanıcının görebileceği kayıtlar (Y-02 — süzme artık sunucuda; ön yüzdeki süzme ikinci güvence olarak kalır).
/// Kaynaklar (birleşim): SystemUser.AuthCode · SYS_UserAuthCode (kayıt türü bazında) · SYS_UserOrgAuth (firma / işyeri / ambar) ·
/// rol AuthConfig (authCode, companyScopes[].authCodeLines / workplaceIds / whouseIds). Yönetici süzülmez.
/// Yetki kodu kuralı ön yüzle aynı: «+SAT,+PER» yalnız bunlar · «-GIZLI» bunlar hariç · kaydın kodu boşsa herkes görür.
/// </summary>
public sealed class DataScopeService
{
    private readonly IDbConnection _db;
    private readonly RolesRepository _roles;
    private readonly IHttpContextAccessor _http;
    private Scope? _scope;

    public DataScopeService(IDbConnection db, RolesRepository roles, IHttpContextAccessor http)
    {
        _db = db;
        _roles = roles;
        _http = http;
    }

    public sealed class Scope
    {
        public bool Unrestricted { get; set; }
        public HashSet<string> Companies { get; } = new();
        public HashSet<string> Workplaces { get; } = new();
        public HashSet<string> Whouses { get; } = new();
        public List<string> GeneralAuth { get; } = new();
        public Dictionary<string, List<string>> AuthByType { get; } = new(StringComparer.OrdinalIgnoreCase);
    }

    private static readonly string[] CompanyCols = ["CompanyID"];
    private static readonly string[] WorkplaceCols = ["WorkplaceID", "DepartmentID"];
    private static readonly string[] WhouseCols = ["WhouseID", "WarehouseID"];

    public async Task<Scope> GetAsync(CancellationToken ct = default)
    {
        if (_scope != null) return _scope;
        var s = new Scope();
        var user = _http.HttpContext?.User;
        var uid = user.UserId();
        if (uid <= 0 || user.IsAdmin())
        {
            s.Unrestricted = true;
            return _scope = s;
        }
        if (_db.State != ConnectionState.Open) _db.Open();

        async Task<bool> Has(string t) =>
            await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END", new { t = "dbo." + t }) == 1;

        if (await Has("SystemUser") && await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN COL_LENGTH(N'dbo.SystemUser', N'AuthCode') IS NULL THEN 0 ELSE 1 END") == 1)
        {
            var legacy = await _db.ExecuteScalarAsync<string?>("SELECT AuthCode FROM dbo.SystemUser WHERE SystemUserID = @uid", new { uid });
            if (!string.IsNullOrWhiteSpace(legacy)) s.GeneralAuth.Add(legacy.Trim());
        }
        if (await Has("SYS_UserAuthCode"))
            foreach (var r in await _db.QueryAsync(
                         "SELECT RecordType, AuthCode FROM dbo.SYS_UserAuthCode WHERE SystemUserID = @uid AND ISNULL(IsActive, 1) = 1", new { uid }))
                AddTyped(s, (string?)r.RecordType, (string?)r.AuthCode);
        if (await Has("SYS_UserOrgAuth"))
            foreach (var r in await _db.QueryAsync(
                         "SELECT CompanyID, WorkplaceID, WhouseID FROM dbo.SYS_UserOrgAuth WHERE SystemUserID = @uid AND ISNULL(IsActive, 1) = 1", new { uid }))
            {
                if (r.CompanyID != null) s.Companies.Add(Convert.ToString(r.CompanyID));
                if (r.WorkplaceID != null) s.Workplaces.Add(Convert.ToString(r.WorkplaceID));
                if (r.WhouseID != null) s.Whouses.Add(Convert.ToString(r.WhouseID));
            }

        // Rol yetkileri
        var eff = await _roles.GetEffectiveAuthAsync(uid, ct);
        if (eff.IsAdmin)
        {
            s.Unrestricted = true;
            return _scope = s;
        }
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(eff.AuthConfigJson) ? "{}" : eff.AuthConfigJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("authCode", out var ac) && ac.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(ac.GetString()))
                s.GeneralAuth.Add(ac.GetString()!.Trim());
            if (root.TryGetProperty("companyScopes", out var scopes) && scopes.ValueKind == JsonValueKind.Array)
                foreach (var sc in scopes.EnumerateArray())
                {
                    if (!(sc.TryGetProperty("enabled", out var en) && en.ValueKind == JsonValueKind.True)) continue;
                    if (sc.TryGetProperty("companyId", out var cid)) s.Companies.Add(cid.ToString());
                    foreach (var (prop, set) in new[] { ("workplaceIds", s.Workplaces), ("whouseIds", s.Whouses) })
                        if (sc.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array)
                            foreach (var x in arr.EnumerateArray()) set.Add(x.ToString());
                    if (sc.TryGetProperty("authCodeLines", out var lines) && lines.ValueKind == JsonValueKind.Array)
                        foreach (var l in lines.EnumerateArray())
                            AddTyped(s,
                                l.TryGetProperty("recordType", out var rt) ? rt.GetString() : null,
                                l.TryGetProperty("authCode", out var a) ? a.GetString() : null);
                }
        }
        catch (JsonException)
        {
            // bozuk rol ayarı süzmeyi kapatmaz — yalnız tablo kaynakları kullanılır
        }
        return _scope = s;
    }

    private static void AddTyped(Scope s, string? recordType, string? authCode)
    {
        if (string.IsNullOrWhiteSpace(authCode)) return;
        if (string.IsNullOrWhiteSpace(recordType))
        {
            s.GeneralAuth.Add(authCode.Trim());
            return;
        }
        if (!s.AuthByType.TryGetValue(recordType.Trim(), out var list)) s.AuthByType[recordType.Trim()] = list = new();
        list.Add(authCode.Trim());
    }

    private static string[] Tokens(string? text) =>
        (text ?? "").Split([',', ';', ' ', '\t', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    /// <summary>Ön yüzdeki canViewByAuthCode ile aynı</summary>
    public static bool CanViewByAuthCode(string? userExpr, string? recordAuth)
    {
        if (string.IsNullOrWhiteSpace(userExpr)) return true;
        var codes = Tokens(recordAuth).Select(t => t.TrimStart('+', '-').ToUpperInvariant()).Where(t => t.Length > 0).ToList();
        if (codes.Count == 0) return true;
        var plus = new List<string>();
        var minus = new List<string>();
        foreach (var t in Tokens(userExpr))
        {
            if (t.StartsWith('-')) minus.Add(t[1..].Trim().ToUpperInvariant());
            else plus.Add(t.TrimStart('+').Trim().ToUpperInvariant());
        }
        if (minus.Any(codes.Contains)) return false;
        return plus.Count == 0 || plus.Any(codes.Contains);
    }

    private static string? Value(IDictionary<string, object?> row, string[] cols)
    {
        foreach (var c in cols)
        {
            var hit = row.FirstOrDefault(kv => kv.Key.Equals(c, StringComparison.OrdinalIgnoreCase));
            if (hit.Key != null && hit.Value != null && Convert.ToString(hit.Value)?.Trim() is { Length: > 0 } v) return v;
        }
        return null;
    }

    /// <summary>Satır kullanıcıya görünür mü (yetki kodu + firma / işyeri / ambar)</summary>
    public bool CanSee(Scope s, string table, IDictionary<string, object?> row)
    {
        if (s.Unrestricted) return true;
        var expr = s.AuthByType.TryGetValue(table, out var typed) && typed.Count > 0
            ? string.Join(',', typed)
            : string.Join(',', s.GeneralAuth);
        if (!CanViewByAuthCode(expr, Value(row, ["AuthCode"]))) return false;
        if (s.Companies.Count > 0 && Value(row, CompanyCols) is { } c && !s.Companies.Contains(c)) return false;
        if (s.Workplaces.Count > 0 && Value(row, WorkplaceCols) is { } w && !s.Workplaces.Contains(w)) return false;
        if (s.Whouses.Count > 0 && Value(row, WhouseCols) is { } h && !s.Whouses.Contains(h)) return false;
        return true;
    }

    /// <summary>Tek kayıt görünür mü (ekstre / kart uçları için)</summary>
    public async Task<bool> CanSeeRecordAsync(string table, string pk, int id, CancellationToken ct = default)
    {
        var s = await GetAsync(ct);
        if (s.Unrestricted) return true;
        if (_db.State != ConnectionState.Open) _db.Open();
        var cols = (await _db.QueryAsync<string>(
            "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@t) AND name IN ('AuthCode','CompanyID','WorkplaceID','DepartmentID','WhouseID','WarehouseID')",
            new { t = "dbo." + table })).ToList();
        if (cols.Count == 0) return true;
        var row = await _db.QueryFirstOrDefaultAsync(
            $"SELECT {string.Join(',', cols.Select(c => $"[{c}]"))} FROM dbo.[{table.Replace("]", "")}] WHERE [{pk.Replace("]", "")}] = @id", new { id });
        if (row == null) return true;
        return CanSee(s, table, ((IDictionary<string, object>)row).ToDictionary(kv => kv.Key, kv => (object?)kv.Value));
    }
}
