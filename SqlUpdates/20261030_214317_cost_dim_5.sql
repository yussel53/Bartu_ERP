-- 5 masraf boyutu: CostDim + CostDimCard + AccountTransDetail.CostDimCardID1..5
-- Bağlı boyut (LinkedDimNo / LinkedCostDimCardID) · Başka kartta seçilebilir

IF OBJECT_ID(N'dbo.CostDim', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CostDim (
    CostDimID                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CostDim PRIMARY KEY,
    DimNo                    TINYINT NOT NULL,
    Code                     NVARCHAR(20)  NULL,
    Title                    NVARCHAR(100) NOT NULL,
    LinkedDimNo              TINYINT NULL, -- bağlı olduğu önceki boyut (1..DimNo-1)
    SelectableOnOtherCards   BIT NOT NULL CONSTRAINT DF_CostDim_Selectable DEFAULT (0),
    IsActive                 BIT NOT NULL CONSTRAINT DF_CostDim_Active DEFAULT (1),
    SortOrder                INT NULL,
    CONSTRAINT UQ_CostDim_DimNo UNIQUE (DimNo),
    CONSTRAINT CK_CostDim_DimNo CHECK (DimNo BETWEEN 1 AND 5)
  );
END
GO

IF OBJECT_ID(N'dbo.CostDim', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CostDim', N'LinkedDimNo') IS NULL
    ALTER TABLE dbo.CostDim ADD LinkedDimNo TINYINT NULL;
  IF COL_LENGTH(N'dbo.CostDim', N'SelectableOnOtherCards') IS NULL
    ALTER TABLE dbo.CostDim ADD SelectableOnOtherCards BIT NOT NULL
      CONSTRAINT DF_CostDim_Selectable2 DEFAULT (0);
  IF COL_LENGTH(N'dbo.CostDim', N'SortOrder') IS NULL
    ALTER TABLE dbo.CostDim ADD SortOrder INT NULL;
END
GO

IF OBJECT_ID(N'dbo.CostDimCard', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CostDimCard (
    CostDimCardID            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CostDimCard PRIMARY KEY,
    CostDimID                INT NOT NULL,
    DimNo                    TINYINT NOT NULL,
    Code                     NVARCHAR(50)  NULL,
    Title                    NVARCHAR(200) NULL,
    LinkedCostDimCardID      INT NULL, -- bağlı boyut kartı
    SelectableOnOtherCards   BIT NULL, -- NULL = boyuttan miras
    Description              NVARCHAR(500) NULL,
    IsActive                 BIT NOT NULL CONSTRAINT DF_CostDimCard_Active DEFAULT (1),
    CompanyID                INT NULL
  );
  CREATE NONCLUSTERED INDEX IX_CostDimCard_DimNo ON dbo.CostDimCard (DimNo, Code);
  CREATE NONCLUSTERED INDEX IX_CostDimCard_Linked ON dbo.CostDimCard (LinkedCostDimCardID)
    WHERE LinkedCostDimCardID IS NOT NULL;
END
GO

IF OBJECT_ID(N'dbo.CostDimCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CostDimCard', N'LinkedCostDimCardID') IS NULL
    ALTER TABLE dbo.CostDimCard ADD LinkedCostDimCardID INT NULL;
  IF COL_LENGTH(N'dbo.CostDimCard', N'SelectableOnOtherCards') IS NULL
    ALTER TABLE dbo.CostDimCard ADD SelectableOnOtherCards BIT NULL;
  IF COL_LENGTH(N'dbo.CostDimCard', N'DimNo') IS NULL
    ALTER TABLE dbo.CostDimCard ADD DimNo TINYINT NULL;
END
GO

-- AccountTransDetail: 5 boyut kolonu
IF OBJECT_ID(N'dbo.AccountTransDetail', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AccountTransDetail', N'CostDimCardID1') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD CostDimCardID1 INT NULL;
  IF COL_LENGTH(N'dbo.AccountTransDetail', N'CostDimCardID2') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD CostDimCardID2 INT NULL;
  IF COL_LENGTH(N'dbo.AccountTransDetail', N'CostDimCardID3') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD CostDimCardID3 INT NULL;
  IF COL_LENGTH(N'dbo.AccountTransDetail', N'CostDimCardID4') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD CostDimCardID4 INT NULL;
  IF COL_LENGTH(N'dbo.AccountTransDetail', N'CostDimCardID5') IS NULL
    ALTER TABLE dbo.AccountTransDetail ADD CostDimCardID5 INT NULL;
END
GO

-- Seed 5 boyut (yoksa)
IF OBJECT_ID(N'dbo.CostDim', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.CostDim WHERE DimNo = 1)
BEGIN
  SET IDENTITY_INSERT dbo.CostDim ON;
  INSERT INTO dbo.CostDim (CostDimID, DimNo, Code, Title, LinkedDimNo, SelectableOnOtherCards, IsActive, SortOrder)
  VALUES
    (1, 1, N'ISY', N'İşyeri', NULL, 0, 1, 1),
    (2, 2, N'KIS', N'Kişiler', 1, 0, 1, 2),
    (3, 3, N'ARC', N'Araçlar', NULL, 0, 1, 3),
    (4, 4, N'PRJ', N'Proje', NULL, 0, 1, 4),
    (5, 5, N'DIM5', N'Boyut 5', NULL, 0, 1, 5);
  SET IDENTITY_INSERT dbo.CostDim OFF;
END
GO

-- Eski CostCenter → DimNo 1
IF OBJECT_ID(N'dbo.CostCenter', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.CostDimCard', N'U') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.CostDim WHERE DimNo = 1)
BEGIN
  DECLARE @d1 INT = (SELECT TOP 1 CostDimID FROM dbo.CostDim WHERE DimNo = 1);
  INSERT INTO dbo.CostDimCard (CostDimID, DimNo, Code, Title, Description, IsActive, CompanyID, SelectableOnOtherCards)
  SELECT @d1, 1, c.Code, c.Title, c.Description, ISNULL(c.IsActive, 1), c.CompanyID, 0
  FROM dbo.CostCenter c
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CostDimCard x
    WHERE x.DimNo = 1 AND ISNULL(x.Code, N'') = ISNULL(c.Code, N'') AND ISNULL(x.Title, N'') = ISNULL(c.Title, N'')
  );
END
GO

-- Eski ProjectCard → DimNo 4 (Proje)
IF OBJECT_ID(N'dbo.ProjectCard', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.CostDimCard', N'U') IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.CostDim WHERE DimNo = 4)
BEGIN
  DECLARE @d4 INT = (SELECT TOP 1 CostDimID FROM dbo.CostDim WHERE DimNo = 4);
  INSERT INTO dbo.CostDimCard (CostDimID, DimNo, Code, Title, Description, IsActive, CompanyID, SelectableOnOtherCards)
  SELECT @d4, 4, p.Code, p.Title, p.Description, ISNULL(p.IsActive, 1), p.CompanyID, 0
  FROM dbo.ProjectCard p
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CostDimCard x
    WHERE x.DimNo = 4 AND ISNULL(x.Code, N'') = ISNULL(p.Code, N'') AND ISNULL(x.Title, N'') = ISNULL(p.Title, N'')
  );
END
GO

-- Mevcut dağıtım satırlarını yeni kolonlara taşı
IF OBJECT_ID(N'dbo.AccountTransDetail', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTransDetail', N'CostDimCardID1') IS NOT NULL
BEGIN
  UPDATE atd SET CostDimCardID1 = c.CostDimCardID
  FROM dbo.AccountTransDetail atd
  INNER JOIN dbo.CostCenter old ON old.CostCenterID = atd.CostCenterID
  INNER JOIN dbo.CostDimCard c
    ON c.DimNo = 1 AND ISNULL(c.Code, N'') = ISNULL(old.Code, N'') AND ISNULL(c.Title, N'') = ISNULL(old.Title, N'')
  WHERE atd.CostCenterID IS NOT NULL AND atd.CostDimCardID1 IS NULL;

  UPDATE atd SET CostDimCardID4 = c.CostDimCardID
  FROM dbo.AccountTransDetail atd
  INNER JOIN dbo.ProjectCard old ON old.ProjectCardID = atd.ProjectCardID
  INNER JOIN dbo.CostDimCard c
    ON c.DimNo = 4 AND ISNULL(c.Code, N'') = ISNULL(old.Code, N'') AND ISNULL(c.Title, N'') = ISNULL(old.Title, N'')
  WHERE atd.ProjectCardID IS NOT NULL AND atd.CostDimCardID4 IS NULL;
END
GO
