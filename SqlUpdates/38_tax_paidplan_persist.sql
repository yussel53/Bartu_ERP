-- 38: Vergi + Ödeme/Tahsilat planı — DB kayıt uyumu
-- PaidPlanCard.Description nchar(10) → NVARCHAR(200)
-- TaxCard.Rate + AccountGroupID öndeğer

-- PaidPlanCard: Decription → Description (eski yazım)
IF OBJECT_ID(N'dbo.PaidPlanCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.PaidPlanCard', N'Description') IS NULL
  AND COL_LENGTH(N'dbo.PaidPlanCard', N'Decription') IS NOT NULL
BEGIN
  EXEC sp_rename N'dbo.PaidPlanCard.Decription', N'Description', N'COLUMN';
END
GO

IF OBJECT_ID(N'dbo.PaidPlanCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.PaidPlanCard', N'Description') IS NULL
BEGIN
  ALTER TABLE dbo.PaidPlanCard ADD Description NVARCHAR(200) NULL;
END
GO

-- nchar(10) / kısa kolon → NVARCHAR(200)
IF OBJECT_ID(N'dbo.PaidPlanCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.PaidPlanCard', N'Description') IS NOT NULL
BEGIN
  DECLARE @maxLen int =
    (SELECT CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'PaidPlanCard' AND COLUMN_NAME = N'Description');
  IF @maxLen IS NOT NULL AND (@maxLen < 200 AND @maxLen > 0)
  BEGIN
    ALTER TABLE dbo.PaidPlanCard ALTER COLUMN Description NVARCHAR(200) NULL;
  END
END
GO

IF OBJECT_ID(N'dbo.PaidPlanCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.PaidPlanCard', N'PlanType') IS NULL
    ALTER TABLE dbo.PaidPlanCard ADD PlanType TINYINT NOT NULL CONSTRAINT DF_PaidPlanCard_PlanType38 DEFAULT (3);
  IF COL_LENGTH(N'dbo.PaidPlanCard', N'DayCount') IS NULL
    ALTER TABLE dbo.PaidPlanCard ADD DayCount INT NULL;
  IF COL_LENGTH(N'dbo.PaidPlanCard', N'InstallmentCnt') IS NULL
    ALTER TABLE dbo.PaidPlanCard ADD InstallmentCnt INT NULL;
  IF COL_LENGTH(N'dbo.PaidPlanCard', N'IsActive') IS NULL
    ALTER TABLE dbo.PaidPlanCard ADD IsActive BIT NOT NULL CONSTRAINT DF_PaidPlanCard_IsActive38 DEFAULT (1);
  IF COL_LENGTH(N'dbo.PaidPlanCard', N'AuthCode') IS NULL
    ALTER TABLE dbo.PaidPlanCard ADD AuthCode NVARCHAR(50) NULL;
END
GO

IF OBJECT_ID(N'dbo.PaidPlanLine', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PaidPlanLine (
    PaidPlanLineID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PaidPlanLine38 PRIMARY KEY,
    PaidPlanID     INT NOT NULL,
    [LineNo]       INT NOT NULL,
    DayOffset      INT NOT NULL CONSTRAINT DF_PaidPlanLine_DayOffset38 DEFAULT (0),
    RatePercent    DECIMAL(9,4) NULL,
    Description    NVARCHAR(100) NULL
  );
END
GO

-- TaxCard.Rate
IF OBJECT_ID(N'dbo.TaxCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.TaxCard', N'Rate') IS NULL
BEGIN
  ALTER TABLE dbo.TaxCard ADD Rate FLOAT NULL;
END
GO

IF OBJECT_ID(N'dbo.TaxCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.TaxCard', N'AuthCode') IS NULL
BEGIN
  ALTER TABLE dbo.TaxCard ADD AuthCode NVARCHAR(50) NULL;
END
GO

-- TaxLine: oran satırı (opsiyonel detay)
IF OBJECT_ID(N'dbo.TaxLine', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.TaxLine', N'Rate') IS NULL
BEGIN
  ALTER TABLE dbo.TaxLine ADD Rate FLOAT NULL;
END
GO
