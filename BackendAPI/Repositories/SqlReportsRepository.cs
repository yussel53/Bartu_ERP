using System.Data;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

public sealed class SqlReportDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string ReportGroup { get; set; } = "Genel";
    public string? Description { get; set; }
    public string QueryTemplate { get; set; } = "";
    public string? PreQueryTemplate { get; set; }
    public string? FiltersConfig { get; set; }
    public string? ChartConfig { get; set; }
    public string? KpiConfig { get; set; }
    public string? ColumnFormats { get; set; }
    public string? PivotConfig { get; set; }
    public string? CalendarConfig { get; set; }
    public string? AdvancedFeaturesConfig { get; set; }
    public string? CachedColumns { get; set; }
    public string? AuxQueriesConfig { get; set; }
    public string? CalculatedColumns { get; set; }
    public string? ConditionalFormattingConfig { get; set; }
    public string? ReportColor { get; set; }
    public bool AllowExport { get; set; } = true;
    public bool AllowPdfExport { get; set; }
    public bool AllowSimulation { get; set; } = true;
    public bool ShowDataTable { get; set; } = true;
    public bool ShowPivotTable { get; set; }
    public bool ShowCalendar { get; set; }
    public bool RestrictUsers { get; set; }
    public bool IsActive { get; set; } = true;
    public int? MenuId { get; set; }
    public string? MenuDisplayName { get; set; }
    public int? MenuSortOrder { get; set; }
    public string? ExportKey { get; set; }
    public string? MenuTitle { get; set; }
    public string? MenuModulePath { get; set; }
    public string? MenuGroupKey { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    /// <summary>Yetkili kullanıcı sayısı (özet).</summary>
    public int AuthorizedUserCount { get; set; }
}

public sealed class SqlReportSaveDto
{
    public string Name { get; set; } = "";
    public string ReportGroup { get; set; } = "Genel";
    public string? Description { get; set; }
    public string QueryTemplate { get; set; } = "";
    public string? PreQueryTemplate { get; set; }
    public string? FiltersConfig { get; set; }
    public string? ChartConfig { get; set; }
    public string? KpiConfig { get; set; }
    public string? ColumnFormats { get; set; }
    public string? PivotConfig { get; set; }
    public string? CalendarConfig { get; set; }
    public string? AdvancedFeaturesConfig { get; set; }
    public string? CachedColumns { get; set; }
    public string? AuxQueriesConfig { get; set; }
    public string? CalculatedColumns { get; set; }
    public string? ConditionalFormattingConfig { get; set; }
    public string? ReportColor { get; set; }
    public bool AllowExport { get; set; } = true;
    public bool AllowPdfExport { get; set; }
    public bool AllowSimulation { get; set; } = true;
    public bool ShowDataTable { get; set; } = true;
    public bool ShowPivotTable { get; set; }
    public bool ShowCalendar { get; set; }
    public bool RestrictUsers { get; set; }
    public bool IsActive { get; set; } = true;
    public int? MenuId { get; set; }
    public string? MenuDisplayName { get; set; }
    public int? MenuSortOrder { get; set; }
    public string? ExportKey { get; set; }
    public string? CreatedBy { get; set; }
}

public sealed class SqlReportUserDto
{
    public int SystemUserId { get; set; }
    public string NickName { get; set; } = "";
    public string Name { get; set; } = "";
    public string Surname { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string DisplayName
    {
        get
        {
            var full = $"{Name} {Surname}".Trim();
            if (string.IsNullOrWhiteSpace(full)) return NickName;
            return string.IsNullOrWhiteSpace(NickName) ? full : $"{full} ({NickName})";
        }
    }
}

public sealed class SqlReportAuthUserDto
{
    public int SystemUserId { get; set; }
    public string? NickName { get; set; }
    public string? DisplayName { get; set; }
    public bool CanView { get; set; } = true;
    public bool CanRun { get; set; } = true;
}

public sealed class SqlReportAuthRoleDto
{
    public int RoleId { get; set; }
    public string? Code { get; set; }
    public string? Name { get; set; }
    public bool CanView { get; set; } = true;
    public bool CanRun { get; set; } = true;
}

public sealed class SqlReportAuthStateDto
{
    public int ReportId { get; set; }
    public bool RestrictUsers { get; set; }
    public List<SqlReportAuthUserDto> Users { get; set; } = new();
    public List<SqlReportAuthRoleDto> Roles { get; set; } = new();
}

public sealed class SqlReportAuthSaveDto
{
    public bool RestrictUsers { get; set; }
    public List<SqlReportAuthUserDto> Users { get; set; } = new();
    public List<SqlReportAuthRoleDto> Roles { get; set; } = new();
}

public sealed class SqlReportUserAuthStateDto
{
    public int SystemUserId { get; set; }
    public List<SqlReportUserAuthItemDto> Reports { get; set; } = new();
}

public sealed class SqlReportUserAuthItemDto
{
    public int ReportId { get; set; }
    public string Name { get; set; } = "";
    public string ReportGroup { get; set; } = "";
    public bool RestrictUsers { get; set; }
    public bool Assigned { get; set; }
    public bool CanView { get; set; } = true;
    public bool CanRun { get; set; } = true;
}

public sealed class SqlReportUserAuthSaveDto
{
    public List<int> ReportIds { get; set; } = new();
}

public sealed class SqlReportMenuDto
{
    public int Id { get; set; }
    public string ExportKey { get; set; } = "";
    public string ModulePath { get; set; } = "";
    public string GroupKey { get; set; } = "raporlar";
    public string Title { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<SqlReportMenuItemDto> Reports { get; set; } = new();
}

public sealed class SqlReportMenuItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public string? ExportKey { get; set; }
}

public sealed class SqlReportMenuSaveDto
{
    public string ModulePath { get; set; } = "";
    public string GroupKey { get; set; } = "raporlar";
    public string Title { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ExportKey { get; set; }
}

public sealed class SqlReportPackageDto
{
    public string Format { get; set; } = "kavisoft-sql-reports";
    public int Version { get; set; } = 1;
    public DateTime ExportedAt { get; set; } = DateTime.UtcNow;
    public List<SqlReportPackageMenuDto> Menus { get; set; } = new();
    public List<SqlReportPackageReportDto> Reports { get; set; } = new();
}

public sealed class SqlReportPackageMenuDto
{
    public string ExportKey { get; set; } = "";
    public string ModulePath { get; set; } = "";
    public string GroupKey { get; set; } = "raporlar";
    public string Title { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class SqlReportPackageReportDto
{
    public string ExportKey { get; set; } = "";
    public string Name { get; set; } = "";
    public string ReportGroup { get; set; } = "Genel";
    public string? Description { get; set; }
    public string QueryTemplate { get; set; } = "";
    public string? PreQueryTemplate { get; set; }
    public string? FiltersConfig { get; set; }
    public string? ChartConfig { get; set; }
    public string? KpiConfig { get; set; }
    public string? ColumnFormats { get; set; }
    public string? PivotConfig { get; set; }
    public string? CalendarConfig { get; set; }
    public string? AdvancedFeaturesConfig { get; set; }
    public string? CachedColumns { get; set; }
    public string? AuxQueriesConfig { get; set; }
    public string? CalculatedColumns { get; set; }
    public string? ConditionalFormattingConfig { get; set; }
    public string? ReportColor { get; set; }
    public bool AllowExport { get; set; } = true;
    public bool AllowPdfExport { get; set; }
    public bool AllowSimulation { get; set; } = true;
    public bool ShowDataTable { get; set; } = true;
    public bool ShowPivotTable { get; set; }
    public bool ShowCalendar { get; set; }
    public bool RestrictUsers { get; set; }
    public bool IsActive { get; set; } = true;
    public string? MenuExportKey { get; set; }
    public string? MenuDisplayName { get; set; }
    public int? MenuSortOrder { get; set; }
}

public sealed class SqlReportImportResult
{
    public int MenusUpserted { get; set; }
    public int ReportsUpserted { get; set; }
    public List<string> Messages { get; set; } = new();
}

public sealed class SqlReportRunRequest
{
    public int? ReportId { get; set; }
    public string? QueryTemplate { get; set; }
    public string? PreQueryTemplate { get; set; }
    public string? AuxQueriesConfig { get; set; }
    public string? CalculatedColumns { get; set; }
    public Dictionary<string, string>? Parameters { get; set; }
    /// <summary>What-If: sütun adı → yüzde (örn. NetTutar → 10 = +%10).</summary>
    public Dictionary<string, double>? SimulationPercents { get; set; }
    public int MaxRows { get; set; } = 5000;
    public bool FastTest { get; set; }
    public bool SkipAuxQueries { get; set; }
    /// <summary>Yetki kontrolü için (menüden çalıştırma).</summary>
    public int? UserId { get; set; }
    public bool IsAdmin { get; set; }
}

public sealed class SqlReportAuxDataset
{
    public string Key { get; set; } = "";
    public string? Label { get; set; }
    public List<string> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public int RowCount { get; set; }
    public string? Error { get; set; }
}

public sealed class SqlReportRunResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? ExecutedQuery { get; set; }
    public List<string> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public int RowCount { get; set; }
    public double ElapsedMs { get; set; }
    public List<SqlReportAuxDataset> AuxDatasets { get; set; } = new();
}

public sealed class SqlReportsRepository
{
    private readonly IDbConnection _db;

