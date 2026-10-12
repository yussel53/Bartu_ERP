-- VariantCard → ProductCard bağlantı indeksi (kart içinde varyant sekmesi)
-- ProductCardID kolonu Create_DB'de zaten var

IF OBJECT_ID(N'dbo.VariantCard', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_VariantCard_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.VariantCard')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_VariantCard_ProductCardID
    ON dbo.VariantCard (ProductCardID);
END
GO
