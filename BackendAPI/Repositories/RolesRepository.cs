using System.Data;
using System.Text.Json;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class RoleDto
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; } = true;
    public string? AuthConfigJson { get; set; }
    public int SortOrder { get; set; } = 10;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int UserCount { get; set; }
}

public sealed class RoleSaveDto
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsActive { get; set; } = true;
    public string? AuthConfigJson { get; set; }
    public int SortOrder { get; set; } = 10;
}

public sealed class UserRoleAssignmentDto
{
    public int SystemUserId { get; set; }
    public string? NickName { get; set; }
    public string? DisplayName { get; set; }
    public List<int> RoleIds { get; set; } = new();
    public List<RoleDto> Roles { get; set; } = new();
}

public sealed class UserRolesSaveDto
{
    public List<int> RoleIds { get; set; } = new();
}

public sealed class EffectiveAuthDto
{
    public int SystemUserId { get; set; }
    public bool IsAdmin { get; set; }
    public List<RoleDto> Roles { get; set; } = new();
    /// <summary>Birleştirilmiş AuthConfig (roller OR).</summary>
    public string AuthConfigJson { get; set; } = "{}";
}

public sealed class RolesRepository
{
    private readonly IDbConnection _db;

    public RolesRepository(IDbConnection db)
    {
        _db = db;
    }

