-- Genel Durum: sekmeler + SQL rapor / özel SQL widget bağları

IF OBJECT_ID(N'dbo.SYS_DashboardTab', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_DashboardTab (
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_DashboardTab PRIMARY KEY,
    ExportKey           NVARCHAR(80) NOT NULL,
    Title               NVARCHAR(120) NOT NULL,
    SortOrder           INT NOT NULL CONSTRAINT DF_SYS_DashboardTab_Sort DEFAULT (10),
    IsActive            BIT NOT NULL CONSTRAINT DF_SYS_DashboardTab_Active DEFAULT (1),
    ShowBuiltInSummary  BIT NOT NULL CONSTRAINT DF_SYS_DashboardTab_BuiltIn DEFAULT (0),
    CreatedAt           DATETIME2 NOT NULL CONSTRAINT DF_SYS_DashboardTab_Created DEFAULT (SYSUTCDATETIME()),
    UpdatedAt           DATETIME2 NULL,
    CONSTRAINT UQ_SYS_DashboardTab_ExportKey UNIQUE (ExportKey)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_DashboardTabItem', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_DashboardTabItem (
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_DashboardTabItem PRIMARY KEY,
    TabId           INT NOT NULL,
    SqlReportId     INT NULL,
    DisplayName     NVARCHAR(150) NULL,
    QueryTemplate   NVARCHAR(MAX) NULL,   -- SqlReportId yoksa özel SQL
    KpiConfig       NVARCHAR(MAX) NULL,
    ChartConfig     NVARCHAR(MAX) NULL,
    ShowDataTable   BIT NOT NULL CONSTRAINT DF_SYS_DashItem_Table DEFAULT (0),
    ColSpan         INT NOT NULL CONSTRAINT DF_SYS_DashItem_Span DEFAULT (12), -- 6 veya 12
    SortOrder       INT NOT NULL CONSTRAINT DF_SYS_DashItem_Sort DEFAULT (10),
    IsActive        BIT NOT NULL CONSTRAINT DF_SYS_DashItem_Active DEFAULT (1),
    CONSTRAINT FK_SYS_DashboardTabItem_Tab
      FOREIGN KEY (TabId) REFERENCES dbo.SYS_DashboardTab (Id) ON DELETE CASCADE
  );

  CREATE NONCLUSTERED INDEX IX_SYS_DashboardTabItem_Tab
    ON dbo.SYS_DashboardTabItem (TabId, SortOrder)
    INCLUDE (IsActive, SqlReportId);
END
GO

-- Seed sekmeler
IF OBJECT_ID(N'dbo.SYS_DashboardTab', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTab WHERE ExportKey = N'ozet')
    INSERT INTO dbo.SYS_DashboardTab (ExportKey, Title, SortOrder, IsActive, ShowBuiltInSummary)
    VALUES (N'ozet', N'Özet', 10, 1, 1);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTab WHERE ExportKey = N'finans')
    INSERT INTO dbo.SYS_DashboardTab (ExportKey, Title, SortOrder, IsActive, ShowBuiltInSummary)
    VALUES (N'finans', N'Finans', 20, 1, 0);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTab WHERE ExportKey = N'malzeme')
    INSERT INTO dbo.SYS_DashboardTab (ExportKey, Title, SortOrder, IsActive, ShowBuiltInSummary)
    VALUES (N'malzeme', N'Malzeme', 30, 1, 0);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTab WHERE ExportKey = N'satis')
    INSERT INTO dbo.SYS_DashboardTab (ExportKey, Title, SortOrder, IsActive, ShowBuiltInSummary)
    VALUES (N'satis', N'Satış', 40, 1, 0);
END
GO

-- Seed: SQL rapor bağları (rapor varsa)
IF OBJECT_ID(N'dbo.SYS_DashboardTabItem', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
  DECLARE @finans INT = (SELECT TOP 1 Id FROM dbo.SYS_DashboardTab WHERE ExportKey = N'finans');
  DECLARE @malzeme INT = (SELECT TOP 1 Id FROM dbo.SYS_DashboardTab WHERE ExportKey = N'malzeme');
  DECLARE @satis INT = (SELECT TOP 1 Id FROM dbo.SYS_DashboardTab WHERE ExportKey = N'satis');
  DECLARE @rCari INT = (SELECT TOP 1 Id FROM dbo.SYS_SqlReport WHERE Name = N'Cari Kart Listesi');
  DECLARE @rMalzeme INT = (SELECT TOP 1 Id FROM dbo.SYS_SqlReport WHERE Name = N'Malzeme Kart Listesi');
  DECLARE @rSiparis INT = (SELECT TOP 1 Id FROM dbo.SYS_SqlReport WHERE Name = N'Sipariş Özeti (Tarih Aralığı)');

  IF @finans IS NOT NULL AND @rCari IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTabItem WHERE TabId = @finans AND SqlReportId = @rCari)
    INSERT INTO dbo.SYS_DashboardTabItem (TabId, SqlReportId, DisplayName, ShowDataTable, ColSpan, SortOrder)
    VALUES (@finans, @rCari, N'Cari özeti', 0, 12, 10);

  IF @malzeme IS NOT NULL AND @rMalzeme IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTabItem WHERE TabId = @malzeme AND SqlReportId = @rMalzeme)
    INSERT INTO dbo.SYS_DashboardTabItem (TabId, SqlReportId, DisplayName, ShowDataTable, ColSpan, SortOrder)
    VALUES (@malzeme, @rMalzeme, N'Malzeme özeti', 0, 12, 10);

  IF @satis IS NOT NULL AND @rSiparis IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.SYS_DashboardTabItem WHERE TabId = @satis AND SqlReportId = @rSiparis)
    INSERT INTO dbo.SYS_DashboardTabItem (TabId, SqlReportId, DisplayName, ShowDataTable, ColSpan, SortOrder)
    VALUES (@satis, @rSiparis, N'Sipariş özeti', 0, 12, 10);
END
GO
