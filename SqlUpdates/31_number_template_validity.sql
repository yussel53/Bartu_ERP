-- 31: Fiş numaralama şablonu — geçerlilik tarihi, başlangıç/bitiş, org/kullanıcı filtreleri

IF OBJECT_ID(N'dbo.SYS_NumberTemplate', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'ValidFrom') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD ValidFrom DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'ValidTo') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD ValidTo DATETIME NULL;

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'StartNumber') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD StartNumber BIGINT NOT NULL
      CONSTRAINT DF_SYS_NumberTemplate_Start DEFAULT (1);

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'EndNumber') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD EndNumber BIGINT NULL;

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'FilterCompanyID') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD FilterCompanyID NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'FilterWorkplaceID') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD FilterWorkplaceID NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'FilterWhouseID') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD FilterWhouseID NVARCHAR(40) NULL;

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'FilterUserId') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD FilterUserId NVARCHAR(40) NULL;

  -- 0 Yok, 1 Yıl, 2 Ay, 3 Hafta, 4 Gün, 5 Çeyrek
  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'PeriodKind') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD PeriodKind TINYINT NOT NULL
      CONSTRAINT DF_SYS_NumberTemplate_PeriodKind DEFAULT (0);

  IF COL_LENGTH(N'dbo.SYS_NumberTemplate', N'CardCode') IS NULL
    ALTER TABLE dbo.SYS_NumberTemplate ADD CardCode NVARCHAR(40) NULL;
END
GO

-- Mevcut satırlara öndeğer geçerlilik (Logo: 01.01.1900 – 31.12.2100)
UPDATE dbo.SYS_NumberTemplate
SET ValidFrom = ISNULL(ValidFrom, '19000101'),
    ValidTo = ISNULL(ValidTo, '21001231'),
    StartNumber = ISNULL(StartNumber, 1),
    CardCode = ISNULL(NULLIF(LTRIM(RTRIM(CardCode)), N''), N'*')
WHERE ValidFrom IS NULL OR ValidTo IS NULL OR CardCode IS NULL;
GO