    private void EnsureOpen()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public static async Task EnsureTableAsync(IDbConnection db, CancellationToken ct = default)
    {
        const string sql = """
            IF OBJECT_ID(N'dbo.SYS_Role', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_Role (
                Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_Role2 PRIMARY KEY,
                Code            NVARCHAR(40)  NOT NULL,
                Name            NVARCHAR(150) NOT NULL,
                Description     NVARCHAR(500) NULL,
                IsAdmin         BIT NOT NULL CONSTRAINT DF_SYS_Role_IsAdmin2 DEFAULT (0),
                IsActive        BIT NOT NULL CONSTRAINT DF_SYS_Role_IsActive2 DEFAULT (1),
                AuthConfigJson  NVARCHAR(MAX) NULL,
                SortOrder       INT NOT NULL CONSTRAINT DF_SYS_Role_Sort2 DEFAULT (10),
                CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_SYS_Role_CreatedAt2 DEFAULT (SYSUTCDATETIME()),
                UpdatedAt       DATETIME2 NULL,
                CONSTRAINT UQ_SYS_Role_Code2 UNIQUE (Code)
              );
            END

            IF OBJECT_ID(N'dbo.SYS_UserRole', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_UserRole (
                Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_UserRole2 PRIMARY KEY,
                SystemUserID  INT NOT NULL,
                RoleId        INT NOT NULL,
                CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_SYS_UserRole_CreatedAt2 DEFAULT (SYSUTCDATETIME()),
                CONSTRAINT UQ_SYS_UserRole_UserRole2 UNIQUE (SystemUserID, RoleId)
              );
            END

            IF OBJECT_ID(N'dbo.SYS_SqlReportRoleAuth', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_SqlReportRoleAuth (
                Id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportRoleAuth2 PRIMARY KEY,
                ReportId   INT NOT NULL,
                RoleId     INT NOT NULL,
                CanView    BIT NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_View2 DEFAULT (1),
                CanRun     BIT NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_Run2 DEFAULT (1),
                CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_CreatedAt2 DEFAULT (SYSUTCDATETIME()),
                CONSTRAINT UQ_SYS_SqlReportRoleAuth2 UNIQUE (ReportId, RoleId)
              );
            END

            IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'ADMIN')
              INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
              VALUES (N'ADMIN', N'Sistem Yöneticisi', N'Tüm yetkiler', 1, 1, N'{"isAdmin":true}', 1);
            IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'MUHASEBE')
              INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
              VALUES (N'MUHASEBE', N'Muhasebe', N'Finans / muhasebe işlemleri', 0, 1, N'{"isAdmin":false}', 10);
            IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'SATIS')
              INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
              VALUES (N'SATIS', N'Satış', N'Satış / malzeme işlemleri', 0, 1, N'{"isAdmin":false}', 20);
            """;
        await db.ExecuteAsync(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<RoleDto>> ListAsync(CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var rows = await _db.QueryAsync<RoleDto>(new CommandDefinition(
            """
            SELECT r.Id, r.Code, r.Name, r.Description, r.IsAdmin, r.IsActive,
                   r.AuthConfigJson, r.SortOrder, r.CreatedAt, r.UpdatedAt,
                   (SELECT COUNT(1) FROM dbo.SYS_UserRole ur WHERE ur.RoleId = r.Id) AS UserCount
            FROM dbo.SYS_Role r
            ORDER BY r.SortOrder, r.Name
            """,
            cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<RoleDto?> GetAsync(int id, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        return await _db.QueryFirstOrDefaultAsync<RoleDto>(new CommandDefinition(
            """
            SELECT r.Id, r.Code, r.Name, r.Description, r.IsAdmin, r.IsActive,
                   r.AuthConfigJson, r.SortOrder, r.CreatedAt, r.UpdatedAt,
                   (SELECT COUNT(1) FROM dbo.SYS_UserRole ur WHERE ur.RoleId = r.Id) AS UserCount
            FROM dbo.SYS_Role r
            WHERE r.Id = @id
            """,
            new { id },
            cancellationToken: ct));
    }

    public async Task<RoleDto> UpsertAsync(int? id, RoleSaveDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
            throw new InvalidOperationException("Rol kodu zorunlu.");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("Rol adı zorunlu.");

        var code = dto.Code.Trim().ToUpperInvariant();
        var name = dto.Name.Trim();
        EnsureOpen();
        await EnsureTableAsync(_db, ct);

        var authJson = NormalizeAuthJson(dto.AuthConfigJson, dto.IsAdmin);

        if (id is null or <= 0)
        {
            var newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
                OUTPUT INSERTED.Id
                VALUES (@Code, @Name, @Description, @IsAdmin, @IsActive, @AuthConfigJson, @SortOrder)
                """,
                new
                {
                    Code = code,
                    Name = name,
                    dto.Description,
                    dto.IsAdmin,
                    dto.IsActive,
                    AuthConfigJson = authJson,
                    dto.SortOrder,
                },
                cancellationToken: ct));
            return (await GetAsync(newId, ct))!;
        }

        var affected = await _db.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.SYS_Role SET
              Code = @Code,
              Name = @Name,
              Description = @Description,
              IsAdmin = @IsAdmin,
              IsActive = @IsActive,
              AuthConfigJson = @AuthConfigJson,
              SortOrder = @SortOrder,
              UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @Id
            """,
            new
            {
                Id = id.Value,
                Code = code,
                Name = name,
                dto.Description,
                dto.IsAdmin,
                dto.IsActive,
                AuthConfigJson = authJson,
                dto.SortOrder,
            },
            cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("Rol bulunamadı.");

        return (await GetAsync(id.Value, ct))!;
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var role = await GetAsync(id, ct) ?? throw new InvalidOperationException("Rol bulunamadı.");
        if (role.Code.Equals("ADMIN", StringComparison.OrdinalIgnoreCase) && role.IsAdmin)
            throw new InvalidOperationException("ADMIN rolü silinemez.");

        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportRoleAuth WHERE RoleId = @id",
            new { id }, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_UserRole WHERE RoleId = @id",
            new { id }, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_Role WHERE Id = @id",
            new { id }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<int>> GetUserRoleIdsAsync(int systemUserId, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var ids = await _db.QueryAsync<int>(new CommandDefinition(
            """
            SELECT ur.RoleId
            FROM dbo.SYS_UserRole ur
            INNER JOIN dbo.SYS_Role r ON r.Id = ur.RoleId AND r.IsActive = 1
            WHERE ur.SystemUserID = @systemUserId
            """,
            new { systemUserId },
            cancellationToken: ct));
        return ids.AsList();
    }

    public async Task<UserRoleAssignmentDto> GetUserRolesAsync(int systemUserId, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var roleIds = await GetUserRoleIdsAsync(systemUserId, ct);
        var all = await ListAsync(ct);
        var roles = all.Where(r => roleIds.Contains(r.Id)).ToList();

        string? nick = null, name = null, surname = null;
        if (await TableExistsAsync("SystemUser", ct))
        {
            var user = await _db.QueryFirstOrDefaultAsync<dynamic>(new CommandDefinition(
                """
                SELECT TOP 1 NickName, Name, Surname
                FROM dbo.SystemUser
                WHERE SystemUserID = @id
                """,
                new { id = systemUserId },
                cancellationToken: ct));

            if (user != null)
            {
                nick = (string?)user.NickName;
                name = (string?)user.Name;
                surname = (string?)user.Surname;
            }
        }

        var display = $"{name} {surname}".Trim();
        if (string.IsNullOrWhiteSpace(display)) display = nick ?? $"#{systemUserId}";
        else if (!string.IsNullOrWhiteSpace(nick)) display = $"{display} ({nick})";

        return new UserRoleAssignmentDto
        {
            SystemUserId = systemUserId,
            NickName = nick,
            DisplayName = display,
            RoleIds = roleIds.ToList(),
            Roles = roles,
        };
    }

    public async Task<UserRoleAssignmentDto> SaveUserRolesAsync(
        int systemUserId,
        UserRolesSaveDto dto,
        CancellationToken ct = default)
    {
        if (systemUserId <= 0)
            throw new InvalidOperationException("Geçersiz kullanıcı.");

        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var wanted = (dto.RoleIds ?? new()).Where(x => x > 0).Distinct().ToList();

        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_UserRole WHERE SystemUserID = @systemUserId",
            new { systemUserId },
            cancellationToken: ct));

        foreach (var roleId in wanted)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_UserRole (SystemUserID, RoleId)
                SELECT @systemUserId, @roleId
                WHERE EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Id = @roleId)
                """,
                new { systemUserId, roleId },
                cancellationToken: ct));
        }

        return await GetUserRolesAsync(systemUserId, ct);
    }

    public async Task<EffectiveAuthDto> GetEffectiveAuthAsync(int systemUserId, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var assignment = await GetUserRolesAsync(systemUserId, ct);
        var roles = assignment.Roles.Where(r => r.IsActive).ToList();
        var isAdmin = roles.Any(r => r.IsAdmin);

        return new EffectiveAuthDto
        {
            SystemUserId = systemUserId,
            IsAdmin = isAdmin,
            Roles = roles,
            AuthConfigJson = MergeAuthConfigs(roles, isAdmin),
        };
    }

    public async Task<IReadOnlyList<int>> ListUserIdsInRolesAsync(
        IEnumerable<int> roleIds,
        CancellationToken ct = default)
    {
        var ids = roleIds.Where(x => x > 0).Distinct().ToList();
        if (ids.Count == 0) return Array.Empty<int>();
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var users = await _db.QueryAsync<int>(new CommandDefinition(
            """
            SELECT DISTINCT SystemUserID
            FROM dbo.SYS_UserRole
            WHERE RoleId IN @ids
            """,
            new { ids },
            cancellationToken: ct));
        return users.AsList();
    }

    private async Task<bool> TableExistsAsync(string name, CancellationToken ct)
    {
        var n = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(@name, N'U') IS NULL THEN 0 ELSE 1 END",
            new { name = $"dbo.{name}" },
            cancellationToken: ct));
        return n == 1;
    }

    private static string NormalizeAuthJson(string? raw, bool isAdmin)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return isAdmin ? """{"isAdmin":true}""" : """{"isAdmin":false}""";
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return isAdmin ? """{"isAdmin":true}""" : """{"isAdmin":false}""";
            return raw.Trim();
        }
        catch
        {
            return isAdmin ? """{"isAdmin":true}""" : """{"isAdmin":false}""";
        }
    }

    private static string MergeAuthConfigs(List<RoleDto> roles, bool isAdmin)
    {
        if (isAdmin) return """{"isAdmin":true}""";
        if (roles.Count == 0) return """{"isAdmin":false,"screens":{},"fields":{}}""";

        using var outDoc = JsonDocument.Parse("""{"isAdmin":false,"screens":{},"fields":{},"companyScopes":[]}""");
        var screens = new Dictionary<string, Dictionary<string, bool>>(StringComparer.OrdinalIgnoreCase);
        var fields = new Dictionary<string, Dictionary<string, bool>>(StringComparer.OrdinalIgnoreCase);
        var scopesByCompany = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        string? authCode = null;

        foreach (var role in roles)
        {
            if (string.IsNullOrWhiteSpace(role.AuthConfigJson)) continue;
            try
            {
                using var doc = JsonDocument.Parse(role.AuthConfigJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("isAdmin", out var ia) && ia.ValueKind == JsonValueKind.True)
                    return """{"isAdmin":true}""";

                if (root.TryGetProperty("screens", out var scr) && scr.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in scr.EnumerateObject())
                    {
                        if (!screens.TryGetValue(prop.Name, out var flags))
                        {
                            flags = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
                            {
                                ["view"] = false, ["create"] = false, ["update"] = false, ["delete"] = false,
                            };
                            screens[prop.Name] = flags;
                        }
                        OrBool(flags, prop.Value, "view");
                        OrBool(flags, prop.Value, "create");
                        OrBool(flags, prop.Value, "update");
                        OrBool(flags, prop.Value, "delete");
                    }
                }

                if (root.TryGetProperty("fields", out var fld) && fld.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in fld.EnumerateObject())
                    {
                        if (!fields.TryGetValue(prop.Name, out var flags))
                        {
                            flags = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
                            {
                                ["canView"] = false, ["canEdit"] = false,
                            };
                            fields[prop.Name] = flags;
                        }
                        OrBool(flags, prop.Value, "canView");
                        OrBool(flags, prop.Value, "canEdit");
                    }
                }

                if (root.TryGetProperty("companyScopes", out var cs) && cs.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in cs.EnumerateArray())
                    {
                        if (item.ValueKind != JsonValueKind.Object) continue;
                        if (!item.TryGetProperty("companyId", out var cidEl)) continue;
                        var cid = cidEl.ToString();
                        if (string.IsNullOrWhiteSpace(cid)) continue;
                        // son kazanır / enabled OR — basitçe enabled olanı tut
                        if (item.TryGetProperty("enabled", out var en) && en.ValueKind == JsonValueKind.True)
                            scopesByCompany[cid] = item.Clone();
                        else if (!scopesByCompany.ContainsKey(cid))
                            scopesByCompany[cid] = item.Clone();
                    }
                }

                if (root.TryGetProperty("authCode", out var ac) && ac.ValueKind == JsonValueKind.String)
                {
                    var v = ac.GetString();
                    if (!string.IsNullOrWhiteSpace(v))
                        authCode = string.IsNullOrWhiteSpace(authCode) ? v : $"{authCode},{v}";
                }
            }
            catch
            {
                /* skip bad json */
            }
        }

        var payload = new Dictionary<string, object?>
        {
            ["isAdmin"] = false,
            ["screens"] = screens,
            ["fields"] = fields,
            ["companyScopes"] = scopesByCompany.Values.Select(e => JsonSerializer.Deserialize<object>(e.GetRawText())).ToList(),
            ["authCode"] = authCode ?? "",
        };
        return JsonSerializer.Serialize(payload);
    }

    private static void OrBool(Dictionary<string, bool> flags, JsonElement obj, string key)
    {
        if (obj.ValueKind != JsonValueKind.Object) return;
        if (!obj.TryGetProperty(key, out var el)) return;
        if (el.ValueKind == JsonValueKind.True) flags[key] = true;
    }
}
