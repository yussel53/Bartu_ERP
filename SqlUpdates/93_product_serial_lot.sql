-- Malzeme kartı: seri / seri grubu / lot takibi

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductCard', N'TrackSerial') IS NULL
    ALTER TABLE dbo.ProductCard ADD TrackSerial bit NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'TrackSerialGroup') IS NULL
    ALTER TABLE dbo.ProductCard ADD TrackSerialGroup bit NULL;
  IF COL_LENGTH(N'dbo.ProductCard', N'TrackLot') IS NULL
    ALTER TABLE dbo.ProductCard ADD TrackLot bit NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.ProductCard SET TrackSerial = 0 WHERE TrackSerial IS NULL;
  UPDATE dbo.ProductCard SET TrackSerialGroup = 0 WHERE TrackSerialGroup IS NULL;
  UPDATE dbo.ProductCard SET TrackLot = 0 WHERE TrackLot IS NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductSerialGroup', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductSerialGroup (
    ProductSerialGroupID int IDENTITY(1,1) NOT NULL,
    ProductCardID int NULL,
    Code nvarchar(50) NULL,
    Title nvarchar(200) NULL,
    IsActive bit NULL,
    CONSTRAINT PK_ProductSerialGroup PRIMARY KEY CLUSTERED (ProductSerialGroupID)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductSerialGroup', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductSerialGroup_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductSerialGroup')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductSerialGroup_ProductCardID
    ON dbo.ProductSerialGroup (ProductCardID);
END
GO

IF OBJECT_ID(N'dbo.ProductSerial', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductSerial (
    ProductSerialID int IDENTITY(1,1) NOT NULL,
    ProductCardID int NULL,
    SerialGroupCode nvarchar(50) NULL,
    SerialNo nvarchar(80) NULL,
    Status_ tinyint NULL,
    Note nvarchar(250) NULL,
    CONSTRAINT PK_ProductSerial PRIMARY KEY CLUSTERED (ProductSerialID)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductSerial', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductSerial_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductSerial')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductSerial_ProductCardID
    ON dbo.ProductSerial (ProductCardID, SerialNo);
END
GO

IF OBJECT_ID(N'dbo.ProductLot', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductLot (
    ProductLotID int IDENTITY(1,1) NOT NULL,
    ProductCardID int NULL,
    LotNo nvarchar(80) NULL,
    ExpireDate datetime NULL,
    Note nvarchar(250) NULL,
    IsActive bit NULL,
    CONSTRAINT PK_ProductLot PRIMARY KEY CLUSTERED (ProductLotID)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductLot', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductLot_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductLot')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductLot_ProductCardID
    ON dbo.ProductLot (ProductCardID, LotNo);
END
GO
