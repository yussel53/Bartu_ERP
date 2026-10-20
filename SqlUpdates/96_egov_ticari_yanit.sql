-- 96: E-Devlet — gelen TİCARİ faturaya KABUL / RED yanıtı ve harici itiraz / iptal kaydı
-- EGovDocument: uygulama yanıtı (e-Logo CREATEAPPLICATIONRESPONSE) — gönderim canlı adreste kilitli.
-- EGovDocumentObjection: 8 günlük süre dışında ya da GİB sistemi dışında yapılan itiraz / iptaller
--   (KEP · NOTER; ayrıca GİB portalı). Gelen ve giden belgede tutulur.

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovDocument', N'ResponseCode') IS NULL
  ALTER TABLE dbo.EGovDocument ADD
    ResponseCode    NVARCHAR(10) NULL,      -- KABUL · RED
    ResponseNote    NVARCHAR(500) NULL,
    ResponseAt      DATETIME2 NULL,
    ResponseBy      INT NULL,
    ResponseStatus  NVARCHAR(20) NULL,      -- Gönderildi · Hata
    ResponseError   NVARCHAR(1000) NULL;
GO

IF OBJECT_ID(N'dbo.EGovDocumentObjection', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovDocumentObjection (
    EGovDocumentObjectionID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovDocumentObjection PRIMARY KEY,
    EGovDocumentID   INT NOT NULL,
    -- ITIRAZ · IPTAL (karşılıklı iptal)
    Kind             NVARCHAR(10) NOT NULL,
    -- KEP · NOTER · GIB_PORTAL
    Method           NVARCHAR(20) NOT NULL,
    -- 1: gelen faturaya bizim itirazımız · 2: giden faturamıza alıcının itirazı (belgenin yönüyle aynı)
    ObjectionDate    DATE NOT NULL,
    ObjectionDocNo   NVARCHAR(100) NULL,
    Description      NVARCHAR(500) NOT NULL,
    -- Kayıt öncesi belge durumu (kayıt geri alınınca geri yüklenir)
    PrevStatus       NVARCHAR(50) NULL,
    IsActive         BIT NOT NULL CONSTRAINT DF_EGovDocumentObjection_Active DEFAULT (1),
    CreatedAt        DATETIME2 NOT NULL CONSTRAINT DF_EGovDocumentObjection_Created DEFAULT (SYSDATETIME()),
    CreatedBy        INT NULL,
    CancelledAt      DATETIME2 NULL,
    CancelledBy      INT NULL
  );
  CREATE INDEX IX_EGovDocumentObjection_Doc ON dbo.EGovDocumentObjection (EGovDocumentID) WHERE IsActive = 1;
END
GO
