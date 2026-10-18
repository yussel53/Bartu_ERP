-- 89: Zamanlanmış rapor e-postası (Y-13) — SQL Rapor Tasarımcısındaki rapor belirlenen sıklıkta çalıştırılır, Excel eki ile gönderilir.
-- Frequency: 1 günlük · 2 haftalık (WeekDay 1 Pzt … 7 Paz) · 3 aylık (MonthDay 1-28). RunHour: Türkiye saati (0-23).
-- ParamsJson: {"start_date":"prev_month_start", ...} — tarih anahtarları: boş (bugün), -N days, year_start, month_start,
--             prev_month_start, prev_month_end; boş bırakılan filtrede raporun öndeğeri kullanılır.
-- SMTP: OwnerUserID kullanıcısının mail tanımı (CRM → Mail tanımları; yoksa genel SMTP).

IF OBJECT_ID(N'dbo.SYS_SqlReportSchedule', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_SqlReportSchedule (
    Id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_SqlReportSchedule PRIMARY KEY,
    ReportId      INT            NOT NULL,
    Title         NVARCHAR(200)  NULL,
    Recipients    NVARCHAR(1000) NOT NULL,
    Frequency     TINYINT        NOT NULL CONSTRAINT DF_SYS_SqlReportSchedule_Freq DEFAULT 1,
    RunHour       TINYINT        NOT NULL CONSTRAINT DF_SYS_SqlReportSchedule_Hour DEFAULT 8,
    WeekDay       TINYINT        NULL,
    MonthDay      TINYINT        NULL,
    ParamsJson    NVARCHAR(MAX)  NULL,
    OwnerUserID   INT            NULL,
    IsActive      BIT            NOT NULL CONSTRAINT DF_SYS_SqlReportSchedule_Active DEFAULT 1,
    LastRunAt     DATETIME2      NULL,
    LastStatus    NVARCHAR(500)  NULL,
    NextRunAt     DATETIME2      NULL,
    CreatedAt     DATETIME2      NOT NULL CONSTRAINT DF_SYS_SqlReportSchedule_CreatedAt DEFAULT SYSDATETIME()
  );
  CREATE INDEX IX_SYS_SqlReportSchedule_Next ON dbo.SYS_SqlReportSchedule (IsActive, NextRunAt);
END
GO
