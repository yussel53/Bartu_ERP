-- 44: Malzeme birim çevirimi (ProductUnit) + barkodun birime bağlanması (ProductBarcode.UnitID)

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductUnit (
    ProductUnitID int IDENTITY(1,1) NOT NULL,
    ProductCardID int NULL,
    UnitID int NULL,
    ConvFactor float NULL,
    LineNr int NULL,
    IsMain bit NULL,
    CONSTRAINT PK_ProductUnit PRIMARY KEY CLUSTERED (ProductUnitID ASC)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductUnit', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductUnit_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductUnit')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductUnit_ProductCardID
    ON dbo.ProductUnit (ProductCardID);
END
GO

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductBarcode', N'UnitID') IS NULL
BEGIN
  ALTER TABLE dbo.ProductBarcode ADD UnitID int NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductBarcode', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductBarcode', N'UnitID') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductBarcode_UnitID'
      AND object_id = OBJECT_ID(N'dbo.ProductBarcode')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductBarcode_UnitID
    ON dbo.ProductBarcode (ProductCardID, UnitID);
END
GO
