-- 86: Çek / senet portföy bordroları (Y-11)
-- BoundRoll: bordro başlığı · BoundTrans: bordrodaki her çek / senedin hareketi (BoundRollID, Amount, PrevStatus) — kartın geçmişi
-- BoundRoll.Type_: 1 Müşteriden giriş (portföye) · 2 Cariye ciro · 3 Bankaya tahsile · 4 Bankaya teminata · 5 Bankadan tahsil
--                  6 Elden / kasaya tahsil · 7 Karşılıksız · 8 Müşteriye iade · 9 Borç çeki / senedi çıkışı · 10 Borç çeki / senedi ödemesi
--                  11 Portföye geri alma (tahsilden / teminattan)
-- BoundCard.Status_ (konum): 1 Portföyde · 2 Ciro edildi · 3 Tahsilde · 4 Teminatta · 5 Tahsil edildi · 6 Karşılıksız
--                            7 İade edildi · 8 Verildi (kendi) · 9 Ödendi
-- Cari etkisi: 1 alacak · 2, 7 (ilk cariye), 8, 9 borç. Banka: 5 giriş, 10 çıkış. Kasa: 6 giriş. (CardStatementRepository)

IF OBJECT_ID(N'dbo.BoundRoll', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.BoundRoll (
    BoundRollID       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BoundRoll PRIMARY KEY,
    Type_             TINYINT       NOT NULL,
    Status_           TINYINT       NOT NULL CONSTRAINT DF_BoundRoll_Status DEFAULT 0,
    RollDate          DATETIME      NOT NULL,
    DocumentNumber    NVARCHAR(50)  NULL,
    CustomerID        INT           NULL,
    BankAccountCardID INT           NULL,
    SafeCardID        INT           NULL,
    Description       NVARCHAR(500) NULL,
    Amount            FLOAT         NULL,
    AuthCode          NVARCHAR(50)  NULL,
    CompanyID         INT           NULL,
    CreatedBy         INT           NULL,
    CreatedAt         DATETIME2     NOT NULL CONSTRAINT DF_BoundRoll_CreatedAt DEFAULT SYSDATETIME()
  );
  CREATE INDEX IX_BoundRoll_Date ON dbo.BoundRoll (RollDate);
  CREATE INDEX IX_BoundRoll_Customer ON dbo.BoundRoll (CustomerID);
END
GO

IF OBJECT_ID(N'dbo.BoundTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.BoundTrans', N'BoundRollID') IS NULL ALTER TABLE dbo.BoundTrans ADD BoundRollID INT NULL;
  IF COL_LENGTH(N'dbo.BoundTrans', N'Amount') IS NULL ALTER TABLE dbo.BoundTrans ADD Amount FLOAT NULL;
  IF COL_LENGTH(N'dbo.BoundTrans', N'PrevStatus') IS NULL ALTER TABLE dbo.BoundTrans ADD PrevStatus TINYINT NULL;
END
GO

IF OBJECT_ID(N'dbo.BoundTrans', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BoundTrans_Roll' AND object_id = OBJECT_ID(N'dbo.BoundTrans'))
  CREATE INDEX IX_BoundTrans_Roll ON dbo.BoundTrans (BoundRollID);
GO

IF OBJECT_ID(N'dbo.BoundTrans', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BoundTrans_Check' AND object_id = OBJECT_ID(N'dbo.BoundTrans'))
  CREATE INDEX IX_BoundTrans_Check ON dbo.BoundTrans (CheckID);
GO

IF OBJECT_ID(N'dbo.BoundCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.BoundCard', N'Debtor') IS NULL ALTER TABLE dbo.BoundCard ADD Debtor NVARCHAR(200) NULL;
  IF COL_LENGTH(N'dbo.BoundCard', N'BankName') IS NULL ALTER TABLE dbo.BoundCard ADD BankName NVARCHAR(100) NULL;
  IF COL_LENGTH(N'dbo.BoundCard', N'BranchName') IS NULL ALTER TABLE dbo.BoundCard ADD BranchName NVARCHAR(100) NULL;
  IF COL_LENGTH(N'dbo.BoundCard', N'AccountNo') IS NULL ALTER TABLE dbo.BoundCard ADD AccountNo NVARCHAR(50) NULL;
  IF COL_LENGTH(N'dbo.BoundCard', N'IsOwn') IS NULL ALTER TABLE dbo.BoundCard ADD IsOwn BIT NOT NULL CONSTRAINT DF_BoundCard_IsOwn DEFAULT 0;
  IF COL_LENGTH(N'dbo.BoundCard', N'Description') IS NULL ALTER TABLE dbo.BoundCard ADD Description NVARCHAR(500) NULL;
END
GO
