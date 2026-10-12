-- 27: Adres tabloları zaten 06'da; arama indexleri (seed API ile doldurulur)
IF OBJECT_ID(N'dbo.SYS_Province', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SYS_Province_Name' AND object_id = OBJECT_ID(N'dbo.SYS_Province')
  )
  CREATE NONCLUSTERED INDEX IX_SYS_Province_Name ON dbo.SYS_Province (Name);
GO

IF OBJECT_ID(N'dbo.SYS_District', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SYS_District_Name' AND object_id = OBJECT_ID(N'dbo.SYS_District')
  )
  CREATE NONCLUSTERED INDEX IX_SYS_District_Name ON dbo.SYS_District (ProvinceID, Name);
GO

IF OBJECT_ID(N'dbo.SYS_Neighborhood', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SYS_Neighborhood_Name' AND object_id = OBJECT_ID(N'dbo.SYS_Neighborhood')
  )
  CREATE NONCLUSTERED INDEX IX_SYS_Neighborhood_Name ON dbo.SYS_Neighborhood (DistrictID, Name);
GO
