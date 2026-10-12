-- Adres hiyerarşisi: Ülke → İl → İlçe → Mahalle
IF OBJECT_ID(N'dbo.SYS_Country', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Country (
    CountryID INT NOT NULL CONSTRAINT PK_SYS_Country PRIMARY KEY,
    Code      NVARCHAR(10) NOT NULL,
    Name      NVARCHAR(100) NOT NULL,
    IsActive  BIT NOT NULL CONSTRAINT DF_SYS_Country_IsActive DEFAULT (1)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_Province', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Province (
    ProvinceID INT NOT NULL CONSTRAINT PK_SYS_Province PRIMARY KEY,
    CountryID  INT NOT NULL,
    Code       NVARCHAR(10) NOT NULL, -- plaka 01..81
    Name       NVARCHAR(100) NOT NULL,
    IsActive   BIT NOT NULL CONSTRAINT DF_SYS_Province_IsActive DEFAULT (1)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_District', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_District (
    DistrictID INT NOT NULL CONSTRAINT PK_SYS_District PRIMARY KEY,
    ProvinceID INT NOT NULL,
    Name       NVARCHAR(100) NOT NULL,
    IsActive   BIT NOT NULL CONSTRAINT DF_SYS_District_IsActive DEFAULT (1)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_Neighborhood', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Neighborhood (
    NeighborhoodID INT NOT NULL CONSTRAINT PK_SYS_Neighborhood PRIMARY KEY,
    ProvinceID     INT NOT NULL,
    DistrictID     INT NOT NULL,
    Name           NVARCHAR(150) NOT NULL,
    PostalCode     NVARCHAR(10) NULL,
    IsActive       BIT NOT NULL CONSTRAINT DF_SYS_Neighborhood_IsActive DEFAULT (1)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_District_Province' AND object_id = OBJECT_ID(N'dbo.SYS_District')
)
  CREATE NONCLUSTERED INDEX IX_SYS_District_Province ON dbo.SYS_District (ProvinceID);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'IX_SYS_Neighborhood_District' AND object_id = OBJECT_ID(N'dbo.SYS_Neighborhood')
)
  CREATE NONCLUSTERED INDEX IX_SYS_Neighborhood_District ON dbo.SYS_Neighborhood (DistrictID);
GO

-- Seed: Türkiye
IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Country WHERE CountryID = 1)
  INSERT INTO dbo.SYS_Country (CountryID, Code, Name, IsActive) VALUES (1, N'TR', N'Türkiye', 1);
GO
