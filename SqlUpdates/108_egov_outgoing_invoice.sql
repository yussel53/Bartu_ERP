-- 108: E-Devlet — giden e-fatura hazırlama (yol haritası E-03)
-- EGovSendSetting: firma bazında GİB seri önekleri, varsayılan senaryo ve canlı gönderim izni (varsayılan kapalı).
-- EGovNumberCounter: önek + yıl bazında GİB belge numarası sayacı (numara gönderimde verilir, boşluk olmaz).
-- EGovDocument: giden belgenin gönderim durumu.

IF OBJECT_ID(N'dbo.EGovSendSetting', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovSendSetting (
    CompanyId         INT NOT NULL CONSTRAINT PK_EGovSendSetting PRIMARY KEY,
    EInvoicePrefix    NVARCHAR(3) NULL,
    EArchivePrefix    NVARCHAR(3) NULL,
    EDespatchPrefix   NVARCHAR(3) NULL,
    -- TEMELFATURA · TICARIFATURA
    DefaultProfile    NVARCHAR(20) NOT NULL CONSTRAINT DF_EGovSendSetting_Profile DEFAULT (N'TICARIFATURA'),
    -- Entegratör adresi canlıysa gönderim yalnız bu açıksa yapılır
    AllowLiveSend     BIT NOT NULL CONSTRAINT DF_EGovSendSetting_AllowLive DEFAULT (0),
    UpdatedAt         DATETIME2 NULL,
    UpdatedBy         INT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.EGovNumberCounter', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovNumberCounter (
    CompanyId   INT NOT NULL,
    Prefix      NVARCHAR(3) NOT NULL,
    [Year]      INT NOT NULL,
    LastValue   BIGINT NOT NULL CONSTRAINT DF_EGovNumberCounter_Last DEFAULT (0),
    UpdatedAt   DATETIME2 NULL,
    CONSTRAINT PK_EGovNumberCounter PRIMARY KEY (CompanyId, Prefix, [Year])
  );
END
GO

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovDocument', N'SendStatus') IS NULL
  ALTER TABLE dbo.EGovDocument ADD
    SendStatus  NVARCHAR(20) NULL,     -- Gönderildi · Hata
    SendError   NVARCHAR(2000) NULL,
    SentAt      DATETIME2 NULL,
    SentBy      INT NULL;
GO
