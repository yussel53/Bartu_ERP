-- Banka hesabı: entegrasyon kanalı ve bağlantı bilgisi
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegEnabled') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegEnabled BIT NULL;
GO
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegBank') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegBank NVARCHAR(40) NULL;
GO
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegCustomerNo') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegCustomerNo NVARCHAR(50) NULL;
GO
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegBranch') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegBranch NVARCHAR(20) NULL;
GO
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegUser') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegUser NVARCHAR(100) NULL;
GO
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegSecret') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegSecret NVARCHAR(200) NULL;
GO
IF COL_LENGTH(N'dbo.BankAccountCard', N'IntegEndpoint') IS NULL
  ALTER TABLE dbo.BankAccountCard ADD IntegEndpoint NVARCHAR(250) NULL;
GO
