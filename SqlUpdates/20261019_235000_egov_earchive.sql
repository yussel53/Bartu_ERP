-- 20261019235000: E-Devlet — e-Arşiv fatura bilgileri ve iptal (yol haritası E-04)
-- EGovInvoiceEArchive: fatura başına gönderim şekli, alıcı e-postası ve internet satışı bilgileri (GİB e-Arşiv kılavuzu 3.3.2.17).
-- EGovSendSetting: firmanın varsayılan web adresi ve gönderim şekli.
-- EGovDocument: e-Arşiv iptal bilgisi.

IF OBJECT_ID(N'dbo.EGovInvoiceEArchive', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovInvoiceEArchive (
    InvoiceID         INT NOT NULL CONSTRAINT PK_EGovInvoiceEArchive PRIMARY KEY,
    -- ELEKTRONIK · KAGIT
    SendType          NVARCHAR(10) NOT NULL CONSTRAINT DF_EGovInvoiceEArchive_SendType DEFAULT (N'ELEKTRONIK'),
    Email             NVARCHAR(200) NULL,
    IsInternetSale    BIT NOT NULL CONSTRAINT DF_EGovInvoiceEArchive_Internet DEFAULT (0),
    WebAddress        NVARCHAR(250) NULL,
    -- KREDIKARTI/BANKAKARTI · EFT/HAVALE · KAPIDAODEME · ODEMEARACISI · DIGER
    PaymentMethod     NVARCHAR(30) NULL,
    PaymentNote       NVARCHAR(200) NULL,
    PaymentAgent      NVARCHAR(150) NULL,
    PaymentDate       DATE NULL,
    DespatchDate      DATE NULL,
    CarrierTaxNr      NVARCHAR(11) NULL,
    CarrierName       NVARCHAR(150) NULL,
    UpdatedAt         DATETIME2 NULL,
    UpdatedBy         INT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.EGovSendSetting', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovSendSetting', N'EArchiveWebAddress') IS NULL
  ALTER TABLE dbo.EGovSendSetting ADD
    EArchiveWebAddress  NVARCHAR(250) NULL,
    EArchiveSendType    NVARCHAR(10) NOT NULL CONSTRAINT DF_EGovSendSetting_EArchiveSendType DEFAULT (N'ELEKTRONIK');
GO

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EGovDocument', N'CancelledAt') IS NULL
  ALTER TABLE dbo.EGovDocument ADD
    CancelledAt     DATETIME2 NULL,
    CancelledBy     INT NULL,
    CancelReason    NVARCHAR(500) NULL;
GO
