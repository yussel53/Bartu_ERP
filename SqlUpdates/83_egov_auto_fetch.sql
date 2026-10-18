-- 83: E-Devlet — gelen belgeleri otomatik çekme (yol haritası E-02)
-- EGovAutoFetchSetting: firma bazında zamanlanmış e-Logo çekme ayarı + son çalışma durumu.
-- EGovAutoFetchLog: her çalışmanın (otomatik / elle) belge türü bazında günlüğü.
-- Zamanlanmış iş: BackendAPI/Services/EGovAutoFetchJob.cs

IF OBJECT_ID(N'dbo.EGovAutoFetchSetting', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovAutoFetchSetting (
    CompanyId           INT NOT NULL CONSTRAINT PK_EGovAutoFetchSetting PRIMARY KEY,
    IsEnabled           BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_IsEnabled DEFAULT (0),
    IntervalMinutes     INT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_Interval DEFAULT (30),
    DaysBack            INT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_DaysBack DEFAULT (3),
    FetchEInvoice       BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_EInvoice DEFAULT (1),
    FetchEArchive       BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_EArchive DEFAULT (0),
    FetchEDespatch      BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_EDespatch DEFAULT (0),
    DownloadPdf         BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_Pdf DEFAULT (1),
    DownloadXml         BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_Xml DEFAULT (1),
    AutoSendToApproval  BIT NOT NULL CONSTRAINT DF_EGovAutoFetchSetting_AutoSend DEFAULT (1),
    ApprovalGroupId     INT NULL,
    LastRunAt           DATETIME2 NULL,
    LastSuccessAt       DATETIME2 NULL,
    LastError           NVARCHAR(1000) NULL,
    NextRunAt           DATETIME2 NULL,
    UpdatedAt           DATETIME2 NULL,
    UpdatedBy           INT NULL,
    CONSTRAINT CK_EGovAutoFetchSetting_Interval CHECK (IntervalMinutes BETWEEN 5 AND 1440),
    CONSTRAINT CK_EGovAutoFetchSetting_DaysBack CHECK (DaysBack BETWEEN 1 AND 30)
  );
END
GO

IF OBJECT_ID(N'dbo.EGovAutoFetchLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EGovAutoFetchLog (
    EGovAutoFetchLogID  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EGovAutoFetchLog PRIMARY KEY,
    CompanyId           INT NOT NULL,
    DocKind             TINYINT NOT NULL,          -- 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye
    TriggerKind         NVARCHAR(10) NOT NULL,     -- auto · manual
    StartedBy           INT NULL,                  -- elle çalıştıran kullanıcı; otomatikte NULL (Sistem)
    StartedAt           DATETIME2 NOT NULL,
    FinishedAt          DATETIME2 NULL,
    Ok                  BIT NOT NULL CONSTRAINT DF_EGovAutoFetchLog_Ok DEFAULT (0),
    Fetched             INT NOT NULL CONSTRAINT DF_EGovAutoFetchLog_Fetched DEFAULT (0),
    Inserted            INT NOT NULL CONSTRAINT DF_EGovAutoFetchLog_Inserted DEFAULT (0),
    Updated             INT NOT NULL CONSTRAINT DF_EGovAutoFetchLog_Updated DEFAULT (0),
    QueuedForApproval   INT NOT NULL CONSTRAINT DF_EGovAutoFetchLog_Queued DEFAULT (0),
    Message             NVARCHAR(2000) NULL
  );
  CREATE INDEX IX_EGovAutoFetchLog_Company_Started ON dbo.EGovAutoFetchLog (CompanyId, StartedAt DESC);
END
GO
