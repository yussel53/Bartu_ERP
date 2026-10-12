-- Rol (grup) bazlı yetkilendirme — tüm ekran / alan / rapor yetkileri

IF OBJECT_ID(N'dbo.SYS_Role', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_Role (
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_Role PRIMARY KEY,
    Code            NVARCHAR(40)  NOT NULL,
    Name            NVARCHAR(150) NOT NULL,
    Description     NVARCHAR(500) NULL,
    IsAdmin         BIT NOT NULL CONSTRAINT DF_SYS_Role_IsAdmin DEFAULT (0),
    IsActive        BIT NOT NULL CONSTRAINT DF_SYS_Role_IsActive DEFAULT (1),
    AuthConfigJson  NVARCHAR(MAX) NULL,
    SortOrder       INT NOT NULL CONSTRAINT DF_SYS_Role_Sort DEFAULT (10),
    CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_SYS_Role_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt       DATETIME2 NULL,
    CONSTRAINT UQ_SYS_Role_Code UNIQUE (Code)
  );
END
GO

IF OBJECT_ID(N'dbo.SYS_UserRole', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_UserRole (
    Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_UserRole PRIMARY KEY,
    SystemUserID  INT NOT NULL,
    RoleId        INT NOT NULL,
    CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_SYS_UserRole_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SYS_UserRole_UserRole UNIQUE (SystemUserID, RoleId)
  );

  CREATE NONCLUSTERED INDEX IX_SYS_UserRole_User ON dbo.SYS_UserRole (SystemUserID) INCLUDE (RoleId);
  CREATE NONCLUSTERED INDEX IX_SYS_UserRole_Role ON dbo.SYS_UserRole (RoleId) INCLUDE (SystemUserID);
END
GO

IF OBJECT_ID(N'dbo.SYS_SqlReportRoleAuth', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_SqlReportRoleAuth (
    Id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportRoleAuth PRIMARY KEY,
    ReportId   INT NOT NULL,
    RoleId     INT NOT NULL,
    CanView    BIT NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_View DEFAULT (1),
    CanRun     BIT NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_Run DEFAULT (1),
    CreatedAt  DATETIME2 NOT NULL CONSTRAINT DF_SYS_SqlReportRoleAuth_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SYS_SqlReportRoleAuth UNIQUE (ReportId, RoleId)
  );

  CREATE NONCLUSTERED INDEX IX_SYS_SqlReportRoleAuth_Role
    ON dbo.SYS_SqlReportRoleAuth (RoleId) INCLUDE (ReportId, CanView, CanRun);
  CREATE NONCLUSTERED INDEX IX_SYS_SqlReportRoleAuth_Report
    ON dbo.SYS_SqlReportRoleAuth (ReportId) INCLUDE (RoleId, CanView, CanRun);
END
GO

-- Örnek roller (yoksa)
IF OBJECT_ID(N'dbo.SYS_Role', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'ADMIN')
    INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
    VALUES (N'ADMIN', N'Sistem Yöneticisi', N'Tüm yetkiler', 1, 1, N'{"isAdmin":true}', 1);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'MUHASEBE')
    INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
    VALUES (N'MUHASEBE', N'Muhasebe', N'Finans / muhasebe işlemleri', 0, 1, N'{"isAdmin":false}', 10);

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'SATIS')
    INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
    VALUES (N'SATIS', N'Satış', N'Satış / malzeme işlemleri', 0, 1, N'{"isAdmin":false}', 20);
END
GO

-- Demo kullanıcı ↔ rol (SystemUser varsa)
IF OBJECT_ID(N'dbo.SystemUser', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.SYS_UserRole', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.SYS_Role', N'U') IS NOT NULL
BEGIN
  ;WITH Map AS (
    SELECT u.SystemUserID, r.Id AS RoleId
    FROM dbo.SystemUser u
    CROSS APPLY (
      SELECT TOP 1 Id FROM dbo.SYS_Role
      WHERE (u.SystemUserID = 1 AND Code = N'ADMIN')
         OR (u.SystemUserID = 2 AND Code = N'MUHASEBE')
         OR (u.SystemUserID = 3 AND Code = N'SATIS')
         OR (LOWER(u.NickName) = N'admin' AND Code = N'ADMIN')
         OR (LOWER(u.NickName) LIKE N'%muhasebe%' AND Code = N'MUHASEBE')
         OR (LOWER(u.NickName) LIKE N'%satis%' AND Code = N'SATIS')
    ) r
  )
  INSERT INTO dbo.SYS_UserRole (SystemUserID, RoleId)
  SELECT m.SystemUserID, m.RoleId
  FROM Map m
  WHERE NOT EXISTS (
    SELECT 1 FROM dbo.SYS_UserRole x
    WHERE x.SystemUserID = m.SystemUserID AND x.RoleId = m.RoleId
  );
END
GO
