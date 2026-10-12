-- CRM mail tanımları: Genel / Firma / Bölüm / Birim / Kullanıcı bazlı SMTP + gönderen + imza
-- Çözümleme sırası (gönderen kullanıcıya göre): Kullanıcı → Birim → Bölüm → Firma → Genel
--   ScopeType: 0 Genel · 1 Firma (SYS_Companies.CompanyId) · 2 Bölüm (SYS_OrgUnit UnitKind=1)
--              3 Birim (SYS_OrgUnit UnitKind=2) · 4 Kullanıcı (SystemUser.SystemUserID)

IF OBJECT_ID(N'dbo.CRM_MailProfile', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CRM_MailProfile
  (
    MailProfileID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CRM_MailProfile PRIMARY KEY,
    ScopeType     TINYINT        NOT NULL,
    ScopeID       INT            NULL,           -- Genel için NULL
    Title         NVARCHAR(150)  NULL,
    SmtpHost      NVARCHAR(200)  NULL,
    SmtpPort      INT            NULL,
    SmtpSsl       BIT            NOT NULL CONSTRAINT DF_CRM_MailProfile_Ssl DEFAULT (1),
    SmtpUser      NVARCHAR(320)  NULL,
    SmtpPassword  NVARCHAR(500)  NULL,
    FromAddress   NVARCHAR(320)  NULL,
    FromName      NVARCHAR(150)  NULL,
    ReplyTo       NVARCHAR(320)  NULL,
    BccAddress    NVARCHAR(320)  NULL,
    Signature     NVARCHAR(MAX)  NULL,
    IsActive      BIT            NOT NULL CONSTRAINT DF_CRM_MailProfile_IsActive DEFAULT (1),
    CreateDate    DATETIME2      NOT NULL CONSTRAINT DF_CRM_MailProfile_CreateDate DEFAULT (SYSDATETIME()),
    UpdateDate    DATETIME2      NULL
  );
  CREATE UNIQUE INDEX UX_CRM_MailProfile_Scope ON dbo.CRM_MailProfile (ScopeType, ScopeID);
END
GO

-- 70'te CRM_Setting'e girilmiş genel SMTP varsa "Genel" profile taşı
IF NOT EXISTS (SELECT 1 FROM dbo.CRM_MailProfile WHERE ScopeType = 0)
   AND OBJECT_ID(N'dbo.CRM_Setting', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpHost' AND ISNULL(SettingValue, N'') <> N'')
BEGIN
  INSERT INTO dbo.CRM_MailProfile (ScopeType, ScopeID, Title, SmtpHost, SmtpPort, SmtpSsl, SmtpUser, SmtpPassword, FromAddress)
  SELECT 0, NULL, N'Genel',
    (SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpHost'),
    TRY_CAST((SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpPort') AS INT),
    CASE WHEN (SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpSsl') = N'false' THEN 0 ELSE 1 END,
    (SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpUser'),
    (SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpPassword'),
    (SELECT SettingValue FROM dbo.CRM_Setting WHERE SettingKey = N'SmtpFrom');
END
GO
