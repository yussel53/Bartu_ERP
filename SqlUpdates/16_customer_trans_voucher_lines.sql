-- CustomerVoucher (başlık) ↔ CustomerTrans (satır): bir cari fişte N satır

IF OBJECT_ID(N'dbo.CustomerTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerTrans', N'CustomerVoucherID') IS NULL
    ALTER TABLE dbo.CustomerTrans ADD CustomerVoucherID INT NULL;

  IF COL_LENGTH(N'dbo.CustomerTrans', N'Description') IS NULL
    ALTER TABLE dbo.CustomerTrans ADD Description NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.CustomerTrans', N'Amount') IS NULL
    ALTER TABLE dbo.CustomerTrans ADD Amount FLOAT NULL;

  IF COL_LENGTH(N'dbo.CustomerTrans', N'LineNr') IS NULL
    ALTER TABLE dbo.CustomerTrans ADD LineNr INT NULL;

  IF COL_LENGTH(N'dbo.CustomerTrans', N'DueDate') IS NULL
    ALTER TABLE dbo.CustomerTrans ADD DueDate DATETIME NULL;
END
GO

IF OBJECT_ID(N'dbo.CustomerTrans', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerTrans_CustomerVoucherID'
      AND object_id = OBJECT_ID(N'dbo.CustomerTrans')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_CustomerTrans_CustomerVoucherID
    ON dbo.CustomerTrans (CustomerVoucherID);
END
GO
