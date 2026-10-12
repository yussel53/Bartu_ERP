-- 36: Muhasebe fiş satırları — AccountTrans ← AccountVoucherID + Debit/Credit
-- Create_DB AccountTrans'ta fiş FK yoktu; form Debit/Credit kullanıyor.

IF OBJECT_ID(N'dbo.AccountTrans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AccountTrans (
    AccountTransID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccountTrans PRIMARY KEY,
    AccountVoucherID INT NOT NULL,
    AccountCardID    INT NULL,
    Debit            FLOAT NULL,
    Credit           FLOAT NULL,
    Amount           FLOAT NULL,
    Description      NVARCHAR(MAX) NULL,
    TransLineNo      INT NULL,
    CompanyID        INT NULL,
    DepartmentID     INT NULL,
    Currency         INT NULL,
    CurrencyRate     FLOAT NULL,
    CurrencyAmount   FLOAT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.AccountTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AccountTrans', N'AccountVoucherID') IS NULL
    ALTER TABLE dbo.AccountTrans ADD AccountVoucherID INT NULL;

  IF COL_LENGTH(N'dbo.AccountTrans', N'Debit') IS NULL
    ALTER TABLE dbo.AccountTrans ADD Debit FLOAT NULL;

  IF COL_LENGTH(N'dbo.AccountTrans', N'Credit') IS NULL
    ALTER TABLE dbo.AccountTrans ADD Credit FLOAT NULL;

  IF COL_LENGTH(N'dbo.AccountTrans', N'AccountTransID') IS NULL
     AND COL_LENGTH(N'dbo.AccountTrans', N'AccountTrasnID') IS NULL
    ALTER TABLE dbo.AccountTrans ADD AccountTransID INT IDENTITY(1,1) NOT NULL;
END
GO

IF OBJECT_ID(N'dbo.AccountTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'AccountVoucherID') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AccountTrans_Voucher' AND object_id = OBJECT_ID(N'dbo.AccountTrans')
  )
  CREATE NONCLUSTERED INDEX IX_AccountTrans_Voucher
    ON dbo.AccountTrans (AccountVoucherID, TransLineNo);
GO
