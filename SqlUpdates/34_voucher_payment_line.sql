-- Fiş ödeme planı satırları (sipariş / irsaliye / fatura)
-- Not: LineNo SQL Server'da LINENO anahtar kelimesine çakışır → [LineNo] zorunlu

IF OBJECT_ID(N'dbo.VoucherPaymentLine', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VoucherPaymentLine (
    VoucherPaymentLineID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_VoucherPaymentLine PRIMARY KEY,
    OrderVoucherID   INT NULL,
    ProductVoucherID INT NULL,
    InvoiceID        INT NULL,
    [LineNo]         INT NOT NULL CONSTRAINT DF_VoucherPaymentLine_LineNo DEFAULT (1),
    DueDate          DATE NULL,
    Amount           FLOAT NULL,
    RatePercent      DECIMAL(9,4) NULL,
    Description      NVARCHAR(200) NULL
  );
END
GO

IF OBJECT_ID(N'dbo.VoucherPaymentLine', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'OrderVoucherID') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD OrderVoucherID INT NULL;
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'ProductVoucherID') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD ProductVoucherID INT NULL;
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'InvoiceID') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD InvoiceID INT NULL;
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'LineNo') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD [LineNo] INT NOT NULL CONSTRAINT DF_VoucherPaymentLine_LineNo2 DEFAULT (1);
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'DueDate') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD DueDate DATE NULL;
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'Amount') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD Amount FLOAT NULL;
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'RatePercent') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD RatePercent DECIMAL(9,4) NULL;
  IF COL_LENGTH(N'dbo.VoucherPaymentLine', N'Description') IS NULL
    ALTER TABLE dbo.VoucherPaymentLine ADD Description NVARCHAR(200) NULL;
END
GO

IF OBJECT_ID(N'dbo.VoucherPaymentLine', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_VoucherPaymentLine_Order' AND object_id = OBJECT_ID(N'dbo.VoucherPaymentLine')
  )
  CREATE NONCLUSTERED INDEX IX_VoucherPaymentLine_Order ON dbo.VoucherPaymentLine (OrderVoucherID, [LineNo]);
GO

IF OBJECT_ID(N'dbo.VoucherPaymentLine', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_VoucherPaymentLine_Product' AND object_id = OBJECT_ID(N'dbo.VoucherPaymentLine')
  )
  CREATE NONCLUSTERED INDEX IX_VoucherPaymentLine_Product ON dbo.VoucherPaymentLine (ProductVoucherID, [LineNo]);
GO

IF OBJECT_ID(N'dbo.VoucherPaymentLine', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_VoucherPaymentLine_Invoice' AND object_id = OBJECT_ID(N'dbo.VoucherPaymentLine')
  )
  CREATE NONCLUSTERED INDEX IX_VoucherPaymentLine_Invoice ON dbo.VoucherPaymentLine (InvoiceID, [LineNo]);
GO
