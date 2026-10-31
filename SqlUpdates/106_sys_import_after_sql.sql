-- Aktarım profiline, kayıt düştükten sonra kaynakta çalışacak UPDATE

IF OBJECT_ID(N'dbo.SYS_ImportProfile', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_ImportProfile', N'AfterSql') IS NULL
  ALTER TABLE dbo.SYS_ImportProfile ADD AfterSql NVARCHAR(MAX) NULL;
GO
