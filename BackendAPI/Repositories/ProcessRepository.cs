using System.Data;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

public sealed class ProcessDefDto
{
    public int ProcessDefID { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public byte TriggerType { get; set; }
    public string? SourceTable { get; set; }
    public string? TargetTable { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public string? Category { get; set; }
    public string? TriggerConfigJson { get; set; }
    public List<ProcessStepDto> Steps { get; set; } = new();
}

public sealed class ProcessStepDto
{
    public int ProcessStepID { get; set; }
    public int ProcessDefID { get; set; }
    public int StepNo { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public int? ApproverRoleId { get; set; }
    public int? ApproverUserId { get; set; }
    public string ActionType { get; set; } = "Approve";
    public string NodeType { get; set; } = "TaskForm";
    public string? ConfigJson { get; set; }
    public int? NextStepOnOk { get; set; }
    public int? NextStepOnFail { get; set; }
    public bool IsActive { get; set; }
    public string? ApproverRoleName { get; set; }
}

public sealed class ProcessTriggerStartRequest
{
    public byte TriggerType { get; set; }
    public string SourceTable { get; set; } = "";
    public int SourceId { get; set; }
    public string? TargetTable { get; set; }
    public int? TargetId { get; set; }
    public string? Title { get; set; }
    public int? StartedBy { get; set; }
    /// <summary>Eşleme için ek alanlar: docKind, direction, typeFilter, formCode</summary>
    public Dictionary<string, string?>? Context { get; set; }
}

public sealed class ProcessInstanceDto
{
    public int ProcessInstanceID { get; set; }
    public int ProcessDefID { get; set; }
    public string ProcessCode { get; set; } = "";
    public string ProcessName { get; set; } = "";
    public string Status { get; set; } = "";
    public string SourceTable { get; set; } = "";
    public int SourceId { get; set; }
    public string? TargetTable { get; set; }
    public int? TargetId { get; set; }
    public string? Title { get; set; }
    public int CurrentStepNo { get; set; }
    public int? StartedBy { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? LastComment { get; set; }
    /// <summary>Ortak nesne: belge, cari, adres, satir.</summary>
    public string? DataJson { get; set; }
}

public sealed class ProcessTaskDto
{
    public int ProcessTaskID { get; set; }
    public int ProcessInstanceID { get; set; }
    public int ProcessStepID { get; set; }
    public string Status { get; set; } = "";
    public int? AssignedRoleId { get; set; }
    public int? AssignedUserId { get; set; }
    public int? ClaimedBy { get; set; }
    public DateTime? DueAt { get; set; }
    public int? CompletedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? StepTitle { get; set; }
    public string? StepCode { get; set; }
    public string? ActionType { get; set; }
    public string? ProcessCode { get; set; }
    public string? ProcessName { get; set; }
    public string? InstanceTitle { get; set; }
    public string? InstanceStatus { get; set; }
    public string? SourceTable { get; set; }
    public int? SourceId { get; set; }
    public string? TargetTable { get; set; }
    public int? TargetId { get; set; }
    public bool HasPdf { get; set; }
    public string? DocumentNo { get; set; }
    public string? CustomerTitle { get; set; }
    public decimal? Amount { get; set; }
}

public sealed class ProcessScanResult
{
    public int Started { get; set; }
    public int Skipped { get; set; }
    public List<string> Messages { get; set; } = new();
}

public sealed class ProcessStartRequest
{
    public string ProcessCode { get; set; } = "";
    public string SourceTable { get; set; } = "";
    public int SourceId { get; set; }
    public string? TargetTable { get; set; }
    public int? TargetId { get; set; }
    public string? Title { get; set; }
    public int? StartedBy { get; set; }
    /// <summary>Hazır nesne. Boşsa kaynak kayıttan üretilir.</summary>
    public string? DataJson { get; set; }
}

public sealed class ProcessTaskActionRequest
{
    public int UserId { get; set; }
    public string? Comment { get; set; }
}

public sealed class TalepTransferRequest
{
    public int TalepOrderVoucherId { get; set; }
    public int? StartedBy { get; set; }
    public string? Comment { get; set; }
    public bool RequireApproval { get; set; } = true;
}

public sealed class EgovLinkRequest
{
    public int EGovDocumentId { get; set; }
    public int OrderVoucherId { get; set; }
    public int? StartedBy { get; set; }
    public string? Comment { get; set; }
    public bool StartProcess { get; set; } = true;
}

public sealed class ProcessDocLinkDto
{
    public int ProcessDocLinkID { get; set; }
    public int? ProcessInstanceID { get; set; }
    public string LinkType { get; set; } = "";
    public string FromTable { get; set; } = "";
    public int FromId { get; set; }
    public string ToTable { get; set; } = "";
    public int ToId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class ProcessRepository
{
    private readonly IDbConnection _db;

    public ProcessRepository(IDbConnection db) => _db = db;

    private void EnsureOpen()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private async Task EnsureTablesAsync(CancellationToken ct)
    {
        EnsureOpen();
        var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct));
        if (exists == 0)
            throw new InvalidOperationException(
                "Süreç tabloları yok. Sistem → Veritabanı Güncelleme ile 67_process_management.sql uygulayın.");
    }

    private async Task<bool> ColExistsAsync(string table, string col, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}", c = col }, cancellationToken: ct));
        return n == 1;
    }

    public async Task<IReadOnlyList<ProcessDefDto>> ListDefsAsync(bool includeInactive, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var hasCat = await ColExistsAsync("SYS_ProcessDef", "Category", ct);
        var hasCfg = await ColExistsAsync("SYS_ProcessDef", "TriggerConfigJson", ct);
        var hasNode = await ColExistsAsync("SYS_ProcessStep", "NodeType", ct);

        var defSql = $"""
            SELECT ProcessDefID, Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder
              {(hasCat ? ", Category" : ", CAST(NULL AS NVARCHAR(40)) AS Category")}
              {(hasCfg ? ", TriggerConfigJson" : ", CAST(NULL AS NVARCHAR(MAX)) AS TriggerConfigJson")}
            FROM dbo.SYS_ProcessDef
            WHERE (@all = 1 OR IsActive = 1)
            ORDER BY SortOrder, ProcessDefID
            """;

        var defs = (await _db.QueryAsync<ProcessDefDto>(new CommandDefinition(
            defSql, new { all = includeInactive ? 1 : 0 }, cancellationToken: ct))).ToList();

        if (defs.Count == 0) return defs;

        var stepSql = $"""
            SELECT s.ProcessStepID, s.ProcessDefID, s.StepNo, s.Code, s.Title,
                   s.ApproverRoleId, s.ApproverUserId, s.ActionType, s.IsActive,
                   r.Name AS ApproverRoleName
                   {(hasNode ? ", s.NodeType, s.ConfigJson, s.NextStepOnOk, s.NextStepOnFail" : ", N'TaskForm' AS NodeType, CAST(NULL AS NVARCHAR(MAX)) AS ConfigJson, CAST(NULL AS INT) AS NextStepOnOk, CAST(NULL AS INT) AS NextStepOnFail")}
            FROM dbo.SYS_ProcessStep s
            LEFT JOIN dbo.SYS_Role r ON r.Id = s.ApproverRoleId
            WHERE s.ProcessDefID IN @ids
            ORDER BY s.ProcessDefID, s.StepNo
            """;

        var steps = (await _db.QueryAsync<ProcessStepDto>(new CommandDefinition(
            stepSql, new { ids = defs.Select(d => d.ProcessDefID).ToArray() }, cancellationToken: ct))).ToList();

        foreach (var d in defs)
            d.Steps = steps.Where(s => s.ProcessDefID == d.ProcessDefID).ToList();
        return defs;
    }

    public async Task<ProcessDefDto?> GetDefAsync(int id, CancellationToken ct)
    {
        var all = await ListDefsAsync(true, ct);
        return all.FirstOrDefault(d => d.ProcessDefID == id);
    }

    public async Task<ProcessDefDto> SaveDefAsync(ProcessDefDto dto, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var code = (dto.Code ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code)) throw new InvalidOperationException("Süreç kodu zorunlu.");
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new InvalidOperationException("Süreç adı zorunlu.");

        var hasCfg = await ColumnExistsAsync("SYS_ProcessDef", "TriggerConfigJson", ct);
        var hasCat = await ColumnExistsAsync("SYS_ProcessDef", "Category", ct);
        var hasNode = await ColumnExistsAsync("SYS_ProcessStep", "NodeType", ct);

        if (dto.ProcessDefID <= 0)
        {
            dto.ProcessDefID = await _db.ExecuteScalarAsync<int>(new CommandDefinition($"""
                INSERT INTO dbo.SYS_ProcessDef
                  (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder
                   {(hasCat ? ", Category" : "")}{(hasCfg ? ", TriggerConfigJson" : "")})
                OUTPUT INSERTED.ProcessDefID
                VALUES
                  (@Code, @Name, @Description, @TriggerType, @SourceTable, @TargetTable, @IsActive, @SortOrder
                   {(hasCat ? ", @Category" : "")}{(hasCfg ? ", @TriggerConfigJson" : "")})
                """, new
            {
                Code = code,
                dto.Name,
                dto.Description,
                dto.TriggerType,
                dto.SourceTable,
                dto.TargetTable,
                dto.IsActive,
                dto.SortOrder,
                dto.Category,
                dto.TriggerConfigJson
            }, cancellationToken: ct));
        }
        else
        {
            await _db.ExecuteAsync(new CommandDefinition($"""
                UPDATE dbo.SYS_ProcessDef
                SET Code = @Code, Name = @Name, Description = @Description, TriggerType = @TriggerType,
                    SourceTable = @SourceTable, TargetTable = @TargetTable, IsActive = @IsActive,
                    SortOrder = @SortOrder, UpdatedAt = SYSUTCDATETIME()
                    {(hasCat ? ", Category = @Category" : "")}
                    {(hasCfg ? ", TriggerConfigJson = @TriggerConfigJson" : "")}
                WHERE ProcessDefID = @ProcessDefID
                """, new
            {
                dto.ProcessDefID,
                Code = code,
                dto.Name,
                dto.Description,
                dto.TriggerType,
                dto.SourceTable,
                dto.TargetTable,
                dto.IsActive,
                dto.SortOrder,
                dto.Category,
                dto.TriggerConfigJson
            }, cancellationToken: ct));
        }

        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @id",
            new { id = dto.ProcessDefID }, cancellationToken: ct));

