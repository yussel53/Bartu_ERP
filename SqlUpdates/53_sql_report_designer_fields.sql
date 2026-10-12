-- Raporlama / Nova Sierra tasarımcı alanları

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
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
    ALTER TABLE dbo.SYS_SqlReport ADD ShowDataTable BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_ShowData DEFAULT (1);
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ShowPivotTable') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD ShowPivotTable BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_ShowPivot DEFAULT (0);
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ShowCalendar') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD ShowCalendar BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_ShowCal DEFAULT (0);
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AllowPdfExport') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD AllowPdfExport BIT NOT NULL CONSTRAINT DF_SYS_SqlReport_AllowPdf DEFAULT (0);
END
GO
