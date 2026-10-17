using System.Text;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;
using BartuERP.Backend.Services;

namespace BartuERP.Backend.Repositories;

public sealed class BootstrapScriptInfo
{
    public string FileName { get; set; } = "";
    public string Title { get; set; } = "";
    public string FullPath { get; set; } = "";
    public bool Exists { get; set; }
    public long SizeBytes { get; set; }
}

public sealed class DbBootstrapStatus
{
    public string ScriptsRoot { get; set; } = "";
    public string Server { get; set; } = "";
    public string Database { get; set; } = "";
    public bool Configured { get; set; }
    public bool ServerOk { get; set; }
    public bool DatabaseExists { get; set; }
    public int TableCount { get; set; }
    public bool HasSysDbUpdates { get; set; }
    public string? Message { get; set; }
    public List<BootstrapScriptInfo> BootstrapScripts { get; set; } = new();
}

public sealed class DbBootstrapStepResult
{
    public string Step { get; set; } = "";
    public bool Success { get; set; }
    public string Message { get; set; } = "";
}

public sealed class DbBootstrapResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public List<DbBootstrapStepResult> Steps { get; set; } = new();
    public List<DbUpdateApplyResult>? SqlUpdates { get; set; }
}

public sealed class DbBootstrapRequest
{
    /** Yoksa kaydedilmiş ayarlar kullanılır */
    public string? Server { get; set; }
    public string? Database { get; set; }
    public bool? TrustedConnection { get; set; }
    public string? UserId { get; set; }
    public string? Password { get; set; }
    public bool? TrustServerCertificate { get; set; }

    public bool CreateDatabaseIfMissing { get; set; } = true;
    public bool RunCreateDb { get; set; } = true;
    public bool RunSysTables { get; set; } = true;
    public bool ApplySqlUpdates { get; set; } = true;
    /** Mevcut DB'de tablo varsa yine de Create_DB çalıştır (dikkatli) */
    public bool ForceSchemaScripts { get; set; } = false;
}

public sealed class DbBootstrapRepository
{
    private static readonly string[] BootstrapFiles =
    [
        "Create_DB.sql",
        "SYS_Tables_And_UDF.sql",
    ];

    private readonly DbConnectionStore _store;
    private readonly DbUpdateRepository _updates;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public DbBootstrapRepository(
        DbConnectionStore store,
        DbUpdateRepository updates,
        IConfiguration config,
        IWebHostEnvironment env)
    {
        _store = store;
        _updates = updates;
        _config = config;
        _env = env;
    }

    public string GetScriptsRoot()
    {
        var configured = _config["DbBootstrap:ScriptsPath"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return Path.IsPathRooted(configured)
                ? configured
                : Path.GetFullPath(Path.Combine(_env.ContentRootPath, configured));
        }
        return Path.GetFullPath(Path.Combine(_env.ContentRootPath, ".."));
    }

