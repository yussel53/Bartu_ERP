-- Ödeme / Tahsilat planları (PaidPlanCard genişletme) + Banka Kredileri / Taksitler

-- PaidPlanCard: Create_DB minimal; canlıda kolonları tamamla
IF OBJECT_ID(N'dbo.PaidPlanCard', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PaidPlanCard (
    PaidPlanID     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PaidPlanCard PRIMARY KEY,
    Code           NVARCHAR(50) NOT NULL,
    Description    NVARCHAR(200) NULL,
    PlanType       TINYINT NOT NULL CONSTRAINT DF_PaidPlanCard_PlanType DEFAULT (3), -- 1 Ödeme, 2 Tahsilat, 3 Her İkisi
    DayCount       INT NULL,
    InstallmentCnt INT NULL,
    IsActive       BIT NOT NULL CONSTRAINT DF_PaidPlanCard_IsActive DEFAULT (1)
  );
END
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'PaidPlanID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'PK_PaidPlanCard' AND parent_object_id = OBJECT_ID(N'dbo.PaidPlanCard'))
BEGIN
  -- Create_DB'de PK yoksa eklemeyi dene (IDENTITY değilse atlanır)
  BEGIN TRY
    ALTER TABLE dbo.PaidPlanCard ALTER COLUMN PaidPlanID INT NOT NULL;
  END TRY BEGIN CATCH END CATCH
END
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'Description') IS NULL
  AND COL_LENGTH(N'dbo.PaidPlanCard', N'Decription') IS NOT NULL
BEGIN
  EXEC sp_rename N'dbo.PaidPlanCard.Decription', N'Description', N'COLUMN';
END
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'Description') IS NULL
  ALTER TABLE dbo.PaidPlanCard ADD Description NVARCHAR(200) NULL;
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'PlanType') IS NULL
  ALTER TABLE dbo.PaidPlanCard ADD PlanType TINYINT NOT NULL CONSTRAINT DF_PaidPlanCard_PlanType DEFAULT (3);
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'DayCount') IS NULL
  ALTER TABLE dbo.PaidPlanCard ADD DayCount INT NULL;
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'InstallmentCnt') IS NULL
  ALTER TABLE dbo.PaidPlanCard ADD InstallmentCnt INT NULL;
GO

IF COL_LENGTH(N'dbo.PaidPlanCard', N'IsActive') IS NULL
  ALTER TABLE dbo.PaidPlanCard ADD IsActive BIT NOT NULL CONSTRAINT DF_PaidPlanCard_IsActive DEFAULT (1);
GO

IF OBJECT_ID(N'dbo.PaidPlanLine', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PaidPlanLine (
    PaidPlanLineID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PaidPlanLine PRIMARY KEY,
    PaidPlanID     INT NOT NULL,
    [LineNo]       INT NOT NULL,
    DayOffset      INT NOT NULL CONSTRAINT DF_PaidPlanLine_DayOffset DEFAULT (0),
    RatePercent    DECIMAL(9,4) NULL,
    Description    NVARCHAR(100) NULL
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_PaidPlanLine_Plan' AND object_id = OBJECT_ID(N'dbo.PaidPlanLine')
)
  CREATE NONCLUSTERED INDEX IX_PaidPlanLine_Plan ON dbo.PaidPlanLine (PaidPlanID, [LineNo]);
GO

-- Banka kredisi (ana kayıt)
IF OBJECT_ID(N'dbo.BankCredit', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.BankCredit (
    BankCreditID    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BankCredit PRIMARY KEY,
    Code            NVARCHAR(50) NOT NULL,
    Title           NVARCHAR(200) NOT NULL,
    BankCardID      INT NULL,
    BankAccountID   INT NULL,
    CreditDate      DATETIME NULL,
    StartDate       DATETIME NULL,
    EndDate         DATETIME NULL,
    CreditAmount    DECIMAL(18,2) NOT NULL CONSTRAINT DF_BankCredit_Amount DEFAULT (0),
    InterestRate    DECIMAL(9,4) NULL,
    CurrencyCode    NVARCHAR(10) NULL,
    InstallmentCnt  INT NULL,
    PaidPlanID      INT NULL,
    Status          NVARCHAR(30) NULL, -- Aktif / Kapalı / Erken Kapama
    Notes           NVARCHAR(500) NULL,
    AuthCode        NVARCHAR(50) NULL,
    IsActive        BIT NOT NULL CONSTRAINT DF_BankCredit_IsActive DEFAULT (1),
    CreatedAt       DATETIME NULL CONSTRAINT DF_BankCredit_CreatedAt DEFAULT (GETDATE())
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_BankCredit_Code' AND object_id = OBJECT_ID(N'dbo.BankCredit')
)
  CREATE UNIQUE NONCLUSTERED INDEX IX_BankCredit_Code ON dbo.BankCredit (Code);
GO

-- Kredi taksitleri (finans hareket)
IF OBJECT_ID(N'dbo.BankCreditInstallment', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.BankCreditInstallment (
    BankCreditInstallmentID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BankCreditInstallment PRIMARY KEY,
    BankCreditID    INT NOT NULL,
    InstallmentNo   INT NOT NULL,
    DueDate         DATETIME NOT NULL,
    PrincipalAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_BCI_Principal DEFAULT (0),
    InterestAmount  DECIMAL(18,2) NOT NULL CONSTRAINT DF_BCI_Interest DEFAULT (0),
    TotalAmount     DECIMAL(18,2) NOT NULL CONSTRAINT DF_BCI_Total DEFAULT (0),
    PaidAmount      DECIMAL(18,2) NOT NULL CONSTRAINT DF_BCI_Paid DEFAULT (0),
    PaymentDate     DATETIME NULL,
    Status          NVARCHAR(30) NULL, -- Açık / Ödendi / Gecikmiş
    BankVoucherID   INT NULL,
    Notes           NVARCHAR(200) NULL,
    IsActive        BIT NOT NULL CONSTRAINT DF_BCI_IsActive DEFAULT (1)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_BankCreditInstallment_Credit' AND object_id = OBJECT_ID(N'dbo.BankCreditInstallment')
)
  CREATE NONCLUSTERED INDEX IX_BankCreditInstallment_Credit
    ON dbo.BankCreditInstallment (BankCreditID, InstallmentNo);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_BankCreditInstallment_Due' AND object_id = OBJECT_ID(N'dbo.BankCreditInstallment')
)
  CREATE NONCLUSTERED INDEX IX_BankCreditInstallment_Due
    ON dbo.BankCreditInstallment (DueDate, Status);
GO
