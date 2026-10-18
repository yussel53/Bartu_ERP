-- 84: E-Devlet — gelen e-İrsaliye → alış irsaliyesi (yol haritası E-05)
-- EGovDocument.ProductVoucherID: belgenin kaydedildiği alış irsaliyesi (ProductVoucher, VoucherType = 2).
-- Gelen e-faturadaki InvoiceID karşılığı; doluysa belge «kaydedildi» sayılır.

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovDocument', N'ProductVoucherID') IS NULL
  ALTER TABLE dbo.EGovDocument ADD ProductVoucherID INT NULL;
GO

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.EGovDocument', N'ProductVoucherID') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EGovDocument_ProductVoucherID' AND object_id = OBJECT_ID(N'dbo.EGovDocument'))
  CREATE INDEX IX_EGovDocument_ProductVoucherID ON dbo.EGovDocument (ProductVoucherID) WHERE ProductVoucherID IS NOT NULL;
GO
