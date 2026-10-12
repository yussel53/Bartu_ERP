
-- =============================================
-- ERP DYNAMIC FORMS & UDF METADATA TABLES
-- =============================================
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- 1. Form Tanımları (SYS_Forms)
CREATE TABLE [dbo].[SYS_Forms](
	[FormId] [int] IDENTITY(1,1) NOT NULL,
	[FormCode] [nvarchar](50) NOT NULL, -- Örn: "ProductCardForm"
	[Title] [nvarchar](150) NOT NULL,
	[Description] [nvarchar](500) NULL,
	[TableName] [nvarchar](100) NOT NULL, -- Örn: "ProductCard"
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[CreatedAt] [datetime] NOT NULL DEFAULT(GETDATE()),
 CONSTRAINT [PK_SYS_Forms] PRIMARY KEY CLUSTERED 
(
	[FormId] ASC
)
) ON [PRIMARY]
GO

-- 2. Form Alanları (SYS_FormFields)
CREATE TABLE [dbo].[SYS_FormFields](
	[FieldId] [int] IDENTITY(1,1) NOT NULL,
	[FormId] [int] NOT NULL,
	[FieldName] [nvarchar](100) NOT NULL, -- JSON property key, Örn: "U_WarrantyPeriod"
	[Label] [nvarchar](100) NOT NULL,
	[FieldType] [nvarchar](50) NOT NULL, -- text, number, date, select, checkbox
	[IsRequired] [bit] NOT NULL DEFAULT(0),
	[ColSpan] [int] NOT NULL DEFAULT(6), -- 12'li Grid'de kaç kolon kaplayacağı
	[OrderIndex] [int] NOT NULL DEFAULT(0),
	[OptionsJson] [nvarchar](max) NULL, -- Select tipleri için: [{"label":"Var","value":"1"}]
	[DefaultValue] [nvarchar](250) NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
 CONSTRAINT [PK_SYS_FormFields] PRIMARY KEY CLUSTERED 
(
	[FieldId] ASC
)
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[SYS_FormFields]  WITH CHECK ADD  CONSTRAINT [FK_SYS_FormFields_SYS_Forms] FOREIGN KEY([FormId])
REFERENCES [dbo].[SYS_Forms] ([FormId])
ON DELETE CASCADE
GO

-- =============================================
-- EKSİK SYS TABLOLARI
-- =============================================

-- SYS_Users (Mevcut SystemUser'a ek/alternatif olarak)
CREATE TABLE [dbo].[SYS_Users](
	[UserId] [int] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](50) NOT NULL,
	[PasswordHash] [nvarchar](250) NOT NULL,
	[FullName] [nvarchar](150) NULL,
	[Email] [nvarchar](150) NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[AdditionalFields] [nvarchar](max) NULL, -- JSON UDF Alanı
 CONSTRAINT [PK_SYS_Users] PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)
) ON [PRIMARY]
GO

-- SYS_Companies
CREATE TABLE [dbo].[SYS_Companies](
	[CompanyId] [int] IDENTITY(1,1) NOT NULL,
	[CompanyCode] [nvarchar](50) NOT NULL,
	[Title] [nvarchar](200) NOT NULL,
	[TaxNumber] [nvarchar](50) NULL,
	[TaxOffice] [nvarchar](100) NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[AdditionalFields] [nvarchar](max) NULL, -- JSON UDF Alanı
 CONSTRAINT [PK_SYS_Companies] PRIMARY KEY CLUSTERED 
(
	[CompanyId] ASC
)
) ON [PRIMARY]
GO

-- SYS_Whouse (Depolar)
CREATE TABLE [dbo].[SYS_Whouse](
	[WhouseId] [int] IDENTITY(1,1) NOT NULL,
	[WhouseCode] [nvarchar](50) NOT NULL,
	[Name] [nvarchar](150) NOT NULL,
	[CompanyId] [int] NOT NULL,
	[IsActive] [bit] NOT NULL DEFAULT(1),
	[AdditionalFields] [nvarchar](max) NULL, -- JSON UDF Alanı
 CONSTRAINT [PK_SYS_Whouse] PRIMARY KEY CLUSTERED 
(
	[WhouseId] ASC
)
) ON [PRIMARY]
GO

-- SYS_City (Şehirler)
CREATE TABLE [dbo].[SYS_City](
	[CityId] [int] IDENTITY(1,1) NOT NULL,
	[CityCode] [nvarchar](10) NOT NULL, -- Örn: 34
	[Name] [nvarchar](100) NOT NULL,
 CONSTRAINT [PK_SYS_City] PRIMARY KEY CLUSTERED 
(
	[CityId] ASC
)
) ON [PRIMARY]
GO

-- =============================================
-- MEVCUT TABLOLARA UDF (JSON) ALANI EKLENMESİ
-- =============================================
-- Örnek: ProductCard tablosuna AdditionalFields (JSON UDF) alanı ekleme
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[ProductCard]') AND name = 'AdditionalFields'
)
BEGIN
    ALTER TABLE [dbo].[ProductCard] ADD [AdditionalFields] [nvarchar](max) NULL
END
GO
