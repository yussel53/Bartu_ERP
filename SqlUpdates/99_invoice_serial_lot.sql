-- Fatura satırındaki lot / seri, fiş ile aynı numarayı paylaşmasın

IF OBJECT_ID(N'dbo.ProductSerialLot', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductSerialLot', N'SourceInvoiceID') IS NULL
    ALTER TABLE dbo.ProductSerialLot ADD SourceInvoiceID INT NULL;
  IF COL_LENGTH(N'dbo.ProductSerialLot', N'OutInvoiceID') IS NULL
    ALTER TABLE dbo.ProductSerialLot ADD OutInvoiceID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductTrans', N'SerialLotNo') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'dbo'
      AND TABLE_NAME = N'ProductTrans'
      AND COLUMN_NAME = N'SerialLotNo'
      AND CHARACTER_MAXIMUM_LENGTH <> -1
  )
  ALTER TABLE dbo.ProductTrans ALTER COLUMN SerialLotNo NVARCHAR(MAX) NULL;
GO
