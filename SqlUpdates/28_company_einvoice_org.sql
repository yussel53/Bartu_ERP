-- 28: Firma e-Fatura / e-Defter / dönem / entegrasyon alanları
-- SYS_Companies genişletme + Workplace/Whouse için gerekli kolonlar

IF OBJECT_ID(N'dbo.SYS_Companies', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_Companies', N'PeriodStartDate') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD PeriodStartDate DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EDefterStartDate') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EDefterStartDate DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EInvoiceStartDate') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EInvoiceStartDate DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'PostLabel') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD PostLabel NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'SenderLabel') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD SenderLabel NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EinvoiceEmail') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EinvoiceEmail NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorName') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD IntegratorName NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorWsUrl') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD IntegratorWsUrl NVARCHAR(400) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorUser') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD IntegratorUser NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorPassword') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD IntegratorPassword NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'IntegratorVkN') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD IntegratorVkN NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EnableMukellefCheck') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EnableMukellefCheck BIT NOT NULL
      CONSTRAINT DF_SYS_Companies_EnableMukellefCheck DEFAULT (1);

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EnableInvoiceSend') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EnableInvoiceSend BIT NOT NULL
      CONSTRAINT DF_SYS_Companies_EnableInvoiceSend DEFAULT (1);

  IF COL_LENGTH(N'dbo.SYS_Companies', N'EnableInvoiceReceive') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD EnableInvoiceReceive BIT NOT NULL
      CONSTRAINT DF_SYS_Companies_EnableInvoiceReceive DEFAULT (1);

  IF COL_LENGTH(N'dbo.SYS_Companies', N'AddressText') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD AddressText NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'City') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD City NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Town') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Town NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'Phone') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD Phone NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'MukellefCheckStatus') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD MukellefCheckStatus NVARCHAR(250) NULL;

  IF COL_LENGTH(N'dbo.SYS_Companies', N'MukellefCheckAt') IS NULL
    ALTER TABLE dbo.SYS_Companies ADD MukellefCheckAt DATETIME NULL;
END
GO

-- SYS_Workplace yoksa oluştur (10 ile uyumlu)
IF OBJECT_ID(N'dbo.SYS_Workplace', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Workplace (
    WorkplaceID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_Workplace PRIMARY KEY,
    CompanyID   INT NOT NULL,
    Code        NVARCHAR(50) NOT NULL,
    Title       NVARCHAR(150) NOT NULL,
    IsActive    BIT NOT NULL CONSTRAINT DF_SYS_Workplace_IsActive_28 DEFAULT (1),
    AdditionalFields NVARCHAR(MAX) NULL
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_Whouse', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_Whouse', N'WorkplaceID') IS NULL
BEGIN
  ALTER TABLE dbo.SYS_Whouse ADD WorkplaceID INT NULL;
END
GO
