-- PHP Raporlama eksikleri: aux query, calculated cols, conditional format, what-if

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AuxQueriesConfig') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD AuxQueriesConfig NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'CalculatedColumns') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD CalculatedColumns NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'ConditionalFormattingConfig') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD ConditionalFormattingConfig NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'AllowSimulation') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD AllowSimulation BIT NOT NULL
      CONSTRAINT DF_SYS_SqlReport_AllowSim DEFAULT (1);
END
GO
