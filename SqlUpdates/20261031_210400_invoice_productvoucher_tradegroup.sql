-- Invoice / ProductVoucher: satış-satınalma grubu + liste indeksleri
-- TradeGroup: 1 Satış · 2 Satınalma · 0 Diğer (malzeme / tanımsız)
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.Invoice', N'TradeGroup') IS NULL
    ALTER TABLE dbo.Invoice ADD TradeGroup TINYINT NOT NULL
      CONSTRAINT DF_Invoice_TradeGroup DEFAULT (0);
END
GO

IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductVoucher', N'TradeGroup') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD TradeGroup TINYINT NOT NULL
      CONSTRAINT DF_ProductVoucher_TradeGroup DEFAULT (0);
END
GO

-- Mevcut kayıtları tip alanından doldur
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'TradeGroup') IS NOT NULL
BEGIN
  UPDATE dbo.Invoice
  SET TradeGroup = CASE
    WHEN InvoiceType IN (1, 3, 7) THEN 1  -- satış / satış iade / satış fiyat farkı
    WHEN InvoiceType IN (2, 4, 5, 6) THEN 2  -- alış / alış iade / alınan hizmet / alış fiyat farkı
    ELSE 0
  END
  WHERE TradeGroup = 0 OR TradeGroup IS NULL
     OR TradeGroup <> CASE
          WHEN InvoiceType IN (1, 3, 7) THEN 1
          WHEN InvoiceType IN (2, 4, 5, 6) THEN 2
          ELSE 0
        END;
END
GO

IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductVoucher', N'TradeGroup') IS NOT NULL
BEGIN
  UPDATE dbo.ProductVoucher
  SET TradeGroup = CASE
    WHEN VoucherType IN (3, 5) THEN 1  -- satış / satış iade irsaliye
    WHEN VoucherType IN (2, 4) THEN 2  -- alış / alış iade irsaliye
    ELSE 0  -- devir / transfer / sayım / sarf …
  END
  WHERE TradeGroup = 0 OR TradeGroup IS NULL
     OR TradeGroup <> CASE
          WHEN VoucherType IN (3, 5) THEN 1
          WHEN VoucherType IN (2, 4) THEN 2
          ELSE 0
        END;
END
GO

-- Invoice indeksleri (satış/satınalma listesi + tip + belge no)
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Invoice_TradeGroup_Date' AND object_id = OBJECT_ID(N'dbo.Invoice')
  )
    CREATE NONCLUSTERED INDEX IX_Invoice_TradeGroup_Date
      ON dbo.Invoice (TradeGroup, InvoiceDate DESC, InvoiceID DESC)
      INCLUDE (DocumentNumber, InvoiceType, CustomerID, Status_, CompanyID, DepartmentID, WhouseID);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Invoice_InvoiceType_Date' AND object_id = OBJECT_ID(N'dbo.Invoice')
  )
    CREATE NONCLUSTERED INDEX IX_Invoice_InvoiceType_Date
      ON dbo.Invoice (InvoiceType, InvoiceDate DESC, InvoiceID DESC)
      INCLUDE (DocumentNumber, CustomerID, Status_, TradeGroup);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Invoice_DocumentNumber_Type' AND object_id = OBJECT_ID(N'dbo.Invoice')
  )
    CREATE NONCLUSTERED INDEX IX_Invoice_DocumentNumber_Type
      ON dbo.Invoice (DocumentNumber, InvoiceType)
      WHERE DocumentNumber IS NOT NULL;
END
GO

-- ProductVoucher (malzeme / irsaliye fişi) indeksleri
IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductVoucher_TradeGroup_Date' AND object_id = OBJECT_ID(N'dbo.ProductVoucher')
  )
    CREATE NONCLUSTERED INDEX IX_ProductVoucher_TradeGroup_Date
      ON dbo.ProductVoucher (TradeGroup, VoucherDate DESC, ProductVoucherID DESC)
      INCLUDE (DocumentNumber, VoucherType, CustomerID, Status_, CompanyID, DepartmentID, WhouseID);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductVoucher_VoucherType_Date' AND object_id = OBJECT_ID(N'dbo.ProductVoucher')
  )
    CREATE NONCLUSTERED INDEX IX_ProductVoucher_VoucherType_Date
      ON dbo.ProductVoucher (VoucherType, VoucherDate DESC, ProductVoucherID DESC)
      INCLUDE (DocumentNumber, CustomerID, Status_, TradeGroup, WhouseID);

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductVoucher_DocumentNumber_Type' AND object_id = OBJECT_ID(N'dbo.ProductVoucher')
  )
    CREATE NONCLUSTERED INDEX IX_ProductVoucher_DocumentNumber_Type
      ON dbo.ProductVoucher (DocumentNumber, VoucherType)
      WHERE DocumentNumber IS NOT NULL;
END
GO
