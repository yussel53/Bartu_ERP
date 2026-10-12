-- Organizasyon: Firma → İşyeri → Ambar; Bölüm/Birim bağımsız; kullanıcı öndeğerleri

-- SYS_Workplace (işyeri — firmaya bağlı)
IF OBJECT_ID(N'dbo.SYS_Workplace', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Workplace (
    WorkplaceID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_Workplace PRIMARY KEY,
    CompanyID   INT NOT NULL,
    Code        NVARCHAR(50) NOT NULL,
    Title       NVARCHAR(150) NOT NULL,
    IsActive    BIT NOT NULL CONSTRAINT DF_SYS_Workplace_IsActive DEFAULT (1),
    AdditionalFields NVARCHAR(MAX) NULL
  );
END
GO

IF COL_LENGTH(N'dbo.SYS_Workplace', N'CompanyID') IS NULL
  ALTER TABLE dbo.SYS_Workplace ADD CompanyID INT NOT NULL CONSTRAINT DF_SYS_Workplace_Company DEFAULT (0);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_Workplace_Company' AND object_id = OBJECT_ID(N'dbo.SYS_Workplace')
)
  CREATE NONCLUSTERED INDEX IX_SYS_Workplace_Company ON dbo.SYS_Workplace (CompanyID, IsActive);
GO

-- SYS_Whouse: işyerine bağla (WorkplaceID)
IF OBJECT_ID(N'dbo.SYS_Whouse', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_Whouse', N'WorkplaceID') IS NULL
BEGIN
  ALTER TABLE dbo.SYS_Whouse ADD WorkplaceID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.SYS_Whouse', N'U') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_Whouse_Workplace' AND object_id = OBJECT_ID(N'dbo.SYS_Whouse')
   )
  CREATE NONCLUSTERED INDEX IX_SYS_Whouse_Workplace ON dbo.SYS_Whouse (WorkplaceID, CompanyId);
GO

-- SYS_OrgUnit: Bölüm / Birim (firmadan bağımsız — opsiyonel CompanyID)
IF OBJECT_ID(N'dbo.SYS_OrgUnit', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_OrgUnit (
    OrgUnitID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_OrgUnit PRIMARY KEY,
    Code        NVARCHAR(50) NOT NULL,
    Title       NVARCHAR(150) NOT NULL,
    UnitKind    TINYINT NOT NULL CONSTRAINT DF_SYS_OrgUnit_Kind DEFAULT (1), -- 1 Bölüm, 2 Birim
    CompanyID   INT NULL, -- opsiyonel; boş = tüm firmalar
    IsActive    BIT NOT NULL CONSTRAINT DF_SYS_OrgUnit_IsActive DEFAULT (1),
    AdditionalFields NVARCHAR(MAX) NULL
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'UQ_SYS_OrgUnit_Code' AND object_id = OBJECT_ID(N'dbo.SYS_OrgUnit')
)
  CREATE UNIQUE NONCLUSTERED INDEX UQ_SYS_OrgUnit_Code ON dbo.SYS_OrgUnit (Code);
GO

-- SystemUser öndeğer firma / işyeri / ambar
IF COL_LENGTH(N'dbo.SystemUser', N'DefaultCompanyID') IS NULL
  ALTER TABLE dbo.SystemUser ADD DefaultCompanyID INT NULL;
GO

IF COL_LENGTH(N'dbo.SystemUser', N'DefaultWorkplaceID') IS NULL
  ALTER TABLE dbo.SystemUser ADD DefaultWorkplaceID INT NULL;
GO

IF COL_LENGTH(N'dbo.SystemUser', N'DefaultWhouseID') IS NULL
  ALTER TABLE dbo.SystemUser ADD DefaultWhouseID INT NULL;
GO

IF COL_LENGTH(N'dbo.SystemUser', N'DefaultOrgUnitID') IS NULL
  ALTER TABLE dbo.SystemUser ADD DefaultOrgUnitID INT NULL;
GO
