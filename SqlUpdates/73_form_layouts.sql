-- 73: Ekran tasarımları (kullanıcı / rol bazında form düzeni)
-- SYS_FormLayout: form başına N tasarım (alan görünürlüğü, sıra, etiket, zorunlu, salt okunur, varsayılan,
--                 kalem kolonları) — LayoutJson. IsDefault: atanmamış kullanıcılar için varsayılan tasarım.
-- SYS_FormLayoutAssign: tasarım ↔ kullanıcı (ScopeType=1, ScopeKey=UserId) / rol (ScopeType=2, ScopeKey=RoleId)

IF OBJECT_ID(N'dbo.SYS_FormLayout', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_FormLayout
  (
    LayoutID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_FormLayout PRIMARY KEY,
    FormCode   NVARCHAR(80)  NOT NULL,
    Name       NVARCHAR(100) NOT NULL,
    LayoutJson NVARCHAR(MAX) NOT NULL,
    IsDefault  BIT           NOT NULL CONSTRAINT DF_SYS_FormLayout_IsDefault DEFAULT (0),
    IsActive   BIT           NOT NULL CONSTRAINT DF_SYS_FormLayout_IsActive DEFAULT (1),
    CreatedBy  NVARCHAR(50)  NULL,
    CreatedAt  DATETIME2     NOT NULL CONSTRAINT DF_SYS_FormLayout_CreatedAt DEFAULT (SYSDATETIME()),
    UpdatedAt  DATETIME2     NULL
  );
  CREATE INDEX IX_SYS_FormLayout_FormCode ON dbo.SYS_FormLayout (FormCode);
END
GO

IF OBJECT_ID(N'dbo.SYS_FormLayoutAssign', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_FormLayoutAssign
  (
    AssignID  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_FormLayoutAssign PRIMARY KEY,
    LayoutID  INT          NOT NULL,
    ScopeType TINYINT      NOT NULL, -- 1 kullanıcı · 2 rol
    ScopeKey  NVARCHAR(50) NOT NULL,
    CONSTRAINT FK_SYS_FormLayoutAssign_Layout FOREIGN KEY (LayoutID)
      REFERENCES dbo.SYS_FormLayout (LayoutID) ON DELETE CASCADE
  );
  CREATE INDEX IX_SYS_FormLayoutAssign_Layout ON dbo.SYS_FormLayoutAssign (LayoutID);
  CREATE INDEX IX_SYS_FormLayoutAssign_Scope ON dbo.SYS_FormLayoutAssign (ScopeType, ScopeKey);
END
GO
