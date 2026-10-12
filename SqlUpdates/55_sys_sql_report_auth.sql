-- SQL rapor yetkilendirme: rapor ↔ kullanıcı

IF OBJECT_ID(N'dbo.SYS_SqlReport', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_SqlReport', N'RestrictUsers') IS NULL
    ALTER TABLE dbo.SYS_SqlReport ADD RestrictUsers BIT NOT NULL
      CONSTRAINT DF_SYS_SqlReport_RestrictUsers DEFAULT (0);
END
GO

IF OBJECT_ID(N'dbo.SYS_SqlReportAuth', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_SqlReportAuth (
    Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportAuth PRIMARY KEY,
    ReportId      INT NOT NULL,
    SystemUserID  INT NOT NULL,
    CanView       BIT NOT NULL CONSTRAINT DF_SYS_SqlReportAuth_View DEFAULT (1),
    CanRun        BIT NOT NULL CONSTRAINT DF_SYS_SqlReportAuth_Run DEFAULT (1),
    CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportAuth_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SYS_SqlReportAuth_ReportUser UNIQUE (ReportId, SystemUserID)
  );

  CREATE NONCLUSTERED INDEX IX_SYS_SqlReportAuth_User
    ON dbo.SYS_SqlReportAuth (SystemUserID)
    INCLUDE (ReportId, CanView, CanRun);

  CREATE NONCLUSTERED INDEX IX_SYS_SqlReportAuth_Report
    ON dbo.SYS_SqlReportAuth (ReportId)
    INCLUDE (SystemUserID, CanView, CanRun);
END
GO
