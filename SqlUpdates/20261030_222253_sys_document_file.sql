-- Belge / kart doküman yönetimi — istenildiği kadar PDF / Word / Excel / txt …
IF OBJECT_ID(N'dbo.SYS_DocumentFile', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_DocumentFile (
    DocumentFileID INT IDENTITY(1,1) NOT NULL,
    SourceTable    NVARCHAR(64)  NOT NULL,
    SourceID       INT           NOT NULL,
    FileName       NVARCHAR(260) NOT NULL,
    StoredName     NVARCHAR(80)  NOT NULL,
    ContentType    NVARCHAR(128) NULL,
    Extension      NVARCHAR(16)  NULL,
    SizeBytes      BIGINT        NULL,
    Title          NVARCHAR(200) NULL,
    Note           NVARCHAR(500) NULL,
    CreatedAt      DATETIME      NOT NULL CONSTRAINT DF_SYS_DocumentFile_CreatedAt DEFAULT (GETDATE()),
    CreatedBy      INT           NULL,
    CONSTRAINT PK_SYS_DocumentFile PRIMARY KEY CLUSTERED (DocumentFileID)
  );
END
GO

SET QUOTED_IDENTIFIER ON;
GO
IF OBJECT_ID(N'dbo.SYS_DocumentFile', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SYS_DocumentFile_Source'
      AND object_id = OBJECT_ID(N'dbo.SYS_DocumentFile')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_SYS_DocumentFile_Source
    ON dbo.SYS_DocumentFile (SourceTable, SourceID, DocumentFileID DESC);
END
GO