        var stepNo = 1;
        foreach (var s in dto.Steps.OrderBy(x => x.StepNo).ThenBy(x => x.Code))
        {
            if (!s.IsActive && string.IsNullOrWhiteSpace(s.Title)) continue;
            var node = string.IsNullOrWhiteSpace(s.NodeType) ? "TaskForm" : s.NodeType.Trim();
            var action = string.IsNullOrWhiteSpace(s.ActionType)
                ? (node is "Link" or "Transfer" or "Review" ? node : "Approve")
                : s.ActionType;
            if (hasNode)
            {
                await _db.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO dbo.SYS_ProcessStep
                      (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ApproverUserId, ActionType, IsActive,
                       NodeType, ConfigJson, NextStepOnOk, NextStepOnFail)
                    VALUES
                      (@ProcessDefID, @StepNo, @Code, @Title, @ApproverRoleId, @ApproverUserId, @ActionType, @IsActive,
                       @NodeType, @ConfigJson, @NextStepOnOk, @NextStepOnFail)
                    """, new
                {
                    ProcessDefID = dto.ProcessDefID,
                    StepNo = stepNo++,
                    Code = string.IsNullOrWhiteSpace(s.Code) ? $"STEP{stepNo}" : s.Code.Trim().ToUpperInvariant(),
                    Title = string.IsNullOrWhiteSpace(s.Title) ? $"Adım {stepNo - 1}" : s.Title.Trim(),
                    s.ApproverRoleId,
                    s.ApproverUserId,
                    ActionType = action,
                    IsActive = s.IsActive,
                    NodeType = node,
                    s.ConfigJson,
                    s.NextStepOnOk,
                    s.NextStepOnFail
                }, cancellationToken: ct));
            }
            else
            {
                await _db.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO dbo.SYS_ProcessStep
                      (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ApproverUserId, ActionType, IsActive)
                    VALUES
                      (@ProcessDefID, @StepNo, @Code, @Title, @ApproverRoleId, @ApproverUserId, @ActionType, @IsActive)
                    """, new
                {
                    ProcessDefID = dto.ProcessDefID,
                    StepNo = stepNo++,
                    Code = string.IsNullOrWhiteSpace(s.Code) ? $"STEP{stepNo}" : s.Code.Trim().ToUpperInvariant(),
                    Title = string.IsNullOrWhiteSpace(s.Title) ? $"Adım {stepNo - 1}" : s.Title.Trim(),
                    s.ApproverRoleId,
                    s.ApproverUserId,
                    ActionType = action,
                    IsActive = s.IsActive
                }, cancellationToken: ct));
            }
        }

        return (await GetDefAsync(dto.ProcessDefID, ct))!;
    }

    /// <summary>Tanımı, adımlarını, örneklerini ve onay görevlerini siler.</summary>
    public async Task DeleteDefAsync(int id, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        if (id <= 0) throw new InvalidOperationException("Süreç seçilmedi.");
        var exists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(1) FROM dbo.SYS_ProcessDef WHERE ProcessDefID = @id",
            new { id }, cancellationToken: ct));
        if (exists == 0) throw new InvalidOperationException("Süreç bulunamadı.");

        var instanceIds = (await _db.QueryAsync<int>(new CommandDefinition(
            "SELECT ProcessInstanceID FROM dbo.SYS_ProcessInstance WHERE ProcessDefID = @id",
            new { id }, cancellationToken: ct))).ToList();

        if (instanceIds.Count > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.SYS_ProcessTask WHERE ProcessInstanceID IN @ids",
                new { ids = instanceIds }, cancellationToken: ct));
            if (await TableExistsAsync("SYS_ProcessDocLink", ct))
            {
                await _db.ExecuteAsync(new CommandDefinition(
                    "UPDATE dbo.SYS_ProcessDocLink SET ProcessInstanceID = NULL WHERE ProcessInstanceID IN @ids",
                    new { ids = instanceIds }, cancellationToken: ct));
            }
            await _db.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.SYS_ProcessInstance WHERE ProcessDefID = @id",
                new { id }, cancellationToken: ct));
        }

        await _db.ExecuteAsync(new CommandDefinition("""
            DELETE t FROM dbo.SYS_ProcessTask t
            INNER JOIN dbo.SYS_ProcessStep s ON s.ProcessStepID = t.ProcessStepID
            WHERE s.ProcessDefID = @id
            """, new { id }, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @id",
            new { id }, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_ProcessDef WHERE ProcessDefID = @id",
            new { id }, cancellationToken: ct));
    }

    /// <summary>
    /// Tetik tipine + SourceTable + TriggerConfigJson bağlamına uyan aktif süreçleri başlatır.
    /// </summary>
    public async Task<IReadOnlyList<ProcessInstanceDto>> StartByTriggerAsync(ProcessTriggerStartRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var defs = await ListDefsAsync(false, ct);
        var matched = defs.Where(d =>
        {
            if (d.TriggerType != req.TriggerType) return false;
            if (!string.IsNullOrWhiteSpace(d.SourceTable)
                && !string.IsNullOrWhiteSpace(req.SourceTable)
                && !d.SourceTable.Equals(req.SourceTable, StringComparison.OrdinalIgnoreCase))
                return false;
            return MatchTriggerConfig(d.TriggerConfigJson, req.Context);
        }).ToList();

        var started = new List<ProcessInstanceDto>();
        foreach (var d in matched)
        {
            // Aynı kaynakta açık süreç varsa tekrar başlatma
            var open = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT COUNT(1) FROM dbo.SYS_ProcessInstance
                WHERE ProcessDefID = @defId AND SourceTable = @tbl AND SourceId = @id
                  AND Status IN (N'Pending', N'InProgress')
                """, new { defId = d.ProcessDefID, tbl = req.SourceTable, id = req.SourceId },
                cancellationToken: ct));
            if (open > 0) continue;

            var inst = await StartAsync(new ProcessStartRequest
            {
                ProcessCode = d.Code,
                SourceTable = req.SourceTable,
                SourceId = req.SourceId,
                TargetTable = req.TargetTable ?? d.TargetTable,
                TargetId = req.TargetId,
                Title = string.IsNullOrWhiteSpace(req.Title) ? $"{d.Name} · {req.SourceTable}#{req.SourceId}" : req.Title,
                StartedBy = req.StartedBy
            }, ct);
            started.Add(inst);
        }
        return started;
    }

    /// <summary>DB tarama SELECT'ini çalıştırır. Her satır aynı nesneyle bir süreç başlatır.</summary>
    public async Task<ProcessScanResult> RunDbScansAsync(int? processDefId, int? startedBy, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var result = new ProcessScanResult();
        var defs = (await ListDefsAsync(false, ct))
            .Where(d => processDefId is null or 0 || d.ProcessDefID == processDefId)
            .ToList();
        foreach (var def in defs)
        {
            ScanPlan? plan;
            List<IDictionary<string, object?>> rows;
            var bankStep = def.Steps.FirstOrDefault(s =>
                string.Equals(s.NodeType, "BankFetch", StringComparison.OrdinalIgnoreCase));
            var external = bankStep is null ? ExternalOf(def) : null;
            if (bankStep != null)
            {
                plan = ReadPlan(bankStep.ConfigJson);
                try
                {
                    var req = JsonSerializer.Deserialize<ProcessBank.Request>(bankStep.ConfigJson ?? "{}",
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new ProcessBank.Request();
                    var pull = await ProcessBank.PullAsync(_db, req, ct);
                    rows = pull.Rows.Cast<IDictionary<string, object?>>().ToList();
                    foreach (var message in pull.Messages)
                        result.Messages.Add($"{def.Code}: {message}");
                }
                catch (Exception ex)
                {
                    result.Messages.Add($"{def.Code}: {ex.Message}");
                    continue;
                }
            }
            else if (external != null)
            {
                plan = external.Plan;
                try
                {
                    rows = (await ProcessSource.RowsAsync(external.Request, ct))
                        .Cast<IDictionary<string, object?>>()
                        .ToList();
                }
                catch (Exception ex)
                {
                    result.Messages.Add($"{def.Code}: {ex.Message}");
                    continue;
                }
            }
            else
            {
                plan = ScanPlanOf(def);
                if (plan is null || string.IsNullOrWhiteSpace(plan.Sql)) continue;
                if (!ProcessContextData.IsSafeSelect(plan.Sql))
                {
                    result.Messages.Add($"{def.Code}: yalnız tek bir SELECT yazılabilir.");
                    continue;
                }
                try
                {
                    var raw = await _db.QueryAsync(new CommandDefinition(
                        ProcessContextData.WrapDerived(plan.Sql, "scan_q", 200), cancellationToken: ct));
                    rows = raw.Select(r => (IDictionary<string, object?>)ToNullableDict(r)).ToList();
                }
                catch (Exception ex)
                {
                    result.Messages.Add($"{def.Code}: {ex.Message}");
                    continue;
                }
            }
            foreach (var group in GroupScanRows(rows, plan))
            {
                var draft = await ProcessContextData.BuildAsync(_db, null, 0, group.Header, ct, group.Lines, plan.TableName);
                var (table, id) = ProcessContextData.SourceOf(group.Header, draft);
                var open = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
                    SELECT COUNT(1) FROM dbo.SYS_ProcessInstance
                    WHERE ProcessDefID = @defId AND SourceTable = @tbl AND SourceId = @id
                      AND Status IN (N'Pending', N'InProgress')
                    """, new { defId = def.ProcessDefID, tbl = table, id }, cancellationToken: ct));
                if (open > 0)
                {
                    result.Skipped++;
                    continue;
                }
                var json = await ProcessContextData.BuildAsync(_db, table, id, group.Header, ct, group.Lines, plan.TableName);
                await StartAsync(new ProcessStartRequest
                {
                    ProcessCode = def.Code,
                    SourceTable = table,
                    SourceId = id,
                    TargetTable = def.TargetTable,
                    StartedBy = startedBy,
                    DataJson = json,
                    Title = ProcessContextData.TitleOf(json)
                }, ct);
                result.Started++;
            }
        }
        return result;
    }

    public Task<IReadOnlyList<string>> DescribeBankAsync(ProcessBank.Request req, CancellationToken ct)
    {
        EnsureOpen();
        return ProcessBank.ColumnsAsync(_db, req, ct);
    }

    public async Task<IReadOnlyList<string>> DescribeSelectAsync(string sql, CancellationToken ct)
    {
        if (!ProcessContextData.IsSafeSelect(sql))
            throw new InvalidOperationException("Yalnızca tek bir SELECT yazılabilir.");
        EnsureOpen();
        if (_db is not SqlConnection conn)
            throw new InvalidOperationException("Sorgu kolonları okunamadı.");
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = ProcessContextData.WrapDerived(sql, "scan_q", 0);
        cmd.CommandTimeout = 30;
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
        {
            var name = reader.GetName(i);
            if (string.IsNullOrWhiteSpace(name) || !seen.Add(name)) continue;
            names.Add(name);
        }
        return names;
    }

    private sealed class ScanPlan
    {
        public string Sql { get; init; } = "";
        public string TableName { get; init; } = "Satirlar";
        public List<(string Name, bool Table)> Columns { get; init; } = new();
    }

    private sealed class ScanGroup
    {
        public Dictionary<string, object?> Header { get; init; } = new();
        public List<IDictionary<string, object?>> Lines { get; init; } = new();
    }

    private static bool IsLocalFetch(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return true;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("sourceType", out var el)) return true;
            if (el.ValueKind == JsonValueKind.Number && el.TryGetInt32(out var n)) return n == 0;
            return true;
        }
        catch
        {
            return true;
        }
    }

    private static ScanPlan? ScanPlanOf(ProcessDefDto def)
    {
        if (def.TriggerType == 8 && TryScanPlan(def.TriggerConfigJson, out var fromTrigger))
            return fromTrigger;
        foreach (var step in def.Steps)
        {
            if (step.NodeType is "DbScan" or "DbScanLoop" && TryScanPlan(step.ConfigJson, out var fromStep))
                return fromStep;
            if (step.NodeType == "DataFetch" && IsLocalFetch(step.ConfigJson) && TryScanPlan(step.ConfigJson, out var fromFetch))
                return fromFetch;
        }
        return null;
    }

    private sealed class ExternalFetch
    {
        public ProcessSourceRequest Request { get; init; } = new();
        public ScanPlan Plan { get; init; } = new();
    }

    private static ExternalFetch? ExternalOf(ProcessDefDto def)
    {
        foreach (var step in def.Steps)
        {
            if (step.NodeType != "DataFetch" || IsLocalFetch(step.ConfigJson)) continue;
            ProcessSourceRequest? req;
            try
            {
                req = JsonSerializer.Deserialize<ProcessSourceRequest>(step.ConfigJson ?? "{}",
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch
            {
                continue;
            }
            if (req is null || req.SourceType is not (1 or 2 or 3)) continue;
            return new ExternalFetch { Request = req, Plan = ReadPlan(step.ConfigJson) };
        }
        return null;
    }

    private static ScanPlan ReadPlan(string? json)
    {
        ProcessContextData.TryReadSql(json, out var sql);
        var columns = new List<(string Name, bool Table)>();
        var tableName = "Satirlar";
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            if (doc.RootElement.TryGetProperty("tabloAdi", out var tn) && tn.ValueKind == JsonValueKind.String)
            {
                var name = tn.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(name)) tableName = name;
            }
            if (doc.RootElement.TryGetProperty("columns", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in arr.EnumerateArray())
                {
                    var name = el.TryGetProperty("name", out var n) ? n.GetString()?.Trim() : null;
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    var kind = el.TryGetProperty("kind", out var k) ? k.GetString() : "alan";
                    columns.Add((name, string.Equals(kind, "tablo", StringComparison.OrdinalIgnoreCase)));
                }
            }
        }
        catch
        {
            /* kolon listesi yoksa her satır ayrı süreç */
        }
        return new ScanPlan { Sql = sql, TableName = tableName, Columns = columns };
    }

    private static bool TryScanPlan(string? json, out ScanPlan plan)
    {
        plan = ReadPlan(json);
        return !string.IsNullOrWhiteSpace(plan.Sql);
    }

    private static List<ScanGroup> GroupScanRows(IReadOnlyList<IDictionary<string, object?>> rows, ScanPlan plan)
    {
        var tableCols = plan.Columns.Where(c => c.Table).Select(c => c.Name).ToList();
        if (tableCols.Count == 0)
        {
            return rows.Select(r => new ScanGroup
            {
                Header = new Dictionary<string, object?>(r, StringComparer.OrdinalIgnoreCase)
            }).ToList();
        }

        var headerCols = plan.Columns.Where(c => !c.Table).Select(c => c.Name).ToList();
        var groups = new List<ScanGroup>();
        var index = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var row in rows)
        {
            var key = string.Join("|", headerCols.Select(c => Convert.ToString(Val(row, c)) ?? ""));
            if (!index.TryGetValue(key, out var at))
            {
                var header = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                foreach (var c in headerCols)
                    header[c] = Val(row, c);
                foreach (var idName in new[] { "EGovDocumentID", "InvoiceID", "OrderVoucherID", "ProductVoucherID", "CustomerCardID", "ProductCardID" })
                {
                    if (row.TryGetValue(idName, out var idv)) header[idName] = idv;
                }
                groups.Add(new ScanGroup { Header = header });
                at = groups.Count - 1;
                index[key] = at;
            }
            var line = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var c in tableCols)
                line[c] = Val(row, c);
            groups[at].Lines.Add(line);
        }
        return groups;
    }

    private static object? Val(IDictionary<string, object?> row, string key)
    {
        if (row.TryGetValue(key, out var v)) return v;
        foreach (var kv in row)
        {
            if (kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase)) return kv.Value;
        }
        return null;
    }

    private static Dictionary<string, object?> ToNullableDict(object raw)
    {
        var map = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (raw is not IDictionary<string, object> src) return map;
        foreach (var kv in src)
            map[kv.Key] = kv.Value is DBNull ? null : kv.Value;
        return map;
    }

    private static bool MatchTriggerConfig(string? cfgJson, Dictionary<string, string?>? ctx)
    {
        if (string.IsNullOrWhiteSpace(cfgJson) || cfgJson.Trim() is "{}" or "null")
            return true;
        if (ctx is null || ctx.Count == 0) return true;

        try
        {
            using var doc = JsonDocument.Parse(cfgJson);
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (prop.Value.ValueKind is JsonValueKind.Null) continue;
                if (prop.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array) continue;
                if (prop.Name.Equals("sql", StringComparison.OrdinalIgnoreCase)
                    || prop.Name.Equals("columns", StringComparison.OrdinalIgnoreCase)
                    || prop.Name.Equals("tabloAdi", StringComparison.OrdinalIgnoreCase)
                    || prop.Name.Equals("ifade", StringComparison.OrdinalIgnoreCase))
                    continue;

                // typeFilter boş/null → her tip eşleşir
                if (prop.Name.Equals("typeFilter", StringComparison.OrdinalIgnoreCase)
                    && (prop.Value.ValueKind is JsonValueKind.Null
                        || (prop.Value.ValueKind is JsonValueKind.String
                            && string.IsNullOrWhiteSpace(prop.Value.GetString()))))
                    continue;

                if (!TryGetCtx(ctx, prop.Name, out var got))
                    return false;

                var want = prop.Value.ValueKind switch
                {
                    JsonValueKind.Number => prop.Value.ToString(),
                    JsonValueKind.String => prop.Value.GetString(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => prop.Value.ToString()
                };
                if (string.IsNullOrWhiteSpace(want)) continue;
                if (!string.Equals(want, got ?? "", StringComparison.OrdinalIgnoreCase))
                    return false;
            }
            return true;
        }
        catch
        {
            return true;
        }
    }

    private static bool TryGetCtx(Dictionary<string, string?> ctx, string key, out string? value)
    {
        if (ctx.TryGetValue(key, out value)) return true;
        foreach (var kv in ctx)
        {
            if (kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase))
            {
                value = kv.Value;
                return true;
            }
        }
        value = null;
        return false;
    }

    public async Task<IReadOnlyList<ProcessInstanceDto>> ListInstancesAsync(string? status, int take, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var hasData = await ColumnExistsAsync("SYS_ProcessInstance", "DataJson", ct);
        return (await _db.QueryAsync<ProcessInstanceDto>(new CommandDefinition($"""
            SELECT TOP (@take)
              i.ProcessInstanceID, i.ProcessDefID, d.Code AS ProcessCode, d.Name AS ProcessName,
              i.Status, i.SourceTable, i.SourceId, i.TargetTable, i.TargetId, i.Title,
              i.CurrentStepNo, i.StartedBy, i.StartedAt, i.CompletedAt, i.LastComment
              {(hasData ? ", i.DataJson" : ", CAST(NULL AS nvarchar(max)) AS DataJson")}
            FROM dbo.SYS_ProcessInstance i
            INNER JOIN dbo.SYS_ProcessDef d ON d.ProcessDefID = i.ProcessDefID
            WHERE (@status IS NULL OR i.Status = @status)
            ORDER BY i.StartedAt DESC
            """, new { status, take = Math.Clamp(take, 1, 500) }, cancellationToken: ct))).ToList();
    }

    public async Task<IReadOnlyList<ProcessTaskDto>> InboxAsync(int userId, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        var roleIds = (await _db.QueryAsync<int>(new CommandDefinition("""
            SELECT RoleId FROM dbo.SYS_UserRole WHERE SystemUserID = @userId
            """, new { userId }, cancellationToken: ct))).ToArray();

        var isAdmin = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT CASE WHEN EXISTS (
              SELECT 1 FROM dbo.SYS_UserRole ur
              INNER JOIN dbo.SYS_Role r ON r.Id = ur.RoleId
              WHERE ur.SystemUserID = @userId AND (r.IsAdmin = 1 OR r.Code = N'ADMIN')
            ) THEN 1 ELSE 0 END
            """, new { userId }, cancellationToken: ct));

        // Onay grupları (78_approval_groups.sql): gruba atanan görev yalnız grup üyelerine düşer
        var hasGroups = await ColumnExistsAsync("SYS_ProcessTask", "AssignedGroupId", ct)
            && await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ApprovalGroupMember', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 1;
        var groupFilter = hasGroups
            ? """
                OR (t.AssignedUserId IS NULL AND t.AssignedRoleId IS NULL AND t.AssignedGroupId IS NULL)
                OR (t.AssignedGroupId IS NOT NULL AND EXISTS (
                      SELECT 1 FROM dbo.SYS_ApprovalGroupMember m
                      WHERE m.ApprovalGroupID = t.AssignedGroupId AND m.SystemUserID = @userId))
              """
            : "OR (t.AssignedUserId IS NULL AND t.AssignedRoleId IS NULL)";

        var tasks = (await _db.QueryAsync<ProcessTaskDto>(new CommandDefinition($"""
            SELECT
              t.ProcessTaskID, t.ProcessInstanceID, t.ProcessStepID, t.Status,
              t.AssignedRoleId, t.AssignedUserId, t.ClaimedBy, t.DueAt,
              t.CompletedBy, t.CompletedAt, t.Comment, t.CreatedAt,
              s.Title AS StepTitle, s.Code AS StepCode, s.ActionType,
              d.Code AS ProcessCode, d.Name AS ProcessName,
              i.Title AS InstanceTitle, i.Status AS InstanceStatus,
              i.SourceTable, i.SourceId, i.TargetTable, i.TargetId
            FROM dbo.SYS_ProcessTask t
            INNER JOIN dbo.SYS_ProcessInstance i ON i.ProcessInstanceID = t.ProcessInstanceID
            INNER JOIN dbo.SYS_ProcessDef d ON d.ProcessDefID = i.ProcessDefID
            INNER JOIN dbo.SYS_ProcessStep s ON s.ProcessStepID = t.ProcessStepID
            WHERE t.Status = N'Pending'
              AND i.Status IN (N'Pending', N'InProgress')
              AND (
                @isAdmin = 1
                OR t.AssignedUserId = @userId
                {groupFilter}
                OR (t.AssignedRoleId IS NOT NULL AND t.AssignedRoleId IN @roleIds)
              )
            ORDER BY t.CreatedAt DESC
            """, new { userId, isAdmin, roleIds = roleIds.Length > 0 ? roleIds : new[] { -1 } },
            cancellationToken: ct))).ToList();

        foreach (var task in tasks.Where(t =>
                     string.Equals(t.SourceTable, "EGovDocument", StringComparison.OrdinalIgnoreCase)
                     && t.SourceId is > 0))
        {
            var meta = await _db.QueryFirstOrDefaultAsync<(int HasPdf, string? DocumentNo, string? CustomerTitle, decimal? Amount)>(
                new CommandDefinition("""
                    SELECT
                      CASE WHEN PdfContent IS NOT NULL THEN 1 ELSE 0 END AS HasPdf,
                      DocumentNo, CustomerTitle, Amount
                    FROM dbo.EGovDocument WHERE EGovDocumentID = @id
                    """, new { id = task.SourceId }, cancellationToken: ct));
            task.HasPdf = meta.HasPdf == 1;
            task.DocumentNo = meta.DocumentNo;
            task.CustomerTitle = meta.CustomerTitle;
            task.Amount = meta.Amount;
        }

        return tasks;
    }

    public async Task<ProcessInstanceDto> StartAsync(ProcessStartRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var code = (req.ProcessCode ?? "").Trim().ToUpperInvariant();
        var def = await _db.QueryFirstOrDefaultAsync<(int ProcessDefID, string Name)>(new CommandDefinition("""
            SELECT ProcessDefID, Name FROM dbo.SYS_ProcessDef WHERE Code = @code AND IsActive = 1
            """, new { code }, cancellationToken: ct));
        if (def.ProcessDefID == 0)
            throw new InvalidOperationException($"Aktif süreç bulunamadı: {code}");

        var steps = await LoadStepsAsync(def.ProcessDefID, ct);
        var firstStep = steps.FirstOrDefault()
            ?? throw new InvalidOperationException("Süreçte aktif adım yok.");

        var hasData = await ColumnExistsAsync("SYS_ProcessInstance", "DataJson", ct);
        string? dataJson = null;
        if (hasData)
        {
            dataJson = string.IsNullOrWhiteSpace(req.DataJson)
                ? await ProcessContextData.BuildAsync(_db, req.SourceTable, req.SourceId, null, ct)
                : req.DataJson;
        }
        var title = string.IsNullOrWhiteSpace(req.Title)
            ? ProcessContextData.TitleOf(dataJson ?? "") ?? $"{def.Name} · {req.SourceTable}#{req.SourceId}"
            : req.Title.Trim();

        var instanceId = await _db.ExecuteScalarAsync<int>(new CommandDefinition($"""
            INSERT INTO dbo.SYS_ProcessInstance
              (ProcessDefID, Status, SourceTable, SourceId, TargetTable, TargetId, Title, CurrentStepNo, StartedBy
               {(hasData ? ", DataJson" : "")})
            OUTPUT INSERTED.ProcessInstanceID
            VALUES
              (@ProcessDefID, N'InProgress', @SourceTable, @SourceId, @TargetTable, @TargetId, @Title, @StepNo, @StartedBy
               {(hasData ? ", @DataJson" : "")})
            """, new
        {
            ProcessDefID = def.ProcessDefID,
            req.SourceTable,
            req.SourceId,
            req.TargetTable,
            req.TargetId,
            Title = title,
            StepNo = firstStep.StepNo,
            req.StartedBy,
            DataJson = dataJson
        }, cancellationToken: ct));

        if (IsTerminate(firstStep))
        {
            await CompleteInstanceAsync(instanceId, "Approved", null, req.SourceTable, req.SourceId, ct);
        }
        else
        {
            await OpenTaskAsync(instanceId, firstStep, ct);
            await TouchSourceProcessAsync(req.SourceTable, req.SourceId, "InProgress", instanceId, ct);
        }

        var created = await _db.QueryFirstAsync<ProcessInstanceDto>(new CommandDefinition($"""
            SELECT
              i.ProcessInstanceID, i.ProcessDefID, d.Code AS ProcessCode, d.Name AS ProcessName,
              i.Status, i.SourceTable, i.SourceId, i.TargetTable, i.TargetId, i.Title,
              i.CurrentStepNo, i.StartedBy, i.StartedAt, i.CompletedAt, i.LastComment
              {(hasData ? ", i.DataJson" : ", CAST(NULL AS nvarchar(max)) AS DataJson")}
            FROM dbo.SYS_ProcessInstance i
            INNER JOIN dbo.SYS_ProcessDef d ON d.ProcessDefID = i.ProcessDefID
            WHERE i.ProcessInstanceID = @instanceId
            """, new { instanceId }, cancellationToken: ct));
        return created;
    }

    private async Task TouchSourceProcessAsync(string table, int id, string status, int? instanceId, CancellationToken ct)
    {
        if (string.Equals(table, "OrderVoucher", StringComparison.OrdinalIgnoreCase)
            && await ColumnExistsAsync("OrderVoucher", "ProcessStatus", ct))
        {
            await _db.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.OrderVoucher
                SET ProcessStatus = @status,
                    ProcessInstanceID = COALESCE(@instanceId, ProcessInstanceID)
                WHERE OrderVoucherID = @id
                """, new { status, instanceId, id }, cancellationToken: ct));
        }

        if (string.Equals(table, "EGovDocument", StringComparison.OrdinalIgnoreCase)
            && await ColumnExistsAsync("EGovDocument", "ProcessInstanceID", ct)
            && instanceId is > 0)
        {
            await _db.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.EGovDocument SET ProcessInstanceID = @instanceId WHERE EGovDocumentID = @id
                """, new { instanceId, id }, cancellationToken: ct));
        }
    }

    private async Task<bool> ColumnExistsAsync(string table, string column, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}", c = column }, cancellationToken: ct));
        return n == 1;
    }

    public async Task<ProcessTaskDto> ApproveTaskAsync(int taskId, ProcessTaskActionRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var task = await LoadTaskAsync(taskId, ct)
            ?? throw new InvalidOperationException("Görev bulunamadı.");
        if (!string.Equals(task.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Görev zaten sonuçlanmış.");

        await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.SYS_ProcessTask
            SET Status = N'Approved', CompletedBy = @userId, CompletedAt = SYSUTCDATETIME(),
                Comment = @comment, ClaimedBy = COALESCE(ClaimedBy, @userId)
            WHERE ProcessTaskID = @taskId
            """, new { taskId, userId = req.UserId, comment = req.Comment }, cancellationToken: ct));

        var header = await InstanceHeaderAsync(task.ProcessInstanceID, ct);
        var steps = await LoadStepsAsync(header.ProcessDefID, ct);
        var current = steps.FirstOrDefault(s => s.ProcessStepID == task.ProcessStepID);
        var next = ResolveNext(steps, current, ok: true);

        if (next is null || IsTerminate(next))
            await CompleteInstanceAsync(task.ProcessInstanceID, "Approved", req.Comment, header.SourceTable, header.SourceId, ct);
        else
            await OpenTaskAsync(task.ProcessInstanceID, next, ct, req.Comment);

        return (await LoadTaskAsync(taskId, ct))!;
    }

    public async Task<ProcessTaskDto> RejectTaskAsync(int taskId, ProcessTaskActionRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        var task = await LoadTaskAsync(taskId, ct)
            ?? throw new InvalidOperationException("Görev bulunamadı.");
        if (!string.Equals(task.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Görev zaten sonuçlanmış.");

        await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.SYS_ProcessTask
            SET Status = N'Rejected', CompletedBy = @userId, CompletedAt = SYSUTCDATETIME(),
                Comment = @comment, ClaimedBy = COALESCE(ClaimedBy, @userId)
            WHERE ProcessTaskID = @taskId
            """, new { taskId, userId = req.UserId, comment = req.Comment }, cancellationToken: ct));

        var header = await InstanceHeaderAsync(task.ProcessInstanceID, ct);
        var steps = await LoadStepsAsync(header.ProcessDefID, ct);
        var current = steps.FirstOrDefault(s => s.ProcessStepID == task.ProcessStepID);
        var next = ResolveNext(steps, current, ok: false);

        if (next is null)
            await CompleteInstanceAsync(task.ProcessInstanceID, "Rejected", req.Comment, header.SourceTable, header.SourceId, ct);
        else if (IsTerminate(next))
            await CompleteInstanceAsync(task.ProcessInstanceID, "Approved", req.Comment, header.SourceTable, header.SourceId, ct);
        else
            await OpenTaskAsync(task.ProcessInstanceID, next, ct, req.Comment);

        return (await LoadTaskAsync(taskId, ct))!;
    }

    /// <summary>NextStepOnOk/Fail adım numarasıdır. Onayda boş = sıradaki, 0 = bitir. Redde boş = süreci reddet.</summary>
    private static ProcessStepDto? ResolveNext(IReadOnlyList<ProcessStepDto> steps, ProcessStepDto? current, bool ok)
    {
        if (current is null) return null;
        var link = ok ? current.NextStepOnOk : current.NextStepOnFail;
        if (!ok && link is null or 0) return null;
        if (ok && link is 0) return null;
        if (ok && link is null)
            return steps.Where(s => s.StepNo > current.StepNo).OrderBy(s => s.StepNo).FirstOrDefault();
        if (link is > 0)
        {
            var target = steps.FirstOrDefault(s => s.StepNo == link)
                ?? throw new InvalidOperationException($"Sonraki adım bulunamadı (adım no {link}).");
            if (target.ProcessStepID == current.ProcessStepID)
                throw new InvalidOperationException("Adım kendine bağlanamaz.");
            return target;
        }
        return null;
    }

    private static bool IsTerminate(ProcessStepDto step) =>
        string.Equals(step.NodeType, "Terminate", StringComparison.OrdinalIgnoreCase);

    private async Task<(int ProcessDefID, string SourceTable, int SourceId)> InstanceHeaderAsync(int instanceId, CancellationToken ct)
    {
        return await _db.QueryFirstAsync<(int ProcessDefID, string SourceTable, int SourceId)>(new CommandDefinition("""
            SELECT ProcessDefID, SourceTable, SourceId
            FROM dbo.SYS_ProcessInstance WHERE ProcessInstanceID = @id
            """, new { id = instanceId }, cancellationToken: ct));
    }

    private async Task<List<ProcessStepDto>> LoadStepsAsync(int processDefId, CancellationToken ct)
    {
        var hasNode = await ColumnExistsAsync("SYS_ProcessStep", "NodeType", ct);
        var sql = hasNode
            ? """
              SELECT ProcessStepID, ProcessDefID, StepNo, Code, Title, ApproverRoleId, ApproverUserId,
                     ActionType, IsActive, NodeType, ConfigJson, NextStepOnOk, NextStepOnFail
              FROM dbo.SYS_ProcessStep
              WHERE ProcessDefID = @id AND IsActive = 1
              ORDER BY StepNo
              """
            : """
              SELECT ProcessStepID, ProcessDefID, StepNo, Code, Title, ApproverRoleId, ApproverUserId,
                     ActionType, IsActive, N'TaskForm' AS NodeType, CAST(NULL AS nvarchar(max)) AS ConfigJson,
                     CAST(NULL AS int) AS NextStepOnOk, CAST(NULL AS int) AS NextStepOnFail
              FROM dbo.SYS_ProcessStep
              WHERE ProcessDefID = @id AND IsActive = 1
              ORDER BY StepNo
              """;
        var rows = await _db.QueryAsync<ProcessStepDto>(new CommandDefinition(sql, new { id = processDefId }, cancellationToken: ct));
        return rows.ToList();
    }

    private async Task OpenTaskAsync(int instanceId, ProcessStepDto step, CancellationToken ct, string? comment = null)
    {
        await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.SYS_ProcessInstance
            SET Status = N'InProgress', CurrentStepNo = @stepNo, LastComment = COALESCE(@comment, LastComment)
            WHERE ProcessInstanceID = @iid
            """, new { iid = instanceId, stepNo = step.StepNo, comment }, cancellationToken: ct));

        await _db.ExecuteAsync(new CommandDefinition("""
            INSERT INTO dbo.SYS_ProcessTask
              (ProcessInstanceID, ProcessStepID, Status, AssignedRoleId, AssignedUserId)
            VALUES
              (@iid, @stepId, N'Pending', @roleId, @userId)
            """, new
        {
            iid = instanceId,
            stepId = step.ProcessStepID,
            roleId = step.ApproverRoleId,
            userId = step.ApproverUserId
        }, cancellationToken: ct));
    }

    private async Task CompleteInstanceAsync(
        int instanceId, string status, string? comment, string sourceTable, int sourceId, CancellationToken ct)
    {
        await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.SYS_ProcessInstance
            SET Status = @status, CompletedAt = SYSUTCDATETIME(), LastComment = COALESCE(@comment, LastComment)
            WHERE ProcessInstanceID = @iid
            """, new { iid = instanceId, status, comment }, cancellationToken: ct));
        await TouchSourceProcessAsync(sourceTable, sourceId, status, instanceId, ct);
    }

    private async Task<ProcessTaskDto?> LoadTaskAsync(int taskId, CancellationToken ct)
    {
        return await _db.QueryFirstOrDefaultAsync<ProcessTaskDto>(new CommandDefinition("""
            SELECT
              t.ProcessTaskID, t.ProcessInstanceID, t.ProcessStepID, t.Status,
              t.AssignedRoleId, t.AssignedUserId, t.ClaimedBy, t.DueAt,
              t.CompletedBy, t.CompletedAt, t.Comment, t.CreatedAt,
              s.Title AS StepTitle, s.Code AS StepCode, s.ActionType,
              d.Code AS ProcessCode, d.Name AS ProcessName,
              i.Title AS InstanceTitle, i.Status AS InstanceStatus,
              i.SourceTable, i.SourceId, i.TargetTable, i.TargetId
            FROM dbo.SYS_ProcessTask t
            INNER JOIN dbo.SYS_ProcessInstance i ON i.ProcessInstanceID = t.ProcessInstanceID
            INNER JOIN dbo.SYS_ProcessDef d ON d.ProcessDefID = i.ProcessDefID
            INNER JOIN dbo.SYS_ProcessStep s ON s.ProcessStepID = t.ProcessStepID
            WHERE t.ProcessTaskID = @taskId
            """, new { taskId }, cancellationToken: ct));
    }

    /// <summary>
    /// Talebi (Type_ 5/6) siparişe (Type_ 2/1) kopyalar, bağ kaydı oluşturur, onay sürecini başlatır.
    /// </summary>
    public async Task<object> TransferTalepAsync(TalepTransferRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        EnsureOpen();

        var talep = await _db.QueryFirstOrDefaultAsync<dynamic>(new CommandDefinition("""
            SELECT TOP 1 * FROM dbo.OrderVoucher WHERE OrderVoucherID = @id
            """, new { id = req.TalepOrderVoucherId }, cancellationToken: ct));
        if (talep is null)
            throw new InvalidOperationException("Talep bulunamadı.");

        var dict = (IDictionary<string, object>)talep;
        var typeObj = dict.Keys.FirstOrDefault(k => k.Equals("Type_", StringComparison.OrdinalIgnoreCase));
        var typeVal = typeObj is null ? null : dict[typeObj]?.ToString();
        // 5 Alış Talep → 2 Alış · 6 Satış Talep → 1 Satış
        var targetType = typeVal switch
        {
            "5" => "2",
            "6" => "1",
            _ => throw new InvalidOperationException("Yalnızca alış/satış talebi siparişe aktarılabilir (Type_ 5 veya 6).")
        };

        using var tx = _db.BeginTransaction();
        try
        {
            // Identity PK varsa — Create_DB'de OrderVoucherID NOT NULL ama IDENTITY olmayabilir; MAX+1 kullan
            var hasIdentity = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT CASE WHEN COLUMNPROPERTY(OBJECT_ID(N'dbo.OrderVoucher'), N'OrderVoucherID', 'IsIdentity') = 1 THEN 1 ELSE 0 END
                """, transaction: tx, cancellationToken: ct));

            int newId;
            if (hasIdentity == 1)
            {
                newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
                    INSERT INTO dbo.OrderVoucher (Type_, ProcessStatus, SourceOrderVoucherID)
                    OUTPUT INSERTED.OrderVoucherID
                    VALUES (@type, N'InProgress', @src)
                    """, new { type = targetType, src = req.TalepOrderVoucherId }, transaction: tx, cancellationToken: ct));
            }
            else
            {
                newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
                    SELECT ISNULL(MAX(OrderVoucherID), 0) + 1 FROM dbo.OrderVoucher
                    """, transaction: tx, cancellationToken: ct));
                await _db.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO dbo.OrderVoucher (OrderVoucherID, Type_, ProcessStatus, SourceOrderVoucherID)
                    VALUES (@id, @type, N'InProgress', @src)
                    """, new { id = newId, type = targetType, src = req.TalepOrderVoucherId },
                    transaction: tx, cancellationToken: ct));
            }

            // Ortak kolonları kopyala (PK / tip / kaynak / süreç hariç)
            var cols = (await _db.QueryAsync<string>(new CommandDefinition("""
                SELECT c.name
                FROM sys.columns c
                WHERE c.object_id = OBJECT_ID(N'dbo.OrderVoucher')
                  AND c.is_identity = 0
                  AND c.name NOT IN (N'OrderVoucherID', N'Type_', N'SourceOrderVoucherID', N'ProcessStatus', N'ProcessInstanceID')
                """, transaction: tx, cancellationToken: ct))).ToList();

            if (cols.Count > 0)
            {
                var setList = string.Join(", ", cols.Select(c => $"t.[{c}] = s.[{c}]"));
                await _db.ExecuteAsync(new CommandDefinition($"""
                    UPDATE t SET {setList}
                    FROM dbo.OrderVoucher t
                    INNER JOIN dbo.OrderVoucher s ON s.OrderVoucherID = @src
                    WHERE t.OrderVoucherID = @dst
                    """, new { src = req.TalepOrderVoucherId, dst = newId }, transaction: tx, cancellationToken: ct));
            }

            if (await TableExistsAsync("OrderTrans", ct))
            {
                var lineCols = (await _db.QueryAsync<string>(new CommandDefinition("""
                    SELECT c.name FROM sys.columns c
                    WHERE c.object_id = OBJECT_ID(N'dbo.OrderTrans')
                      AND c.is_identity = 0
                      AND c.name NOT IN (N'OrderTransID', N'OrderVoucherID', N'OrderSlipID')
                    """, transaction: tx, cancellationToken: ct))).ToList();

                var hasOvFk = lineCols.Contains("OrderVoucherID", StringComparer.OrdinalIgnoreCase)
                    || await ColumnExistsTxAsync("OrderTrans", "OrderVoucherID", tx, ct);
                var hasSlip = await ColumnExistsTxAsync("OrderTrans", "OrderSlipID", tx, ct);
                var hasLineId = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
                    SELECT CASE WHEN COLUMNPROPERTY(OBJECT_ID(N'dbo.OrderTrans'), N'OrderTransID', 'IsIdentity') = 1 THEN 1 ELSE 0 END
                    """, transaction: tx, cancellationToken: ct));

                var copyCols = (await _db.QueryAsync<string>(new CommandDefinition("""
                    SELECT c.name FROM sys.columns c
                    WHERE c.object_id = OBJECT_ID(N'dbo.OrderTrans')
                      AND c.is_identity = 0
                      AND c.name NOT IN (N'OrderTransID', N'OrderVoucherID', N'OrderSlipID')
                    """, transaction: tx, cancellationToken: ct))).ToList();

                if (copyCols.Count > 0)
                {
                    var colList = string.Join(", ", copyCols.Select(c => $"[{c}]"));
                    var parentCols = new List<string>();
                    if (hasOvFk || await ColumnExistsTxAsync("OrderTrans", "OrderVoucherID", tx, ct))
                        parentCols.Add("OrderVoucherID");
                    if (hasSlip)
                        parentCols.Add("OrderSlipID");

                    var insertParents = parentCols.Count > 0 ? string.Join(", ", parentCols.Select(c => $"[{c}]")) + ", " : "";
                    var selectParents = parentCols.Count > 0
                        ? string.Join(", ", parentCols.Select(_ => "@dst")) + ", "
                        : "";

                    var whereParent = hasOvFk || await ColumnExistsTxAsync("OrderTrans", "OrderVoucherID", tx, ct)
                        ? "(OrderVoucherID = @src OR OrderSlipID = @src)"
                        : "OrderSlipID = @src";

                    if (hasLineId == 1)
                    {
                        await _db.ExecuteAsync(new CommandDefinition($"""
                            INSERT INTO dbo.OrderTrans ({insertParents}{colList})
                            SELECT {selectParents}{colList}
                            FROM dbo.OrderTrans
                            WHERE {whereParent}
                            """, new { src = req.TalepOrderVoucherId, dst = newId },
                            transaction: tx, cancellationToken: ct));
                    }
                    else
                    {
                        await _db.ExecuteAsync(new CommandDefinition($"""
                            INSERT INTO dbo.OrderTrans (OrderTransID, {insertParents}{colList})
                            SELECT
                              (SELECT ISNULL(MAX(OrderTransID), 0) FROM dbo.OrderTrans) + ROW_NUMBER() OVER (ORDER BY (SELECT 1)),
                              {selectParents}{colList}
                            FROM dbo.OrderTrans
                            WHERE {whereParent}
                            """, new { src = req.TalepOrderVoucherId, dst = newId },
                            transaction: tx, cancellationToken: ct));
                    }
                }
            }

            await _db.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.OrderVoucher SET ProcessStatus = N'Transferred' WHERE OrderVoucherID = @src
                """, new { src = req.TalepOrderVoucherId }, transaction: tx, cancellationToken: ct));

            await _db.ExecuteAsync(new CommandDefinition("""
                INSERT INTO dbo.SYS_ProcessDocLink
                  (LinkType, FromTable, FromId, ToTable, ToId, Note, CreatedBy)
                VALUES
                  (N'TalepToOrder', N'OrderVoucher', @src, N'OrderVoucher', @dst, @note, @by)
                """, new
            {
                src = req.TalepOrderVoucherId,
                dst = newId,
                note = req.Comment,
                by = req.StartedBy
            }, transaction: tx, cancellationToken: ct));

            tx.Commit();

            ProcessInstanceDto? instance = null;
            if (req.RequireApproval)
            {
                instance = await StartAsync(new ProcessStartRequest
                {
                    ProcessCode = "TALEP_TO_ORDER",
                    SourceTable = "OrderVoucher",
                    SourceId = req.TalepOrderVoucherId,
                    TargetTable = "OrderVoucher",
                    TargetId = newId,
                    Title = $"Talep #{req.TalepOrderVoucherId} → Sipariş #{newId}",
                    StartedBy = req.StartedBy
                }, ct);

                await _db.ExecuteAsync(new CommandDefinition("""
                    UPDATE dbo.SYS_ProcessDocLink
                    SET ProcessInstanceID = @iid
                    WHERE FromTable = N'OrderVoucher' AND FromId = @src AND ToId = @dst AND LinkType = N'TalepToOrder'
                      AND ProcessInstanceID IS NULL
                    """, new { iid = instance.ProcessInstanceID, src = req.TalepOrderVoucherId, dst = newId },
                    cancellationToken: ct));
            }

            return new { ok = true, orderVoucherId = newId, processInstance = instance };
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task<object> LinkEgovAsync(EgovLinkRequest req, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);

        var doc = await _db.QueryFirstOrDefaultAsync<(int EGovDocumentID, byte DocKind, string? DocumentNo)>(
            new CommandDefinition("""
                SELECT EGovDocumentID, DocKind, DocumentNo
                FROM dbo.EGovDocument WHERE EGovDocumentID = @id
                """, new { id = req.EGovDocumentId }, cancellationToken: ct));
        if (doc.EGovDocumentID == 0)
            throw new InvalidOperationException("e-Belge bulunamadı.");

        var orderExists = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.OrderVoucher WHERE OrderVoucherID = @id) THEN 1 ELSE 0 END",
            new { id = req.OrderVoucherId }, cancellationToken: ct));
        if (orderExists == 0)
            throw new InvalidOperationException("Sipariş/talep bulunamadı.");

        await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.EGovDocument SET OrderVoucherID = @oid WHERE EGovDocumentID = @eid
            """, new { oid = req.OrderVoucherId, eid = req.EGovDocumentId }, cancellationToken: ct));

        var linkType = doc.DocKind == 3 ? "EGovToOrder" : "EGovToOrder";
        var processCode = doc.DocKind == 3 ? "EGOV_EIRSALIYE_LINK" : "EGOV_EFATURA_LINK";

        await _db.ExecuteAsync(new CommandDefinition("""
            INSERT INTO dbo.SYS_ProcessDocLink
              (LinkType, FromTable, FromId, ToTable, ToId, Note, CreatedBy)
            VALUES
              (@linkType, N'EGovDocument', @eid, N'OrderVoucher', @oid, @note, @by)
            """, new
        {
            linkType,
            eid = req.EGovDocumentId,
            oid = req.OrderVoucherId,
            note = req.Comment,
            by = req.StartedBy
        }, cancellationToken: ct));

        ProcessInstanceDto? instance = null;
        if (req.StartProcess)
        {
            instance = await StartAsync(new ProcessStartRequest
            {
                ProcessCode = processCode,
                SourceTable = "EGovDocument",
                SourceId = req.EGovDocumentId,
                TargetTable = "OrderVoucher",
                TargetId = req.OrderVoucherId,
                Title = $"{(doc.DocKind == 3 ? "e-İrsaliye" : "e-Fatura")} {doc.DocumentNo} → Sipariş/Talep #{req.OrderVoucherId}",
                StartedBy = req.StartedBy
            }, ct);

            await _db.ExecuteAsync(new CommandDefinition("""
                UPDATE dbo.SYS_ProcessDocLink
                SET ProcessInstanceID = @iid
                WHERE FromTable = N'EGovDocument' AND FromId = @eid AND ToId = @oid
                  AND ProcessInstanceID IS NULL
                """, new { iid = instance.ProcessInstanceID, eid = req.EGovDocumentId, oid = req.OrderVoucherId },
                cancellationToken: ct));
        }

        return new { ok = true, processInstance = instance };
    }

    public async Task SaveEgovPdfAsync(int egovId, byte[] content, string fileName, string contentType, CancellationToken ct)
    {
        EnsureOpen();
        if (!await ColumnExistsAsync("EGovDocument", "PdfContent", ct))
            throw new InvalidOperationException(
                "PdfContent kolonu yok. 67_process_management.sql uygulayın.");

        var n = await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.EGovDocument
            SET PdfContent = @content, PdfFileName = @fileName, PdfContentType = @contentType,
                PdfStoredAt = SYSUTCDATETIME()
            WHERE EGovDocumentID = @egovId
            """, new { egovId, content, fileName, contentType }, cancellationToken: ct));
        if (n == 0) throw new InvalidOperationException("e-Belge bulunamadı.");
    }

    public async Task<(byte[] Content, string FileName, string ContentType)?> GetEgovPdfAsync(int egovId, CancellationToken ct)
    {
        EnsureOpen();
        if (!await ColumnExistsAsync("EGovDocument", "PdfContent", ct))
            return null;

        var row = await _db.QueryFirstOrDefaultAsync<(byte[]? PdfContent, string? PdfFileName, string? PdfContentType)>(
            new CommandDefinition("""
                SELECT PdfContent, PdfFileName, PdfContentType
                FROM dbo.EGovDocument WHERE EGovDocumentID = @egovId
                """, new { egovId }, cancellationToken: ct));
        if (row.PdfContent is null || row.PdfContent.Length == 0) return null;
        return (row.PdfContent, row.PdfFileName ?? $"egov-{egovId}.pdf", row.PdfContentType ?? "application/pdf");
    }

    public async Task<IReadOnlyList<ProcessDocLinkDto>> ListLinksAsync(string? table, int? id, CancellationToken ct)
    {
        await EnsureTablesAsync(ct);
        return (await _db.QueryAsync<ProcessDocLinkDto>(new CommandDefinition("""
            SELECT TOP 200 ProcessDocLinkID, ProcessInstanceID, LinkType, FromTable, FromId, ToTable, ToId, Note, CreatedAt
            FROM dbo.SYS_ProcessDocLink
            WHERE (@table IS NULL OR FromTable = @table OR ToTable = @table)
              AND (@id IS NULL OR FromId = @id OR ToId = @id)
            ORDER BY CreatedAt DESC
            """, new { table, id }, cancellationToken: ct))).ToList();
    }

    private async Task<bool> TableExistsAsync(string table, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}" }, cancellationToken: ct));
        return n == 1;
    }

    private async Task<bool> ColumnExistsTxAsync(string table, string column, IDbTransaction tx, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN COL_LENGTH(@t, @c) IS NULL THEN 0 ELSE 1 END",
            new { t = $"dbo.{table}", c = column }, transaction: tx, cancellationToken: ct));
        return n == 1;
    }
}
