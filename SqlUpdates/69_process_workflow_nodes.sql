-- Süreç / Onay: tetikleyici ayarı + parça (node) tipi + dal bağlantıları

IF OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_ProcessDef', N'TriggerConfigJson') IS NULL
    ALTER TABLE dbo.SYS_ProcessDef ADD TriggerConfigJson NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'dbo.SYS_ProcessDef', N'Category') IS NULL
    ALTER TABLE dbo.SYS_ProcessDef ADD Category NVARCHAR(40) NULL;
  -- Category: Approval | Integration | Notify | Custom

  -- TriggerType genişletme (dokümantasyon):
  -- 1 Manuel
  -- 2 Fiş kaydedilince (OnVoucherSave) — SourceTable + TriggerConfigJson.typeFilter
  -- 3 e-Belge gelince (OnEGovReceive) — TriggerConfigJson.docKind / direction
  -- 4 Aktarım (OnTransfer)
  -- 5 Kart kaydedilince (OnCardSave) — SourceTable = ProductCard/CustomerCard/...
  -- 6 Zamanlanmış / yinelemeli (Scheduled)
  -- 7 E-posta kontrol
  -- 8 DB tarama
END
GO

IF OBJECT_ID(N'dbo.SYS_ProcessStep', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_ProcessStep', N'NodeType') IS NULL
    ALTER TABLE dbo.SYS_ProcessStep ADD NodeType NVARCHAR(40) NOT NULL
      CONSTRAINT DF_SYS_ProcessStep_NodeType DEFAULT (N'TaskForm');
  -- NodeType: TaskForm | Decision | Review | Link | Transfer | EmailSend |
  --           DbUpdate | DbBrowse | Wait | SubProcess | Terminate |
  --           WebApi | RestService | WebService | Calculate | Integration | ListUpdate

  IF COL_LENGTH(N'dbo.SYS_ProcessStep', N'ConfigJson') IS NULL
    ALTER TABLE dbo.SYS_ProcessStep ADD ConfigJson NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'dbo.SYS_ProcessStep', N'NextStepOnOk') IS NULL
    ALTER TABLE dbo.SYS_ProcessStep ADD NextStepOnOk INT NULL;

  IF COL_LENGTH(N'dbo.SYS_ProcessStep', N'NextStepOnFail') IS NULL
    ALTER TABLE dbo.SYS_ProcessStep ADD NextStepOnFail INT NULL;
END
GO

-- Mevcut ActionType -> NodeType geriye dönük doldurma
IF OBJECT_ID(N'dbo.SYS_ProcessStep', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SYS_ProcessStep', N'NodeType') IS NOT NULL
BEGIN
  UPDATE dbo.SYS_ProcessStep SET NodeType = N'TaskForm'
  WHERE (NodeType IS NULL OR NodeType = N'') AND ActionType IN (N'Approve', N'Review');

  UPDATE dbo.SYS_ProcessStep SET NodeType = N'Transfer'
  WHERE ActionType = N'Transfer' AND (NodeType IS NULL OR NodeType IN (N'', N'TaskForm'));

  UPDATE dbo.SYS_ProcessStep SET NodeType = N'Link'
  WHERE ActionType = N'Link' AND (NodeType IS NULL OR NodeType IN (N'', N'TaskForm'));

  UPDATE dbo.SYS_ProcessStep SET NodeType = N'Review'
  WHERE ActionType = N'Review' AND NodeType = N'TaskForm';
END
GO

-- Örnek onay tanımı: e-Fatura gelince (yoksa)
IF OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'ONAY_EFATURA_GELEN')
  BEGIN
    INSERT INTO dbo.SYS_ProcessDef
      (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder, Category, TriggerConfigJson)
    VALUES (
      N'ONAY_EFATURA_GELEN',
      N'Gelen e-Fatura Onayı',
      N'e-Fatura geldiğinde PDF inceleme + sipariş/talep bağlama onayı',
      3, N'EGovDocument', N'OrderVoucher', 1, 15, N'Approval',
      N'{"docKind":1,"direction":1}'
    );

    DECLARE @id INT = SCOPE_IDENTITY();
    DECLARE @roleMuh INT = (SELECT TOP 1 Id FROM dbo.SYS_Role WHERE Code = N'MUHASEBE' AND IsActive = 1);

    INSERT INTO dbo.SYS_ProcessStep
      (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ActionType, NodeType, IsActive)
    VALUES
      (@id, 1, N'PDF', N'PDF / belge inceleme', @roleMuh, N'Review', N'Review', 1),
      (@id, 2, N'BAGLA', N'Sipariş veya talebe bağla', @roleMuh, N'Link', N'Link', 1),
      (@id, 3, N'ONAY', N'Nihai onay', @roleMuh, N'Approve', N'TaskForm', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'ONAY_EIRSALIYE_GELEN')
  BEGIN
    INSERT INTO dbo.SYS_ProcessDef
      (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder, Category, TriggerConfigJson)
    VALUES (
      N'ONAY_EIRSALIYE_GELEN',
      N'Gelen e-İrsaliye Onayı',
      N'e-İrsaliye geldiğinde inceleme ve bağlama',
      3, N'EGovDocument', N'OrderVoucher', 1, 16, N'Approval',
      N'{"docKind":3,"direction":1}'
    );
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'ONAY_FIS_KAYIT')
  BEGIN
    INSERT INTO dbo.SYS_ProcessDef
      (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder, Category, TriggerConfigJson)
    VALUES (
      N'ONAY_FIS_KAYIT',
      N'Sipariş Fişi Kaydı Onayı',
      N'OrderVoucher kaydedilince onay kuyruğuna düşer',
      2, N'OrderVoucher', NULL, 0, 17, N'Approval',
      N'{"typeFilter":null}'
    );
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'ONAY_KART_EKLE')
  BEGIN
    INSERT INTO dbo.SYS_ProcessDef
      (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder, Category, TriggerConfigJson)
    VALUES (
      N'ONAY_KART_EKLE',
      N'Cari Kart Ekleme Onayı',
      N'CustomerCard kaydedilince (örnek; pasif — etkinleştirin)',
      5, N'CustomerCard', NULL, 0, 18, N'Approval',
      N'{}'
    );
  END
END
GO
