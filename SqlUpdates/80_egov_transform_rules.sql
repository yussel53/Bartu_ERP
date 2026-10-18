-- 80: e-Belge kuralları — gönderim öncesi UBL üzerinde değişiklik (Logo «Kural Tanımları» karşılığı)
-- Kural = şablon (TemplateCode) + parametre (ParamsJson) + koşullar (ConditionsJson) + sıra (Priority).
-- Kurallar uygulamanın kendi bağlantısıyla çalışır; kural içinde bağlantı bilgisi / şifre SAKLANMAZ.
-- DocKinds: '1,2,3' (1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye), boş = hepsi. Direction: 2 giden (varsayılan), 1 gelen.

IF OBJECT_ID(N'dbo.EGovTransformRule', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovTransformRule (
    EGovTransformRuleID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovTransformRule PRIMARY KEY,
    Name            NVARCHAR(150) NOT NULL,
    TemplateCode    NVARCHAR(60)  NOT NULL,
    DocKinds        NVARCHAR(20)  NULL,
    Direction       TINYINT       NOT NULL CONSTRAINT DF_EGovTransformRule_Direction DEFAULT 2,
    ParamsJson      NVARCHAR(MAX) NULL,
    ConditionsJson  NVARCHAR(MAX) NULL,
    Priority        INT           NOT NULL CONSTRAINT DF_EGovTransformRule_Priority DEFAULT 100,
    StopAfter       BIT           NOT NULL CONSTRAINT DF_EGovTransformRule_StopAfter DEFAULT 0,
    IsActive        BIT           NOT NULL CONSTRAINT DF_EGovTransformRule_IsActive DEFAULT 1,
    Description     NVARCHAR(500) NULL,
    CompanyID       INT           NULL,
    CreatedBy       INT           NULL,
    CreatedAt       DATETIME2     NOT NULL CONSTRAINT DF_EGovTransformRule_CreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt       DATETIME2     NULL
  );
END
GO

IF OBJECT_ID(N'dbo.EGovTransformRuleLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovTransformRuleLog (
    Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovTransformRuleLog PRIMARY KEY,
    EGovTransformRuleID INT           NULL,
    EGovDocumentID      INT           NULL,
    InvoiceID           INT           NULL,
    DocumentNo          NVARCHAR(50)  NULL,
    Changed             BIT           NOT NULL CONSTRAINT DF_EGovTransformRuleLog_Changed DEFAULT 0,
    Message             NVARCHAR(1000) NULL,
    AppliedAt           DATETIME2     NOT NULL CONSTRAINT DF_EGovTransformRuleLog_AppliedAt DEFAULT SYSDATETIME()
  );
  CREATE INDEX IX_EGovTransformRuleLog_Doc ON dbo.EGovTransformRuleLog (EGovDocumentID, InvoiceID);
END
GO
