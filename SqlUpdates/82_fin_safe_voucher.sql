-- 82: Kasa fişleri (Y-08) — SafeVoucher (başlık) + SafeTrans (satır)
-- Type_: 1 Tahsilat (cariden, kasa +) · 2 Tediye (cariye, kasa −) · 3 Kasa → Banka (kasa −) · 4 Banka → Kasa (kasa +)
--        5 Masraf (kasa −) · 6 Kasa → Kasa virman (kasa −, hedef kasa +)
-- Cari ekstresi / bakiyesi: tahsilat alacak, tediye borç (CardStatementRepository). Status_: 0 açık · 1 kapalı · 2 iptal.

IF OBJECT_ID(N'dbo.SafeVoucher', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SafeVoucher (
    SafeVoucherID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SafeVoucher PRIMARY KEY,
    Type_           TINYINT       NOT NULL,
    Status_         TINYINT       NOT NULL CONSTRAINT DF_SafeVoucher_Status DEFAULT 0,
    VoucherDate     DATETIME      NOT NULL,
    DocumentNumber  NVARCHAR(50)  NULL,
    SafeCardID      INT           NOT NULL,
    Amount          FLOAT         NULL,
    Description     NVARCHAR(500) NULL,
    AuthCode        NVARCHAR(50)  NULL,
    CompanyID       INT           NULL,
    WorkplaceID     INT           NULL,
    Currency        INT           NULL,
    CurrencyRate    FLOAT         NULL,
    CreatedAt       DATETIME2     NOT NULL CONSTRAINT DF_SafeVoucher_CreatedAt DEFAULT SYSDATETIME()
  );
  CREATE INDEX IX_SafeVoucher_Safe ON dbo.SafeVoucher (SafeCardID, VoucherDate);
END
GO

IF OBJECT_ID(N'dbo.SafeTrans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SafeTrans (
    SafeTransID        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SafeTrans PRIMARY KEY,
    SafeVoucherID      INT           NOT NULL,
    TransLineNo        INT           NULL,
    CustomerID         INT           NULL,
    BankAccountCardID  INT           NULL,
    AimSafeCardID      INT           NULL,
    AccountCardID      INT           NULL,
    Description        NVARCHAR(500) NULL,
    Amount             FLOAT         NOT NULL CONSTRAINT DF_SafeTrans_Amount DEFAULT 0,
    Currency           INT           NULL,
    CurrencyRate       FLOAT         NULL,
    DueDate            DATETIME      NULL
  );
  CREATE INDEX IX_SafeTrans_Voucher ON dbo.SafeTrans (SafeVoucherID);
  CREATE INDEX IX_SafeTrans_Customer ON dbo.SafeTrans (CustomerID);
END
GO
