-- Lot / seri satırına son kullanma, açıklama ve stok yeri

IF OBJECT_ID(N'dbo.ProductSerialLot', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductSerialLot', N'ExpireDate') IS NULL
    ALTER TABLE dbo.ProductSerialLot ADD ExpireDate DATE NULL;
  IF COL_LENGTH(N'dbo.ProductSerialLot', N'Description') IS NULL
    ALTER TABLE dbo.ProductSerialLot ADD Description NVARCHAR(250) NULL;
  IF COL_LENGTH(N'dbo.ProductSerialLot', N'StockLocationID') IS NULL
    ALTER TABLE dbo.ProductSerialLot ADD StockLocationID INT NULL;
END
GO