    private static readonly string[] BlockedDdl =
    {
        "DROP DATABASE", "TRUNCATE TABLE", "ALTER TABLE", "GRANT ", "REVOKE ",
        "CREATE LOGIN", "ALTER LOGIN", "DROP LOGIN", "XP_CMDSHELL", "SP_CONFIGURE",
    };

    public SqlReportsRepository(IDbConnection db)
    {
        _db = db;
    }

    private void EnsureOpen()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    private const string ReportSelect = """
        SELECT r.Id, r.Name, r.ReportGroup, r.Description, r.QueryTemplate, r.PreQueryTemplate,
               r.FiltersConfig, r.ChartConfig, r.KpiConfig, r.ColumnFormats,
               r.PivotConfig, r.CalendarConfig, r.AdvancedFeaturesConfig, r.CachedColumns,
               r.AuxQueriesConfig, r.CalculatedColumns, r.ConditionalFormattingConfig,
               r.ReportColor,
               r.AllowExport, r.AllowPdfExport, r.AllowSimulation,
               r.ShowDataTable, r.ShowPivotTable, r.ShowCalendar, r.RestrictUsers,
               r.IsActive, r.MenuId, r.MenuDisplayName, r.MenuSortOrder, r.ExportKey,
               m.Title AS MenuTitle, m.ModulePath AS MenuModulePath, m.GroupKey AS MenuGroupKey,
               r.CreatedAt, r.UpdatedAt, r.CreatedBy,
               (SELECT COUNT(1) FROM dbo.SYS_SqlReportAuth a WHERE a.ReportId = r.Id) AS AuthorizedUserCount
        FROM dbo.SYS_SqlReport r
        LEFT JOIN dbo.SYS_SqlReportMenu m ON m.Id = r.MenuId
        """;

    private static async Task EnsureTableAsync(IDbConnection db, CancellationToken ct)
    {
        const string sql = """
            IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_SqlReport (
                Id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReport PRIMARY KEY,
                Name              NVARCHAR(150) NOT NULL,
                ReportGroup       NVARCHAR(100) NOT NULL CONSTRAINT DF_SYS_SqlReport_Group DEFAULT (N'Genel'),
                Description       NVARCHAR(500) NULL,
                QueryTemplate     NVARCHAR(MAX) NOT NULL,
                PreQueryTemplate  NVARCHAR(MAX) NULL,
                FiltersConfig     NVARCHAR(MAX) NULL,
                ChartConfig       NVARCHAR(MAX) NULL,
                KpiConfig         NVARCHAR(MAX) NULL,
                ColumnFormats     NVARCHAR(MAX) NULL,
                AllowExport       BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_AllowExport DEFAULT (1),
                IsActive          BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_IsActive DEFAULT (1),
                MenuId            INT NULL,
                MenuDisplayName   NVARCHAR(150) NULL,
                MenuSortOrder     INT NULL,
                ExportKey         NVARCHAR(80) NULL,
                CreatedAt         DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReport_CreatedAt DEFAULT (SYSUTCDATETIME()),
                UpdatedAt         DATETIME2 NULL,
                CreatedBy         NVARCHAR(100) NULL
              );
            END

            IF OBJECT_ID(N'dbo.SYS_SqlReportMenu', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_SqlReportMenu (
                Id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportMenu PRIMARY KEY,
                ExportKey    NVARCHAR(80)  NOT NULL,
                ModulePath   NVARCHAR(50)  NOT NULL,
                GroupKey     NVARCHAR(50)  NOT NULL,
                Title        NVARCHAR(150) NOT NULL,
                SortOrder    INT NOT NULL CONSTRAINT DF_SYS_SqlReportMenu_Sort DEFAULT (0),
                IsActive     BIT NOT NULL CONSTRAINT DF_SYS_SqlReportMenu_Active DEFAULT (1),
                CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportMenu_CreatedAt DEFAULT (SYSUTCDATETIME()),
                UpdatedAt    DATETIME2 NULL,
                CONSTRAINT UQ_SYS_SqlReportMenu_ExportKey UNIQUE (ExportKey)
              );
            END

            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuId') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD MenuId INT NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuDisplayName') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD MenuDisplayName NVARCHAR(150) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuSortOrder') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD MenuSortOrder INT NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ExportKey') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD ExportKey NVARCHAR(80) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'PivotConfig') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD PivotConfig NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'CalendarConfig') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD CalendarConfig NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AdvancedFeaturesConfig') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD AdvancedFeaturesConfig NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'CachedColumns') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD CachedColumns NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ReportColor') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD ReportColor NVARCHAR(20) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ShowDataTable') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD ShowDataTable BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_ShowData2 DEFAULT (1);
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ShowPivotTable') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD ShowPivotTable BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_ShowPivot2 DEFAULT (0);
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ShowCalendar') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD ShowCalendar BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_ShowCal2 DEFAULT (0);
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AllowPdfExport') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD AllowPdfExport BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_AllowPdf2 DEFAULT (0);
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AuxQueriesConfig') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD AuxQueriesConfig NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'CalculatedColumns') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD CalculatedColumns NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ConditionalFormattingConfig') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD ConditionalFormattingConfig NVARCHAR(MAX) NULL;
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AllowSimulation') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD AllowSimulation BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_AllowSim2 DEFAULT (1);
            IF COL_LENGTH(N'dbo.SYS_SqlReport', N'RestrictUsers') IS NULL
              ALTER TABLE dbo.SYS_SqlReport ADD RestrictUsers BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_RestrictUsers2 DEFAULT (0);

            IF OBJECT_ID(N'dbo.SYS_SqlReportAuth', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_SqlReportAuth (
                Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportAuth PRIMARY KEY,
                ReportId      INT NOT NULL,
                SystemUserID  INT NOT NULL,
                CanView       BIT NOT NULL CONSTRAINT DF_SYS_SqlReportAuth_View2 DEFAULT (1),
                CanRun        BIT NOT NULL CONSTRAINT DF_SYS_SqlReportAuth_Run2 DEFAULT (1),
                CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportAuth_CreatedAt2 DEFAULT (SYSUTCDATETIME()),
                CONSTRAINT UQ_SYS_SqlReportAuth_ReportUser UNIQUE (ReportId, SystemUserID)
              );
            END

            IF OBJECT_ID(N'dbo.SYS_SqlReportRoleAuth', N'U') IS NULL
            BEGIN
              CREATE TABLE dbo.SYS_SqlReportRoleAuth (
                Id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportRoleAuth3 PRIMARY KEY,
                ReportId   INT NOT NULL,
                RoleId     INT NOT NULL,
                CanView    BIT NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_View3 DEFAULT (1),
                CanRun     BIT NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_Run3 DEFAULT (1),
                CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_CreatedAt3 DEFAULT (SYSUTCDATETIME()),
                CONSTRAINT UQ_SYS_SqlReportRoleAuth3 UNIQUE (ReportId, RoleId)
              );
            END
            """;
        await db.ExecuteAsync(new CommandDefinition(sql, cancellationToken: ct));
        await RolesRepository.EnsureTableAsync(db, ct);
        await db.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.SYS_SqlReport
            SET ExportKey = N'rpt-' + CAST(Id AS NVARCHAR(20))
            WHERE ExportKey IS NULL OR LTRIM(RTRIM(ExportKey)) = N'';
            """,
            cancellationToken: ct));
    }

    public async Task<IReadOnlyList<SqlReportDto>> ListAsync(string? group = null, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        if (string.IsNullOrWhiteSpace(group))
        {
            var all = await _db.QueryAsync<SqlReportDto>(new CommandDefinition(
                ReportSelect + " ORDER BY r.ReportGroup, r.Name",
                cancellationToken: ct));
            return all.AsList();
        }

        var filtered = await _db.QueryAsync<SqlReportDto>(new CommandDefinition(
            ReportSelect + " WHERE r.ReportGroup = @group ORDER BY r.Name",
            new { group },
            cancellationToken: ct));
        return filtered.AsList();
    }

    public async Task<SqlReportDto?> GetAsync(int id, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        return await _db.QuerySingleOrDefaultAsync<SqlReportDto>(new CommandDefinition(
            ReportSelect + " WHERE r.Id = @id",
            new { id },
            cancellationToken: ct));
    }

    public async Task<SqlReportDto> UpsertAsync(int? id, SqlReportSaveDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("Rapor adı zorunlu.");
        if (string.IsNullOrWhiteSpace(dto.QueryTemplate))
            throw new InvalidOperationException("SQL sorgu şablonu zorunlu.");

        ValidateQuery(dto.QueryTemplate, allowWrite: false);
        if (!string.IsNullOrWhiteSpace(dto.PreQueryTemplate))
            ValidateQuery(dto.PreQueryTemplate, allowWrite: true);

        EnsureOpen();
        await EnsureTableAsync(_db, ct);

        var group = string.IsNullOrWhiteSpace(dto.ReportGroup) ? "Genel" : dto.ReportGroup.Trim();

        var exportKey = string.IsNullOrWhiteSpace(dto.ExportKey)
            ? null
            : dto.ExportKey.Trim();
        var menuDisplay = string.IsNullOrWhiteSpace(dto.MenuDisplayName)
            ? null
            : dto.MenuDisplayName.Trim();

        if (id is null or <= 0)
        {
            var newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_SqlReport
                  (Name, ReportGroup, Description, QueryTemplate, PreQueryTemplate,
                   FiltersConfig, ChartConfig, KpiConfig, ColumnFormats,
                   PivotConfig, CalendarConfig, AdvancedFeaturesConfig, CachedColumns,
                   AuxQueriesConfig, CalculatedColumns, ConditionalFormattingConfig, ReportColor,
                   AllowExport, AllowPdfExport, AllowSimulation,
                   ShowDataTable, ShowPivotTable, ShowCalendar, RestrictUsers,
                   IsActive, MenuId, MenuDisplayName, MenuSortOrder, ExportKey, CreatedBy)
                OUTPUT INSERTED.Id
                VALUES
                  (@Name, @ReportGroup, @Description, @QueryTemplate, @PreQueryTemplate,
                   @FiltersConfig, @ChartConfig, @KpiConfig, @ColumnFormats,
                   @PivotConfig, @CalendarConfig, @AdvancedFeaturesConfig, @CachedColumns,
                   @AuxQueriesConfig, @CalculatedColumns, @ConditionalFormattingConfig, @ReportColor,
                   @AllowExport, @AllowPdfExport, @AllowSimulation,
                   @ShowDataTable, @ShowPivotTable, @ShowCalendar, @RestrictUsers,
                   @IsActive, @MenuId, @MenuDisplayName, @MenuSortOrder,
                   COALESCE(@ExportKey, N'rpt-tmp'), @CreatedBy)
                """,
                new
                {
                    dto.Name,
                    ReportGroup = group,
                    dto.Description,
                    dto.QueryTemplate,
                    dto.PreQueryTemplate,
                    FiltersConfig = NormalizeJson(dto.FiltersConfig),
                    ChartConfig = NormalizeJson(dto.ChartConfig),
                    KpiConfig = NormalizeJson(dto.KpiConfig),
                    ColumnFormats = NormalizeJson(dto.ColumnFormats),
                    PivotConfig = NormalizeJson(dto.PivotConfig, allowObject: true),
                    CalendarConfig = NormalizeJson(dto.CalendarConfig, allowObject: true),
                    AdvancedFeaturesConfig = NormalizeJson(dto.AdvancedFeaturesConfig, allowObject: true),
                    CachedColumns = NormalizeJson(dto.CachedColumns),
                    AuxQueriesConfig = NormalizeJson(dto.AuxQueriesConfig),
                    CalculatedColumns = NormalizeJson(dto.CalculatedColumns),
                    ConditionalFormattingConfig = NormalizeJson(dto.ConditionalFormattingConfig),
                    ReportColor = string.IsNullOrWhiteSpace(dto.ReportColor) ? "#6366f1" : dto.ReportColor.Trim(),
                    dto.AllowExport,
                    dto.AllowPdfExport,
                    dto.AllowSimulation,
                    dto.ShowDataTable,
                    dto.ShowPivotTable,
                    dto.ShowCalendar,
                    dto.RestrictUsers,
                    dto.IsActive,
                    dto.MenuId,
                    MenuDisplayName = menuDisplay,
                    dto.MenuSortOrder,
                    ExportKey = exportKey,
                    CreatedBy = dto.CreatedBy ?? "UI",
                },
                cancellationToken: ct));

