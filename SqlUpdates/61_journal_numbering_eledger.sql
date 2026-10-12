-- Yevmiye madde numaralandırma (tarih + saat sırası) ve muhasebe fişi e-Defter detayları

IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL
BEGIN
  -- Fiş saati: aynı gündeki fişlerin yevmiye sırası
  IF COL_LENGTH(N'dbo.AccountVoucher', N'VoucherTime') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD VoucherTime TIME(0) NULL;

  IF COL_LENGTH(N'dbo.AccountVoucher', N'JournalNumberedAt') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD JournalNumberedAt DATETIME2 NULL;

  -- e-Defter (GİB yevmiye: belge türü / no / tarih / ödeme şekli)
  IF COL_LENGTH(N'dbo.AccountVoucher', N'EDocumentType') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD EDocumentType NVARCHAR(30) NULL;      -- invoice, check, voucher, receipt, shipment, order-customer, order-vendor, other

  IF COL_LENGTH(N'dbo.AccountVoucher', N'EDocumentTypeDesc') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD EDocumentTypeDesc NVARCHAR(100) NULL; -- other ise zorunlu açıklama

  IF COL_LENGTH(N'dbo.AccountVoucher', N'EDocumentNumber') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD EDocumentNumber NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.AccountVoucher', N'EDocumentDate') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD EDocumentDate DATE NULL;

  IF COL_LENGTH(N'dbo.AccountVoucher', N'EPaymentMethod') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD EPaymentMethod NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.AccountVoucher', N'EEntryComment') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD EEntryComment NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.AccountVoucher', N'ELedgerExclude') IS NULL
    ALTER TABLE dbo.AccountVoucher ADD ELedgerExclude BIT NULL;
END
GO

IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AccountVoucher_JournalOrder' AND object_id = OBJECT_ID(N'dbo.AccountVoucher')
  )
  CREATE NONCLUSTERED INDEX IX_AccountVoucher_JournalOrder
    ON dbo.AccountVoucher (VoucherDate, VoucherTime, AccountVoucherID)
    INCLUDE (journalNO, Status);
GO

-- Numaralandırma geçmişi
IF OBJECT_ID(N'dbo.SYS_JournalNumberingLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_JournalNumberingLog (
    Id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_JournalNumberingLog PRIMARY KEY,
    StartDate      DATE NOT NULL,
    EndDate        DATE NOT NULL,
    StartNumber    INT NOT NULL,
    EndNumber      INT NULL,
    VoucherCount   INT NOT NULL CONSTRAINT DF_SYS_JNL_Count DEFAULT (0),
    OnlyUnnumbered BIT NOT NULL CONSTRAINT DF_SYS_JNL_Only DEFAULT (0),
    CompanyID      INT NULL,
    Note           NVARCHAR(500) NULL,
    AppliedBy      NVARCHAR(100) NULL,
    AppliedAt      DATETIME2 NOT NULL CONSTRAINT DF_SYS_JNL_At DEFAULT (SYSUTCDATETIME())
  );
END
GO
