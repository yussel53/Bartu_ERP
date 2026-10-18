using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

public sealed class DbConnectionSettings
{
    public bool Configured { get; set; }
    public string Server { get; set; } = "localhost";
    public string Database { get; set; } = "Bartu_ERP";
    public bool TrustedConnection { get; set; } = true;
    public string? UserId { get; set; }
    public string? Password { get; set; }
    public bool TrustServerCertificate { get; set; } = true;

    public string BuildConnectionString()
    {
        var b = new SqlConnectionStringBuilder
        {
            DataSource = Server?.Trim() ?? "",
            InitialCatalog = Database?.Trim() ?? "",
            TrustServerCertificate = TrustServerCertificate,
        };
        if (TrustedConnection)
        {
            b.IntegratedSecurity = true;
        }
        else
        {
            b.IntegratedSecurity = false;
            b.UserID = UserId?.Trim() ?? "";
            b.Password = Password ?? "";
        }
        return b.ConnectionString;
    }

    /** master — DB henüz yokken sunucu testi / CREATE DATABASE */
    public string BuildMasterConnectionString()
    {
        var b = new SqlConnectionStringBuilder(BuildConnectionString())
        {
            InitialCatalog = "master",
        };
        return b.ConnectionString;
    }

    public bool HasMinimumInfo()
    {
        if (string.IsNullOrWhiteSpace(Server) || string.IsNullOrWhiteSpace(Database))
            return false;
        if (!TrustedConnection && string.IsNullOrWhiteSpace(UserId))
            return false;
        return true;
    }
}

public sealed class DbConnectionStore
{
    private readonly string _filePath;
    private readonly object _lock = new();
    private DbConnectionSettings _settings;
    private string _connectionString;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public DbConnectionStore(IWebHostEnvironment env, IConfiguration config)
    {
        var dataDir = Path.Combine(env.ContentRootPath, "Data");
        Directory.CreateDirectory(dataDir);
        _filePath = Path.Combine(dataDir, "dbsettings.json");

        _settings = LoadOrCreate(config);
        _connectionString = ResolveConnectionString(config);
    }

    public string FilePath => _filePath;

    public DbConnectionSettings GetSettings()
    {
        lock (_lock) return Clone(_settings);
    }

    public string GetConnectionString()
    {
        lock (_lock) return _connectionString;
    }

    public SqlConnection CreateConnection()
    {
        return new SqlConnection(GetConnectionString());
    }

    /// <summary>Aynı sunucuda başka veritabanı (çok veritabanlı kullanım — CurrentDatabase); boşsa varsayılan</summary>
    public string GetConnectionString(string? database)
    {
        var cs = GetConnectionString();
        if (string.IsNullOrWhiteSpace(database)) return cs;
        return new SqlConnectionStringBuilder(cs) { InitialCatalog = database.Trim() }.ConnectionString;
    }

    public SqlConnection CreateConnection(string? database) => new(GetConnectionString(database));

    public SqlConnection CreateMasterConnection(DbConnectionSettings? settings = null)
    {
        var s = settings ?? GetSettings();
        return new SqlConnection(s.BuildMasterConnectionString());
    }

    public bool IsConfigured()
    {
        lock (_lock) return _settings.Configured && _settings.HasMinimumInfo();
    }

    public void Save(DbConnectionSettings settings)
    {
        settings.Configured = settings.HasMinimumInfo();
        var cs = settings.BuildConnectionString();
        lock (_lock)
        {
            _settings = Clone(settings);
            _connectionString = cs;
            var json = JsonSerializer.Serialize(_settings, JsonOpts);
            File.WriteAllText(_filePath, json);
        }
    }

    public async Task<(bool Ok, string Message)> TestAsync(DbConnectionSettings? settings = null, CancellationToken ct = default)
    {
        string cs;
        lock (_lock)
        {
            cs = settings != null ? settings.BuildConnectionString() : _connectionString;
        }

        if (string.IsNullOrWhiteSpace(cs))
            return (false, "Bağlantı dizesi boş");

        try
        {
            await using var conn = new SqlConnection(cs);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT 1";
            _ = await cmd.ExecuteScalarAsync(ct);
            return (true, "Bağlantı başarılı");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>
    /// Önce hedef DB, yoksa master. databaseExists: hedef katalog var mı.
    /// </summary>
    public async Task<(bool Ok, string Message, bool DatabaseExists)> TestDetailedAsync(
        DbConnectionSettings? settings = null,
        CancellationToken ct = default)
    {
        var s = settings ?? GetSettings();
        if (!s.HasMinimumInfo())
            return (false, "Sunucu ve veritabanı zorunlu", false);

        var (dbOk, dbMsg) = await TestAsync(s, ct);
        if (dbOk) return (true, "Bağlantı başarılı", true);

        try
        {
            await using var master = CreateMasterConnection(s);
            await master.OpenAsync(ct);
            await using var cmd = master.CreateCommand();
            cmd.CommandText = "SELECT CASE WHEN DB_ID(@db) IS NULL THEN 0 ELSE 1 END";
            cmd.Parameters.AddWithValue("@db", s.Database.Trim());
            var exists = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) == 1;
            if (!exists)
            {
                return (true,
                    $"Sunucu OK — veritabanı '{s.Database}' henüz yok. Sıfırdan Oluştur ile yaratabilirsiniz.",
                    false);
            }

            return (false, $"Veritabanı var ama açılamadı: {dbMsg}", true);
        }
        catch (Exception ex)
        {
            return (false, $"Sunucu bağlantısı başarısız: {ex.Message}", false);
        }
    }

    private DbConnectionSettings LoadOrCreate(IConfiguration config)
    {
        if (File.Exists(_filePath))
        {
            try
            {
                var json = File.ReadAllText(_filePath);
                var loaded = JsonSerializer.Deserialize<DbConnectionSettings>(json, JsonOpts);
                if (loaded != null) return loaded;
            }
            catch
            {
                /* fall through */
            }
        }

        // appsettings ConnectionStrings.DefaultConnection'dan türet (varsa)
        var fromConfig = config.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrWhiteSpace(fromConfig))
        {
            try
            {
                var b = new SqlConnectionStringBuilder(fromConfig);
                return new DbConnectionSettings
                {
                    Configured = !string.IsNullOrWhiteSpace(b.DataSource) && !string.IsNullOrWhiteSpace(b.InitialCatalog),
                    Server = b.DataSource ?? "localhost",
                    Database = b.InitialCatalog ?? "Bartu_ERP",
                    TrustedConnection = b.IntegratedSecurity,
                    UserId = b.IntegratedSecurity ? null : b.UserID,
                    Password = b.IntegratedSecurity ? null : b.Password,
                    TrustServerCertificate = b.TrustServerCertificate,
                };
            }
            catch
            {
                /* ignore */
            }
        }

        return new DbConnectionSettings { Configured = false };
    }

    private string ResolveConnectionString(IConfiguration config)
    {
        if (_settings.Configured && _settings.HasMinimumInfo())
            return _settings.BuildConnectionString();

        var fallback = config.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrWhiteSpace(fallback))
            return fallback;

        return "";
    }

    private static DbConnectionSettings Clone(DbConnectionSettings s) => new()
    {
        Configured = s.Configured,
        Server = s.Server,
        Database = s.Database,
        TrustedConnection = s.TrustedConnection,
        UserId = s.UserId,
        Password = s.Password,
        TrustServerCertificate = s.TrustServerCertificate,
    };
}
