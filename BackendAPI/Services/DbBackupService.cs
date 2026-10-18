using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

public sealed class DbBackupFile
{
    public string FileName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public long SizeBytes { get; set; }
}

public sealed class DbBackupResult
{
    public bool Ok { get; set; }
    public string Message { get; set; } = "";
    public string? FilePath { get; set; }
}

/// <summary>
/// Veritabanı yedeği: BACKUP DATABASE … COPY_ONLY. Klasör Backup:Path (yoksa SQL Server'ın varsayılan yedek
/// klasörü); dosyayı SQL Server servisi yazar. Son Backup:Keep (7) yedek tutulur (klasör bu makinedeyse).
/// Gece işi (DbBackupJob) ve SQL güncellemesi öncesi otomatik çalışır.
/// </summary>
public sealed class DbBackupService
{
    private const string Prefix = "BartuERP_";
    private readonly DbConnectionStore _store;
    private readonly IConfiguration _cfg;
    private readonly ILogger<DbBackupService> _log;
    private readonly CurrentDatabase _current;

    public DbBackupService(DbConnectionStore store, IConfiguration cfg, ILogger<DbBackupService> log, CurrentDatabase current)
    {
        _store = store;
        _current = current;
        _cfg = cfg;
        _log = log;
    }

    private int Keep => Math.Clamp(_cfg.GetValue("Backup:Keep", 7), 1, 60);

    private async Task<string> FolderAsync(SqlConnection cn)
    {
        var configured = _cfg["Backup:Path"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured.Trim();
        var def = await cn.ExecuteScalarAsync<string?>("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400))");
        if (string.IsNullOrWhiteSpace(def))
        {
            // SQL Server 2017 ve öncesi: varsayılan yedek klasörü kayıt defterinde
            try
            {
                def = await cn.ExecuteScalarAsync<string?>(@"
DECLARE @d nvarchar(400);
EXEC master.dbo.xp_instance_regread N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'BackupDirectory', @d OUTPUT;
SELECT @d;");
            }
            catch
            {
                def = null;
            }
        }
        return string.IsNullOrWhiteSpace(def) ? @"C:\BartuERP_Yedek" : def.Trim();
    }

    public async Task<DbBackupResult> BackupAsync(string reason, CancellationToken ct = default)
    {
        if (!_store.IsConfigured()) return new DbBackupResult { Message = "Veritabanı bağlantısı tanımlı değil." };
        var db = _current.Name.Trim();
        try
        {
            await using var cn = new SqlConnection(_store.GetConnectionString(_current.Name));
            await cn.OpenAsync(ct);
            var folder = await FolderAsync(cn);
            var safeReason = new string((reason ?? "elle").Where(char.IsLetterOrDigit).Take(20).ToArray());
            var file = Path.Combine(folder, $"{Prefix}{db}_{DateTime.Now:yyyyMMdd_HHmmss}_{safeReason}.bak");
            var sql = $"BACKUP DATABASE [{db.Replace("]", "]]")}] TO DISK = @file WITH COPY_ONLY, INIT, NAME = @name";
            await cn.ExecuteAsync(new CommandDefinition(sql, new { file, name = $"Bartu ERP — {reason}" },
                commandTimeout: 1800, cancellationToken: ct));
            Prune(folder, db);
            _log.LogInformation("Veritabanı yedeği alındı: {File}", file);
            return new DbBackupResult { Ok = true, FilePath = file, Message = $"Yedek alındı: {file}" };
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Veritabanı yedeği alınamadı");
            return new DbBackupResult { Message = "Yedek alınamadı: " + ex.Message };
        }
    }

    /// <summary>Bu makinede erişilebilen yedek klasöründeki son yedekler</summary>
    public async Task<(string Folder, List<DbBackupFile> Files)> ListAsync(CancellationToken ct = default)
    {
        if (!_store.IsConfigured()) return ("", new List<DbBackupFile>());
        await using var cn = new SqlConnection(_store.GetConnectionString(_current.Name));
        await cn.OpenAsync(ct);
        var folder = await FolderAsync(cn);
        var db = _current.Name.Trim();
        var files = new List<DbBackupFile>();
        try
        {
            if (Directory.Exists(folder))
                files = new DirectoryInfo(folder).GetFiles($"{Prefix}{db}_*.bak")
                    .OrderByDescending(f => f.CreationTime)
                    .Take(30)
                    .Select(f => new DbBackupFile { FileName = f.Name, CreatedAt = f.CreationTime, SizeBytes = f.Length })
                    .ToList();
        }
        catch
        {
            // klasör başka makinede / yetki yok — liste boş
        }
        return (folder, files);
    }

    private void Prune(string folder, string db)
    {
        try
        {
            if (!Directory.Exists(folder)) return;
            foreach (var f in new DirectoryInfo(folder).GetFiles($"{Prefix}{db}_*.bak")
                         .OrderByDescending(f => f.CreationTime).Skip(Keep))
                f.Delete();
        }
        catch (Exception ex)
        {
            _log.LogInformation("Eski yedekler silinemedi: {Msg}", ex.Message);
        }
    }
}

/// <summary>Her gece Backup:Hour (02) saatinde veritabanı yedeği</summary>
public sealed class DbBackupJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly IConfiguration _cfg;
    private readonly ILogger<DbBackupJob> _log;

    public DbBackupJob(IServiceScopeFactory scopes, IConfiguration cfg, ILogger<DbBackupJob> log)
    {
        _scopes = scopes;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_cfg.GetValue("Backup:Nightly", true)) return;
        var hour = Math.Clamp(_cfg.GetValue("Backup:Hour", 2), 0, 23);
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.Now;
            var next = now.Date.AddHours(hour);
            if (next <= now) next = next.AddDays(1);
            try
            {
                await Task.Delay(next - now, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }
            // Sunucudaki her Bartu veritabanı ayrı yedeklenir
            var dbs = _scopes.CreateScope().ServiceProvider.GetRequiredService<TenantDbRegistry>().List();
            foreach (var name in dbs)
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    scope.ServiceProvider.GetRequiredService<CurrentDatabase>().Name = name;
                    await scope.ServiceProvider.GetRequiredService<DbBackupService>().BackupAsync("gece", stoppingToken);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Gece yedeği çalışmadı: {Db}", name);
                }
            }
        }
    }
}
