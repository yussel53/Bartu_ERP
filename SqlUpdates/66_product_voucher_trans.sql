-- 66: Malzeme / irsaliye fişleri — ProductVoucher (başlık) + ProductTrans (satır)
-- Yoksa oluştur; varsa eksik kolonları tamamla

IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductVoucher (
    ProductVoucherID INT NOT NULL,
    ModuleID TINYINT NULL,
    DepartmentID INT NULL,
    VoucherType INT NULL,
    VoucherDate DATETIME NULL,
    DocumentNumber NVARCHAR(50) NOT NULL,
    Type TINYINT NULL,
    Status_ TINYINT NULL,
    CompanyID INT NULL,
    WhouseID INT NULL,
    AimWhouseID INT NULL,
    CustomerID INT NULL,
    CustomerAdressID INT NULL,
    Description NVARCHAR(MAX) NULL,
    AdditionalFields NVARCHAR(MAX) NULL,
    AuthCode NVARCHAR(50) NULL,
    Currency INT NULL,
    CurrencyRate FLOAT NULL,
    PaidPlanID INT NULL,
    OrgUnitID INT NULL,
    UnitID INT NULL,
    WorkplaceID INT NULL,
    CONSTRAINT PK_ProductVoucher PRIMARY KEY CLUSTERED (ProductVoucherID ASC)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductVoucher', N'AimWhouseID') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD AimWhouseID INT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'AdditionalFields') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD AdditionalFields NVARCHAR(MAX) NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'AuthCode') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD AuthCode NVARCHAR(50) NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'Currency') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD Currency INT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'CurrencyRate') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD CurrencyRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'PaidPlanID') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD PaidPlanID INT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'OrgUnitID') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD OrgUnitID INT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'UnitID') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD UnitID INT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'WorkplaceID') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD WorkplaceID INT NULL;
  IF COL_LENGTH(N'dbo.ProductVoucher', N'CustomerAdressID') IS NULL
    ALTER TABLE dbo.ProductVoucher ADD CustomerAdressID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductTrans (
    ProductTransID INT NOT NULL,
    ProductVoucherID INT NULL,
    ModuleID INT NULL,
    TransType INT NULL,
    VoucherType INT NULL,
    Status_ INT NULL,
    TransDate DATETIME NULL,
    WhouseID INT NULL,
    AimWhouseID INT NULL,
    DepartmentID INT NULL,
    CostGroup INT NULL,
    CostProjectGroup INT NULL,
    ProductCardID INT NULL,
    Description NCHAR(10) NULL,
    Quantity FLOAT NULL,
    Price FLOAT NULL,
    TotalDiscount FLOAT NULL,
    TotalCost FLOAT NULL,
    TotalPrice FLOAT NULL,
    TotalTax FLOAT NULL,
    UnitID INT NULL,
    MainUnitQuantity FLOAT NULL,
    LineUnitQuantity FLOAT NULL,
    InvoiceID INT NULL,
    AuxilCode NVARCHAR(50) NULL,
    CustomerTrackCode NVARCHAR(50) NULL,
    TransMonth INT NULL,
    TransYear INT NULL,
    GroupNr INT NULL,
    Description1 NVARCHAR(MAX) NULL,
    Description2 NVARCHAR(250) NULL,
    TransLineNo INT NULL,
    AccountGroupID INT NULL,
    TaxCardID INT NULL,
    TaxRate FLOAT NULL,
    NetTotal FLOAT NULL,
    AdditionalFields NVARCHAR(MAX) NULL,
    CONSTRAINT PK_ProductTrans PRIMARY KEY CLUSTERED (ProductTransID ASC)
  );
END
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductTrans', N'AimWhouseID') IS NULL
    ALTER TABLE dbo.ProductTrans ADD AimWhouseID INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'TaxCardID') IS NULL
    ALTER TABLE dbo.ProductTrans ADD TaxCardID INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'TaxRate') IS NULL
    ALTER TABLE dbo.ProductTrans ADD TaxRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'NetTotal') IS NULL
    ALTER TABLE dbo.ProductTrans ADD NetTotal FLOAT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'Description2') IS NULL
    ALTER TABLE dbo.ProductTrans ADD Description2 NVARCHAR(250) NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'AdditionalFields') IS NULL
    ALTER TABLE dbo.ProductTrans ADD AdditionalFields NVARCHAR(MAX) NULL;
  -- MainUnitQuantity Create_DB'de int olabilir; float değilse dokunma
END
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductTrans_ProductVoucherID'
      AND object_id = OBJECT_ID(N'dbo.ProductTrans')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductTrans_ProductVoucherID
    ON dbo.ProductTrans (ProductVoucherID);
END
GO

IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductTrans_ProductCardID'
      AND object_id = OBJECT_ID(N'dbo.ProductTrans')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_ProductTrans_ProductCardID
    ON dbo.ProductTrans (ProductCardID);
END
GO
