-- 47: Malzeme / birim — geçerli olduğu yerler
-- UseInMaterial (Malzeme yönetimi), UseInSales (Satış ve dağıtım), UseInPurchase (Satın alma)

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'UseInMaterial') IS NULL
    ALTER TABLE dbo.ProductCard ADD UseInMaterial bit NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'UseInSales') IS NULL
    ALTER TABLE dbo.ProductCard ADD UseInSales bit NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'UseInPurchase') IS NULL
    ALTER TABLE dbo.ProductCard ADD UseInPurchase bit NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.ProductCard SET UseInMaterial = 1 WHERE UseInMaterial IS NULL;
  UPDATE dbo.ProductCard SET UseInSales = 1 WHERE UseInSales IS NULL;
  UPDATE dbo.ProductCard SET UseInPurchase = 1 WHERE UseInPurchase IS NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductUnit', N'UseInMaterial') IS NULL
    ALTER TABLE dbo.ProductUnit ADD UseInMaterial bit NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'UseInSales') IS NULL
    ALTER TABLE dbo.ProductUnit ADD UseInSales bit NULL;
  IF COL_LENGTH(N'dbo.ProductUnit', N'UseInPurchase') IS NULL
    ALTER TABLE dbo.ProductUnit ADD UseInPurchase bit NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.ProductUnit SET UseInMaterial = 1 WHERE UseInMaterial IS NULL;
  UPDATE dbo.ProductUnit SET UseInSales = 1 WHERE UseInSales IS NULL;
  UPDATE dbo.ProductUnit SET UseInPurchase = 1 WHERE UseInPurchase IS NULL;
END
GO
