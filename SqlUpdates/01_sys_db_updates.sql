-- Takip tablosu: Sistem Yönetimi → Veritabanı Güncelleme
IF OBJECT_ID(N'dbo.SYS_DbUpdates', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_DbUpdates (
    ScriptName NVARCHAR(200) NOT NULL PRIMARY KEY,
    AppliedAt  DATETIME2 NOT NULL CONSTRAINT DF_SYS_DbUpdates_AppliedAt DEFAULT (SYSUTCDATETIME()),
    AppliedBy  NVARCHAR(100) NULL
  );
END
GO
