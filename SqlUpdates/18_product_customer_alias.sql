-- Cariye göre malzeme kodu / adı (ProductCard içinde sekme)
-- Her satır: bu malzeme kartının ilgili carideki kodu ve adı

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductCustomerAlias (
    ProductCustomerAliasID INT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_ProductCustomerAlias PRIMARY KEY,
    ProductCardID   INT NOT NULL,
    CustomerCardID  INT NOT NULL,
    CustomerCode    NVARCHAR(50) NULL,   -- cariye özel malzeme kodu
    CustomerTitle   NVARCHAR(200) NULL,  -- cariye özel malzeme adı
    Note            NVARCHAR(200) NULL,
    IsActive        BIT NOT NULL
      CONSTRAINT DF_ProductCustomerAlias_IsActive DEFAULT (1),
    CreatedAt       DATETIME NULL
      CONSTRAINT DF_ProductCustomerAlias_CreatedAt DEFAULT (GETDATE())
  );
END
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_ProductCustomerAlias_Product_Customer'
      AND object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
  )
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UX_ProductCustomerAlias_Product_Customer
    ON dbo.ProductCustomerAlias (ProductCardID, CustomerCardID);
END
GO

IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductCustomerAlias_CustomerCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductCustomerAlias_CustomerCardID
    ON dbo.ProductCustomerAlias (CustomerCardID);
END
GO
