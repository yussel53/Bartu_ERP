-- Seri lot / seri lot grubu: kartta izleme tipi, numara giriş hareketinde oluşur

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'TrackingMode') IS NULL
  ALTER TABLE dbo.ProductCard ADD TrackingMode TINYINT NULL;
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'TrackingMode') IS NOT NULL
BEGIN
  UPDATE dbo.ProductCard SET TrackingMode = 0 WHERE TrackingMode IS NULL;

  IF COL_LENGTH(N'dbo.ProductCard', N'TrackSerialGroup') IS NOT NULL
    UPDATE dbo.ProductCard SET TrackingMode = 2
    WHERE ISNULL(TrackSerialGroup, 0) = 1 AND ISNULL(TrackingMode, 0) = 0;

  IF COL_LENGTH(N'dbo.ProductCard', N'TrackSerial') IS NOT NULL
    UPDATE dbo.ProductCard SET TrackingMode = 1
    WHERE ISNULL(TrackSerial, 0) = 1 AND ISNULL(TrackingMode, 0) = 0;

  IF COL_LENGTH(N'dbo.ProductCard', N'TrackLot') IS NOT NULL
    UPDATE dbo.ProductCard SET TrackingMode = 1
    WHERE ISNULL(TrackLot, 0) = 1 AND ISNULL(TrackingMode, 0) = 0;
END
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductTrans', N'SerialLotNo') IS NULL
    ALTER TABLE dbo.ProductTrans ADD SerialLotNo NVARCHAR(80) NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'ProductSerialLotID') IS NULL
    ALTER TABLE dbo.ProductTrans ADD ProductSerialLotID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductSerialLot', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductSerialLot (
    ProductSerialLotID INT IDENTITY(1,1) NOT NULL,
    ProductCardID INT NOT NULL,
    Kind TINYINT NOT NULL,              -- 1 Seri Lot · 2 Seri Lot Grubu
    Code NVARCHAR(80) NOT NULL,
    Status_ TINYINT NOT NULL CONSTRAINT DF_ProductSerialLot_Status DEFAULT (1), -- 1 stokta · 2 çıktı
    WhouseID INT NULL,
    Qty FLOAT NULL,
    SourceVoucherID INT NULL,
    SourceTransID INT NULL,
    OutVoucherID INT NULL,
    OutTransID INT NULL,
    CONSTRAINT PK_ProductSerialLot PRIMARY KEY CLUSTERED (ProductSerialLotID)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductSerialLot', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ProductSerialLot_Code'
      AND object_id = OBJECT_ID(N'dbo.ProductSerialLot')
  )
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UX_ProductSerialLot_Code
    ON dbo.ProductSerialLot (ProductCardID, Kind, Code);
END
GO
