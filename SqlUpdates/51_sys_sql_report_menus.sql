-- SQL rapor menü klasörleri + menü atama / Kavisoft aktarım anahtarı

IF OBJECT_ID(N'dbo.SYS_SqlReportMenu', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_SqlReportMenu (
    Id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportMenu PRIMARY KEY,
    ExportKey    NVARCHAR(80)  NOT NULL,
    ModulePath   NVARCHAR(50)  NOT NULL,  -- malzeme, finans, satis, ...
    GroupKey     NVARCHAR(50)  NOT NULL,  -- raporlar, ana-kayitlar, ...
    Title        NVARCHAR(150) NOT NULL,
    SortOrder    INT NOT NULL CONSTRAINT DF_SYS_SqlReportMenu_Sort DEFAULT (0),
    IsActive     BIT NOT NULL CONSTRAINT DF_SYS_SqlReportMenu_Active DEFAULT (1),
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportMenu_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt    DATETIME2 NULL,
    CONSTRAINT UQ_SYS_SqlReportMenu_ExportKey UNIQUE (ExportKey)
  );
  CREATE INDEX IX_SYS_SqlReportMenu_Module ON dbo.SYS_SqlReportMenu (ModulePath, GroupKey, SortOrder);
END
GO

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuId') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD MenuId INT NULL;
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuDisplayName') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD MenuDisplayName NVARCHAR(150) NULL;
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuSortOrder') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD MenuSortOrder INT NULL;
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ExportKey') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD ExportKey NVARCHAR(80) NULL;
END
GO

-- Mevcut raporlara ExportKey doldur
IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SYS_SqlReport', N'ExportKey') IS NOT NULL
BEGIN
  UPDATE r
  SET ExportKey = N'rpt-' + CAST(r.Id AS NVARCHAR(20))
  FROM dbo.SYS_SqlReport r
  WHERE r.ExportKey IS NULL OR LTRIM(RTRIM(r.ExportKey)) = N'';
END
GO

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SYS_SqlReport', N'ExportKey') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'UQ_SYS_SqlReport_ExportKey' AND object_id = OBJECT_ID(N'dbo.SYS_SqlReport')
  )
BEGIN
  CREATE UNIQUE INDEX UQ_SYS_SqlReport_ExportKey ON dbo.SYS_SqlReport (ExportKey) WHERE ExportKey IS NOT NULL;
END
GO

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuId') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_SYS_SqlReport_Menu'
  )
BEGIN
  ALTER TABLE dbo.SYS_SqlReport
    ADD CONSTRAINT FK_SYS_SqlReport_Menu
    FOREIGN KEY (MenuId) REFERENCES dbo.SYS_SqlReportMenu (Id) ON DELETE SET NULL;
END
GO

-- Örnek menü: Malzeme → Raporlar
IF OBJECT_ID(N'dbo.SYS_SqlReportMenu', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'menu-malzeme-detay')
BEGIN
  INSERT INTO dbo.SYS_SqlReportMenu (ExportKey, ModulePath, GroupKey, Title, SortOrder)
  VALUES (N'menu-malzeme-detay', N'malzeme', N'raporlar', N'Malzeme Detay Bilgi Listesi Raporları', 10);
END
GO

-- Örnek: Malzeme kart listesi raporunu bu menüye bağla
IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SYS_SqlReport', N'MenuId') IS NOT NULL
BEGIN
  DECLARE @menuId INT = (SELECT TOP 1 Id FROM dbo.SYS_SqlReportMenu WHERE ExportKey = N'menu-malzeme-detay');
  DECLARE @rptId INT = (SELECT TOP 1 Id FROM dbo.SYS_SqlReport WHERE Name = N'Malzeme Kart Listesi');
  IF @menuId IS NOT NULL AND @rptId IS NOT NULL
  BEGIN
    UPDATE dbo.SYS_SqlReport
    SET MenuId = @menuId,
        MenuDisplayName = N'Malzeme Kart Listesi',
        MenuSortOrder = 10
    WHERE Id = @rptId AND MenuId IS NULL;
  END
END
GO
