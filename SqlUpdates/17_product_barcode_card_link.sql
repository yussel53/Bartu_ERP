-- ProductBarcode → ProductCard bağlantısı (kart içinde barkod sekmesi)

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductBarcode', N'ProductCardID') IS NULL
    ALTER TABLE dbo.ProductBarcode ADD ProductCardID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductBarcode_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductBarcode')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductBarcode_ProductCardID
    ON dbo.ProductBarcode (ProductCardID);
END
GO
