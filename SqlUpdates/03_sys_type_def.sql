-- Ortak tür tanımları: fiş türü / malzeme türü / cari tür
-- Kind: 1=Fiş, 2=Malzeme, 3=Cari
IF OBJECT_ID(N'dbo.SYS_TypeDef', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_TypeDef (
    TypeDefID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_TypeDef PRIMARY KEY,
    Kind        TINYINT NOT NULL,
    Code        NVARCHAR(30) NOT NULL,
    Title       NVARCHAR(150) NOT NULL,
    ModuleKey   NVARCHAR(30) NOT NULL,
    TargetTable NVARCHAR(50) NOT NULL,
    IsActive    BIT NOT NULL CONSTRAINT DF_SYS_TypeDef_IsActive DEFAULT (1),
    SortOrder   INT NOT NULL CONSTRAINT DF_SYS_TypeDef_SortOrder DEFAULT (0),
    CONSTRAINT UQ_SYS_TypeDef_Kind_Code UNIQUE (Kind, Code)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SYS_TypeDef_Target' AND object_id = OBJECT_ID(N'dbo.SYS_TypeDef')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_SYS_TypeDef_Target
    ON dbo.SYS_TypeDef (Kind, TargetTable, ModuleKey, IsActive);
END
GO

-- VoucherType (Create_DB) — hedef tablo / modül anahtarı (geriye uyum)
IF COL_LENGTH(N'dbo.VoucherType', N'TargetTable') IS NULL
BEGIN
  ALTER TABLE dbo.VoucherType ADD TargetTable NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH(N'dbo.VoucherType', N'ModuleKey') IS NULL
BEGIN
  ALTER TABLE dbo.VoucherType ADD ModuleKey NVARCHAR(30) NULL;
END
GO
