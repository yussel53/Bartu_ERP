-- Satır vergi kodu + oran; TaxCard.Rate

IF OBJECT_ID(N'dbo.TaxCard', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.TaxCard', N'Rate') IS NULL
  ALTER TABLE dbo.TaxCard ADD Rate FLOAT NULL;
GO

-- OrderTrans satır vergi / birim / net
IF OBJECT_ID(N'dbo.OrderTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.OrderTrans', N'TaxCardID') IS NULL
    ALTER TABLE dbo.OrderTrans ADD TaxCardID INT NULL;
  IF COL_LENGTH(N'dbo.OrderTrans', N'TaxRate') IS NULL
    ALTER TABLE dbo.OrderTrans ADD TaxRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.OrderTrans', N'TotalTax') IS NULL
    ALTER TABLE dbo.OrderTrans ADD TotalTax FLOAT NULL;
  IF COL_LENGTH(N'dbo.OrderTrans', N'NetTotal') IS NULL
    ALTER TABLE dbo.OrderTrans ADD NetTotal FLOAT NULL;
  IF COL_LENGTH(N'dbo.OrderTrans', N'Description2') IS NULL
    ALTER TABLE dbo.OrderTrans ADD Description2 NVARCHAR(250) NULL;
  IF COL_LENGTH(N'dbo.OrderTrans', N'AuxilCode') IS NULL
    ALTER TABLE dbo.OrderTrans ADD AuxilCode NVARCHAR(50) NULL;
END
GO

-- ProductTrans (irsaliye + fatura satırları)
IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductTrans', N'TaxCardID') IS NULL
    ALTER TABLE dbo.ProductTrans ADD TaxCardID INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'TaxRate') IS NULL
    ALTER TABLE dbo.ProductTrans ADD TaxRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'NetTotal') IS NULL
    ALTER TABLE dbo.ProductTrans ADD NetTotal FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'Description2') IS NULL
    ALTER TABLE dbo.ProductTrans ADD Description2 NVARCHAR(250) NULL;
END
GO
