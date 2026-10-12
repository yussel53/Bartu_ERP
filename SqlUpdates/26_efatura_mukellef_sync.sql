-- 26: e-Fatura mükellef GİB senkron meta + staging
IF OBJECT_ID(N'dbo.SYS_EFaturaMukellefSync', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_EFaturaMukellefSync (
    SyncID INT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_SYS_EFaturaMukellefSync PRIMARY KEY,
    StartedAt DATETIME NOT NULL
      CONSTRAINT DF_SYS_EFaturaMukellefSync_StartedAt DEFAULT (GETDATE()),
    FinishedAt DATETIME NULL,
    Status NVARCHAR(20) NOT NULL,
    Mode NVARCHAR(30) NULL,
    PkImported INT NULL,
    GbImported INT NULL,
    TotalLocal INT NULL,
    Message NVARCHAR(1000) NULL,
    SourceUrl NVARCHAR(500) NULL
  );
END
GO

IF OBJECT_ID(N'dbo.EFaturaMukellef_Import', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EFaturaMukellef_Import (
    TaxNr NVARCHAR(11) NOT NULL,
    Title NVARCHAR(500) NULL,
    Alias NVARCHAR(250) NOT NULL,
    AliasType NVARCHAR(10) NULL,
    UnitType NVARCHAR(50) NULL,
    FirstCreateDate DATETIME NULL
  );
  CREATE NONCLUSTERED INDEX IX_EFaturaMukellef_Import_TaxNr
    ON dbo.EFaturaMukellef_Import (TaxNr);
END
GO
