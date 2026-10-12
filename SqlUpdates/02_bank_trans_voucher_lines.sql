-- BankVoucher (başlık) ↔ BankTrans (satır): bir fişte N havale / cari satırı
IF COL_LENGTH(N'dbo.BankVoucher', N'DocumentNumber') IS NULL
BEGIN
  ALTER TABLE dbo.BankVoucher ADD DocumentNumber NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH(N'dbo.BankVoucher', N'BankAccountCardID') IS NULL
BEGIN
  ALTER TABLE dbo.BankVoucher ADD BankAccountCardID INT NULL;
END
GO

IF COL_LENGTH(N'dbo.BankVoucher', N'Description') IS NULL
BEGIN
  ALTER TABLE dbo.BankVoucher ADD Description NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH(N'dbo.BankTrans', N'BankVoucherID') IS NULL
BEGIN
  ALTER TABLE dbo.BankTrans ADD BankVoucherID INT NULL;
END
GO

IF COL_LENGTH(N'dbo.BankTrans', N'CustomerID') IS NULL
BEGIN
  ALTER TABLE dbo.BankTrans ADD CustomerID INT NULL;
END
GO

IF COL_LENGTH(N'dbo.BankTrans', N'Description') IS NULL
BEGIN
  ALTER TABLE dbo.BankTrans ADD Description NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_BankTrans_BankVoucherID' AND object_id = OBJECT_ID(N'dbo.BankTrans')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_BankTrans_BankVoucherID ON dbo.BankTrans (BankVoucherID);
END
GO
