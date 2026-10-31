-- 97: İzleme üç tür.
-- TrackingMode / ProductSerialLot.Kind: 1 Lot (bir numara, çok miktar) · 2 Seri (1 numara = 1 adet) · 3 Seri grubu (çok seri no = 1 adet)
-- Eski 2 (seri lot grubu) → 3. Eski 1 lot olarak kalır.

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'TrackingMode') IS NOT NULL
  UPDATE dbo.ProductCard SET TrackingMode = 3 WHERE TrackingMode = 2;
GO

IF OBJECT_ID(N'dbo.ProductSerialLot', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductSerialLot', N'Kind') IS NOT NULL
  UPDATE dbo.ProductSerialLot SET Kind = 3 WHERE Kind = 2;
GO

IF OBJECT_ID(N'dbo.ProductSerialLotItem', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductSerialLotItem (
    ProductSerialLotItemID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductSerialLotItem PRIMARY KEY,
    ProductSerialLotID     INT            NOT NULL,
    SerialNo               NVARCHAR(80)   NOT NULL
  );
  CREATE INDEX IX_ProductSerialLotItem_Lot ON dbo.ProductSerialLotItem (ProductSerialLotID);
END
GO
