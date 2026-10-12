-- Süreç yönetimi: talep→sipariş, e-Fatura/e-İrsaliye bağlama, PDF saklama, onay kuyruğu

-- ─── EGovDocument: PDF + sipariş / süreç bağları ─────────────────────────────
IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.EGovDocument', N'PdfContent') IS NULL
    ALTER TABLE dbo.EGovDocument ADD PdfContent VARBINARY(MAX) NULL;

  IF COL_LENGTH(N'dbo.EGovDocument', N'PdfFileName') IS NULL
    ALTER TABLE dbo.EGovDocument ADD PdfFileName NVARCHAR(260) NULL;

  IF COL_LENGTH(N'dbo.EGovDocument', N'PdfContentType') IS NULL
    ALTER TABLE dbo.EGovDocument ADD PdfContentType NVARCHAR(100) NULL;

  IF COL_LENGTH(N'dbo.EGovDocument', N'PdfStoredAt') IS NULL
    ALTER TABLE dbo.EGovDocument ADD PdfStoredAt DATETIME2 NULL;

  IF COL_LENGTH(N'dbo.EGovDocument', N'OrderVoucherID') IS NULL
    ALTER TABLE dbo.EGovDocument ADD OrderVoucherID INT NULL;

  IF COL_LENGTH(N'dbo.EGovDocument', N'ProcessInstanceID') IS NULL
    ALTER TABLE dbo.EGovDocument ADD ProcessInstanceID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.EGovDocument', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_EGovDocument_OrderVoucherID' AND object_id = OBJECT_ID(N'dbo.EGovDocument')
  )
  CREATE NONCLUSTERED INDEX IX_EGovDocument_OrderVoucherID
    ON dbo.EGovDocument (OrderVoucherID)
    WHERE OrderVoucherID IS NOT NULL;
GO

-- ─── OrderVoucher: talep kaynağı + süreç durumu ──────────────────────────────
IF OBJECT_ID(N'dbo.OrderVoucher', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.OrderVoucher', N'SourceOrderVoucherID') IS NULL
    ALTER TABLE dbo.OrderVoucher ADD SourceOrderVoucherID INT NULL;

  IF COL_LENGTH(N'dbo.OrderVoucher', N'ProcessStatus') IS NULL
    ALTER TABLE dbo.OrderVoucher ADD ProcessStatus NVARCHAR(30) NULL;

  IF COL_LENGTH(N'dbo.OrderVoucher', N'ProcessInstanceID') IS NULL
    ALTER TABLE dbo.OrderVoucher ADD ProcessInstanceID INT NULL;
END
GO

IF OBJECT_ID(N'dbo.OrderVoucher', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_OrderVoucher_Source' AND object_id = OBJECT_ID(N'dbo.OrderVoucher')
  )
  CREATE NONCLUSTERED INDEX IX_OrderVoucher_Source
    ON dbo.OrderVoucher (SourceOrderVoucherID)
    WHERE SourceOrderVoucherID IS NOT NULL;
GO

-- ─── Süreç tanımı ────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ProcessDef (
    ProcessDefID   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ProcessDef PRIMARY KEY,
    Code           NVARCHAR(40)  NOT NULL,
    Name           NVARCHAR(150) NOT NULL,
    Description    NVARCHAR(500) NULL,
    -- 1 Manual · 2 OnSave · 3 OnEGovReceive · 4 OnTransfer
    TriggerType    TINYINT NOT NULL CONSTRAINT DF_SYS_ProcessDef_Trigger DEFAULT (1),
    SourceTable    NVARCHAR(80)  NULL,
    TargetTable    NVARCHAR(80)  NULL,
    IsActive       BIT NOT NULL CONSTRAINT DF_SYS_ProcessDef_Active DEFAULT (1),
    SortOrder      INT NOT NULL CONSTRAINT DF_SYS_ProcessDef_Sort DEFAULT (10),
    CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_SYS_ProcessDef_Created DEFAULT (SYSUTCDATETIME()),
    UpdatedAt      DATETIME2 NULL,
    CONSTRAINT UQ_SYS_ProcessDef_Code UNIQUE (Code)
  );
END
GO

-- ─── Süreç adımları (onaylayıcı rol / kullanıcı) ──────────────────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessStep', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ProcessStep (
    ProcessStepID  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ProcessStep PRIMARY KEY,
    ProcessDefID   INT NOT NULL,
    StepNo         INT NOT NULL,
    Code           NVARCHAR(40)  NOT NULL,
    Title          NVARCHAR(150) NOT NULL,
    ApproverRoleId INT NULL,
    ApproverUserId INT NULL,
    -- Approve · Transfer · Link · Review
    ActionType     NVARCHAR(30) NOT NULL CONSTRAINT DF_SYS_ProcessStep_Action DEFAULT (N'Approve'),
    IsActive       BIT NOT NULL CONSTRAINT DF_SYS_ProcessStep_Active DEFAULT (1),
    CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_SYS_ProcessStep_Created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_SYS_ProcessStep_DefNo UNIQUE (ProcessDefID, StepNo)
  );

  CREATE NONCLUSTERED INDEX IX_SYS_ProcessStep_Def
    ON dbo.SYS_ProcessStep (ProcessDefID, StepNo)
    INCLUDE (ApproverRoleId, ApproverUserId, ActionType, IsActive);
