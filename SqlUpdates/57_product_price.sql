-- Malzeme / hizmet fiyatları — tek tablo, Type_: 1 Satış · 2 Alış

IF OBJECT_ID(N'dbo.ProductPrice', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductPrice (
    ProductPriceID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductPrice PRIMARY KEY,
    Type_            INT NOT NULL,                          -- 1 Satış · 2 Alış
    ProductCardID    INT NOT NULL,                          -- Malzeme veya hizmet (ProductCard)
    UnitID           INT NULL,
    CustomerCardID   INT NULL,                              -- Opsiyonel cariye özel fiyat
    CurrencyID       INT NULL,
    Price            FLOAT NOT NULL CONSTRAINT DF_ProductPrice_Price DEFAULT (0),
    VatIncluded      BIT NOT NULL CONSTRAINT DF_ProductPrice_VatInc DEFAULT (0),
    ValidFrom        DATE NULL,
    ValidTo          DATE NULL,
    Code             NVARCHAR(40) NULL,                     -- Fiyat listesi / kod
    Title            NVARCHAR(150) NULL,
    Description      NVARCHAR(500) NULL,
    IsActive         BIT NOT NULL CONSTRAINT DF_ProductPrice_Active DEFAULT (1),
    CompanyID        INT NULL,
    WorkplaceID      INT NULL,
    AuthCode         NVARCHAR(50) NULL,
    CreatedAt        DATETIME2 NOT NULL CONSTRAINT DF_ProductPrice_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt        DATETIME2 NULL
  );

  CREATE NONCLUSTERED INDEX IX_ProductPrice_TypeProduct
    ON dbo.ProductPrice (Type_, ProductCardID, IsActive)
    INCLUDE (Price, ValidFrom, ValidTo, CustomerCardID);

  CREATE NONCLUSTERED INDEX IX_ProductPrice_Customer
    ON dbo.ProductPrice (CustomerCardID, Type_)
    WHERE CustomerCardID IS NOT NULL;
END
GO

-- SYS_TypeDef: fiyat yönü (Kind 4 = Fiyat)
IF OBJECT_ID(N'dbo.SYS_TypeDef', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM dbo.SYS_TypeDef
    WHERE Kind = 4 AND Code = N'1' AND TargetTable = N'ProductPrice'
  )
    INSERT INTO dbo.SYS_TypeDef (Kind, Code, Title, ModuleKey, TargetTable, IsActive, SortOrder)
    VALUES (4, N'1', N'Satış Fiyatı', N'satis', N'ProductPrice', 1, 10);

  IF NOT EXISTS (
    SELECT 1 FROM dbo.SYS_TypeDef
    WHERE Kind = 4 AND Code = N'2' AND TargetTable = N'ProductPrice'
  )
    INSERT INTO dbo.SYS_TypeDef (Kind, Code, Title, ModuleKey, TargetTable, IsActive, SortOrder)
    VALUES (4, N'2', N'Alış Fiyatı', N'satinalma', N'ProductPrice', 1, 20);
END
GO
