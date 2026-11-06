-- Kayıt kuralları: koşul tutunca alan şöyle olmak zorunda; tutmazsa Kaydet engellenir.
-- Scope: data = seçilen tablo · einvoice = gidecek e-fatura (cari e-Fatura/e-Arşiv) veya giden e-belge

IF OBJECT_ID(N'dbo.SYS_SaveRule', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_SaveRule (
    SaveRuleID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SaveRule PRIMARY KEY,
    Name         NVARCHAR(150) NOT NULL,
    Scope        NVARCHAR(20)  NOT NULL CONSTRAINT DF_SYS_SaveRule_Scope DEFAULT N'data',
    TableName    NVARCHAR(80)  NOT NULL,
    WhenField    NVARCHAR(80)  NULL,
    WhenOp       NVARCHAR(20)  NOT NULL CONSTRAINT DF_SYS_SaveRule_WhenOp DEFAULT N'eq',
    WhenValue    NVARCHAR(250) NULL,
    MustField    NVARCHAR(80)  NOT NULL,
    MustOp       NVARCHAR(20)  NOT NULL CONSTRAINT DF_SYS_SaveRule_MustOp DEFAULT N'notempty',
    MustValue    NVARCHAR(250) NULL,
    OnLine       BIT           NOT NULL CONSTRAINT DF_SYS_SaveRule_OnLine DEFAULT 0,
    Message      NVARCHAR(400) NULL,
    IsActive     BIT           NOT NULL CONSTRAINT DF_SYS_SaveRule_IsActive DEFAULT 1,
    CreatedAt    DATETIME2     NOT NULL CONSTRAINT DF_SYS_SaveRule_CreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt    DATETIME2     NULL
  );
  CREATE INDEX IX_SYS_SaveRule_Table ON dbo.SYS_SaveRule (TableName, IsActive);
END
GO
