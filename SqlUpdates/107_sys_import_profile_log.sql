-- Aktarım profilinde log takibi ve log satırının profile bağlanması

IF OBJECT_ID(N'dbo.SYS_ImportProfile', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_ImportProfile', N'KeepLog') IS NULL
  ALTER TABLE dbo.SYS_ImportProfile ADD KeepLog BIT NOT NULL
    CONSTRAINT DF_SYS_ImportProfile_KeepLog DEFAULT (1);
GO

IF OBJECT_ID(N'dbo.SYS_ImportLog', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_ImportLog', N'ImportProfileID') IS NULL
  ALTER TABLE dbo.SYS_ImportLog ADD ImportProfileID INT NULL;
GO

IF OBJECT_ID(N'dbo.SYS_ImportLog', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_ImportLog', N'ImportProfileID') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = N'IX_SYS_ImportLog_Profile' AND object_id = OBJECT_ID(N'dbo.SYS_ImportLog')
   )
  CREATE INDEX IX_SYS_ImportLog_Profile ON dbo.SYS_ImportLog (ImportProfileID, ImportedAt DESC);
GO