END
GO

-- ─── Süreç örneği ────────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessInstance', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ProcessInstance (
    ProcessInstanceID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ProcessInstance PRIMARY KEY,
    ProcessDefID      INT NOT NULL,
    -- Pending · InProgress · Approved · Rejected · Cancelled
    Status            NVARCHAR(30) NOT NULL CONSTRAINT DF_SYS_ProcessInstance_Status DEFAULT (N'Pending'),
    SourceTable       NVARCHAR(80)  NOT NULL,
    SourceId          INT NOT NULL,
    TargetTable       NVARCHAR(80)  NULL,
    TargetId          INT NULL,
    Title             NVARCHAR(250) NULL,
    CurrentStepNo     INT NOT NULL CONSTRAINT DF_SYS_ProcessInstance_Step DEFAULT (1),
    StartedBy         INT NULL,
    StartedAt         DATETIME2 NOT NULL CONSTRAINT DF_SYS_ProcessInstance_Started DEFAULT (SYSUTCDATETIME()),
    CompletedAt       DATETIME2 NULL,
    LastComment       NVARCHAR(500) NULL
  );

  CREATE NONCLUSTERED INDEX IX_SYS_ProcessInstance_Status
    ON dbo.SYS_ProcessInstance (Status, ProcessDefID)
    INCLUDE (SourceTable, SourceId, Title, CurrentStepNo);

  CREATE NONCLUSTERED INDEX IX_SYS_ProcessInstance_Source
    ON dbo.SYS_ProcessInstance (SourceTable, SourceId);
END
GO

-- ─── Onay görevi (kullanıcı önüne düşen iş) ──────────────────────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessTask', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ProcessTask (
    ProcessTaskID     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ProcessTask PRIMARY KEY,
    ProcessInstanceID INT NOT NULL,
    ProcessStepID     INT NOT NULL,
    -- Pending · Approved · Rejected · Skipped
    Status            NVARCHAR(30) NOT NULL CONSTRAINT DF_SYS_ProcessTask_Status DEFAULT (N'Pending'),
    AssignedRoleId    INT NULL,
    AssignedUserId    INT NULL,
    ClaimedBy         INT NULL,
    DueAt             DATETIME2 NULL,
    CompletedBy       INT NULL,
    CompletedAt       DATETIME2 NULL,
    Comment           NVARCHAR(500) NULL,
    CreatedAt         DATETIME2 NOT NULL CONSTRAINT DF_SYS_ProcessTask_Created DEFAULT (SYSUTCDATETIME())
  );

  CREATE NONCLUSTERED INDEX IX_SYS_ProcessTask_Inbox
    ON dbo.SYS_ProcessTask (Status, AssignedRoleId, AssignedUserId)
    INCLUDE (ProcessInstanceID, ProcessStepID, CreatedAt);

  CREATE NONCLUSTERED INDEX IX_SYS_ProcessTask_Instance
    ON dbo.SYS_ProcessTask (ProcessInstanceID, Status);
END
GO

-- ─── Belge bağları (talep↔sipariş, e-belge↔sipariş/talep) ───────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessDocLink', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_ProcessDocLink (
    ProcessDocLinkID  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_ProcessDocLink PRIMARY KEY,
    ProcessInstanceID INT NULL,
    -- TalepToOrder · EGovToOrder · EGovToTalep
    LinkType          NVARCHAR(40) NOT NULL,
    FromTable         NVARCHAR(80) NOT NULL,
    FromId            INT NOT NULL,
    ToTable           NVARCHAR(80) NOT NULL,
    ToId              INT NOT NULL,
    Note              NVARCHAR(250) NULL,
    CreatedBy         INT NULL,
    CreatedAt         DATETIME2 NOT NULL CONSTRAINT DF_SYS_ProcessDocLink_Created DEFAULT (SYSUTCDATETIME())
  );

  CREATE NONCLUSTERED INDEX IX_SYS_ProcessDocLink_From
    ON dbo.SYS_ProcessDocLink (FromTable, FromId);
  CREATE NONCLUSTERED INDEX IX_SYS_ProcessDocLink_To
    ON dbo.SYS_ProcessDocLink (ToTable, ToId);
