-- Muhasebe fişi satır dağıtımı: AccountTransDetail ← masraf merkezi / proje
-- Fiş satırı (AccountTrans.TransLineNo) başına N dağıtım satırı; AccountVoucherID + TransLineNo ile bağlanır.

-- Masraf merkezleri
IF OBJECT_ID(N'dbo.CostCenter', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CostCenter (
    CostCenterID  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CostCenter PRIMARY KEY,
    Code          NVARCHAR(50)  NULL,
    Title         NVARCHAR(200) NULL,
    Description   NVARCHAR(500) NULL,
    IsActive      BIT NOT NULL CONSTRAINT DF_CostCenter_Active DEFAULT (1),
    CompanyID     INT NULL
  );

  CREATE NONCLUSTERED INDEX IX_CostCenter_Code ON dbo.CostCenter (Code);
END
GO

-- Projeler
IF OBJECT_ID(N'dbo.ProjectCard', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProjectCard (
    ProjectCardID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProjectCard PRIMARY KEY,
    Code          NVARCHAR(50)  NULL,
    Title         NVARCHAR(200) NULL,
    StartDate     DATE NULL,
    EndDate       DATE NULL,
    Description   NVARCHAR(500) NULL,
    IsActive      BIT NOT NULL CONSTRAINT DF_ProjectCard_Active DEFAULT (1),
    CompanyID     INT NULL
  );

  CREATE NONCLUSTERED INDEX IX_ProjectCard_Code ON dbo.ProjectCard (Code);
END
GO

-- Dağıtım satırları
IF OBJECT_ID(N'dbo.AccountTransDetail', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AccountTransDetail (
    AccountTransDetailID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccountTransDetail PRIMARY KEY,
    AccountGroup         INT NULL,
    AccountTrasnID       INT NULL,
    ExpenseID            INT NULL,
    Amount               FLOAT NULL,
    TotalType_           SMALLINT NULL,
    CurrencyAmount       FLOAT NULL,
    AccountSlipNr        TINYINT NULL,
    AccontCountrySystem  TINYINT NULL,
    Currency             INT NULL,
    CurrencyRate         FLOAT NULL,
    TransLineNo          INT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.AccountTransDetail', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AccountTransDetail', N'AccountVoucherID') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD AccountVoucherID INT NULL;

  IF COL_LENGTH(N'dbo.AccountTransDetail', N'CostCenterID') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD CostCenterID INT NULL;

  IF COL_LENGTH(N'dbo.AccountTransDetail', N'ProjectCardID') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD ProjectCardID INT NULL;

  IF COL_LENGTH(N'dbo.AccountTransDetail', N'RatePercent') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD RatePercent FLOAT NULL;

  IF COL_LENGTH(N'dbo.AccountTransDetail', N'Description') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD Description NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.AccountTransDetail', N'TransLineNo') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD TransLineNo INT NULL;
END
GO

IF OBJECT_ID(N'dbo.AccountTransDetail', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AccountTransDetail_Voucher' AND object_id = OBJECT_ID(N'dbo.AccountTransDetail')
  )
  CREATE NONCLUSTERED INDEX IX_AccountTransDetail_Voucher
    ON dbo.AccountTransDetail (AccountVoucherID, TransLineNo);
GO

-- Fiş satır sırası (dağıtım bağı için)
IF OBJECT_ID(N'dbo.AccountTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'TransLineNo') IS NULL
  ALTER TABLE dbo.AccountTrans ADD TransLineNo INT NULL;
GO
