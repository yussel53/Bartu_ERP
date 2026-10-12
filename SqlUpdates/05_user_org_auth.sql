-- Kullanıcı → Firma / İşyeri / Ambar yetkisi
IF OBJECT_ID(N'dbo.SYS_UserOrgAuth', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_UserOrgAuth (
    UserOrgAuthID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_UserOrgAuth PRIMARY KEY,
    SystemUserID  INT NOT NULL,
    CompanyID     INT NULL,
    WorkplaceID   INT NULL,  -- SYS_Workplace / DepartmentID
    WhouseID      INT NULL,
    IsActive      BIT NOT NULL CONSTRAINT DF_SYS_UserOrgAuth_IsActive DEFAULT (1)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SYS_UserOrgAuth_User' AND object_id = OBJECT_ID(N'dbo.SYS_UserOrgAuth')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_SYS_UserOrgAuth_User
    ON dbo.SYS_UserOrgAuth (SystemUserID, IsActive);
END
GO
