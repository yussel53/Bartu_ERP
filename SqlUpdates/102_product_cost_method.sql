-- 102: Malzeme kartı maliyet hesaplama yöntemi.
-- CostMethod: 0 hareketli ağırlıklı ortalama · 1 dönemsel ortalama · 2 FIFO · 3 LIFO · 4 son alış · 5 standart
-- StandardCost: yöntem 5 için birim maliyet. Öndeğer kart (ProductCardID = -1) CostMethod 0.

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'CostMethod') IS NULL
    ALTER TABLE dbo.ProductCard ADD CostMethod TINYINT NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'StandardCost') IS NULL
    ALTER TABLE dbo.ProductCard ADD StandardCost FLOAT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'CostMethod') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.ProductCard WHERE ProductCardID = -1)
BEGIN
  UPDATE dbo.ProductCard
  SET CostMethod = ISNULL(CostMethod, 0)
  WHERE ProductCardID = -1;
END
GO
