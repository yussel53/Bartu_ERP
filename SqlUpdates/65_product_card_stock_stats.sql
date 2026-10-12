-- 65: ProductCard stok / sipariş özet kolonları
-- Değerler API tarafında RefreshProductCardStats ile güncellenir; burada kolon + sıfır öndeğer

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'StockQty') IS NULL
    ALTER TABLE dbo.ProductCard ADD StockQty FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'SalesOrderQty') IS NULL
    ALTER TABLE dbo.ProductCard ADD SalesOrderQty FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'PurchaseOrderQty') IS NULL
    ALTER TABLE dbo.ProductCard ADD PurchaseOrderQty FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'MainUnitName') IS NULL
    ALTER TABLE dbo.ProductCard ADD MainUnitName NVARCHAR(50) NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'StockQty') IS NOT NULL
BEGIN
  UPDATE dbo.ProductCard SET StockQty = 0 WHERE ProductCardID > 0 AND StockQty IS NULL;
  UPDATE dbo.ProductCard SET SalesOrderQty = 0 WHERE ProductCardID > 0 AND SalesOrderQty IS NULL;
  UPDATE dbo.ProductCard SET PurchaseOrderQty = 0 WHERE ProductCardID > 0 AND PurchaseOrderQty IS NULL;
END
GO

-- Ana birim adı (DefaultUnitID katalog)
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'MainUnitName') IS NOT NULL
BEGIN
  UPDATE dbo.ProductCard
  SET MainUnitName = CASE DefaultUnitID
    WHEN 1 THEN N'Adet'
    WHEN 2 THEN N'Koli'
    WHEN 3 THEN N'Paket'
    WHEN 4 THEN N'Kg'
    WHEN 5 THEN N'Litre'
    WHEN 6 THEN N'Metre'
    WHEN 7 THEN N'Saat'
    WHEN 8 THEN N'Gün'
    ELSE CAST(DefaultUnitID AS NVARCHAR(20))
  END
  WHERE ProductCardID > 0
    AND DefaultUnitID IS NOT NULL
    AND (MainUnitName IS NULL OR LTRIM(RTRIM(MainUnitName)) = N'');
END
GO
