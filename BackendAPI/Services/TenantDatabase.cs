using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

/// <summary>
/// İsteğin çalıştığı veritabanı (aynı SQL sunucusunda birden çok Bartu veritabanı).
/// Oturum açmış istekte token'daki «bartu_db»; girişte X-Bartu-Db başlığı (yalnız geçerli bir Bartu veritabanıysa);
/// hiçbiri yoksa SQL bağlantı ayarındaki varsayılan veritabanı. Arka plan işleri <see cref="Name"/>'i kendisi atar.
/// </summary>
public sealed class CurrentDatabase
{
    public const string Claim = "bartu_db";
    public const string Header = "X-Bartu-Db";

    public string Name { get; set; } = "";
    /// <summary>İstemcinin istediği ama geçersiz olan ad (girişte «veritabanı bulunamadı»)</summary>
    public string? RejectedName { get; set; }
}

/// <summary>
/// Sunucudaki Bartu veritabanları: sistem veritabanı değil, çevrimiçi, dbo.SystemUser + dbo.SYS_DbUpdates tabloları var.
/// İsteğe bağlı izin listesi: appsettings «Tenancy:AllowedDatabases» (virgülle). Liste 2 dk önbelleklenir.
/// </summary>
public sealed partial class TenantDbRegistry
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(2);
    private static readonly string[] SystemDbs = ["master", "model", "msdb", "tempdb", "distribution", "ReportServer", "ReportServerTempDB", "SSISDB"];

    private readonly DbConnectionStore _store;
    private readonly IConfiguration _cfg;
    private readonly ILogger<TenantDbRegistry> _log;
    private readonly object _lock = new();
    private HashSet<string> _valid = new(StringComparer.OrdinalIgnoreCase);
    private DateTime _loadedAt = DateTime.MinValue;

    public TenantDbRegistry(DbConnectionStore store, IConfiguration cfg, ILogger<TenantDbRegistry> log)
    {
        _store = store;
        _cfg = cfg;
        _log = log;
    }

    [GeneratedRegex(@"^[A-Za-z0-9_\-\.]{1,128}$")]
    private static partial Regex NameRx();

    public static bool LooksValid(string? name) =>
        !string.IsNullOrWhiteSpace(name) && NameRx().IsMatch(name.Trim()) && !SystemDbs.Contains(name.Trim(), StringComparer.OrdinalIgnoreCase);

    public string DefaultDatabase => _store.GetSettings().Database.Trim();

    public bool IsValid(string? name)
    {
        if (!LooksValid(name)) return false;
        var n = name!.Trim();
        lock (_lock)
        {
            if (DateTime.UtcNow - _loadedAt < Ttl && _valid.Contains(n)) return true;
        }
        // önbellekte yoksa (yeni açılmış veritabanı olabilir) yenile
        Refresh();
        lock (_lock) return _valid.Contains(n);
    }

    public IReadOnlyList<string> List()
    {
        lock (_lock)
        {
            if (DateTime.UtcNow - _loadedAt < Ttl) return _valid.OrderBy(x => x).ToList();
        }
        Refresh();
        lock (_lock) return _valid.OrderBy(x => x).ToList();
    }

    private void Refresh()
    {
        if (!_store.IsConfigured()) return;
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var cn = new SqlConnection(_store.GetConnectionString(null));
            cn.Open();
            var names = cn.Query<string>(
                "SELECT name FROM sys.databases WHERE state = 0 AND database_id > 4 AND HAS_DBACCESS(name) = 1").ToList();
            foreach (var n in names.Where(LooksValid))
            {
                var q = "[" + n.Replace("]", "]]") + "]";
                var ok = cn.ExecuteScalar<int>($@"
SELECT CASE WHEN OBJECT_ID(N'{q}.dbo.SystemUser', N'U') IS NOT NULL
             AND OBJECT_ID(N'{q}.dbo.SYS_DbUpdates', N'U') IS NOT NULL THEN 1 ELSE 0 END") == 1;
                if (ok) found.Add(n);
            }
            var allowed = (_cfg["Tenancy:AllowedDatabases"] ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (allowed.Length > 0) found.IntersectWith(allowed);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Veritabanı listesi okunamadı");
            return;
        }
        lock (_lock)
        {
            _valid = found;
            _loadedAt = DateTime.UtcNow;
        }
    }

    /// <summary>İstek için veritabanı çözümü (DI fabrikası)</summary>
    public CurrentDatabase Resolve(HttpContext? http)
    {
        var current = new CurrentDatabase { Name = DefaultDatabase };
        if (http == null) return current;
        var claim = http.User.FindFirst(CurrentDatabase.Claim)?.Value;
        if (!string.IsNullOrWhiteSpace(claim))
        {
            current.Name = claim; // token imzalı — başlık yok sayılır, kullanıcı başka veritabanına geçemez
            return current;
        }
        var header = http.Request.Headers[CurrentDatabase.Header].FirstOrDefault()?.Trim();
        if (string.IsNullOrEmpty(header) || string.Equals(header, current.Name, StringComparison.OrdinalIgnoreCase)) return current;
        if (IsValid(header)) current.Name = header;
        else current.RejectedName = header;
        return current;
    }
}
