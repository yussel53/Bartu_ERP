-- Belge satır FK / kolon tamamlayıcıları

-- OrderTrans: OrderVoucherID (OrderSlipID ile eş anlamlı kullanım)
IF OBJECT_ID(N'dbo.OrderTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.OrderTrans', N'OrderVoucherID') IS NULL
    ALTER TABLE dbo.OrderTrans ADD OrderVoucherID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.OrderTrans', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_OrderTrans_OrderVoucherID'
      AND object_id = OBJECT_ID(N'dbo.OrderTrans')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_OrderTrans_OrderVoucherID
    ON dbo.OrderTrans (OrderVoucherID);
END
GO

-- CustomerTrans: Amount yoksa LocalAmount'a yansıtmak için Amount kolonu (16'da da var, idempotent)
IF OBJECT_ID(N'dbo.CustomerTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerTrans', N'Amount') IS NULL
    ALTER TABLE dbo.CustomerTrans ADD Amount FLOAT NULL;
END
GO
