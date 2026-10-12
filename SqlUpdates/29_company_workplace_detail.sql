-- 29: Firma + İşyeri detay / e-Devlet / çalışma bilgileri
-- Referans: Firma Tanımı (Genel, Mali Müşavir, Çalışma, e-Devlet, İşyeri bazlı)

IF OBJECT_ID(N'dbo.SYS_Companies', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_Companies', N'TradeTitle') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD TradeTitle NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Street') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Street NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Street2') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Street2 NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'DoorNo') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD DoorNo NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'PostalCode') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD PostalCode NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Country') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Country NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Phone2') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Phone2 NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Fax') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Fax NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Email') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Email NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'WebAddress') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD WebAddress NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'TaxOfficeCode') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD TaxOfficeCode NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'NaceCode') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD NaceCode NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'InstitutionType') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD InstitutionType NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'SskNo') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD SskNo NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'CalendarType') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD CalendarType NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'FiscalYearStartMonth') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD FiscalYearStartMonth INT NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'DbLanguage') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD DbLanguage NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'CurrencyCode') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD CurrencyCode NVARCHAR(10) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'ReportCurrency') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD ReportCurrency NVARCHAR(10) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'VatRounding') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD VatRounding NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'FxRateSource') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD FxRateSource NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EDevletKontrolTipi') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EDevletKontrolTipi NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorApiKey') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD IntegratorApiKey NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'OnlineSend') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD OnlineSend BIT NOT NULL
      CONSTRAINT DF_SYS_Companies_OnlineSend DEFAULT (0);

  -- Mali müşavir
  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorName') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorName NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorSurname') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorSurname NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorTckn') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorTckn NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorPhone') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorPhone NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorEmail') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorEmail NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorTaxOffice') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorTaxOffice NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorTaxNr') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorTaxNr NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorChamberNo') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorChamberNo NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorAddress') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorAddress NVARCHAR(400) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorContractNo') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorContractNo NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorContractType') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorContractType NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorContractEnd') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorContractEnd DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AdvisorContractDesc') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AdvisorContractDesc NVARCHAR(200) NULL;
END
GO

IF OBJECT_ID(N'dbo.SYS_Workplace', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_Workplace', N'TaxNumber') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD TaxNumber NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'TaxOffice') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD TaxOffice NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'TaxOfficeCode') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD TaxOfficeCode NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Phone') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Phone NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Phone2') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Phone2 NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Fax') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Fax NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Email') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Email NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'WebAddress') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD WebAddress NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Street') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Street NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Street2') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Street2 NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'DoorNo') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD DoorNo NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Town') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Town NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'City') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD City NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'PostalCode') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD PostalCode NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'Country') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD Country NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'AddressText') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD AddressText NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'NaceCode') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD NaceCode NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'SskNo') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD SskNo NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'CalendarType') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD CalendarType NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'FiscalYearStartMonth') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD FiscalYearStartMonth INT NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'CurrencyCode') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD CurrencyCode NVARCHAR(10) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'ReportCurrency') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD ReportCurrency NVARCHAR(10) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'VatRounding') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD VatRounding NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'FxRateSource') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD FxRateSource NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'PeriodStartDate') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD PeriodStartDate DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'EDefterStartDate') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD EDefterStartDate DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'EInvoiceStartDate') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD EInvoiceStartDate DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'PostLabel') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD PostLabel NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'SenderLabel') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD SenderLabel NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'EinvoiceEmail') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD EinvoiceEmail NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'IntegratorName') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD IntegratorName NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'IntegratorWsUrl') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD IntegratorWsUrl NVARCHAR(400) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'IntegratorUser') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD IntegratorUser NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'IntegratorPassword') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD IntegratorPassword NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'IntegratorVkN') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD IntegratorVkN NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'IntegratorApiKey') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD IntegratorApiKey NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'OnlineSend') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD OnlineSend BIT NOT NULL
      CONSTRAINT DF_SYS_Workplace_OnlineSend DEFAULT (0);

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'EnableMukellefCheck') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD EnableMukellefCheck BIT NOT NULL
      CONSTRAINT DF_SYS_Workplace_EnableMukellefCheck DEFAULT (1);

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'EnableInvoiceSend') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD EnableInvoiceSend BIT NOT NULL
      CONSTRAINT DF_SYS_Workplace_EnableInvoiceSend DEFAULT (1);

  IF COL_LENGTH(N'dbo.SYS_Workplace', N'EnableInvoiceReceive') IS NULL
    ALTER TABLE dbo.SYS_Workplace ADD EnableInvoiceReceive BIT NOT NULL
      CONSTRAINT DF_SYS_Workplace_EnableInvoiceReceive DEFAULT (1);
END
GO
