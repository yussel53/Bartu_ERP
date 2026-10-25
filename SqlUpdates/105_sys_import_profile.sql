-- Veri aktarımı profili: SQL / API kaynağı, alan eşlemesi ve süreç zamanlaması

IF OBJECT_ID(N'dbo.SYS_ImportProfile', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ImportProfile (
    ImportProfileID     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ImportProfile PRIMARY KEY,
    Title               NVARCHAR(150) NOT NULL,
    Kind                NVARCHAR(30)  NOT NULL,
    -- 1 SQL Server · 2 MySQL · 3 REST API
    SourceKind          TINYINT NOT NULL,
    SourceJson          NVARCHAR(MAX) NULL,
    MapJson             NVARCHAR(MAX) NULL,
    Mode                NVARCHAR(20) NOT NULL CONSTRAINT DF_SYS_ImportProfile_Mode DEFAULT (N'upsert'),
    CreateMissingCards  BIT NOT NULL CONSTRAINT DF_SYS_ImportProfile_Cards DEFAULT (0),
    ProductType         INT NULL,
    IntervalMinutes     INT NULL,
    IsActive            BIT NOT NULL CONSTRAINT DF_SYS_ImportProfile_Active DEFAULT (1),
    ProcessDefID        INT NULL,
    LastRunAt           DATETIME2 NULL,
    NextRunAt           DATETIME2 NULL,
    LastStatus          NVARCHAR(500) NULL,
    CreatedAt           DATETIME2 NOT NULL CONSTRAINT DF_SYS_ImportProfile_Created DEFAULT (SYSDATETIME()),
    UpdatedAt           DATETIME2 NULL
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_ImportProfile', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SYS_ImportProfile_Due' AND object_id = OBJECT_ID(N'dbo.SYS_ImportProfile')
  )
  CREATE NONCLUSTERED INDEX IX_SYS_ImportProfile_Due
    ON dbo.SYS_ImportProfile (IsActive, NextRunAt)
    INCLUDE (Kind, SourceKind, IntervalMinutes);
GO
