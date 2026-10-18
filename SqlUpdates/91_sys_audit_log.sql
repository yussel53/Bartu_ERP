-- 91: Değişiklik geçmişi (Y-15) — kart / fiş kaydı ve silmede kim, ne zaman, hangi alanı neden neye değiştirdi.
-- Action: I eklendi · U değişti · D silindi. ChangesJson: [{"f":"Alan","o":"eski","n":"yeni"}, …] (silmede son hali).
-- Satır (Lines) değişikliği özet olarak yazılır: {"f":"#Satır","o":"3 satır · 1.200,00","n":"4 satır · 1.450,00"}.

IF OBJECT_ID(N'dbo.SYS_AuditLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_AuditLog (
    Id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_AuditLog PRIMARY KEY,
    TableName   NVARCHAR(128) NOT NULL,
    RecordId    INT           NOT NULL,
    Action      CHAR(1)       NOT NULL,
    UserId      INT           NULL,
    UserName    NVARCHAR(100) NULL,
    At          DATETIME2     NOT NULL CONSTRAINT DF_SYS_AuditLog_At DEFAULT SYSDATETIME(),
    ChangesJson NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_SYS_AuditLog_Record ON dbo.SYS_AuditLog (TableName, RecordId, At DESC);
  CREATE INDEX IX_SYS_AuditLog_At ON dbo.SYS_AuditLog (At DESC);
END
GO
