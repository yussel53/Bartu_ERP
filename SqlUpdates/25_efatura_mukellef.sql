-- e-Fatura / e-Arşiv mükellef listesi (GİB kullanıcı/alias kaydı)
-- Cari adres → PostLabel (PK) / SenderLabel (GB) doldurma

IF OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EFaturaMukellef (
    EFaturaMukellefID INT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_EFaturaMukellef PRIMARY KEY,
    TaxNr           NVARCHAR(20)  NOT NULL,   -- VKN / TCKN
    Title           NVARCHAR(250) NULL,
    Alias           NVARCHAR(200) NOT NULL,   -- posta kutusu etiketi (urn:mail:...)
    AliasType       NVARCHAR(10)  NULL,      -- PK (gelen) / GB (giden)
    UnitType        NVARCHAR(30)  NULL,      -- e-Fatura / e-Arşiv
    FirstCreateDate DATETIME      NULL,
    IsActive        BIT NOT NULL
      CONSTRAINT DF_EFaturaMukellef_IsActive DEFAULT (1),
    CreatedAt       DATETIME NULL
      CONSTRAINT DF_EFaturaMukellef_CreatedAt DEFAULT (GETDATE())
  );
END
GO

IF OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_EFaturaMukellef_TaxNr'
      AND object_id = OBJECT_ID(N'dbo.EFaturaMukellef')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_EFaturaMukellef_TaxNr
    ON dbo.EFaturaMukellef (TaxNr)
    INCLUDE (Alias, AliasType, Title, UnitType, IsActive);
END
GO

IF OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_EFaturaMukellef_TaxNr_Alias'
      AND object_id = OBJECT_ID(N'dbo.EFaturaMukellef')
  )
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UX_EFaturaMukellef_TaxNr_Alias
    ON dbo.EFaturaMukellef (TaxNr, Alias);
END
GO

-- Örnek kayıtlar (yoksa) — test VKN
IF OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.EFaturaMukellef WHERE TaxNr = N'1234567890')
BEGIN
  INSERT INTO dbo.EFaturaMukellef (TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate)
  VALUES
    (N'1234567890', N'Test Cari Nested A.Ş.', N'urn:mail:defaultpk@efatura.gov.tr', N'PK', N'e-Fatura', GETDATE()),
    (N'1234567890', N'Test Cari Nested A.Ş.', N'urn:mail:defaultgb@efatura.gov.tr', N'GB', N'e-Fatura', GETDATE()),
    (N'1234567890', N'Test Cari Nested A.Ş.', N'urn:mail:earsivpk@earsiv.gov.tr', N'PK', N'e-Arşiv', GETDATE());
END
GO

-- CustomerAdress: son mükellef kontrol özeti (opsiyonel)
IF OBJECT_ID(N'dbo.CustomerAdress', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerAdress', N'MukellefCheckStatus') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD MukellefCheckStatus NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.CustomerAdress', N'MukellefCheckAt') IS NULL
    ALTER TABLE dbo.CustomerAdress ADD MukellefCheckAt DATETIME NULL;
END
GO
