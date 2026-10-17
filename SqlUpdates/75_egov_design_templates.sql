-- 75: E-Devlet tasarım şablonları
-- EGovXsltDesign   : XSLT tasarım kütüphanesi (yüklenen dosyalar)
-- EGovDesignRule   : hangi belgede hangi tasarımın kullanılacağı (şablon kuralları)
--
-- DocType (belge türü):
--   1 e-Fatura · 2 e-Fatura İade · 3 e-Arşiv · 4 e-Arşiv İnternet · 5 e-İrsaliye · 6 e-İrsaliye Yanıtı
--   7 e-Müstahsil Makbuzu · 8 e-Serbest Meslek Makbuzu · 9 e-Fatura İhracat · 10 e-İrsaliye Ambar
--   11 e-Fatura İhraç Kayıtlı · 12 e-Arşiv İhraç Kayıtlı · 13 e-Arşiv İade · 14 İlaç ve Tıbbi Cihaz
-- RuleType (şablon tipi):
--   1 Öndeğer · 2 Alıcı Cari VKN/TCKN · 3 Fatura Özel Kodu · 4 Parametre · 5 Cari Hesap Kodu
--   6 İş Yeri Kodu · 7 Organizasyonel Birimler · 8 Ambar Kodu
-- Seçim: belge türünün aktif kurallarından değeri belgeyle eşleşenler, Öncelik küçükten büyüğe;
-- eşleşen yoksa Öndeğer; o da yoksa entegratörün (e-Logo) varsayılan tasarımı.

IF OBJECT_ID(N'dbo.EGovXsltDesign', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovXsltDesign (
    EGovXsltDesignID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovXsltDesign PRIMARY KEY,
    Title        NVARCHAR(150) NOT NULL,
    FileName     NVARCHAR(260) NULL,
    XsltContent  NVARCHAR(MAX) NOT NULL,
    ContentHash  NVARCHAR(64) NULL,           -- SHA-256 (hex)
    IsActive     BIT NOT NULL CONSTRAINT DF_EGovXsltDesign_IsActive DEFAULT (1),
    Notes        NVARCHAR(500) NULL,
    CreatedAt    DATETIME2 NOT NULL CONSTRAINT DF_EGovXsltDesign_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt    DATETIME2 NULL
  );
END
GO

IF OBJECT_ID(N'dbo.EGovDesignRule', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovDesignRule (
    EGovDesignRuleID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovDesignRule PRIMARY KEY,
    DocType          SMALLINT NOT NULL,
    RuleType         TINYINT NOT NULL,
    RuleValue        NVARCHAR(100) NULL,      -- Öndeğer'de NULL
    Priority         INT NOT NULL CONSTRAINT DF_EGovDesignRule_Priority DEFAULT (1),
    EGovXsltDesignID INT NOT NULL
      CONSTRAINT FK_EGovDesignRule_Design REFERENCES dbo.EGovXsltDesign (EGovXsltDesignID),
    Description      NVARCHAR(500) NULL,
    IsActive         BIT NOT NULL CONSTRAINT DF_EGovDesignRule_IsActive DEFAULT (1),
    CreatedAt        DATETIME2 NOT NULL CONSTRAINT DF_EGovDesignRule_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt        DATETIME2 NULL
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_EGovDesignRule_DocType' AND object_id = OBJECT_ID(N'dbo.EGovDesignRule')
)
  CREATE NONCLUSTERED INDEX IX_EGovDesignRule_DocType
    ON dbo.EGovDesignRule (DocType, RuleType, Priority)
    INCLUDE (RuleValue, EGovXsltDesignID, IsActive);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_EGovDesignRule_Design' AND object_id = OBJECT_ID(N'dbo.EGovDesignRule')
)
  CREATE NONCLUSTERED INDEX IX_EGovDesignRule_Design
    ON dbo.EGovDesignRule (EGovXsltDesignID);
GO
