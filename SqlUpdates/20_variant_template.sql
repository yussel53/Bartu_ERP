-- Varyant şablonu: özellik eksenleri + değerler (örn. Beden×Renk)
-- Malzeme kartında şablon seçilerek VariantCard satırları üretilir

IF OBJECT_ID(N'dbo.VariantTemplate', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VariantTemplate (
    VariantTemplateID INT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_VariantTemplate PRIMARY KEY,
    Code       NVARCHAR(50) NULL,
    Title      NVARCHAR(200) NULL,
    IsActive   BIT NOT NULL
      CONSTRAINT DF_VariantTemplate_IsActive DEFAULT (1),
    CreatedAt  DATETIME NULL
      CONSTRAINT DF_VariantTemplate_CreatedAt DEFAULT (GETDATE())
  );
END
GO

IF OBJECT_ID(N'dbo.VariantTemplateDim', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.VariantTemplateDim (
    VariantTemplateDimID INT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_VariantTemplateDim PRIMARY KEY,
    VariantTemplateID INT NOT NULL,
    Code       NVARCHAR(50) NULL,   -- BEDEN / RENK
    Title      NVARCHAR(100) NULL,  -- Beden / Renk
    ValuesText NVARCHAR(500) NULL,  -- S,M,L,XL  veya  Kırmızı,Mavi,Siyah
    SortOrder  INT NULL
      CONSTRAINT DF_VariantTemplateDim_Sort DEFAULT (10)
  );
END
GO

IF OBJECT_ID(N'dbo.VariantTemplateDim', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_VariantTemplateDim_Template'
      AND object_id = OBJECT_ID(N'dbo.VariantTemplateDim')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_VariantTemplateDim_Template
    ON dbo.VariantTemplateDim (VariantTemplateID, SortOrder);
END
GO

-- Malzeme kartı → seçili şablon
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.ProductCard', N'VariantTemplateID') IS NULL
BEGIN
  ALTER TABLE dbo.ProductCard ADD VariantTemplateID INT NULL;
END
GO
