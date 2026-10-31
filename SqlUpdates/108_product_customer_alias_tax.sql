-- Cari malzeme: cari kartı veya vergi / TCK numarası ile eşleşsin
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ProductCustomerAlias', N'MatchBy') IS NULL
  ALTER TABLE dbo.ProductCustomerAlias ADD MatchBy TINYINT NOT NULL
    CONSTRAINT DF_ProductCustomerAlias_MatchBy DEFAULT (1);
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ProductCustomerAlias', N'TaxNr') IS NULL
  ALTER TABLE dbo.ProductCustomerAlias ADD TaxNr NVARCHAR(20) NULL;
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM sys.columns
     WHERE object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
       AND name = N'CustomerCardID' AND is_nullable = 0
   )
  ALTER TABLE dbo.ProductCustomerAlias ALTER COLUMN CustomerCardID INT NULL;
GO

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'UX_ProductCustomerAlias_Product_Customer'
    AND object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
)
  DROP INDEX UX_ProductCustomerAlias_Product_Customer ON dbo.ProductCustomerAlias;
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = N'UX_ProductCustomerAlias_Product_Customer'
       AND object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
   )
  CREATE UNIQUE NONCLUSTERED INDEX UX_ProductCustomerAlias_Product_Customer
    ON dbo.ProductCustomerAlias (ProductCardID, CustomerCardID)
    WHERE CustomerCardID IS NOT NULL AND MatchBy = 1;
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ProductCustomerAlias', N'TaxNr') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = N'UX_ProductCustomerAlias_Product_Tax'
       AND object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
   )
  CREATE UNIQUE NONCLUSTERED INDEX UX_ProductCustomerAlias_Product_Tax
    ON dbo.ProductCustomerAlias (ProductCardID, TaxNr)
    WHERE MatchBy = 2 AND TaxNr IS NOT NULL;
GO
