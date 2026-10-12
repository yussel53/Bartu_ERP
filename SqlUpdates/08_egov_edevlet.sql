-- E-Devlet: e-Fatura / e-Arşiv belgeleri + e-Defter
-- DocKind: 1 e-Fatura, 2 e-Arşiv
-- Direction: 1 Gelen, 2 Giden

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovDocument (
    EGovDocumentID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovDocument PRIMARY KEY,
    DocKind       TINYINT NOT NULL,          -- 1 e-Fatura, 2 e-Arşiv
    Direction      TINYINT NOT NULL,          -- 1 Gelen, 2 Giden
    DocumentNo     NVARCHAR(50) NULL,
    UUID           NVARCHAR(64) NULL,         -- ETNN / UUID
    DocumentDate   DATETIME NULL,
    IssueDate      DATETIME NULL,
    CustomerCode   NVARCHAR(50) NULL,
    CustomerTitle  NVARCHAR(200) NULL,
    TaxNr          NVARCHAR(20) NULL,
    Amount         DECIMAL(18,2) NULL,
    TaxAmount      DECIMAL(18,2) NULL,
    CurrencyCode   NVARCHAR(10) NULL,
    Status         NVARCHAR(30) NULL,         -- Bekliyor / Onaylandı / Red / Gönderildi / ...
    ProfileId      NVARCHAR(50) NULL,         -- TEMELFATURA / TICARIFATURA / EARSIVFATURA
    InvoiceID      INT NULL,                 -- ERP Invoice bağ (opsiyonel)
    XmlContent     NVARCHAR(MAX) NULL,
    IsActive       BIT NOT NULL CONSTRAINT DF_EGovDocument_IsActive DEFAULT (1),
    CreatedAt      DATETIME NULL CONSTRAINT DF_EGovDocument_CreatedAt DEFAULT (GETDATE())
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_EGovDocument_KindDir' AND object_id = OBJECT_ID(N'dbo.EGovDocument')
)
  CREATE NONCLUSTERED INDEX IX_EGovDocument_KindDir
    ON dbo.EGovDocument (DocKind, Direction, DocumentDate DESC)
    INCLUDE (DocumentNo, CustomerTitle, Status, Amount);
GO

IF OBJECT_ID(N'dbo.ELedger', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ELedger (
    ELedgerID    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ELedger PRIMARY KEY,
    PeriodYear   INT NOT NULL,
    PeriodMonth  TINYINT NOT NULL,           -- 1..12
    PartNo       INT NULL,
    LedgerType   NVARCHAR(30) NULL,          -- YEVMIYE / KEBIR / ...
    FileName     NVARCHAR(260) NULL,
    FileHash     NVARCHAR(128) NULL,
    Status       NVARCHAR(30) NULL,          -- Hazırlanıyor / Oluşturuldu / GİB'e Gönderildi / Onay
    GibStatus    NVARCHAR(50) NULL,
    StartDate    DATETIME NULL,
    EndDate      DATETIME NULL,
    IsActive     BIT NOT NULL CONSTRAINT DF_ELedger_IsActive DEFAULT (1),
    CreatedAt    DATETIME NULL CONSTRAINT DF_ELedger_CreatedAt DEFAULT (GETDATE())
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_ELedger_Period' AND object_id = OBJECT_ID(N'dbo.ELedger')
)
  CREATE NONCLUSTERED INDEX IX_ELedger_Period
    ON dbo.ELedger (PeriodYear, PeriodMonth, PartNo);
GO
