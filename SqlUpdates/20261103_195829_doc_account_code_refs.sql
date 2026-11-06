-- Belge muhasebe kodu referansları
-- Invoice.CustomerAccountCardID = cari hesap
-- ProductTrans.AccountCardID / TaxAccountCardID = satır malzeme + KDV
-- ProductTransCalcDetail.AccountCardID = ek vergi / indirim satırları
-- CustomerTrans.AccountCardID = cari fiş satırı
-- BoundTrans.AccountCardID = çek/senet bordro hareketi

IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.Invoice', N'CustomerAccountCardID') IS NULL
  ALTER TABLE dbo.Invoice ADD CustomerAccountCardID INT NULL;
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductTrans', N'AccountCardID') IS NULL
    ALTER TABLE dbo.ProductTrans ADD AccountCardID INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'TaxAccountCardID') IS NULL
    ALTER TABLE dbo.ProductTrans ADD TaxAccountCardID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductTransCalcDetail', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductTransCalcDetail', N'AccountCardID') IS NULL
    ALTER TABLE dbo.ProductTransCalcDetail ADD AccountCardID INT NULL;
  IF COL_LENGTH(N'dbo.ProductTransCalcDetail', N'TaxCardID') IS NULL
    ALTER TABLE dbo.ProductTransCalcDetail ADD TaxCardID INT NULL;
  IF COL_LENGTH(N'dbo.ProductTransCalcDetail', N'TaxRate') IS NULL
    ALTER TABLE dbo.ProductTransCalcDetail ADD TaxRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductTransCalcDetail', N'Description') IS NULL
    ALTER TABLE dbo.ProductTransCalcDetail ADD Description NVARCHAR(250) NULL;
END
GO

IF OBJECT_ID(N'dbo.CustomerTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerTrans', N'AccountCardID') IS NULL
  ALTER TABLE dbo.CustomerTrans ADD AccountCardID INT NULL;
GO

IF OBJECT_ID(N'dbo.BoundTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.BoundTrans', N'AccountCardID') IS NULL
  ALTER TABLE dbo.BoundTrans ADD AccountCardID INT NULL;
GO
