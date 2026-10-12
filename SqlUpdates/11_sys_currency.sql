-- Döviz kartı + kur; cari / fişlere Currency + CurrencyRate

IF OBJECT_ID(N'dbo.SYS_Currency', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Currency (
    CurrencyID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_Currency PRIMARY KEY,
    Code         NVARCHAR(10) NOT NULL,
    Title        NVARCHAR(100) NOT NULL,
    Symbol       NVARCHAR(10) NULL,
    IsLocal      BIT NOT NULL CONSTRAINT DF_SYS_Currency_IsLocal DEFAULT (0),
    Rate         FLOAT NOT NULL CONSTRAINT DF_SYS_Currency_Rate DEFAULT (1),
    IsActive     BIT NOT NULL CONSTRAINT DF_SYS_Currency_IsActive DEFAULT (1),
    AdditionalFields NVARCHAR(MAX) NULL
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UQ_SYS_Currency_Code' AND object_id = OBJECT_ID(N'dbo.SYS_Currency')
)
  CREATE UNIQUE NONCLUSTERED INDEX UQ_SYS_Currency_Code ON dbo.SYS_Currency (Code);
GO

IF OBJECT_ID(N'dbo.SYS_CurrencyRate', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_CurrencyRate (
    CurrencyRateID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_CurrencyRate PRIMARY KEY,
    CurrencyID     INT NOT NULL,
    RateDate       DATE NOT NULL,
    BuyRate        FLOAT NOT NULL CONSTRAINT DF_SYS_CurrencyRate_Buy DEFAULT (1),
    SellRate       FLOAT NOT NULL CONSTRAINT DF_SYS_CurrencyRate_Sell DEFAULT (1),
    IsActive       BIT NOT NULL CONSTRAINT DF_SYS_CurrencyRate_IsActive DEFAULT (1)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UQ_SYS_CurrencyRate_Day' AND object_id = OBJECT_ID(N'dbo.SYS_CurrencyRate')
)
  CREATE UNIQUE NONCLUSTERED INDEX UQ_SYS_CurrencyRate_Day ON dbo.SYS_CurrencyRate (CurrencyID, RateDate);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Currency WHERE Code = N'TRY')
  INSERT INTO dbo.SYS_Currency (Code, Title, Symbol, IsLocal, Rate, IsActive)
  VALUES (N'TRY', N'Türk Lirası', N'₺', 1, 1, 1);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Currency WHERE Code = N'USD')
  INSERT INTO dbo.SYS_Currency (Code, Title, Symbol, IsLocal, Rate, IsActive)
  VALUES (N'USD', N'ABD Doları', N'$', 0, 34.5, 1);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Currency WHERE Code = N'EUR')
  INSERT INTO dbo.SYS_Currency (Code, Title, Symbol, IsLocal, Rate, IsActive)
  VALUES (N'EUR', N'Euro', N'€', 0, 37.2, 1);
GO

IF COL_LENGTH(N'dbo.CustomerCard', N'DefaultCurrency') IS NULL
  ALTER TABLE dbo.CustomerCard ADD DefaultCurrency INT NULL;
GO

-- Fiş tabloları: Currency + CurrencyRate (tablo yoksa atlanır)
IF OBJECT_ID(N'dbo.OrderVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.OrderVoucher', N'Currency') IS NULL
  ALTER TABLE dbo.OrderVoucher ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.OrderVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.OrderVoucher', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.OrderVoucher ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductVoucher', N'Currency') IS NULL
  ALTER TABLE dbo.ProductVoucher ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.ProductVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ProductVoucher', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.ProductVoucher ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'Currency') IS NULL
  ALTER TABLE dbo.Invoice ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Invoice', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.Invoice ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.BankVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.BankVoucher', N'Currency') IS NULL
  ALTER TABLE dbo.BankVoucher ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.BankVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.BankVoucher', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.BankVoucher ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.CustomerVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.CustomerVoucher', N'Currency') IS NULL
  ALTER TABLE dbo.CustomerVoucher ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.CustomerVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.CustomerVoucher', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.CustomerVoucher ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.AccountVoucher', N'Currency') IS NULL
  ALTER TABLE dbo.AccountVoucher ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.AccountVoucher', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.AccountVoucher ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.BankTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.BankTrans', N'Currency') IS NULL
  ALTER TABLE dbo.BankTrans ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.BankTrans', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.BankTrans', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.BankTrans ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.BankCredit', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.BankCredit', N'Currency') IS NULL
  ALTER TABLE dbo.BankCredit ADD Currency INT NULL;
GO
IF OBJECT_ID(N'dbo.BankCredit', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.BankCredit', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.BankCredit ADD CurrencyRate FLOAT NULL;
GO

IF OBJECT_ID(N'dbo.SafeCard', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SafeCard', N'CurrencyRate') IS NULL
  ALTER TABLE dbo.SafeCard ADD CurrencyRate FLOAT NULL;
GO
