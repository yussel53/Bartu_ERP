-- Süreç örneği: başlarken doldurulan ortak nesne (belge, cari, adres, satır)
IF OBJECT_ID(N'dbo.SYS_ProcessInstance', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_ProcessInstance', N'DataJson') IS NULL
  ALTER TABLE dbo.SYS_ProcessInstance ADD DataJson NVARCHAR(MAX) NULL;
GO
