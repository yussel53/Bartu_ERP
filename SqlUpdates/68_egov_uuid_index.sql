-- EGovDocument UUID / belge no indeks (e-Logo senkron upsert)

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_EGovDocument_UUID' AND object_id = OBJECT_ID(N'dbo.EGovDocument')
  )
    CREATE NONCLUSTERED INDEX IX_EGovDocument_UUID
      ON dbo.EGovDocument (UUID)
      WHERE UUID IS NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_EGovDocument_DocNo' AND object_id = OBJECT_ID(N'dbo.EGovDocument')
  )
    CREATE NONCLUSTERED INDEX IX_EGovDocument_DocNo
      ON dbo.EGovDocument (DocumentNo, DocKind, Direction)
      WHERE DocumentNo IS NOT NULL;
END
GO