END
GO

-- ─── Seed süreçler + adımlar ─────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'TALEP_TO_ORDER')
    INSERT INTO dbo.SYS_ProcessDef (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder)
    VALUES (
      N'TALEP_TO_ORDER',
      N'Talep → Sipariş Aktarımı',
      N'Alış/satış talebinin siparişe aktarımı ve onay zinciri',
      4, N'OrderVoucher', N'OrderVoucher', 1, 10
    );

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'EGOV_EFATURA_LINK')
    INSERT INTO dbo.SYS_ProcessDef (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder)
    VALUES (
      N'EGOV_EFATURA_LINK',
      N'e-Fatura Bağlama Onayı',
      N'Gelen e-fatura PDF saklanır, sipariş/talebe bağlanır ve onay kuyruğuna düşer',
      3, N'EGovDocument', N'OrderVoucher', 1, 20
    );

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'EGOV_EIRSALIYE_LINK')
    INSERT INTO dbo.SYS_ProcessDef (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder)
    VALUES (
      N'EGOV_EIRSALIYE_LINK',
      N'e-İrsaliye Bağlama Onayı',
      N'Gelen e-irsaliye PDF saklanır, sipariş/talebe bağlanır ve onay kuyruğuna düşer',
      3, N'EGovDocument', N'OrderVoucher', 1, 30
    );

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'ORDER_APPROVE')
    INSERT INTO dbo.SYS_ProcessDef (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder)
    VALUES (
      N'ORDER_APPROVE',
      N'Sipariş Onayı',
      N'Sipariş girişinde onaylayıcıya düşen süreç',
      2, N'OrderVoucher', NULL, 1, 40
    );
END
GO

-- Adımlar: MUHASEBE / SATIS rolü varsa ona, yoksa ApproverRoleId boş (admin görür)
IF OBJECT_ID(N'dbo.SYS_ProcessStep', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NOT NULL
BEGIN
  DECLARE @defTalep INT = (SELECT TOP 1 ProcessDefID FROM dbo.SYS_ProcessDef WHERE Code = N'TALEP_TO_ORDER');
  DECLARE @defFat INT = (SELECT TOP 1 ProcessDefID FROM dbo.SYS_ProcessDef WHERE Code = N'EGOV_EFATURA_LINK');
  DECLARE @defIrs INT = (SELECT TOP 1 ProcessDefID FROM dbo.SYS_ProcessDef WHERE Code = N'EGOV_EIRSALIYE_LINK');
  DECLARE @defOrd INT = (SELECT TOP 1 ProcessDefID FROM dbo.SYS_ProcessDef WHERE Code = N'ORDER_APPROVE');
  DECLARE @roleMuh INT = (SELECT TOP 1 Id FROM dbo.SYS_Role WHERE Code = N'MUHASEBE' AND IsActive = 1);
  DECLARE @roleSat INT = (SELECT TOP 1 Id FROM dbo.SYS_Role WHERE Code = N'SATIS' AND IsActive = 1);

  IF @defTalep IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @defTalep)
  BEGIN
    INSERT INTO dbo.SYS_ProcessStep (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ActionType)
    VALUES
      (@defTalep, 1, N'REVIEW', N'Talep inceleme', @roleSat, N'Approve'),
      (@defTalep, 2, N'TRANSFER', N'Siparişe aktarım onayı', @roleMuh, N'Transfer');
  END

  IF @defFat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @defFat)
  BEGIN
    INSERT INTO dbo.SYS_ProcessStep (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ActionType)
    VALUES
      (@defFat, 1, N'PDF_REVIEW', N'e-Fatura PDF inceleme', @roleMuh, N'Review'),
      (@defFat, 2, N'LINK_APPROVE', N'Sipariş/talep bağlama onayı', @roleMuh, N'Link');
  END

  IF @defIrs IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @defIrs)
  BEGIN
    INSERT INTO dbo.SYS_ProcessStep (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ActionType)
    VALUES
      (@defIrs, 1, N'PDF_REVIEW', N'e-İrsaliye PDF inceleme', @roleSat, N'Review'),
      (@defIrs, 2, N'LINK_APPROVE', N'Sipariş/talep bağlama onayı', @roleMuh, N'Link');
  END

  IF @defOrd IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessStep WHERE ProcessDefID = @defOrd)
  BEGIN
    INSERT INTO dbo.SYS_ProcessStep (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ActionType)
    VALUES (@defOrd, 1, N'APPROVE', N'Sipariş onayı', @roleMuh, N'Approve');
  END
END
GO
