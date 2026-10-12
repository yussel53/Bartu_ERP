-- 40: Özel kod değer listesi + tarih
-- AuxilCodeValue: tanım altındaki Mercedes/BMW… ve açıklama seçenekleri
-- AuxilCodeTrans.TransDate / AuxilCodeValueID

IF OBJECT_ID(N'dbo.AuxilCodeValue', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuxilCodeValue (
    AuxilCodeValueID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuxilCodeValue40 PRIMARY KEY,
    AuxilCodesID     INT           NOT NULL,
    ValueKind        TINYINT       NOT NULL CONSTRAINT DF_AuxilCodeValue_Kind40 DEFAULT (1), -- 1=Kod, 2=Açıklama
    Code             NVARCHAR(50)  NOT NULL,
    Title            NVARCHAR(200) NULL,
    SortOrder        INT           NULL,
    IsActive         BIT           NOT NULL CONSTRAINT DF_AuxilCodeValue_Active40 DEFAULT (1)
  );
  CREATE INDEX IX_AuxilCodeValue_Parent ON dbo.AuxilCodeValue (AuxilCodesID, ValueKind, SortOrder);
END
GO

IF OBJECT_ID(N'dbo.AuxilCodeValue', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AuxilCodeValue', N'ValueKind') IS NULL
    ALTER TABLE dbo.AuxilCodeValue ADD ValueKind TINYINT NOT NULL CONSTRAINT DF_AuxilCodeValue_Kind40b DEFAULT (1);
  IF COL_LENGTH(N'dbo.AuxilCodeValue', N'Title') IS NULL
    ALTER TABLE dbo.AuxilCodeValue ADD Title NVARCHAR(200) NULL;
  IF COL_LENGTH(N'dbo.AuxilCodeValue', N'SortOrder') IS NULL
    ALTER TABLE dbo.AuxilCodeValue ADD SortOrder INT NULL;
  IF COL_LENGTH(N'dbo.AuxilCodeValue', N'IsActive') IS NULL
    ALTER TABLE dbo.AuxilCodeValue ADD IsActive BIT NOT NULL CONSTRAINT DF_AuxilCodeValue_Active40b DEFAULT (1);
END
GO

-- AuxilCodes: tarih kullanılsın mı?
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AuxilCodes', N'HasDate') IS NULL
BEGIN
  ALTER TABLE dbo.AuxilCodes ADD HasDate BIT NOT NULL CONSTRAINT DF_AuxilCodes_HasDate40 DEFAULT (0);
END
GO

-- AuxilCodeTrans: değer FK + tarih
IF OBJECT_ID(N'dbo.AuxilCodeTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'AuxilCodesID') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD AuxilCodesID INT NULL;
  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'AuxilCodeValueID') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD AuxilCodeValueID INT NULL;
  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'TransDate') IS NULL
    ALTER TABLE dbo.AuxilCodeTrans ADD TransDate DATETIME NULL;
  IF COL_LENGTH(N'dbo.AuxilCodeTrans', N'Definition') IS NOT NULL
  BEGIN
    DECLARE @defLen int =
      (SELECT CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'AuxilCodeTrans' AND COLUMN_NAME = N'Definition');
    IF @defLen IS NOT NULL AND @defLen > 0 AND @defLen < 200
      ALTER TABLE dbo.AuxilCodeTrans ALTER COLUMN Definition NVARCHAR(200) NULL;
  END
END
GO

-- Örnek: Kullanıldığı Marka (Malzeme) + değerler
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.AuxilCodes WHERE Code = N'MARKA')
BEGIN
  DECLARE @mid int = ISNULL((SELECT MAX(AuxilCodesID) FROM dbo.AuxilCodes), 0) + 1;
  INSERT INTO dbo.AuxilCodes (AuxilCodesID, Code, Title, TargetTable, SlotNo, ModuleNr, IsActive, HasDate)
  VALUES (@mid, N'MARKA', N'Kullanıldığı Marka', N'ProductCard', 10, 1, 1, 0);

  IF OBJECT_ID(N'dbo.AuxilCodeValue', N'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.AuxilCodeValue (AuxilCodesID, ValueKind, Code, Title, SortOrder, IsActive)
    VALUES
      (@mid, 1, N'MERCEDES', N'Mercedes', 10, 1),
      (@mid, 1, N'BMW',      N'BMW',      20, 1),
      (@mid, 1, N'AUDI',     N'Audi',     30, 1),
      (@mid, 2, N'OEM',      N'Orijinal parça', 10, 1),
      (@mid, 2, N'AFTER',    N'Aftermarket',    20, 1);
  END
END
GO

-- Örnek: Doğum tarihi (Cari) — tarihli tanım
IF OBJECT_ID(N'dbo.AuxilCodes', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.AuxilCodes WHERE Code = N'DOGUM')
BEGIN
  DECLARE @cid int = ISNULL((SELECT MAX(AuxilCodesID) FROM dbo.AuxilCodes), 0) + 1;
  INSERT INTO dbo.AuxilCodes (AuxilCodesID, Code, Title, TargetTable, SlotNo, ModuleNr, IsActive, HasDate)
  VALUES (@cid, N'DOGUM', N'Doğum Tarihi', N'CustomerCard', 20, 2, 1, 1);
END
GO
