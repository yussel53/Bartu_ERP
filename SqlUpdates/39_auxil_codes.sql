-- 39: Özel kod tanımları (AuxilCodes) + kart/fiş bağlantısı (AuxilCodeTrans)

-- ── AuxilCodes: tanım kartı ──────────────────────────────────────────────
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuxilCodes (
    AuxilCodesID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuxilCodes39 PRIMARY KEY,
    Code           NVARCHAR(50)  NOT NULL,
    Title          NVARCHAR(200) NULL,
    TargetTable    NVARCHAR(50)  NOT NULL CONSTRAINT DF_AuxilCodes_Target39 DEFAULT (N'CustomerCard'),
    SlotNo         INT           NULL,
    ModuleNr       INT           NULL,
    IsActive       BIT           NOT NULL CONSTRAINT DF_AuxilCodes_IsActive39 DEFAULT (1),
    AuthCode       NVARCHAR(50)  NULL
  );
END
GO

IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AuxilCodes', N'Code') IS NULL
    AND COL_LENGTH(N'dbo.AuxilCodes', N'AuxilCODE') IS NOT NULL
    EXEC sp_rename N'dbo.AuxilCodes.AuxilCODE', N'Code', N'COLUMN';

  IF COL_LENGTH(N'dbo.AuxilCodes', N'Code') IS NULL
    ALTER TABLE dbo.AuxilCodes ADD Code NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.AuxilCodes', N'Title') IS NULL
    AND COL_LENGTH(N'dbo.AuxilCodes', N'AuxilDefinition') IS NOT NULL
    EXEC sp_rename N'dbo.AuxilCodes.AuxilDefinition', N'Title', N'COLUMN';

  IF COL_LENGTH(N'dbo.AuxilCodes', N'Title') IS NULL
    ALTER TABLE dbo.AuxilCodes ADD Title NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.AuxilCodes', N'TargetTable') IS NULL
    ALTER TABLE dbo.AuxilCodes ADD TargetTable NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.AuxilCodes', N'SlotNo') IS NULL
  BEGIN
    IF COL_LENGTH(N'dbo.AuxilCodes', N'Type') IS NOT NULL
      EXEC sp_rename N'dbo.AuxilCodes.Type', N'SlotNo', N'COLUMN';
    ELSE
      ALTER TABLE dbo.AuxilCodes ADD SlotNo INT NULL;
  END

  IF COL_LENGTH(N'dbo.AuxilCodes', N'ModuleNr') IS NULL
  BEGIN
    IF COL_LENGTH(N'dbo.AuxilCodes', N'Trcode') IS NOT NULL
      EXEC sp_rename N'dbo.AuxilCodes.Trcode', N'ModuleNr', N'COLUMN';
    ELSE
      ALTER TABLE dbo.AuxilCodes ADD ModuleNr INT NULL;
  END

  IF COL_LENGTH(N'dbo.AuxilCodes', N'IsActive') IS NULL
    ALTER TABLE dbo.AuxilCodes ADD IsActive BIT NOT NULL CONSTRAINT DF_AuxilCodes_IsActive39b DEFAULT (1);

  IF COL_LENGTH(N'dbo.AuxilCodes', N'AuthCode') IS NULL
    ALTER TABLE dbo.AuxilCodes ADD AuthCode NVARCHAR(50) NULL;
END
GO

-- Code / Title genişlet
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AuxilCodes', N'Code') IS NOT NULL
BEGIN
  DECLARE @codeLen int =
    (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'AuxilCodes' AND COLUMN_NAME = N'Code');
  IF @codeLen IS NOT NULL AND @codeLen > 0 AND @codeLen < 50
    ALTER TABLE dbo.AuxilCodes ALTER COLUMN Code NVARCHAR(50) NULL;
END
GO

IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AuxilCodes', N'Title') IS NOT NULL
BEGIN
  DECLARE @titleLen int =
    (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'AuxilCodes' AND COLUMN_NAME = N'Title');
  IF @titleLen IS NOT NULL AND @titleLen > 0 AND @titleLen < 200
    ALTER TABLE dbo.AuxilCodes ALTER COLUMN Title NVARCHAR(200) NULL;
END
GO

-- ── AuxilCodeTrans: kart / fiş üzerindeki değerler ───────────────────
IF OBJECT_ID(N'dbo.AuxilCodeTrans', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuxilCodeTrans (
    AuxilCodeTransID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuxilCodeTrans39 PRIMARY KEY,
    MainCardID       INT           NOT NULL,
    ModuleNr         INT           NOT NULL CONSTRAINT DF_AuxilCodeTrans_Mod39 DEFAULT (0),
    [LineNr]         INT           NOT NULL CONSTRAINT DF_AuxilCodeTrans_Line39 DEFAULT (1),
    AuxilCodesID     INT           NULL,
    AuxilCode        NVARCHAR(50)  NULL,
    Definition       NVARCHAR(150) NULL,
    Type_            INT           NULL,
    Trcode           INT           NULL
  );
END
GO

IF OBJECT_ID(N'dbo.AuxilCodeTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'MainCardID') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD MainCardID INT NULL;

  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'ModuleNr') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD ModuleNr INT NULL;

  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'LineNr') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD LineNr INT NULL;

  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'AuxilCodesID') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD AuxilCodesID INT NULL;

  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'AuxilCode') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD AuxilCode NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'Definition') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD Definition NVARCHAR(150) NULL;

  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'Type_') IS NULL
    AND COL_LENGTH(N'dbo.AuxilCodeTrans', N'Type') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD Type_ INT NULL;
END
GO

-- Örnek tanımlar (yoksa) — PK identity değilse manuel ID
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.AuxilCodes)
BEGIN
  DECLARE @id int = ISNULL((SELECT MAX(AuxilCodesID) FROM dbo.AuxilCodes), 0);
  INSERT INTO dbo.AuxilCodes (AuxilCodesID, Code, Title, TargetTable, SlotNo, ModuleNr, IsActive)
  VALUES
    (@id + 1, N'BOLGE',   N'Bölge',            N'CustomerCard', 1, 2, 1),
    (@id + 2, N'SATTEM',  N'Satış Temsilcisi', N'CustomerCard', 2, 2, 1),
    (@id + 3, N'GRUP',    N'Malzeme Grubu',    N'ProductCard',  1, 1, 1),
    (@id + 4, N'MARKA',   N'Marka',            N'ProductCard',  2, 1, 1),
    (@id + 5, N'KAMPANYA',N'Kampanya',         N'Invoice',      1, 11, 1),
    (@id + 6, N'PROJE',   N'Proje',            N'OrderVoucher', 1, 10, 1);
END
GO
