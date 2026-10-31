-- 101: Birim ana kartı. Mevcut UnitID 1–8 sabit katalogla aynı kalır.
-- GlobalCode: e-belge / UNECE birim kodu (EA, KGM, LTR …)

IF OBJECT_ID(N'dbo.UnitCard', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.UnitCard (
    UnitID      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UnitCard PRIMARY KEY,
    Code        NVARCHAR(20)  NOT NULL,
    Title       NVARCHAR(80)  NOT NULL,
    GlobalCode  NVARCHAR(10)  NULL,
    IsActive    BIT           NOT NULL CONSTRAINT DF_UnitCard_IsActive DEFAULT 1,
    Description NVARCHAR(250) NULL
  );
  CREATE UNIQUE INDEX UX_UnitCard_Code ON dbo.UnitCard (Code);
END
GO

IF OBJECT_ID(N'dbo.UnitCard', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.UnitCard', N'GlobalCode') IS NULL
  ALTER TABLE dbo.UnitCard ADD GlobalCode NVARCHAR(10) NULL;
GO

IF OBJECT_ID(N'dbo.UnitCard', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.UnitCard)
BEGIN
  SET IDENTITY_INSERT dbo.UnitCard ON;
  INSERT INTO dbo.UnitCard (UnitID, Code, Title, GlobalCode) VALUES
    (1, N'ADT',  N'Adet',  N'EA'),
    (2, N'KOLI', N'Koli',  N'BX'),
    (3, N'PKT',  N'Paket', N'PA'),
    (4, N'KG',   N'Kg',    N'KGM'),
    (5, N'LT',   N'Litre', N'LTR'),
    (6, N'MT',   N'Metre', N'MTR'),
    (7, N'SAAT', N'Saat',  N'HUR'),
    (8, N'GUN',  N'G' + NCHAR(252) + N'n', N'DAY');
  SET IDENTITY_INSERT dbo.UnitCard OFF;
END
GO

IF OBJECT_ID(N'dbo.UnitCard', N'U') IS NOT NULL
BEGIN
  UPDATE u
     SET u.GlobalCode = v.GlobalCode
    FROM dbo.UnitCard u
    INNER JOIN (VALUES
      (1, N'EA'),
      (2, N'BX'),
      (3, N'PA'),
      (4, N'KGM'),
      (5, N'LTR'),
      (6, N'MTR'),
      (7, N'HUR'),
      (8, N'DAY')
    ) v(UnitID, GlobalCode) ON v.UnitID = u.UnitID
   WHERE u.GlobalCode IS NULL OR LTRIM(RTRIM(u.GlobalCode)) = N'';
END
GO
