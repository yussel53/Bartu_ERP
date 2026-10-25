using System.Data;
using System.Globalization;
using System.Text.Json;
using BartuERP.Backend.Repositories;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

public sealed class ImportMapItem
{
    public string Header { get; set; } = "";
    public string Field { get; set; } = "";
}

public sealed class ImportProfileDto
{
    public int ImportProfileID { get; set; }
    public string Title { get; set; } = "";
    public string Kind { get; set; } = "";
    public int SourceKind { get; set; }
    public ProcessSourceRequest Source { get; set; } = new();
    public List<ImportMapItem> Map { get; set; } = new();
    public string Mode { get; set; } = "upsert";
    public bool CreateMissingCards { get; set; }
    public int? ProductType { get; set; }
    public int? IntervalMinutes { get; set; }
    public bool IsActive { get; set; } = true;
    public int? ProcessDefID { get; set; }
    public string? AfterSql { get; set; }
    public bool KeepLog { get; set; } = true;
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public string? LastStatus { get; set; }
    public bool HasPassword { get; set; }
}

public sealed class ImportPullResult
{
    public List<string> Headers { get; set; } = new();
    public List<List<string>> Rows { get; set; } = new();
}

/// <summary>SQL / API aktarım profili. Aralık doluysa süreç tanımına bağlanır ve zamanlayıcı çalıştırır.</summary>
public sealed class ImportProfileService
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private readonly IDbConnection _db;
    private readonly ImportRepository _import;

    public ImportProfileService(IDbConnection db, ImportRepository import)
    {
        _db = db;
        _import = import;
    }

    public async Task<List<ImportProfileDto>> ListAsync(CancellationToken ct)
    {
        if (!await TableAsync(ct)) return new();
        var rows = await _db.QueryAsync<ProfileRow>(new CommandDefinition(
            @"SELECT ImportProfileID, Title, Kind, SourceKind, SourceJson, MapJson, Mode, CreateMissingCards,
                     ProductType, IntervalMinutes, IsActive, ProcessDefID, AfterSql, KeepLog, LastRunAt, NextRunAt, LastStatus
              FROM dbo.SYS_ImportProfile ORDER BY ImportProfileID DESC", cancellationToken: ct));
        return rows.Select(r => ToDto(r, mask: true)).ToList();
    }

    public async Task<ImportProfileDto> SaveAsync(ImportProfileDto dto, CancellationToken ct)
    {
        if (!await TableAsync(ct))
            throw new InvalidOperationException("Aktarım profili tablosu yok. Veritabanı Güncelleme ile 105_sys_import_profile.sql uygulayın.");
        var def = ImportRepository.GetTarget(dto.Kind) ?? throw new InvalidOperationException("Aktarım türü yok.");
        var title = (dto.Title ?? "").Trim();
        if (title.Length == 0) throw new InvalidOperationException("Profil adı yazın.");
        if (dto.SourceKind is < 0 or > 4) throw new InvalidOperationException("Kaynak tipi yok.");
        if (dto.SourceKind == 4) dto.IntervalMinutes = null;
        if (dto.IntervalMinutes is <= 0) dto.IntervalMinutes = null;
        if (dto.IntervalMinutes is < 5 or > 10080)
            throw new InvalidOperationException("Aralık 5 dakika ile 7 gün arasında olmalı. Boş bırakılırsa yalnız elle çalışır.");
        dto.Source.SourceType = dto.SourceKind;
        if (dto.SourceKind is 1 or 2 or 3 && dto.IntervalMinutes is > 0)
            ValidateSource(dto.Source);

        string? previousPassword = null;
        if (dto.ImportProfileID > 0)
        {
            var prev = await _db.QuerySingleOrDefaultAsync<string?>(new CommandDefinition(
                "SELECT SourceJson FROM dbo.SYS_ImportProfile WHERE ImportProfileID = @id",
                new { id = dto.ImportProfileID }, cancellationToken: ct));
            previousPassword = ReadPassword(prev);
        }
        if (string.IsNullOrEmpty(dto.Source.Password))
            dto.Source.Password = previousPassword;

        var sourceJson = JsonSerializer.Serialize(dto.Source, Json);
        var mapJson = JsonSerializer.Serialize(dto.Map ?? new(), Json);
        var mode = dto.Mode is "insert" or "update" ? dto.Mode : "upsert";
        var afterSql = string.IsNullOrWhiteSpace(dto.AfterSql) ? null : dto.AfterSql.Trim();
        if (afterSql != null)
        {
            if (!await ColAsync("SYS_ImportProfile", "AfterSql", ct))
                throw new InvalidOperationException("Aktarım sonrası alanı yok. 106_sys_import_after_sql.sql uygulayın.");
            EnsureUpdateSql(afterSql);
        }

        if (dto.ImportProfileID <= 0)
        {
            dto.ImportProfileID = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"INSERT INTO dbo.SYS_ImportProfile
                    (Title, Kind, SourceKind, SourceJson, MapJson, Mode, CreateMissingCards, ProductType, IntervalMinutes, IsActive, AfterSql, KeepLog, NextRunAt)
                  OUTPUT INSERTED.ImportProfileID
                  VALUES (@Title, @Kind, @SourceKind, @SourceJson, @MapJson, @Mode, @Cards, @ProductType, @Interval, @Active, @AfterSql, @KeepLog,
                          CASE WHEN @Interval IS NULL THEN NULL ELSE SYSDATETIME() END)",
                new
                {
                    Title = title, Kind = def.Kind, dto.SourceKind, SourceJson = sourceJson, MapJson = mapJson, Mode = mode,
                    Cards = dto.CreateMissingCards, dto.ProductType, Interval = dto.IntervalMinutes, Active = dto.IsActive,
                    AfterSql = afterSql, KeepLog = dto.KeepLog,
                }, cancellationToken: ct));
        }
        else
        {
            await _db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.SYS_ImportProfile
                  SET Title = @Title, Kind = @Kind, SourceKind = @SourceKind, SourceJson = @SourceJson, MapJson = @MapJson,
                      Mode = @Mode, CreateMissingCards = @Cards, ProductType = @ProductType, IntervalMinutes = @Interval,
                      IsActive = @Active, AfterSql = @AfterSql, KeepLog = @KeepLog, UpdatedAt = SYSDATETIME(),
                      NextRunAt = CASE WHEN @Interval IS NULL THEN NULL WHEN NextRunAt IS NULL THEN SYSDATETIME() ELSE NextRunAt END
                  WHERE ImportProfileID = @id",
                new
                {
                    Title = title, Kind = def.Kind, dto.SourceKind, SourceJson = sourceJson, MapJson = mapJson, Mode = mode,
                    Cards = dto.CreateMissingCards, dto.ProductType, Interval = dto.IntervalMinutes, Active = dto.IsActive,
                    AfterSql = afterSql, KeepLog = dto.KeepLog, id = dto.ImportProfileID,
                }, cancellationToken: ct));
        }

        var processId = await BindProcessAsync(dto.ImportProfileID, title, def.TableName, dto.IntervalMinutes, dto.IsActive, ct);
        if (processId > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.SYS_ImportProfile SET ProcessDefID = @pid WHERE ImportProfileID = @id",
                new { pid = processId, id = dto.ImportProfileID }, cancellationToken: ct));
        }
        dto.Title = title;
        dto.AfterSql = afterSql;
        dto.Kind = def.Kind;
        dto.ProcessDefID = processId > 0 ? processId : dto.ProcessDefID;
        dto.HasPassword = !string.IsNullOrEmpty(dto.Source.Password);
        dto.Source.Password = null;
        return dto;
    }

    public async Task SetKeepLogAsync(int id, bool keepLog, CancellationToken ct)
    {
        if (!await ColAsync("SYS_ImportProfile", "KeepLog", ct))
            throw new InvalidOperationException("Log takibi alanı yok. 107_sys_import_profile_log.sql uygulayın.");
        var n = await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_ImportProfile SET KeepLog = @keep, UpdatedAt = SYSDATETIME() WHERE ImportProfileID = @id",
            new { keep = keepLog, id }, cancellationToken: ct));
        if (n == 0) throw new InvalidOperationException("Aktarım yok.");
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        if (!await TableAsync(ct)) return;
        var pid = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT ProcessDefID FROM dbo.SYS_ImportProfile WHERE ImportProfileID = @id", new { id }, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_ImportProfile WHERE ImportProfileID = @id", new { id }, cancellationToken: ct));
        if (pid is > 0 && await ProcessTableAsync(ct))
            await _db.ExecuteAsync(new CommandDefinition(
                "UPDATE dbo.SYS_ProcessDef SET IsActive = 0, UpdatedAt = SYSDATETIME() WHERE ProcessDefID = @id",
                new { id = pid }, cancellationToken: ct));
    }

    public async Task<ImportPullResult> PullAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        var rows = await ReadAsync(req, ct);
        return ToSheet(rows);
    }

    public async Task<IReadOnlyList<string>> ColumnsAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        if (req.SourceType == 0)
        {
            var sql = req.Sql?.Trim() ?? "";
            if (!ProcessContextData.IsSafeSelect(sql))
                throw new InvalidOperationException("Yalnızca tek bir SELECT yazılabilir.");
            Open();
            await using var cmd = ((SqlConnection)_db).CreateCommand();
            cmd.CommandText = $"SELECT TOP (0) * FROM ({sql}) AS scan_q";
            cmd.CommandTimeout = 30;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            var names = new List<string>();
            for (var i = 0; i < reader.FieldCount; i++) names.Add(reader.GetName(i));
            return names;
        }
        return await ProcessSource.ColumnsAsync(req, ct);
    }

    public async Task<ImportApplyResult> RunAsync(int id, bool dryRun, CancellationToken ct)
    {
        if (!await TableAsync(ct))
            throw new InvalidOperationException("Aktarım profili tablosu yok.");
        var row = await _db.QuerySingleOrDefaultAsync<ProfileRow>(new CommandDefinition(
            @"SELECT ImportProfileID, Title, Kind, SourceKind, SourceJson, MapJson, Mode, CreateMissingCards,
                     ProductType, IntervalMinutes, IsActive, ProcessDefID, AfterSql, KeepLog, LastRunAt, NextRunAt, LastStatus
              FROM dbo.SYS_ImportProfile WHERE ImportProfileID = @id",
            new { id }, cancellationToken: ct)) ?? throw new InvalidOperationException("Profil yok.");
        var dto = ToDto(row, mask: false);
        if (dto.SourceKind == 4)
            throw new InvalidOperationException("Excel aktarımı listeden açılıp dosya seçilerek çalışır.");
        dto.Source.SourceType = dto.SourceKind;
        var result = await ApplySourceAsync(dto, dryRun, ct);
        if (!dryRun)
        {
            var status = $"{result.Inserted} yeni · {result.Updated} güncelleme · {result.Skipped} atlanan · {result.Failed} hata";
            if (status.Length > 500) status = status[..500];
            await _db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.SYS_ImportProfile
                  SET LastRunAt = SYSDATETIME(), LastStatus = @status,
                      NextRunAt = CASE WHEN IntervalMinutes IS NULL THEN NULL ELSE DATEADD(MINUTE, IntervalMinutes, SYSDATETIME()) END
                  WHERE ImportProfileID = @id",
                new { status, id }, cancellationToken: ct));
        }
        return result;
    }

    public async Task<int> RunDueAsync(CancellationToken ct)
    {
        if (!await TableAsync(ct)) return 0;
        var ids = (await _db.QueryAsync<int>(new CommandDefinition(
            @"SELECT ImportProfileID FROM dbo.SYS_ImportProfile
              WHERE IsActive = 1 AND SourceKind IN (0, 1, 2, 3)
                AND IntervalMinutes IS NOT NULL AND IntervalMinutes >= 5
                AND (NextRunAt IS NULL OR NextRunAt <= SYSDATETIME())",
            cancellationToken: ct))).ToList();
        var n = 0;
        foreach (var id in ids)
        {
            try
            {
                await RunAsync(id, dryRun: false, ct);
                n++;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                var msg = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
                await _db.ExecuteAsync(new CommandDefinition(
                    @"UPDATE dbo.SYS_ImportProfile
                      SET LastRunAt = SYSDATETIME(), LastStatus = @msg,
                          NextRunAt = DATEADD(MINUTE, IntervalMinutes, SYSDATETIME())
                      WHERE ImportProfileID = @id",
                    new { msg, id }, cancellationToken: ct));
            }
        }
        return n;
    }

    private async Task<ImportApplyResult> ApplySourceAsync(ImportProfileDto dto, bool dryRun, CancellationToken ct)
    {
        ValidateSource(dto.Source);
        var pulled = await ReadAsync(dto.Source, ct);
        var rows = new List<Dictionary<string, string?>>();
        var sourceRows = new List<Dictionary<string, string?>>();
        var i = 0;
        foreach (var src in pulled)
        {
            i++;
            var rowNo = (i + 1).ToString(CultureInfo.InvariantCulture);
            var rec = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase) { ["__row"] = rowNo };
            var srcRow = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase) { ["__row"] = rowNo };
            foreach (var kv in src)
            {
                if (!Ident.IsMatch(kv.Key)) continue;
                var text = Cell(kv.Value);
                if (!string.IsNullOrWhiteSpace(text)) srcRow[kv.Key] = text;
            }
            var any = false;
            foreach (var map in dto.Map)
            {
                if (string.IsNullOrWhiteSpace(map.Field) || string.IsNullOrWhiteSpace(map.Header)) continue;
                if (!TryGet(src, map.Header, out var value) || value == null) continue;
                var text = Cell(value);
                if (string.IsNullOrWhiteSpace(text)) continue;
                rec[map.Field] = text;
                any = true;
            }
            if (!any) continue;
            rows.Add(rec);
            sourceRows.Add(srcRow);
        }
        if (rows.Count == 0) throw new InvalidOperationException("Sorgudan aktarılacak satır gelmedi.");
        var result = await _import.ApplyAsync(dto.Kind, new ImportApplyRequest
        {
            Rows = rows,
            Mode = dto.Mode,
            DryRun = dryRun,
            ProductType = dto.ProductType,
            CreateMissingCards = dto.CreateMissingCards,
            FileName = dto.Title,
            ImportedBy = "surec",
            WriteLog = dto.KeepLog,
            ProfileId = dto.ImportProfileID,
        }, ct);
        if (!dryRun && !string.IsNullOrWhiteSpace(dto.AfterSql))
            await MarkSourceAsync(dto.Source, dto.AfterSql, result, rows, sourceRows, ct);
        return result;
    }

    /// <summary>Her başarılı kayıttan sonra kaynakta UPDATE çalıştırır. @KayitId oluşan kaydın numarasıdır.</summary>
    public async Task MarkSourceAsync(
        ProcessSourceRequest source,
        string afterSql,
        ImportApplyResult result,
        IReadOnlyList<Dictionary<string, string?>> mappedRows,
        IReadOnlyList<Dictionary<string, string?>>? sourceRows,
        CancellationToken ct)
    {
        var sql = afterSql.Trim();
        if (sql.Length == 0) return;
        try
        {
            EnsureUpdateSql(sql);
            if (source.SourceType == 3)
                throw new InvalidOperationException("Geri güncelleme SQL kaynağında çalışır.");
            if (source.SourceType is 1 or 2 && string.IsNullOrWhiteSpace(source.Server))
                throw new InvalidOperationException("Geri güncelleme için sunucu yazın.");
        }
        catch (Exception ex)
        {
            result.AfterError = ex.Message;
            return;
        }

        var byRow = new Dictionary<int, Dictionary<string, string?>>();
        void Take(IReadOnlyList<Dictionary<string, string?>>? list)
        {
            if (list == null) return;
            foreach (var row in list)
            {
                if (!row.TryGetValue("__row", out var rn) || !int.TryParse(rn, out var n)) continue;
                if (!byRow.TryGetValue(n, out var bag))
                {
                    bag = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
                    byRow[n] = bag;
                }
                foreach (var kv in row)
                {
                    if (kv.Key == "__row" || string.IsNullOrWhiteSpace(kv.Value)) continue;
                    if (!Ident.IsMatch(kv.Key)) continue;
                    bag[kv.Key] = kv.Value;
                }
            }
        }
        Take(sourceRows);
        Take(mappedRows);

        var names = ParamNames(sql);
        foreach (var row in result.Rows)
        {
            if (row.Action is not ("insert" or "update") || row.RecordId is not > 0) continue;
            var lines = row.LineNos is { Count: > 0 } ? row.LineNos : new List<int> { row.RowNo };
            foreach (var lineNo in lines.Distinct())
            {
                byRow.TryGetValue(lineNo, out var vals);
                vals ??= new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
                var args = ArgsOf(names, vals, row);
                try
                {
                    if (source.SourceType == 0)
                    {
                        Open();
                        await _db.ExecuteAsync(new CommandDefinition(sql, args, commandTimeout: 60, cancellationToken: ct));
                    }
                    else
                        await ProcessSource.ExecuteAsync(source, sql, args, ct);
                    result.AfterUpdated++;
                }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    result.AfterFailed++;
                    var note = "Kaynak güncellenemedi: " + ex.Message;
                    row.Message = string.IsNullOrWhiteSpace(row.Message) ? note : row.Message + "; " + note;
                }
            }
        }
    }

    private static readonly System.Text.RegularExpressions.Regex Ident =
        new(@"^[A-Za-z_][A-Za-z0-9_]*$", System.Text.RegularExpressions.RegexOptions.Compiled);

    private static readonly System.Text.RegularExpressions.Regex Param =
        new(@"(?<!@)@([A-Za-z_][A-Za-z0-9_]*)", System.Text.RegularExpressions.RegexOptions.Compiled);

    private static readonly System.Text.RegularExpressions.Regex Forbidden =
        new(@"\b(INSERT|DELETE|DROP|ALTER|EXEC|EXECUTE|MERGE|TRUNCATE|GRANT|REVOKE)\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);

    public static void EnsureUpdateSql(string sql)
    {
        var bare = System.Text.RegularExpressions.Regex.Replace(sql, @"/\*.*?\*/", " ", System.Text.RegularExpressions.RegexOptions.Singleline);
        bare = System.Text.RegularExpressions.Regex.Replace(bare, @"--.*?$", " ", System.Text.RegularExpressions.RegexOptions.Multiline).Trim();
        if (bare.Length == 0) throw new InvalidOperationException("Aktarım sonrası UPDATE yazın.");
        if (System.Text.RegularExpressions.Regex.IsMatch(bare, @"\bGO\b", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            throw new InvalidOperationException("Aktarım sonrası komutunda GO kullanılamaz.");
        if (Forbidden.IsMatch(bare))
            throw new InvalidOperationException("Aktarım sonrası yalnız UPDATE yazılabilir.");
        foreach (var part in bare.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!part.StartsWith("UPDATE", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Aktarım sonrası yalnız UPDATE yazılabilir.");
        }
    }

    private static List<string> ParamNames(string sql)
    {
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (System.Text.RegularExpressions.Match m in Param.Matches(sql))
            if (seen.Add(m.Groups[1].Value)) names.Add(m.Groups[1].Value);
        return names;
    }

    private static DynamicParameters ArgsOf(List<string> names, Dictionary<string, string?> vals, ImportRowResult row)
    {
        string? Pick(params string[] keys)
        {
            foreach (var key in keys)
                if (vals.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v)) return v;
            return null;
        }
        var belge = Pick("DocumentNumber", "EDocumentNumber", "BelgeNo") ?? row.Code;
        var fis = Pick("DocumentNumber", "journalNO", "FisNo") ?? row.Code;
        var args = new DynamicParameters();
        foreach (var name in names)
        {
            object? value = name.ToLowerInvariant() switch
            {
                "kayitid" => row.RecordId,
                "belgeno" => belge,
                "fisno" => fis,
                "kod" => row.Code,
                _ => vals.TryGetValue(name, out var v) ? v : null,
            };
            args.Add(name, value);
        }
        return args;
    }

    private async Task<List<Dictionary<string, object?>>> ReadAsync(ProcessSourceRequest req, CancellationToken ct)
    {
        if (req.SourceType != 0) return await ProcessSource.RowsAsync(req, ct, take: null);
        var sql = req.Sql?.Trim() ?? "";
        if (!ProcessContextData.IsSafeSelect(sql))
            throw new InvalidOperationException("Yalnızca tek bir SELECT yazılabilir.");
        Open();
        var list = new List<Dictionary<string, object?>>();
        await using var cmd = ((SqlConnection)_db).CreateCommand();
        cmd.CommandText = $"SELECT * FROM ({sql}) AS scan_q";
        cmd.CommandTimeout = 180;
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            list.Add(row);
        }
        return list;
    }

    private async Task<int> BindProcessAsync(int profileId, string title, string table, int? minutes, bool active, CancellationToken ct)
    {
        if (!await ProcessTableAsync(ct))
        {
            if (minutes is >= 5)
                throw new InvalidOperationException("Süreç tablosu yok. 67_process_management.sql uygulayın.");
            return 0;
        }
        var existing = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT ProcessDefID FROM dbo.SYS_ImportProfile WHERE ImportProfileID = @id",
            new { id = profileId }, cancellationToken: ct));
        var hasCfg = await ColAsync("SYS_ProcessDef", "TriggerConfigJson", ct);
        var hasCat = await ColAsync("SYS_ProcessDef", "Category", ct);
        var hasNode = await ColAsync("SYS_ProcessStep", "NodeType", ct);
        var cfg = JsonSerializer.Serialize(new { importProfileId = profileId, intervalMinutes = minutes });
        var on = active && minutes is >= 5;

        int processId;
        if (existing is > 0)
        {
            processId = existing.Value;
            await _db.ExecuteAsync(new CommandDefinition($"""
                UPDATE dbo.SYS_ProcessDef
                SET Name = @Name, Description = @Description, TriggerType = 6, SourceTable = @Table, TargetTable = @Table,
                    IsActive = @Active, UpdatedAt = SYSDATETIME()
                    {(hasCat ? ", Category = N'Integration'" : "")}
                    {(hasCfg ? ", TriggerConfigJson = @Cfg" : "")}
                WHERE ProcessDefID = @id
                """, new { Name = title, Description = Describe(minutes), Table = table, Active = on, Cfg = cfg, id = processId }, cancellationToken: ct));
        }
        else if (!on)
        {
            return 0;
        }
        else
        {
            processId = await _db.ExecuteScalarAsync<int>(new CommandDefinition($"""
                INSERT INTO dbo.SYS_ProcessDef
                  (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder
                   {(hasCat ? ", Category" : "")}{(hasCfg ? ", TriggerConfigJson" : "")})
                OUTPUT INSERTED.ProcessDefID
                VALUES
                  (@Code, @Name, @Description, 6, @Table, @Table, 1, 80
                   {(hasCat ? ", N'Integration'" : "")}{(hasCfg ? ", @Cfg" : "")})
                """, new { Code = "AKTARIM_" + profileId, Name = title, Description = Describe(minutes), Table = table, Cfg = cfg }, cancellationToken: ct));
        }

        if (!on) return processId;
        var stepId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT TOP 1 ProcessStepID FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @id ORDER BY StepNo",
            new { id = processId }, cancellationToken: ct));
        if (stepId is > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition($"""
                UPDATE dbo.SYS_ProcessStep
                SET Title = @Title, ActionType = N'Transfer', IsActive = 1
                    {(hasNode ? ", NodeType = N'ImportRun', ConfigJson = @Cfg" : "")}
                WHERE ProcessStepID = @id
                """, new { Title = title, Cfg = cfg, id = stepId }, cancellationToken: ct));
        }
        else
        {
            await _db.ExecuteAsync(new CommandDefinition($"""
                INSERT INTO dbo.SYS_ProcessStep
                  (ProcessDefID, StepNo, Code, Title, ActionType, IsActive{(hasNode ? ", NodeType, ConfigJson" : "")})
                VALUES (@Def, 1, N'AKTAR', @Title, N'Transfer', 1{(hasNode ? ", N'ImportRun', @Cfg" : "")})
                """, new { Def = processId, Title = title, Cfg = cfg }, cancellationToken: ct));
        }
        return processId;
    }

    private static string Describe(int? minutes) =>
        minutes is >= 5 ? $"Veri aktarımı her {minutes} dakikada çalışır." : "Veri aktarımı elle çalışır.";

    private static void ValidateSource(ProcessSourceRequest req)
    {
        if (req.SourceType == 3)
        {
            if (string.IsNullOrWhiteSpace(req.ApiUrl)) throw new InvalidOperationException("API adresi yazın.");
            return;
        }
        var sql = req.Sql?.Trim() ?? "";
        if (!ProcessContextData.IsSafeSelect(sql))
            throw new InvalidOperationException("Yalnızca tek bir SELECT yazılabilir.");
        if (req.SourceType is 1 or 2 && string.IsNullOrWhiteSpace(req.Server))
            throw new InvalidOperationException("Sunucu yazın.");
    }

    private static ImportPullResult ToSheet(List<Dictionary<string, object?>> rows)
    {
        var headers = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
            foreach (var key in row.Keys)
                if (seen.Add(key)) headers.Add(key);
        var sheet = new ImportPullResult { Headers = headers };
        foreach (var row in rows)
        {
            var line = new List<string>(headers.Count);
            foreach (var h in headers)
                line.Add(TryGet(row, h, out var v) ? Cell(v) ?? "" : "");
            sheet.Rows.Add(line);
        }
        return sheet;
    }

    private static bool TryGet(IDictionary<string, object?> row, string key, out object? value)
    {
        if (row.TryGetValue(key, out value)) return true;
        foreach (var kv in row)
        {
            if (!kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase)) continue;
            value = kv.Value;
            return true;
        }
        value = null;
        return false;
    }

    private static string? Cell(object? v) => v switch
    {
        null => null,
        DateTime d => d.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
        bool b => b ? "true" : "false",
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => v.ToString(),
    };

    private static string? ReadPassword(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var src = JsonSerializer.Deserialize<ProcessSourceRequest>(json, Json);
            return src?.Password;
        }
        catch
        {
            return null;
        }
    }

    private static ImportProfileDto ToDto(ProfileRow row, bool mask)
    {
        var source = new ProcessSourceRequest { SourceType = row.SourceKind };
        if (!string.IsNullOrWhiteSpace(row.SourceJson))
        {
            try { source = JsonSerializer.Deserialize<ProcessSourceRequest>(row.SourceJson, Json) ?? source; }
            catch { /* bozuk json */ }
        }
        var hasPassword = !string.IsNullOrEmpty(source.Password);
        if (mask) source.Password = null;
        List<ImportMapItem> map = new();
        if (!string.IsNullOrWhiteSpace(row.MapJson))
        {
            try { map = JsonSerializer.Deserialize<List<ImportMapItem>>(row.MapJson, Json) ?? new(); }
            catch { /* boş eşleme */ }
        }
        return new ImportProfileDto
        {
            ImportProfileID = row.ImportProfileID,
            Title = row.Title,
            Kind = row.Kind,
            SourceKind = row.SourceKind,
            Source = source,
            Map = map,
            Mode = row.Mode,
            CreateMissingCards = row.CreateMissingCards,
            ProductType = row.ProductType,
            IntervalMinutes = row.IntervalMinutes,
            IsActive = row.IsActive,
            ProcessDefID = row.ProcessDefID,
            LastRunAt = row.LastRunAt,
            NextRunAt = row.NextRunAt,
            LastStatus = row.LastStatus,
            AfterSql = row.AfterSql,
            KeepLog = row.KeepLog,
            HasPassword = hasPassword,
        };
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private async Task<bool> TableAsync(CancellationToken ct)
    {
        Open();
        var id = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.SYS_ImportProfile', N'U')", cancellationToken: ct));
        return id is not null;
    }

    private async Task<bool> ProcessTableAsync(CancellationToken ct)
    {
        var id = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT OBJECT_ID(N'dbo.SYS_ProcessDef', N'U')", cancellationToken: ct));
        return id is not null;
    }

    private async Task<bool> ColAsync(string table, string col, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + table, c = col }, cancellationToken: ct));
        return n == 1;
    }

    private sealed class ProfileRow
    {
        public int ImportProfileID { get; set; }
        public string Title { get; set; } = "";
        public string Kind { get; set; } = "";
        public int SourceKind { get; set; }
        public string? SourceJson { get; set; }
        public string? MapJson { get; set; }
        public string Mode { get; set; } = "upsert";
        public bool CreateMissingCards { get; set; }
        public int? ProductType { get; set; }
        public int? IntervalMinutes { get; set; }
        public bool IsActive { get; set; }
        public int? ProcessDefID { get; set; }
        public string? AfterSql { get; set; }
        public bool KeepLog { get; set; } = true;
        public DateTime? LastRunAt { get; set; }
        public DateTime? NextRunAt { get; set; }
        public string? LastStatus { get; set; }
    }
}
