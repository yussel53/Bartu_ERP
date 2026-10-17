-- 79: Giriş (JWT) — SystemUser parola / kilit kolonları + yenileme anahtarları
-- Parola SystemUser.Password içinde "PBKDF2$<iterasyon>$<tuz>$<özet>" biçiminde saklanır.
-- Eski düz metin parolalar ilk başarılı girişte özetlenir; tanınmayan biçimdeki parolalar yönetici
-- tarafından sıfırlanır (Kullanıcı kartı → Şifre).

IF OBJECT_ID(N'dbo.SystemUser', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SystemUser', N'FailedLoginCount') IS NULL
    ALTER TABLE dbo.SystemUser ADD FailedLoginCount INT NULL;
  IF COL_LENGTH(N'dbo.SystemUser', N'LockedUntil') IS NULL
    ALTER TABLE dbo.SystemUser ADD LockedUntil DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.SystemUser', N'LastLoginAt') IS NULL
    ALTER TABLE dbo.SystemUser ADD LastLoginAt DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.SystemUser', N'PasswordChangedAt') IS NULL
    ALTER TABLE dbo.SystemUser ADD PasswordChangedAt DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.SystemUser', N'MustChangePassword') IS NULL
    ALTER TABLE dbo.SystemUser ADD MustChangePassword BIT NULL;
END
GO

IF OBJECT_ID(N'dbo.SYS_AuthRefreshToken', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_AuthRefreshToken (
    Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_AuthRefreshToken PRIMARY KEY,
    SystemUserID  INT NOT NULL,
    TokenHash     NVARCHAR(128) NOT NULL,
    ExpiresAt     DATETIME2 NOT NULL,
    CreatedAt     DATETIME2 NOT NULL CONSTRAINT DF_SYS_AuthRefreshToken_CreatedAt DEFAULT SYSDATETIME(),
    RevokedAt     DATETIME2 NULL,
    UserAgent     NVARCHAR(300) NULL
  );
  CREATE INDEX IX_SYS_AuthRefreshToken_TokenHash ON dbo.SYS_AuthRefreshToken (TokenHash);
END
GO