            if (string.IsNullOrWhiteSpace(exportKey))
            {
                await _db.ExecuteAsync(new CommandDefinition(
                    "UPDATE dbo.SYS_SqlReport SET ExportKey = N'rpt-' + CAST(@id AS NVARCHAR(20)) WHERE Id = @id",
                    new { id = newId },
                    cancellationToken: ct));
            }

            return (await GetAsync(newId, ct))!;
        }

        var affected = await _db.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.SYS_SqlReport SET
              Name = @Name,
              ReportGroup = @ReportGroup,
              Description = @Description,
              QueryTemplate = @QueryTemplate,
              PreQueryTemplate = @PreQueryTemplate,
              FiltersConfig = @FiltersConfig,
              ChartConfig = @ChartConfig,
              KpiConfig = @KpiConfig,
              ColumnFormats = @ColumnFormats,
              PivotConfig = @PivotConfig,
              CalendarConfig = @CalendarConfig,
              AdvancedFeaturesConfig = @AdvancedFeaturesConfig,
              CachedColumns = @CachedColumns,
              AuxQueriesConfig = @AuxQueriesConfig,
              CalculatedColumns = @CalculatedColumns,
              ConditionalFormattingConfig = @ConditionalFormattingConfig,
              ReportColor = @ReportColor,
              AllowExport = @AllowExport,
              AllowPdfExport = @AllowPdfExport,
              AllowSimulation = @AllowSimulation,
              ShowDataTable = @ShowDataTable,
              ShowPivotTable = @ShowPivotTable,
              ShowCalendar = @ShowCalendar,
              RestrictUsers = @RestrictUsers,
              IsActive = @IsActive,
              MenuId = @MenuId,
              MenuDisplayName = @MenuDisplayName,
              MenuSortOrder = @MenuSortOrder,
              ExportKey = COALESCE(@ExportKey, ExportKey),
              UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @Id
            """,
            new
            {
                Id = id.Value,
                dto.Name,
                ReportGroup = group,
                dto.Description,
                dto.QueryTemplate,
                dto.PreQueryTemplate,
                FiltersConfig = NormalizeJson(dto.FiltersConfig),
                ChartConfig = NormalizeJson(dto.ChartConfig),
                KpiConfig = NormalizeJson(dto.KpiConfig),
                ColumnFormats = NormalizeJson(dto.ColumnFormats),
                PivotConfig = NormalizeJson(dto.PivotConfig, allowObject: true),
                CalendarConfig = NormalizeJson(dto.CalendarConfig, allowObject: true),
                AdvancedFeaturesConfig = NormalizeJson(dto.AdvancedFeaturesConfig, allowObject: true),
                CachedColumns = NormalizeJson(dto.CachedColumns),
                AuxQueriesConfig = NormalizeJson(dto.AuxQueriesConfig),
                CalculatedColumns = NormalizeJson(dto.CalculatedColumns),
                ConditionalFormattingConfig = NormalizeJson(dto.ConditionalFormattingConfig),
                ReportColor = string.IsNullOrWhiteSpace(dto.ReportColor) ? "#6366f1" : dto.ReportColor.Trim(),
                dto.AllowExport,
                dto.AllowPdfExport,
                dto.AllowSimulation,
                dto.ShowDataTable,
                dto.ShowPivotTable,
                dto.ShowCalendar,
                dto.RestrictUsers,
                dto.IsActive,
                dto.MenuId,
                MenuDisplayName = menuDisplay,
                dto.MenuSortOrder,
                ExportKey = exportKey,
            },
            cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("Rapor bulunamadı.");

        return (await GetAsync(id.Value, ct))!;
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportAuth WHERE ReportId = @id",
            new { id },
            cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportRoleAuth WHERE ReportId = @id",
            new { id },
            cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReport WHERE Id = @id",
            new { id },
            cancellationToken: ct));
    }

    public async Task<SqlReportRunResult> RunAsync(SqlReportRunRequest req, CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        string query;
        string? preQuery = null;
        string? auxConfig = req.AuxQueriesConfig;
        string? calcConfig = req.CalculatedColumns;
        var allowSimulation = true;

        if (req.ReportId is > 0)
        {
            var report = await GetAsync(req.ReportId.Value, ct)
                ?? throw new InvalidOperationException("Rapor bulunamadı.");
            if (!report.IsActive)
                throw new InvalidOperationException("Rapor pasif.");

            if (req.UserId is > 0 && !req.IsAdmin)
            {
                var ok = await CanUserAccessAsync(req.ReportId.Value, req.UserId.Value, needRun: true, ct);
                if (!ok)
                    throw new InvalidOperationException("Bu raporu çalıştırma yetkiniz yok.");
            }

            query = report.QueryTemplate;
            preQuery = report.PreQueryTemplate;
            auxConfig ??= report.AuxQueriesConfig;
            calcConfig ??= report.CalculatedColumns;
            allowSimulation = report.AllowSimulation;
        }
        else
        {
            query = req.QueryTemplate ?? "";
            preQuery = req.PreQueryTemplate;
            if (string.IsNullOrWhiteSpace(query))
                throw new InvalidOperationException("Çalıştırılacak sorgu yok.");
        }

        var parameters = BuildParameters(req.Parameters);
        query = ReplacePlaceholders(query, parameters);
        if (!string.IsNullOrWhiteSpace(preQuery))
            preQuery = ReplacePlaceholders(preQuery, parameters);

        ValidateQuery(query, allowWrite: false);
        if (!string.IsNullOrWhiteSpace(preQuery))
            ValidateQuery(preQuery, allowWrite: true);

        var maxRows = req.FastTest ? 10 : Math.Clamp(req.MaxRows <= 0 ? 5000 : req.MaxRows, 1, 20000);
        // SET ROWCOUNT bazı batch'lerde kolon metadata'sını bozabiliyor — TOP sarmalayıcı kullan
        if (req.FastTest && !Regex.IsMatch(query, @"^\s*(EXEC|EXECUTE|CALL)\b", RegexOptions.IgnoreCase))
            query = WrapFastTestTop(query, 10);

        EnsureOpen();
        await EnsureTableAsync(_db, ct);

        var result = new SqlReportRunResult();

        try
        {
            if (_db is SqlConnection sqlConn)
            {
                await using var cmd = sqlConn.CreateCommand();
                cmd.CommandTimeout = 120;

                if (!string.IsNullOrWhiteSpace(preQuery))
                {
                    cmd.CommandText = preQuery;
                    await cmd.ExecuteNonQueryAsync(ct);
                }

                cmd.CommandText = query;
                await using var reader = await cmd.ExecuteReaderAsync(ct);

                // İlk sonuç kümesine ilerle (önceki SET/print vb. FieldCount=0 olabilir)
                while (reader.FieldCount == 0 && await reader.NextResultAsync(ct))
                { }

                for (var i = 0; i < reader.FieldCount; i++)
                    result.Columns.Add(reader.GetName(i));

                var count = 0;
                while (await reader.ReadAsync(ct) && count < maxRows)
                {
                    var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                    for (var i = 0; i < reader.FieldCount; i++)
                    {
                        var val = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row[result.Columns[i]] = NormalizeCell(val);
                    }
                    result.Rows.Add(row);
                    count++;
                }

                result.RowCount = count;
                result.Success = true;
                result.ExecutedQuery = query;
                result.Message = count == 0
                    ? (result.Columns.Count > 0
                        ? $"Sorgu çalıştı, satır yok ({result.Columns.Count} kolon)."
                        : "Sorgu çalıştı, satır/kolon dönmedi.")
                    : $"{count} satır.";
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(preQuery))
                    await _db.ExecuteAsync(new CommandDefinition(preQuery, cancellationToken: ct, commandTimeout: 120));

                var rows = (await _db.QueryAsync(new CommandDefinition(query, cancellationToken: ct, commandTimeout: 120)))
                    .Take(maxRows)
                    .ToList();

                if (rows.Count > 0)
                {
                    var first = (IDictionary<string, object>)rows[0];
                    result.Columns = first.Keys.ToList();
                    foreach (var r in rows)
                    {
                        var dict = (IDictionary<string, object>)r;
                        var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                        foreach (var col in result.Columns)
                            row[col] = NormalizeCell(dict[col] is DBNull ? null : dict[col]);
                        result.Rows.Add(row);
                    }
                }
                else
                {
                    // 0 satırda şema için WHERE 1=0 ile kolon adlarını al
                    try
                    {
                        var schemaQ = WrapSchemaProbe(query);
                        var probe = (await _db.QueryAsync(new CommandDefinition(schemaQ, cancellationToken: ct, commandTimeout: 60)))
                            .Take(1).ToList();
                        if (probe.Count > 0)
                            result.Columns = ((IDictionary<string, object>)probe[0]).Keys.ToList();
                    }
                    catch
                    {
                        /* kolonlar boş kalabilir — FE SQL'den çıkarır */
                    }
                }

                result.RowCount = result.Rows.Count;
                result.Success = true;
                result.ExecutedQuery = query;
                result.Message = result.RowCount == 0
                    ? (result.Columns.Count > 0
                        ? $"Sorgu çalıştı, satır yok ({result.Columns.Count} kolon)."
                        : "Sorgu çalıştı, satır/kolon dönmedi.")
                    : $"{result.RowCount} satır.";
            }

            if (result.Success)
            {
                ApplyCalculatedColumns(result, calcConfig);
                if (allowSimulation)
                    ApplySimulation(result, req.SimulationPercents);

                if (!req.SkipAuxQueries && !req.FastTest && !string.IsNullOrWhiteSpace(auxConfig))
                    await FillAuxDatasetsAsync(result, auxConfig, parameters, maxRows, ct);
            }
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = ShortError(ex.Message);
            result.ExecutedQuery = query;
        }

        sw.Stop();
        result.ElapsedMs = sw.Elapsed.TotalMilliseconds;
        return result;
    }

    private async Task FillAuxDatasetsAsync(
        SqlReportRunResult result,
        string auxConfig,
        Dictionary<string, string> parameters,
        int maxRows,
        CancellationToken ct)
    {
        List<AuxQueryDef>? defs;
        try
        {
            defs = JsonSerializer.Deserialize<List<AuxQueryDef>>(auxConfig, JsonOpts);
        }
        catch
        {
            return;
        }

        if (defs == null || defs.Count == 0) return;

        foreach (var def in defs.Take(8))
        {
            var key = string.IsNullOrWhiteSpace(def.Key) ? $"aux_{result.AuxDatasets.Count + 1}" : def.Key.Trim();
            var ds = new SqlReportAuxDataset
            {
                Key = key,
                Label = string.IsNullOrWhiteSpace(def.Label) ? key : def.Label.Trim(),
            };

            var q = def.Query?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(q))
            {
                ds.Error = "Sorgu boş.";
                result.AuxDatasets.Add(ds);
                continue;
            }

            try
            {
                q = ReplacePlaceholders(q, parameters);
                ValidateQuery(q, allowWrite: false);

                if (_db is SqlConnection sqlConn)
                {
                    await using var cmd = sqlConn.CreateCommand();
                    cmd.CommandTimeout = 90;
                    cmd.CommandText = q;
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    for (var i = 0; i < reader.FieldCount; i++)
                        ds.Columns.Add(reader.GetName(i));
                    var count = 0;
                    while (await reader.ReadAsync(ct) && count < maxRows)
                    {
                        var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                        for (var i = 0; i < reader.FieldCount; i++)
                            row[ds.Columns[i]] = NormalizeCell(reader.IsDBNull(i) ? null : reader.GetValue(i));
                        ds.Rows.Add(row);
                        count++;
                    }
                    ds.RowCount = count;
                }
                else
                {
                    var rows = (await _db.QueryAsync(new CommandDefinition(q, cancellationToken: ct, commandTimeout: 90)))
                        .Take(maxRows).ToList();
                    if (rows.Count > 0)
                    {
                        var first = (IDictionary<string, object>)rows[0];
                        ds.Columns = first.Keys.ToList();
                        foreach (var r in rows)
                        {
                            var dict = (IDictionary<string, object>)r;
                            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
                            foreach (var col in ds.Columns)
                                row[col] = NormalizeCell(dict[col] is DBNull ? null : dict[col]);
                            ds.Rows.Add(row);
                        }
                    }
                    ds.RowCount = ds.Rows.Count;
                }
            }
            catch (Exception ex)
            {
                ds.Error = ShortError(ex.Message);
            }

            result.AuxDatasets.Add(ds);
        }
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private sealed class AuxQueryDef
    {
        public string? Key { get; set; }
        public string? Label { get; set; }
        public string? Query { get; set; }
    }

    private sealed class CalcColDef
    {
        public string? Name { get; set; }
        public string? Expression { get; set; }
    }

    private static void ApplyCalculatedColumns(SqlReportRunResult result, string? calcConfig)
    {
        if (string.IsNullOrWhiteSpace(calcConfig)) return;
        List<CalcColDef>? defs;
        try
        {
            defs = JsonSerializer.Deserialize<List<CalcColDef>>(calcConfig, JsonOpts);
        }
        catch
        {
            return;
        }

        if (defs == null || defs.Count == 0) return;

        foreach (var def in defs)
        {
            var name = def.Name?.Trim();
            var expr = def.Expression?.Trim();
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(expr)) continue;
            if (!result.Columns.Contains(name, StringComparer.OrdinalIgnoreCase))
                result.Columns.Add(name);

            foreach (var row in result.Rows)
            {
                try
                {
                    row[name] = EvalSimpleExpression(expr, row);
                }
                catch
                {
                    row[name] = null;
                }
            }
        }

        result.RowCount = result.Rows.Count;
    }

    private static void ApplySimulation(SqlReportRunResult result, Dictionary<string, double>? percents)
    {
        if (percents == null || percents.Count == 0) return;

        foreach (var (col, pct) in percents)
        {
            if (string.IsNullOrWhiteSpace(col) || Math.Abs(pct) < 0.0000001) continue;
            var factor = 1.0 + (pct / 100.0);
            foreach (var row in result.Rows)
            {
                var key = row.Keys.FirstOrDefault(k => k.Equals(col, StringComparison.OrdinalIgnoreCase));
                if (key == null) continue;
                if (row[key] is not (int or long or float or double or decimal))
                {
                    if (row[key] == null) continue;
                    if (!double.TryParse(Convert.ToString(row[key], CultureInfo.InvariantCulture),
                            NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                        continue;
                    row[key] = Math.Round(parsed * factor, 4);
                    continue;
                }

                var n = Convert.ToDouble(row[key], CultureInfo.InvariantCulture);
                row[key] = Math.Round(n * factor, 4);
            }
        }
    }

    /// <summary>Güvenli basit aritmetik: kolon adları + sayılar + + - * / ( ).</summary>
    private static double? EvalSimpleExpression(string expression, Dictionary<string, object?> row)
    {
        var expr = expression.Trim();
        if (expr.Length > 200) throw new InvalidOperationException("İfade çok uzun.");

        // Kolon adlarını (harf/rakam/_) değerlerle değiştir — uzun adlar önce
        var cols = row.Keys.OrderByDescending(k => k.Length).ToList();
        foreach (var col in cols)
        {
            if (!Regex.IsMatch(expr, $@"\b{Regex.Escape(col)}\b", RegexOptions.IgnoreCase)) continue;
            var raw = row.First(kv => kv.Key.Equals(col, StringComparison.OrdinalIgnoreCase)).Value;
            double num = 0;
            if (raw != null)
                double.TryParse(Convert.ToString(raw, CultureInfo.InvariantCulture),
                    NumberStyles.Any, CultureInfo.InvariantCulture, out num);
            expr = Regex.Replace(expr, $@"\b{Regex.Escape(col)}\b",
                num.ToString(CultureInfo.InvariantCulture), RegexOptions.IgnoreCase);
        }

        if (!Regex.IsMatch(expr, @"^[0-9+\-*/().\s]+$"))
            throw new InvalidOperationException("Geçersiz ifade.");

        try
        {
            var dt = new DataTable();
            var val = dt.Compute(expr, "");
            if (val == null || val is DBNull) return null;
            return Convert.ToDouble(val, CultureInfo.InvariantCulture);
        }
        catch
        {
            return null;
        }
    }

    public static void ValidateQuery(string query, bool allowWrite)
    {
        if (string.IsNullOrWhiteSpace(query)) return;
        var upper = query.ToUpperInvariant();

        foreach (var cmd in BlockedDdl)
        {
            if (!upper.Contains(cmd, StringComparison.Ordinal)) continue;

            if (cmd == "TRUNCATE TABLE")
                throw new InvalidOperationException($"Güvenlik: '{cmd.Trim()}' komutuna izin verilmez.");

            if (cmd.StartsWith("DROP ", StringComparison.Ordinal))
            {
                // #temp tablolarına DROP izni
                var scrubbed = Regex.Replace(query, @"DROP\s+TABLE\s+(IF\s+EXISTS\s+)?#?\w+", "", RegexOptions.IgnoreCase);
                if (scrubbed.Contains("DROP DATABASE", StringComparison.OrdinalIgnoreCase) ||
                    Regex.IsMatch(scrubbed, @"\bDROP\s+TABLE\b", RegexOptions.IgnoreCase))
                {
                    throw new InvalidOperationException("Güvenlik: kalıcı tablo DROP işlemine izin verilmez (yalnızca #temp).");
                }
                continue;
            }

            throw new InvalidOperationException($"Güvenlik: '{cmd.Trim()}' komutuna izin verilmez.");
        }

        if (!allowWrite)
        {
            foreach (var cmd in new[] { "INSERT INTO", "UPDATE ", "DELETE FROM", "MERGE " })
            {
                var pattern = @"\b" + Regex.Escape(cmd.Trim()).Replace(@"\ ", @"\s+") + @"\b";
                if (Regex.IsMatch(upper, pattern))
                    throw new InvalidOperationException(
                        $"Güvenlik: okuma sorgusunda '{cmd.Trim()}' yasak. Ön-sorgu (PreQuery) kullanın.");
            }
        }
    }

    private static Dictionary<string, string> BuildParameters(Dictionary<string, string>? input)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["user_id"] = "1",
            ["username"] = "admin",
            ["user_id_ref"] = "1",
            ["user_name_ref"] = "",
            ["user_code_ref"] = "",
            ["start_date"] = DateTime.Today.AddDays(-30).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["end_date"] = DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ["search_query"] = "",
            ["cari"] = "",
            ["aciklama"] = "",
        };

        if (input == null) return map;

        foreach (var (key, raw) in input)
        {
            if (string.IsNullOrWhiteSpace(key)) continue;
            var k = key.Trim().Trim('{', '}');
            var v = raw ?? "";

            if ((k.Equals("start_date", StringComparison.OrdinalIgnoreCase) ||
                 k.Equals("end_date", StringComparison.OrdinalIgnoreCase) ||
                 k.EndsWith("_date", StringComparison.OrdinalIgnoreCase)) &&
                !string.IsNullOrWhiteSpace(v) &&
                Regex.IsMatch(v, @"[a-zA-Z]"))
            {
                if (DateTime.TryParse(v, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt) ||
                    TryRelativeDate(v, out dt))
                {
                    v = dt.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                }
            }

            map[k] = v;
        }

        return map;
    }

    private static bool TryRelativeDate(string text, out DateTime dt)
    {
        dt = DateTime.Today;
        var t = text.Trim().ToLowerInvariant();
        if (t is "today" or "now" or "bugun" or "bugün") return true;
        if (t is "yesterday" or "dun" or "dün") { dt = DateTime.Today.AddDays(-1); return true; }
        var m = Regex.Match(t, @"^(-?\d+)\s*days?$");
        if (m.Success && int.TryParse(m.Groups[1].Value, out var days))
        {
            dt = DateTime.Today.AddDays(days);
            return true;
        }
        return false;
    }

    private static string ReplacePlaceholders(string template, Dictionary<string, string> parameters)
    {
        var result = template;
        foreach (var (key, value) in parameters)
        {
            var escaped = (value ?? "").Replace("'", "''", StringComparison.Ordinal);
            result = result.Replace("{" + key + "}", escaped, StringComparison.OrdinalIgnoreCase);
        }
        // Kalan bilinmeyen placeholder'ları boşalt (syntax kırmasın)
        result = Regex.Replace(result, @"\{[a-zA-Z_][a-zA-Z0-9_]*\}", "");
        return result;
    }

    /// <summary>Hızlı test: mümkünse TOP; CTE için ROWCOUNT (reader NextResult ile kolon okur).</summary>
    private static string WrapFastTestTop(string query, int n)
    {
        var q = query.Trim().TrimEnd(';');
        if (Regex.IsMatch(q, @"^\s*WITH\b", RegexOptions.IgnoreCase))
            return "SET ROWCOUNT " + n + ";\n" + q;
        if (Regex.IsMatch(q, @"^\s*SELECT\s+TOP\s+", RegexOptions.IgnoreCase))
            return q;
        if (Regex.IsMatch(q, @"^\s*SELECT\s+", RegexOptions.IgnoreCase))
            return Regex.Replace(q, @"^\s*SELECT\s+", $"SELECT TOP ({n}) ", RegexOptions.IgnoreCase);
        return ProcessContextData.WrapDerived(q, "__fast_test", n);
    }

    private static string WrapSchemaProbe(string query) =>
        ProcessContextData.WrapDerived(query, "__schema_probe", 0);

    private static string? NormalizeJson(string? json, bool allowObject = false)
    {
        if (string.IsNullOrWhiteSpace(json)) return allowObject ? "{}" : "[]";
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (allowObject && doc.RootElement.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
                return json;
            if (!allowObject && doc.RootElement.ValueKind == JsonValueKind.Array)
                return json;
            return allowObject ? "{}" : "[]";
        }
        catch
        {
            return allowObject ? "{}" : "[]";
        }
    }

    private static object? NormalizeCell(object? val)
    {
        if (val is null or DBNull) return null;
        return val switch
        {
            DateTime dt => dt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            DateTimeOffset dto => dto.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            byte[] => Convert.ToBase64String((byte[])val),
            Guid g => g.ToString(),
            _ => val,
        };
    }

    private static string ShortError(string msg)
    {
        msg = msg.Replace("\r", " ").Replace("\n", " ");
        return msg.Length > 400 ? msg[..400] + "…" : msg;
    }

    public async Task<IReadOnlyList<SqlReportMenuDto>> ListMenusAsync(
        int? userId = null,
        bool isAdmin = false,
        CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var menus = (await _db.QueryAsync<SqlReportMenuDto>(new CommandDefinition(
            """
            SELECT Id, ExportKey, ModulePath, GroupKey, Title, SortOrder, IsActive, CreatedAt, UpdatedAt
            FROM dbo.SYS_SqlReportMenu
            ORDER BY ModulePath, GroupKey, SortOrder, Title
            """,
            cancellationToken: ct))).AsList();

        var items = (await _db.QueryAsync<SqlReportMenuItemRow>(new CommandDefinition(
            """
            SELECT r.Id, r.MenuId, r.Name, r.MenuDisplayName, r.MenuSortOrder, r.IsActive, r.ExportKey
            FROM dbo.SYS_SqlReport r
            WHERE r.MenuId IS NOT NULL
              AND (
                @isAdmin = 1
                OR ISNULL(r.RestrictUsers, 0) = 0
                OR EXISTS (
                  SELECT 1 FROM dbo.SYS_SqlReportAuth a
                  WHERE a.ReportId = r.Id
                    AND a.SystemUserID = @userId
                    AND a.CanView = 1
                )
                OR EXISTS (
                  SELECT 1
                  FROM dbo.SYS_SqlReportRoleAuth ra
                  INNER JOIN dbo.SYS_UserRole ur ON ur.RoleId = ra.RoleId AND ur.SystemUserID = @userId
                  INNER JOIN dbo.SYS_Role role ON role.Id = ur.RoleId AND role.IsActive = 1
                  WHERE ra.ReportId = r.Id AND ra.CanView = 1
                )
              )
            ORDER BY r.MenuSortOrder, r.Name
            """,
            new { userId = userId ?? 0, isAdmin = isAdmin ? 1 : 0 },
            cancellationToken: ct))).AsList();

        foreach (var menu in menus)
        {
            menu.Reports = items
                .Where(x => x.MenuId == menu.Id)
                .Select(x => new SqlReportMenuItemDto
                {
                    Id = x.Id,
                    Name = x.Name,
                    DisplayName = string.IsNullOrWhiteSpace(x.MenuDisplayName) ? x.Name : x.MenuDisplayName!,
                    SortOrder = x.MenuSortOrder ?? 0,
                    IsActive = x.IsActive,
                    ExportKey = x.ExportKey,
                })
                .ToList();
        }

        // Boş klasörleri admin dışı kullanıcıya gösterme
        if (!isAdmin && userId is > 0)
            menus = menus.Where(m => m.Reports.Count > 0).ToList();

        return menus;
    }

    public async Task<SqlReportMenuDto> UpsertMenuAsync(int? id, SqlReportMenuSaveDto dto, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new InvalidOperationException("Menü adı zorunlu.");
        if (string.IsNullOrWhiteSpace(dto.ModulePath))
            throw new InvalidOperationException("Modül seçimi zorunlu.");

        var modulePath = dto.ModulePath.Trim().ToLowerInvariant();
        var groupKey = string.IsNullOrWhiteSpace(dto.GroupKey) ? "raporlar" : dto.GroupKey.Trim().ToLowerInvariant();
        var title = dto.Title.Trim();
        var exportKey = string.IsNullOrWhiteSpace(dto.ExportKey)
            ? $"menu-{modulePath}-{Slug(title)}"
            : dto.ExportKey.Trim();

        EnsureOpen();
        await EnsureTableAsync(_db, ct);

        if (id is null or <= 0)
        {
            var newId = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_SqlReportMenu (ExportKey, ModulePath, GroupKey, Title, SortOrder, IsActive)
                OUTPUT INSERTED.Id
                VALUES (@ExportKey, @ModulePath, @GroupKey, @Title, @SortOrder, @IsActive)
                """,
                new
                {
                    ExportKey = exportKey,
                    ModulePath = modulePath,
                    GroupKey = groupKey,
                    Title = title,
                    dto.SortOrder,
                    dto.IsActive,
                },
                cancellationToken: ct));
            return (await ListMenusAsync(isAdmin: true, ct: ct)).First(m => m.Id == newId);
        }

        var affected = await _db.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.SYS_SqlReportMenu SET
              ExportKey = @ExportKey,
              ModulePath = @ModulePath,
              GroupKey = @GroupKey,
              Title = @Title,
              SortOrder = @SortOrder,
              IsActive = @IsActive,
              UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @Id
            """,
            new
            {
                Id = id.Value,
                ExportKey = exportKey,
                ModulePath = modulePath,
                GroupKey = groupKey,
                Title = title,
                dto.SortOrder,
                dto.IsActive,
            },
            cancellationToken: ct));

        if (affected == 0)
            throw new InvalidOperationException("Menü bulunamadı.");

        return (await ListMenusAsync(isAdmin: true, ct: ct)).First(m => m.Id == id.Value);
    }

    public async Task DeleteMenuAsync(int id, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_SqlReport SET MenuId = NULL, MenuDisplayName = NULL, MenuSortOrder = NULL WHERE MenuId = @id",
            new { id },
            cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportMenu WHERE Id = @id",
            new { id },
            cancellationToken: ct));
    }

    public async Task<SqlReportPackageDto> ExportPackageAsync(IEnumerable<int>? reportIds, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var ids = reportIds?.Where(x => x > 0).Distinct().ToList() ?? new List<int>();

        IReadOnlyList<SqlReportDto> reports;
        if (ids.Count == 0)
            reports = await ListAsync(null, ct);
        else
        {
            var all = await ListAsync(null, ct);
            reports = all.Where(r => ids.Contains(r.Id)).ToList();
        }

        var menuIds = reports.Where(r => r.MenuId is > 0).Select(r => r.MenuId!.Value).Distinct().ToHashSet();
        var menus = (await ListMenusAsync(isAdmin: true, ct: ct)).Where(m => menuIds.Contains(m.Id) || ids.Count == 0).ToList();
        if (ids.Count > 0)
            menus = menus.Where(m => menuIds.Contains(m.Id)).ToList();

        var package = new SqlReportPackageDto
        {
            Menus = menus.Select(m => new SqlReportPackageMenuDto
            {
                ExportKey = m.ExportKey,
                ModulePath = m.ModulePath,
                GroupKey = m.GroupKey,
                Title = m.Title,
                SortOrder = m.SortOrder,
                IsActive = m.IsActive,
            }).ToList(),
            Reports = reports.Select(r => new SqlReportPackageReportDto
            {
                ExportKey = r.ExportKey ?? $"rpt-{r.Id}",
                Name = r.Name,
                ReportGroup = r.ReportGroup,
                Description = r.Description,
                QueryTemplate = r.QueryTemplate,
                PreQueryTemplate = r.PreQueryTemplate,
                FiltersConfig = r.FiltersConfig,
                ChartConfig = r.ChartConfig,
                KpiConfig = r.KpiConfig,
                ColumnFormats = r.ColumnFormats,
                PivotConfig = r.PivotConfig,
                CalendarConfig = r.CalendarConfig,
                AdvancedFeaturesConfig = r.AdvancedFeaturesConfig,
                CachedColumns = r.CachedColumns,
                AuxQueriesConfig = r.AuxQueriesConfig,
                CalculatedColumns = r.CalculatedColumns,
                ConditionalFormattingConfig = r.ConditionalFormattingConfig,
                ReportColor = r.ReportColor,
                AllowExport = r.AllowExport,
                AllowPdfExport = r.AllowPdfExport,
                AllowSimulation = r.AllowSimulation,
                ShowDataTable = r.ShowDataTable,
                ShowPivotTable = r.ShowPivotTable,
                ShowCalendar = r.ShowCalendar,
                RestrictUsers = r.RestrictUsers,
                IsActive = r.IsActive,
                MenuExportKey = menus.FirstOrDefault(m => m.Id == r.MenuId)?.ExportKey,
                MenuDisplayName = r.MenuDisplayName,
                MenuSortOrder = r.MenuSortOrder,
            }).ToList(),
        };
        return package;
    }

    public async Task<IReadOnlyList<SqlReportUserDto>> ListUsersAsync(CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);

        if (await _db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.SystemUser', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 0)
        {
            return Array.Empty<SqlReportUserDto>();
        }

        var rows = await _db.QueryAsync<SqlReportUserDto>(new CommandDefinition(
            """
            SELECT SystemUserID AS SystemUserId,
                   NickName,
                   Name,
                   Surname,
                   IsActive
            FROM dbo.SystemUser
            ORDER BY IsActive DESC, Name, Surname, NickName
            """,
            cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<bool> CanUserAccessAsync(int reportId, int userId, bool needRun, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var report = await GetAsync(reportId, ct);
        if (report is null) return false;
        if (!report.RestrictUsers) return true;

        var userFlags = await _db.QueryFirstOrDefaultAsync<AuthFlagsRow>(new CommandDefinition(
            """
            SELECT CanView, CanRun
            FROM dbo.SYS_SqlReportAuth
            WHERE ReportId = @reportId AND SystemUserID = @userId
            """,
            new { reportId, userId },
            cancellationToken: ct));

        if (userFlags != null)
        {
            if (!userFlags.CanView) return false;
            if (needRun && !userFlags.CanRun) return false;
            return true;
        }

        var roleFlags = await _db.QueryFirstOrDefaultAsync<AuthFlagsRow>(new CommandDefinition(
            """
            SELECT CAST(MAX(CAST(ra.CanView AS INT)) AS BIT) AS CanView,
                   CAST(MAX(CAST(ra.CanRun AS INT)) AS BIT) AS CanRun
            FROM dbo.SYS_SqlReportRoleAuth ra
            INNER JOIN dbo.SYS_UserRole ur ON ur.RoleId = ra.RoleId AND ur.SystemUserID = @userId
            INNER JOIN dbo.SYS_Role r ON r.Id = ur.RoleId AND r.IsActive = 1
            WHERE ra.ReportId = @reportId
            """,
            new { reportId, userId },
            cancellationToken: ct));

        if (roleFlags is null || !roleFlags.CanView) return false;
        if (needRun && !roleFlags.CanRun) return false;
        return true;
    }

    private sealed class AuthFlagsRow
    {
        public bool CanView { get; set; }
        public bool CanRun { get; set; }
    }

    public async Task<SqlReportAuthStateDto> GetReportAuthAsync(int reportId, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var report = await GetAsync(reportId, ct)
            ?? throw new InvalidOperationException("Rapor bulunamadı.");

        var users = (await _db.QueryAsync<SqlReportAuthUserDto>(new CommandDefinition(
            """
            SELECT a.SystemUserID AS SystemUserId,
                   u.NickName,
                   LTRIM(RTRIM(ISNULL(u.Name, N'') + N' ' + ISNULL(u.Surname, N''))) AS DisplayName,
                   a.CanView,
                   a.CanRun
            FROM dbo.SYS_SqlReportAuth a
            LEFT JOIN dbo.SystemUser u ON u.SystemUserID = a.SystemUserID
            WHERE a.ReportId = @reportId
            ORDER BY u.Name, u.Surname, u.NickName, a.SystemUserID
            """,
            new { reportId },
            cancellationToken: ct))).AsList();

        foreach (var u in users)
        {
            if (string.IsNullOrWhiteSpace(u.DisplayName))
                u.DisplayName = u.NickName ?? $"Kullanıcı #{u.SystemUserId}";
        }

        var roles = (await _db.QueryAsync<SqlReportAuthRoleDto>(new CommandDefinition(
            """
            SELECT ra.RoleId, r.Code, r.Name, ra.CanView, ra.CanRun
            FROM dbo.SYS_SqlReportRoleAuth ra
            INNER JOIN dbo.SYS_Role r ON r.Id = ra.RoleId
            WHERE ra.ReportId = @reportId
            ORDER BY r.SortOrder, r.Name
            """,
            new { reportId },
            cancellationToken: ct))).AsList();

        return new SqlReportAuthStateDto
        {
            ReportId = reportId,
            RestrictUsers = report.RestrictUsers,
            Users = users,
            Roles = roles,
        };
    }

    public async Task<SqlReportAuthStateDto> SaveReportAuthAsync(
        int reportId,
        SqlReportAuthSaveDto dto,
        CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        _ = await GetAsync(reportId, ct) ?? throw new InvalidOperationException("Rapor bulunamadı.");

        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.SYS_SqlReport SET RestrictUsers = @restrict, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id",
            new { id = reportId, restrict = dto.RestrictUsers },
            cancellationToken: ct));

        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportAuth WHERE ReportId = @id",
            new { id = reportId },
            cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportRoleAuth WHERE ReportId = @id",
            new { id = reportId },
            cancellationToken: ct));

        var users = (dto.Users ?? new())
            .Where(u => u.SystemUserId > 0)
            .GroupBy(u => u.SystemUserId)
            .Select(g => g.First())
            .ToList();

        foreach (var u in users)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_SqlReportAuth (ReportId, SystemUserID, CanView, CanRun)
                VALUES (@ReportId, @SystemUserId, @CanView, @CanRun)
                """,
                new
                {
                    ReportId = reportId,
                    u.SystemUserId,
                    CanView = u.CanView,
                    CanRun = u.CanRun,
                },
                cancellationToken: ct));
        }

        var roles = (dto.Roles ?? new())
            .Where(r => r.RoleId > 0)
            .GroupBy(r => r.RoleId)
            .Select(g => g.First())
            .ToList();

        foreach (var r in roles)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_SqlReportRoleAuth (ReportId, RoleId, CanView, CanRun)
                SELECT @ReportId, @RoleId, @CanView, @CanRun
                WHERE EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Id = @RoleId)
                """,
                new
                {
                    ReportId = reportId,
                    r.RoleId,
                    CanView = r.CanView,
                    CanRun = r.CanRun,
                },
                cancellationToken: ct));
        }

        return await GetReportAuthAsync(reportId, ct);
    }

    public async Task<SqlReportUserAuthStateDto> GetUserAuthAsync(int systemUserId, CancellationToken ct = default)
    {
        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var reports = await ListAsync(null, ct);
        var assigned = (await _db.QueryAsync<(int ReportId, bool CanView, bool CanRun)>(new CommandDefinition(
            """
            SELECT ReportId, CanView, CanRun
            FROM dbo.SYS_SqlReportAuth
            WHERE SystemUserID = @systemUserId
            """,
            new { systemUserId },
            cancellationToken: ct))).ToDictionary(x => x.ReportId, x => x);

        return new SqlReportUserAuthStateDto
        {
            SystemUserId = systemUserId,
            Reports = reports.Select(r =>
            {
                assigned.TryGetValue(r.Id, out var a);
                var has = assigned.ContainsKey(r.Id);
                return new SqlReportUserAuthItemDto
                {
                    ReportId = r.Id,
                    Name = r.Name,
                    ReportGroup = r.ReportGroup,
                    RestrictUsers = r.RestrictUsers,
                    Assigned = has,
                    CanView = has ? a.CanView : true,
                    CanRun = has ? a.CanRun : true,
                };
            }).ToList(),
        };
    }

    public async Task<SqlReportUserAuthStateDto> SaveUserAuthAsync(
        int systemUserId,
        SqlReportUserAuthSaveDto dto,
        CancellationToken ct = default)
    {
        if (systemUserId <= 0)
            throw new InvalidOperationException("Geçersiz kullanıcı.");

        EnsureOpen();
        await EnsureTableAsync(_db, ct);

        var wanted = (dto.ReportIds ?? new()).Where(x => x > 0).Distinct().ToHashSet();

        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_SqlReportAuth WHERE SystemUserID = @systemUserId",
            new { systemUserId },
            cancellationToken: ct));

        foreach (var reportId in wanted)
        {
            await _db.ExecuteAsync(new CommandDefinition(
                """
                INSERT INTO dbo.SYS_SqlReportAuth (ReportId, SystemUserID, CanView, CanRun)
                VALUES (@reportId, @systemUserId, 1, 1)
                """,
                new { reportId, systemUserId },
                cancellationToken: ct));

            // Kullanıcıdan atanınca kısıtlamayı aç
            await _db.ExecuteAsync(new CommandDefinition(
                """
                UPDATE dbo.SYS_SqlReport
                SET RestrictUsers = 1, UpdatedAt = SYSUTCDATETIME()
                WHERE Id = @reportId AND ISNULL(RestrictUsers, 0) = 0
                """,
                new { reportId },
                cancellationToken: ct));
        }

        return await GetUserAuthAsync(systemUserId, ct);
    }

    public async Task<SqlReportImportResult> ImportPackageAsync(SqlReportPackageDto package, CancellationToken ct = default)
    {
        if (package == null || package.Format != "kavisoft-sql-reports")
            throw new InvalidOperationException("Geçersiz paket formatı (kavisoft-sql-reports bekleniyor).");

        EnsureOpen();
        await EnsureTableAsync(_db, ct);
        var result = new SqlReportImportResult();
        var menuKeyToId = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var menu in package.Menus ?? new())
        {
            if (string.IsNullOrWhiteSpace(menu.ExportKey) || string.IsNullOrWhiteSpace(menu.Title))
                continue;

            var existingId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                "SELECT Id FROM dbo.SYS_SqlReportMenu WHERE ExportKey = @key",
                new { key = menu.ExportKey.Trim() },
                cancellationToken: ct));

            var saved = await UpsertMenuAsync(existingId, new SqlReportMenuSaveDto
            {
                ExportKey = menu.ExportKey.Trim(),
                ModulePath = menu.ModulePath,
                GroupKey = menu.GroupKey,
                Title = menu.Title,
                SortOrder = menu.SortOrder,
                IsActive = menu.IsActive,
            }, ct);
            menuKeyToId[saved.ExportKey] = saved.Id;
            result.MenusUpserted++;
        }

        // Mevcut menüleri de map'e ekle
        foreach (var m in await ListMenusAsync(isAdmin: true, ct: ct))
            menuKeyToId[m.ExportKey] = m.Id;

        foreach (var rpt in package.Reports ?? new())
        {
            if (string.IsNullOrWhiteSpace(rpt.Name) || string.IsNullOrWhiteSpace(rpt.QueryTemplate))
            {
                result.Messages.Add("Atlandı: adı veya sorgusu boş rapor.");
                continue;
            }

            ValidateQuery(rpt.QueryTemplate, allowWrite: false);
            if (!string.IsNullOrWhiteSpace(rpt.PreQueryTemplate))
                ValidateQuery(rpt.PreQueryTemplate, allowWrite: true);

            var key = string.IsNullOrWhiteSpace(rpt.ExportKey)
                ? $"rpt-{Slug(rpt.Name)}"
                : rpt.ExportKey.Trim();

            var existingId = await _db.ExecuteScalarAsync<int?>(new CommandDefinition(
                "SELECT Id FROM dbo.SYS_SqlReport WHERE ExportKey = @key",
                new { key },
                cancellationToken: ct));

            int? menuId = null;
            if (!string.IsNullOrWhiteSpace(rpt.MenuExportKey) &&
                menuKeyToId.TryGetValue(rpt.MenuExportKey.Trim(), out var mid))
            {
                menuId = mid;
            }

            await UpsertAsync(existingId, new SqlReportSaveDto
            {
                Name = rpt.Name,
                ReportGroup = rpt.ReportGroup,
                Description = rpt.Description,
                QueryTemplate = rpt.QueryTemplate,
                PreQueryTemplate = rpt.PreQueryTemplate,
                FiltersConfig = rpt.FiltersConfig,
                ChartConfig = rpt.ChartConfig,
                KpiConfig = rpt.KpiConfig,
                ColumnFormats = rpt.ColumnFormats,
                PivotConfig = rpt.PivotConfig,
                CalendarConfig = rpt.CalendarConfig,
                AdvancedFeaturesConfig = rpt.AdvancedFeaturesConfig,
                CachedColumns = rpt.CachedColumns,
                AuxQueriesConfig = rpt.AuxQueriesConfig,
                CalculatedColumns = rpt.CalculatedColumns,
                ConditionalFormattingConfig = rpt.ConditionalFormattingConfig,
                ReportColor = rpt.ReportColor,
                AllowExport = rpt.AllowExport,
                AllowPdfExport = rpt.AllowPdfExport,
                AllowSimulation = rpt.AllowSimulation,
                ShowDataTable = rpt.ShowDataTable,
                ShowPivotTable = rpt.ShowPivotTable,
                ShowCalendar = rpt.ShowCalendar,
                RestrictUsers = rpt.RestrictUsers,
                IsActive = rpt.IsActive,
                MenuId = menuId,
                MenuDisplayName = rpt.MenuDisplayName,
                MenuSortOrder = rpt.MenuSortOrder,
                ExportKey = key,
                CreatedBy = "import",
            }, ct);
            result.ReportsUpserted++;
        }

        result.Messages.Add($"{result.MenusUpserted} menü, {result.ReportsUpserted} rapor aktarıldı.");
        return result;
    }

    private static string Slug(string text)
    {
        var s = text.Trim().ToLowerInvariant();
        s = s.Replace('ı', 'i').Replace('ğ', 'g').Replace('ü', 'u').Replace('ş', 's')
            .Replace('ö', 'o').Replace('ç', 'c').Replace('İ', 'i');
        s = Regex.Replace(s, @"[^a-z0-9]+", "-");
        s = s.Trim('-');
        if (s.Length > 40) s = s[..40].Trim('-');
        return string.IsNullOrEmpty(s) ? Guid.NewGuid().ToString("N")[..8] : s;
    }

    private sealed class SqlReportMenuItemRow
    {
        public int Id { get; set; }
        public int? MenuId { get; set; }
        public string Name { get; set; } = "";
        public string? MenuDisplayName { get; set; }
        public int? MenuSortOrder { get; set; }
        public bool IsActive { get; set; }
        public string? ExportKey { get; set; }
    }
}
