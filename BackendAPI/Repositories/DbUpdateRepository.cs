using System.Text;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;
using BartuERP.Backend.Services;

namespace BartuERP.Backend.Repositories;

public sealed class DbUpdateScriptInfo
{
    public string ScriptName { get; set; } = "";
    public string Title { get; set; } = "";
    public int Sequence { get; set; }
    public bool Applied { get; set; }
    public DateTime? AppliedAt { get; set; }
    public string? Message { get; set; }
    public long SizeBytes { get; set; }
}

public sealed class DbUpdateStatusInfo
{
    public string FolderPath { get; set; } = "";
    public int Total { get; set; }
    public int AppliedCount { get; set; }
    public int PendingCount { get; set; }
    public string? ConnectionWarning { get; set; }
    public List<DbUpdateScriptInfo> Scripts { get; set; } = new();
}

public sealed class DbUpdateApplyResult
{
    public string ScriptName { get; set; } = "";
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public DateTime? AppliedAt { get; set; }
}

public sealed class DbUpdateRepository
{
    private readonly DbConnectionStore _store;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly CurrentDatabase _current;

    public DbUpdateRepository(DbConnectionStore store, IConfiguration config, IWebHostEnvironment env, CurrentDatabase current)
    {
        _store = store;
        _current = current;
        _config = config;
        _env = env;
    }

    public string GetFolderPath()
    {
        var configured = _config["SqlUpdates:Path"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var p = Path.IsPathRooted(configured)
                ? configured
                : Path.GetFullPath(Path.Combine(_env.ContentRootPath, configured));
            return p;
        }
        return Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "SqlUpdates"));
    }

    public async Task<DbUpdateStatusInfo> GetStatusAsync(CancellationToken ct = default)
    {
        var folder = GetFolderPath();
        var info = new DbUpdateStatusInfo { FolderPath = folder };

        if (!Directory.Exists(folder))
        {
            info.ConnectionWarning = $"SqlUpdates klasörü bulunamadı: {folder}";
            return info;
        }

        var files = Directory.GetFiles(folder, "*.sql")
            .Select(f => new FileInfo(f))
            .OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        HashSet<string> applied = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, DateTime> appliedAt = new(StringComparer.OrdinalIgnoreCase);
        try
        {
            await using var conn = _store.CreateConnection(_current.Name);
            await conn.OpenAsync(ct);
            var exists = await conn.ExecuteScalarAsync<int>(
                @"SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_DbUpdates', N'U') IS NULL THEN 0 ELSE 1 END");
            if (exists == 1)
            {
                var rows = await conn.QueryAsync<(string ScriptName, DateTime AppliedAt)>(
                    "SELECT ScriptName, AppliedAt FROM dbo.SYS_DbUpdates");
                foreach (var r in rows)
                {
                    applied.Add(r.ScriptName);
                    appliedAt[r.ScriptName] = r.AppliedAt;
                }
            }
        }
        catch (Exception ex)
        {
            info.ConnectionWarning = ex.Message;
        }

        foreach (var f in files)
        {
            var seq = ParseSequence(f.Name);
            var title = Path.GetFileNameWithoutExtension(f.Name);
            var isApplied = applied.Contains(f.Name);
            info.Scripts.Add(new DbUpdateScriptInfo
            {
                ScriptName = f.Name,
                Title = title,
                Sequence = seq,
                Applied = isApplied,
                AppliedAt = isApplied && appliedAt.TryGetValue(f.Name, out var at) ? at : null,
                SizeBytes = f.Length,
            });
        }

        info.Total = info.Scripts.Count;
        info.AppliedCount = info.Scripts.Count(s => s.Applied);
        info.PendingCount = info.Total - info.AppliedCount;
        return info;
    }

    public async Task<string?> GetScriptContentAsync(string scriptName)
    {
        var path = SafeScriptPath(scriptName);
        if (path == null || !File.Exists(path)) return null;
        return await File.ReadAllTextAsync(path, Encoding.UTF8);
    }

    public async Task<DbUpdateApplyResult> ApplyAsync(string scriptName, string? appliedBy, CancellationToken ct = default)
    {
        var path = SafeScriptPath(scriptName);
        if (path == null || !File.Exists(path))
        {
            return new DbUpdateApplyResult
            {
                ScriptName = scriptName,
                Success = false,
                Message = "Script bulunamadı",
            };
        }

        try
        {
            var sql = await File.ReadAllTextAsync(path, Encoding.UTF8, ct);
            await using var conn = (SqlConnection)_store.CreateConnection(_current.Name);
            await conn.OpenAsync(ct);

            foreach (var batch in SplitGoBatches(sql))
            {
                if (string.IsNullOrWhiteSpace(batch)) continue;
                await conn.ExecuteAsync(new CommandDefinition(batch, cancellationToken: ct, commandTimeout: 120));
            }

            await conn.ExecuteAsync(
                @"IF OBJECT_ID(N'dbo.SYS_DbUpdates', N'U') IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM dbo.SYS_DbUpdates WHERE ScriptName = @name)
                  INSERT INTO dbo.SYS_DbUpdates (ScriptName, AppliedBy) VALUES (@name, @by)",
                new { name = scriptName, by = appliedBy ?? "API" });

            return new DbUpdateApplyResult
            {
                ScriptName = scriptName,
                Success = true,
                Message = "Uygulandı",
                AppliedAt = DateTime.UtcNow,
            };
        }
        catch (Exception ex)
        {
            return new DbUpdateApplyResult
            {
                ScriptName = scriptName,
                Success = false,
                Message = ex.Message,
            };
        }
    }

    public async Task<List<DbUpdateApplyResult>> ApplyPendingAsync(string? appliedBy, CancellationToken ct = default)
    {
        var status = await GetStatusAsync(ct);
        var results = new List<DbUpdateApplyResult>();
        foreach (var s in status.Scripts.Where(x => !x.Applied).OrderBy(x => x.Sequence).ThenBy(x => x.ScriptName))
        {
            results.Add(await ApplyAsync(s.ScriptName, appliedBy, ct));
            if (!results[^1].Success) break;
        }
        return results;
    }

    private string? SafeScriptPath(string scriptName)
    {
        if (string.IsNullOrWhiteSpace(scriptName) || scriptName.Contains("..") || scriptName.Contains('/') || scriptName.Contains('\\'))
            return null;
        if (!scriptName.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            return null;
        return Path.Combine(GetFolderPath(), scriptName);
    }

    private static int ParseSequence(string fileName)
    {
        var m = Regex.Match(fileName, @"^(\d+)");
        return m.Success && int.TryParse(m.Groups[1].Value, out var n) ? n : 9999;
    }

    private static IEnumerable<string> SplitGoBatches(string sql)
    {
        var parts = Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);
        return parts;
    }
}