    public async Task<DbBootstrapStatus> GetStatusAsync(CancellationToken ct = default)
    {
        var s = _store.GetSettings();
        var status = new DbBootstrapStatus
        {
            ScriptsRoot = GetScriptsRoot(),
            Server = s.Server,
            Database = s.Database,
            Configured = _store.IsConfigured(),
            BootstrapScripts = ListBootstrapScripts(),
        };

        if (!status.Configured)
        {
            status.Message = "Bağlantı bilgileri tanımlı değil";
            return status;
        }

        var (ok, msg, dbExists) = await _store.TestDetailedAsync(s, ct);
        status.ServerOk = ok;
        status.DatabaseExists = dbExists;
        status.Message = msg;

        if (dbExists)
        {
            try
            {
                await using var conn = _store.CreateConnection();
                await conn.OpenAsync(ct);
                status.TableCount = await conn.ExecuteScalarAsync<int>(
                    @"SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')");
                status.HasSysDbUpdates = await conn.ExecuteScalarAsync<int>(
                    @"SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_DbUpdates', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
            }
            catch (Exception ex)
            {
                status.Message = ex.Message;
            }
        }

        return status;
    }

    public List<BootstrapScriptInfo> ListBootstrapScripts()
    {
        var root = GetScriptsRoot();
        var list = new List<BootstrapScriptInfo>();
        foreach (var name in BootstrapFiles)
        {
            var path = Path.Combine(root, name);
            var fi = new FileInfo(path);
            list.Add(new BootstrapScriptInfo
            {
                FileName = name,
                Title = Path.GetFileNameWithoutExtension(name),
                FullPath = path,
                Exists = fi.Exists,
                SizeBytes = fi.Exists ? fi.Length : 0,
            });
        }
        return list;
    }

    public async Task<string?> GetScriptContentAsync(string fileName)
    {
        if (!IsAllowedBootstrap(fileName)) return null;
        var path = Path.Combine(GetScriptsRoot(), fileName);
        if (!File.Exists(path)) return null;
        return await File.ReadAllTextAsync(path, Encoding.UTF8);
    }

    public async Task<DbBootstrapResult> BootstrapAsync(DbBootstrapRequest req, CancellationToken ct = default)
    {
        var result = new DbBootstrapResult();
        var settings = MergeSettings(req);

        if (!settings.HasMinimumInfo())
        {
            result.Success = false;
            result.Message = "Sunucu ve veritabanı zorunlu";
            return result;
        }

        // Ayarları önce kaydet (master ile doğrulanmış)
        var (probeOk, probeMsg, dbExists) = await _store.TestDetailedAsync(settings, ct);
        if (!probeOk)
        {
            result.Success = false;
            result.Message = probeMsg;
            result.Steps.Add(new DbBootstrapStepResult { Step = "probe", Success = false, Message = probeMsg });
            return result;
        }

        _store.Save(settings);
        result.Steps.Add(new DbBootstrapStepResult
        {
            Step = "settings",
            Success = true,
            Message = "Bağlantı ayarları kaydedildi",
        });

        try
        {
            if (req.CreateDatabaseIfMissing && !dbExists)
            {
                await CreateDatabaseAsync(settings, ct);
                result.Steps.Add(new DbBootstrapStepResult
                {
                    Step = "create-database",
                    Success = true,
                    Message = $"Veritabanı oluşturuldu: {settings.Database}",
                });
                dbExists = true;
            }
            else if (!dbExists)
            {
                result.Success = false;
                result.Message = $"Veritabanı yok: {settings.Database}";
                result.Steps.Add(new DbBootstrapStepResult
                {
                    Step = "create-database",
                    Success = false,
                    Message = "CreateDatabaseIfMissing kapalı",
                });
                return result;
            }
            else
            {
                result.Steps.Add(new DbBootstrapStepResult
                {
                    Step = "create-database",
                    Success = true,
                    Message = "Veritabanı zaten var",
                });
            }

            var tableCount = await CountTablesAsync(settings, ct);
            var runSchema = req.ForceSchemaScripts || tableCount == 0;

            if (req.RunCreateDb)
            {
                if (!runSchema)
                {
                    result.Steps.Add(new DbBootstrapStepResult
                    {
                        Step = "Create_DB.sql",
                        Success = true,
                        Message = $"Atlandı ({tableCount} tablo mevcut). Force ile zorlayabilirsiniz.",
                    });
                }
                else
                {
                    var step = await RunBootstrapFileAsync(settings, "Create_DB.sql", ct);
                    result.Steps.Add(step);
                    if (!step.Success)
                    {
                        result.Success = false;
                        result.Message = step.Message;
                        return result;
                    }
                }
            }

            if (req.RunSysTables)
            {
                if (!runSchema && !req.ForceSchemaScripts)
                {
                    // SYS script çoğu IF NOT EXISTS — güvenle çalıştırılabilir
                    var step = await RunBootstrapFileAsync(settings, "SYS_Tables_And_UDF.sql", ct);
                    result.Steps.Add(step);
                    if (!step.Success)
                    {
                        result.Success = false;
                        result.Message = step.Message;
                        return result;
                    }
                }
                else
                {
                    var step = await RunBootstrapFileAsync(settings, "SYS_Tables_And_UDF.sql", ct);
                    result.Steps.Add(step);
                    if (!step.Success)
                    {
                        result.Success = false;
                        result.Message = step.Message;
                        return result;
                    }
                }
            }

            if (req.ApplySqlUpdates)
            {
                var updates = await _updates.ApplyPendingAsync("bootstrap", ct);
                result.SqlUpdates = updates;
                var failed = updates.FirstOrDefault(u => !u.Success);
                result.Steps.Add(new DbBootstrapStepResult
                {
                    Step = "SqlUpdates",
                    Success = failed == null,
                    Message = failed == null
                        ? $"{updates.Count} script işlendi"
                        : $"{failed.ScriptName}: {failed.Message}",
                });
                if (failed != null)
                {
                    result.Success = false;
                    result.Message = failed.Message;
                    return result;
                }
            }

            result.Success = true;
            result.Message = "Veritabanı hazır";
            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = ex.Message;
            result.Steps.Add(new DbBootstrapStepResult { Step = "error", Success = false, Message = ex.Message });
            return result;
        }
    }

    private async Task CreateDatabaseAsync(DbConnectionSettings settings, CancellationToken ct)
    {
        var db = settings.Database.Trim();
        if (!Regex.IsMatch(db, @"^[A-Za-z_][A-Za-z0-9_]*$"))
            throw new ArgumentException("Veritabanı adı yalnızca harf, rakam ve _ içerebilir");

        await using var master = _store.CreateMasterConnection(settings);
        await master.OpenAsync(ct);
        await using var cmd = master.CreateCommand();
        cmd.CommandTimeout = 120;
        cmd.CommandText = $@"
IF DB_ID(N'{db}') IS NULL
BEGIN
  CREATE DATABASE [{db}];
END";
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<int> CountTablesAsync(DbConnectionSettings settings, CancellationToken ct)
    {
        await using var conn = new SqlConnection(settings.BuildConnectionString());
        await conn.OpenAsync(ct);
        return await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(
                @"SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')",
                cancellationToken: ct));
    }

    private async Task<DbBootstrapStepResult> RunBootstrapFileAsync(
        DbConnectionSettings settings,
        string fileName,
        CancellationToken ct)
    {
        var path = Path.Combine(GetScriptsRoot(), fileName);
        if (!File.Exists(path))
        {
            return new DbBootstrapStepResult
            {
                Step = fileName,
                Success = false,
                Message = $"Dosya bulunamadı: {path}",
            };
        }

        try
        {
            var sql = await File.ReadAllTextAsync(path, Encoding.UTF8, ct);
            // Script icindeki USE [xxx] satirlari atlanir — baglanti zaten secili DB'ye acik
            sql = Regex.Replace(sql, @"^\s*USE\s+\[?[^\]\r\n]+\]?\s*;?\s*$", "", RegexOptions.Multiline | RegexOptions.IgnoreCase);
            await using var conn = new SqlConnection(settings.BuildConnectionString());
            await conn.OpenAsync(ct);

            var batches = SplitGoBatches(sql).ToList();
            var n = 0;
            foreach (var batch in batches)
            {
                if (string.IsNullOrWhiteSpace(batch)) continue;
                n++;
                await conn.ExecuteAsync(new CommandDefinition(batch, cancellationToken: ct, commandTimeout: 300));
            }

            return new DbBootstrapStepResult
            {
                Step = fileName,
                Success = true,
                Message = $"{n} batch uygulandı ({new FileInfo(path).Length / 1024} KB)",
            };
        }
        catch (Exception ex)
        {
            return new DbBootstrapStepResult
            {
                Step = fileName,
                Success = false,
                Message = ex.Message,
            };
        }
    }

    private DbConnectionSettings MergeSettings(DbBootstrapRequest req)
    {
        var current = _store.GetSettings();
        var trusted = req.TrustedConnection ?? current.TrustedConnection;
        var password = req.Password;
        if (string.IsNullOrEmpty(password) && !string.IsNullOrEmpty(current.Password))
            password = current.Password;

        return new DbConnectionSettings
        {
            Configured = true,
            Server = string.IsNullOrWhiteSpace(req.Server) ? current.Server : req.Server.Trim(),
            Database = string.IsNullOrWhiteSpace(req.Database) ? current.Database : req.Database.Trim(),
            TrustedConnection = trusted,
            UserId = trusted ? null : (string.IsNullOrWhiteSpace(req.UserId) ? current.UserId : req.UserId.Trim()),
            Password = trusted ? null : password,
            TrustServerCertificate = req.TrustServerCertificate ?? current.TrustServerCertificate,
        };
    }

    private static bool IsAllowedBootstrap(string fileName) =>
        BootstrapFiles.Any(f => f.Equals(fileName, StringComparison.OrdinalIgnoreCase));

    internal static IEnumerable<string> SplitGoBatches(string sql)
    {
        return Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);
    }
}
