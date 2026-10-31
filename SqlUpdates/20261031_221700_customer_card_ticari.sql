-- CustomerCard: Logo cari «Ticari Bilgiler» alanları
-- Title2, yabancı/şahıs, TCKN ayrı, VD kodu, ad/soyad, KDV no, ödeme planı, izleme, kur farkı
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerCard', N'Title2') IS NULL
    ALTER TABLE dbo.CustomerCard ADD Title2 NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'IsForeign') IS NULL
    ALTER TABLE dbo.CustomerCard ADD IsForeign BIT NOT NULL
      CONSTRAINT DF_CustomerCard_IsForeign DEFAULT (0);

  IF COL_LENGTH(N'dbo.CustomerCard', N'IsPersonCompany') IS NULL
    ALTER TABLE dbo.CustomerCard ADD IsPersonCompany BIT NOT NULL
      CONSTRAINT DF_CustomerCard_IsPersonCompany DEFAULT (0);

  IF COL_LENGTH(N'dbo.CustomerCard', N'IdentityNr') IS NULL
    ALTER TABLE dbo.CustomerCard ADD IdentityNr NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'TaxOfficeCode') IS NULL
    ALTER TABLE dbo.CustomerCard ADD TaxOfficeCode NVARCHAR(20) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'FirstName') IS NULL
    ALTER TABLE dbo.CustomerCard ADD FirstName NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'LastName') IS NULL
    ALTER TABLE dbo.CustomerCard ADD LastName NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'VatNr') IS NULL
    ALTER TABLE dbo.CustomerCard ADD VatNr NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'FxRateType') IS NULL
    ALTER TABLE dbo.CustomerCard ADD FxRateType TINYINT NOT NULL
      CONSTRAINT DF_CustomerCard_FxRateType DEFAULT (0);

  IF COL_LENGTH(N'dbo.CustomerCard', N'PaidPlanID') IS NULL
    ALTER TABLE dbo.CustomerCard ADD PaidPlanID INT NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'DiscountRate') IS NULL
    ALTER TABLE dbo.CustomerCard ADD DiscountRate FLOAT NULL;

  IF COL_LENGTH(N'dbo.CustomerCard', N'PaymentTrack') IS NULL
    ALTER TABLE dbo.CustomerCard ADD PaymentTrack TINYINT NOT NULL
      CONSTRAINT DF_CustomerCard_PaymentTrack DEFAULT (1);

  IF COL_LENGTH(N'dbo.CustomerCard', N'PaymentTrackWorkplace') IS NULL
    ALTER TABLE dbo.CustomerCard ADD PaymentTrackWorkplace TINYINT NOT NULL
      CONSTRAINT DF_CustomerCard_PaymentTrackWp DEFAULT (1);

  IF COL_LENGTH(N'dbo.CustomerCard', N'FxDiffMode') IS NULL
    ALTER TABLE dbo.CustomerCard ADD FxDiffMode TINYINT NOT NULL
      CONSTRAINT DF_CustomerCard_FxDiffMode DEFAULT (1);

  IF COL_LENGTH(N'dbo.CustomerCard', N'PaymentType') IS NULL
    ALTER TABLE dbo.CustomerCard ADD PaymentType TINYINT NOT NULL
      CONSTRAINT DF_CustomerCard_PaymentType DEFAULT (0);

  IF COL_LENGTH(N'dbo.CustomerCard', N'GroupCompanyCode') IS NULL
    ALTER TABLE dbo.CustomerCard ADD GroupCompanyCode NVARCHAR(50) NULL;
END
GO

-- TaxType=2 (Gerçek) → şahıs şirketi bayrağı
IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerCard', N'IsPersonCompany') IS NOT NULL
BEGIN
  UPDATE dbo.CustomerCard
  SET IsPersonCompany = 1
  WHERE TaxType = 2 AND ISNULL(IsPersonCompany, 0) = 0;
END
GO

IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerCard', N'PaidPlanID') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerCard_PaidPlanID' AND object_id = OBJECT_ID(N'dbo.CustomerCard')
  )
  CREATE NONCLUSTERED INDEX IX_CustomerCard_PaidPlanID
    ON dbo.CustomerCard (PaidPlanID)
    WHERE PaidPlanID IS NOT NULL;
GO
