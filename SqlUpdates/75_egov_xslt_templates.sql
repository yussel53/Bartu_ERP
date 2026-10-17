-- 75: E-Devlet XSLT tasarımları (e-Fatura / e-Arşiv / e-İrsaliye görünüm şablonları)
-- DocKind: 1 e-Fatura, 2 e-Arşiv, 3 e-İrsaliye
-- CompanyId NULL = tüm firmalar; firmaya özel varsayılan yoksa genel varsayılan kullanılır,
-- o da yoksa entegratörün (e-Logo) varsayılan tasarımı.

IF OBJECT_ID(N'dbo.EGovXsltTemplate', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovXsltTemplate (
    EGovXsltTemplateID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovXsltTemplate PRIMARY KEY,
    DocKind      TINYINT NOT NULL,
    CompanyId    INT NULL,
    Title        NVARCHAR(150) NOT NULL,
    FileName     NVARCHAR(260) NULL,
    XsltContent  NVARCHAR(MAX) NOT NULL,
    ContentHash  NVARCHAR(64) NULL,           -- SHA-256 (hex)
    IsDefault    BIT NOT NULL CONSTRAINT DF_EGovXsltTemplate_IsDefault DEFAULT (0),
    IsActive     BIT NOT NULL CONSTRAINT DF_EGovXsltTemplate_IsActive DEFAULT (1),
    Notes        NVARCHAR(500) NULL,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_EGovXsltTemplate_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt    DATETIME2 NULL
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_EGovXsltTemplate_Kind' AND object_id = OBJECT_ID(N'dbo.EGovXsltTemplate')
)
  CREATE NONCLUSTERED INDEX IX_EGovXsltTemplate_Kind
    ON dbo.EGovXsltTemplate (DocKind, CompanyId)
    INCLUDE (Title, IsDefault, IsActive);
GO

-- Belge türü + firma başına tek varsayılan (CompanyId NULL da tek kayıt sayılır)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UX_EGovXsltTemplate_Default' AND object_id = OBJECT_ID(N'dbo.EGovXsltTemplate')
)
  CREATE UNIQUE NONCLUSTERED INDEX UX_EGovXsltTemplate_Default
    ON dbo.EGovXsltTemplate (DocKind, CompanyId)
    WHERE IsDefault = 1;
GO
