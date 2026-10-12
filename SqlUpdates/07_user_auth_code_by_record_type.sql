-- Kullanıcı × Firma × Kayıt Türü yetki kodu (Logo Yetki Kodları paneli)
IF OBJECT_ID(N'dbo.SYS_UserAuthCode', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_UserAuthCode (
    UserAuthCodeID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_UserAuthCode PRIMARY KEY,
    SystemUserID   INT NOT NULL,
    CompanyID      INT NOT NULL,
    RecordType     NVARCHAR(50) NOT NULL,  -- ProductCard, CustomerCard, …
    AuthCode       NVARCHAR(100) NULL,     -- +SAT,+PER | -GIZLI
    IsActive       BIT NOT NULL CONSTRAINT DF_SYS_UserAuthCode_IsActive DEFAULT (1)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_SYS_UserAuthCode_UserCo'
    AND object_id = OBJECT_ID(N'dbo.SYS_UserAuthCode')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_SYS_UserAuthCode_UserCo
    ON dbo.SYS_UserAuthCode (SystemUserID, CompanyID, IsActive)
    INCLUDE (RecordType, AuthCode);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'UQ_SYS_UserAuthCode_UserCoType'
    AND object_id = OBJECT_ID(N'dbo.SYS_UserAuthCode')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_SYS_UserAuthCode_UserCoType
    ON dbo.SYS_UserAuthCode (SystemUserID, CompanyID, RecordType)
    WHERE IsActive = 1;
END
GO
