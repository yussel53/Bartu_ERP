using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class ApprovalGroupMemberDto
{
    public int SystemUserID { get; set; }
    public string? NickName { get; set; }
    public string? FullName { get; set; }
}

public sealed class ApprovalGroupDto
{
    public int ApprovalGroupID { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public int OpenTaskCount { get; set; }
    public List<ApprovalGroupMemberDto> Members { get; set; } = new();
}

public sealed class ApprovalGroupInput
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 10;
    public List<int> MemberUserIds { get; set; } = new();
}

public sealed class SystemUserOption
{
    public int SystemUserID { get; set; }
    public string? NickName { get; set; }
    public string? FullName { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// Onay grupları — SYS_ApprovalGroup + SYS_ApprovalGroupMember (SqlUpdates/78_approval_groups.sql).
/// Bir onay görevi gruba atanırsa (SYS_ProcessTask.AssignedGroupId) grubun herhangi bir üyesi sonuçlandırır.
/// </summary>
public sealed class ApprovalGroupRepository
{
    public const string MissingTableMessage =
        "Onay grubu tabloları yok — Veritabanı Güncelleme ekranından 78_approval_groups.sql uygulayın.";

    private readonly IDbConnection _db;

    public ApprovalGroupRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_ApprovalGroup', N'U') IS NOT NULL
                         AND OBJECT_ID(N'dbo.SYS_ApprovalGroupMember', N'U') IS NOT NULL
                         AND COL_LENGTH(N'dbo.SYS_ProcessTask', N'AssignedGroupId') IS NOT NULL
                        THEN 1 ELSE 0 END
            """, cancellationToken: ct)) == 1;
    }

    public async Task<List<ApprovalGroupDto>> ListAsync(bool activeOnly, CancellationToken ct = default)
    {
        Open();
        var groups = (await _db.QueryAsync<ApprovalGroupDto>(new CommandDefinition(
            """
            SELECT g.ApprovalGroupID, g.Code, g.Name, g.Description, g.IsDefault, g.IsActive, g.SortOrder,
                   (SELECT COUNT(*) FROM dbo.SYS_ProcessTask t
                    WHERE t.AssignedGroupId = g.ApprovalGroupID AND t.Status = N'Pending') AS OpenTaskCount
            FROM dbo.SYS_ApprovalGroup g
            WHERE @activeOnly = 0 OR g.IsActive = 1
            ORDER BY g.SortOrder, g.Name
            """, new { activeOnly }, cancellationToken: ct))).ToList();
        if (groups.Count == 0) return groups;

        var members = await _db.QueryAsync<(int GroupId, int UserId, string? NickName, string? FullName)>(new CommandDefinition(
            """
            SELECT m.ApprovalGroupID, m.SystemUserID, u.NickName,
                   LTRIM(RTRIM(CONCAT(u.Name, N' ', u.Surname))) AS FullName
            FROM dbo.SYS_ApprovalGroupMember m
            LEFT JOIN dbo.SystemUser u ON u.SystemUserID = m.SystemUserID
            ORDER BY FullName
            """, cancellationToken: ct));
        var byGroup = groups.ToDictionary(g => g.ApprovalGroupID);
        foreach (var m in members)
        {
            if (byGroup.TryGetValue(m.GroupId, out var g))
                g.Members.Add(new ApprovalGroupMemberDto { SystemUserID = m.UserId, NickName = m.NickName, FullName = m.FullName });
        }
        return groups;
    }

    public async Task<List<SystemUserOption>> ListUsersAsync(CancellationToken ct = default)
    {
        Open();
        return (await _db.QueryAsync<SystemUserOption>(new CommandDefinition(
            """
            SELECT SystemUserID, NickName, LTRIM(RTRIM(CONCAT(Name, N' ', Surname))) AS FullName, IsActive
            FROM dbo.SystemUser
            ORDER BY IsActive DESC, Name, Surname
            """, cancellationToken: ct))).ToList();
    }

    public async Task<string?> ValidateAsync(ApprovalGroupInput g, int exceptId, CancellationToken ct = default)
    {
        g.Code = (g.Code ?? "").Trim().ToUpperInvariant();
        g.Name = (g.Name ?? "").Trim();
        if (g.Code.Length is 0 or > 40) return "Kod zorunlu (en fazla 40 karakter).";
        if (g.Name.Length is 0 or > 150) return "Ad zorunlu (en fazla 150 karakter).";
        if (g.IsActive && g.MemberUserIds.Count == 0) return "Aktif grupta en az bir üye olmalı.";
        Open();
        var dup = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.SYS_ApprovalGroup WHERE Code = @Code AND ApprovalGroupID <> @exceptId",
            new { g.Code, exceptId }, cancellationToken: ct));
        if (dup > 0) return $"«{g.Code}» kodlu grup zaten var.";
        return null;
    }

    public async Task<int> SaveAsync(int id, ApprovalGroupInput g, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        if (id == 0)
        {
            id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_ApprovalGroup (Code, Name, Description, IsActive, SortOrder)
                VALUES (@Code, @Name, @Description, @IsActive, @SortOrder);
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """, new { g.Code, g.Name, Description = g.Description?.Trim(), g.IsActive, g.SortOrder }, tx, cancellationToken: ct));
        }
        else
        {
            // Pasife alınan grup varsayılan kalamaz
            await _db.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.SYS_ApprovalGroup
                SET Code = @Code, Name = @Name, Description = @Description, IsActive = @IsActive, SortOrder = @SortOrder,
                    IsDefault = CASE WHEN @IsActive = 1 THEN IsDefault ELSE 0 END, UpdatedAt = SYSDATETIME()
                WHERE ApprovalGroupID = @id
                """, new { id, g.Code, g.Name, Description = g.Description?.Trim(), g.IsActive, g.SortOrder }, tx, cancellationToken: ct));
        }

        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_ApprovalGroupMember WHERE ApprovalGroupID = @id",
            new { id }, tx, cancellationToken: ct));
        foreach (var userId in g.MemberUserIds.Distinct())
        {
            await _db.ExecuteAsync(new CommandDefinition(
                "INSERT INTO dbo.SYS_ApprovalGroupMember (ApprovalGroupID, SystemUserID) VALUES (@id, @userId)",
                new { id, userId }, tx, cancellationToken: ct));
        }
        tx.Commit();
        return id;
    }

    public async Task<(bool Ok, string Message)> SetDefaultAsync(int id, CancellationToken ct = default)
    {
        var (usable, _, error) = await CheckUsableAsync(id, ct);
        if (!usable) return (false, $"{error} Varsayılan yapılamaz.");
        using var tx = _db.BeginTransaction();
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_ApprovalGroup SET IsDefault = 0 WHERE IsDefault = 1 AND ApprovalGroupID <> @id",
            new { id }, tx, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_ApprovalGroup SET IsDefault = 1, UpdatedAt = SYSDATETIME() WHERE ApprovalGroupID = @id",
            new { id }, tx, cancellationToken: ct));
        tx.Commit();
        return (true, "Varsayılan onay grubu ayarlandı.");
    }

    /// <summary>Bekleyen görevi olan grup silinmez (pasife alınabilir).</summary>
    public async Task<(bool Ok, string Message)> DeleteAsync(int id, CancellationToken ct = default)
    {
        Open();
        var open = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.SYS_ProcessTask WHERE AssignedGroupId = @id AND Status = N'Pending'",
            new { id }, cancellationToken: ct));
        if (open > 0) return (false, $"Bu grupta {open} bekleyen onay var — önce sonuçlanmalı ya da grubu pasife alın.");
        var n = await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_ApprovalGroup WHERE ApprovalGroupID = @id", new { id }, cancellationToken: ct));
        return n > 0 ? (true, "Onay grubu silindi.") : (false, $"Grup #{id} bulunamadı.");
    }

    /// <summary>Gönderimde kullanılabilir mi: aktif ve en az bir üyesi var.</summary>
    public async Task<(bool Ok, string? Name, string? Error)> CheckUsableAsync(int id, CancellationToken ct = default)
    {
        Open();
        var g = await _db.QueryFirstOrDefaultAsync<GroupCheck>(new CommandDefinition(
            """
            SELECT g.Name, g.IsActive,
                   (SELECT COUNT(*) FROM dbo.SYS_ApprovalGroupMember m WHERE m.ApprovalGroupID = g.ApprovalGroupID) AS MemberCount
            FROM dbo.SYS_ApprovalGroup g WHERE g.ApprovalGroupID = @id
            """, new { id }, cancellationToken: ct));
        if (g is null) return (false, null, "Onay grubu bulunamadı.");
        if (!g.IsActive) return (false, g.Name, $"«{g.Name}» grubu pasif.");
        if (g.MemberCount == 0) return (false, g.Name, $"«{g.Name}» grubunda üye yok.");
        return (true, g.Name, null);
    }

    private sealed class GroupCheck
    {
        public string Name { get; set; } = "";
        public bool IsActive { get; set; }
        public int MemberCount { get; set; }
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
