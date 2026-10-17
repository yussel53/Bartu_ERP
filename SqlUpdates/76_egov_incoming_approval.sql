-- 76: Gelen e-Fatura onay akışı (Gelen → Onaya Gönder → Onay Bekleyenler → Onaylananlar → Kaydet)
--  · Invoice.DocumentNumber düzeltmesi (Create_DB'de kolon adı bozuk karakterle oluşmuştu → Fatura No hiç kaydedilmiyordu)
--  · ProductCustomerAlias: tedarikçi koduyla malzeme bulma indeksi (gelen faturada satır eşleme)
--  · YONETICI rolü + EGOV_GELEN_FATURA_ONAY süreci (tek adım, YONETICI onayı; Onay Tanımları'ndan değiştirilebilir)

-- ─── Invoice.DocumentNumber ─────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.Invoice', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.Invoice', N'DocumentNumber') IS NULL
BEGIN
  DECLARE @bad SYSNAME = (
    SELECT TOP 1 name FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Invoice')
      AND name LIKE N'DocumentN_mber' AND name <> N'DocumentNumber'
  );
  IF @bad IS NOT NULL
  BEGIN
    -- Varsa mevcut veriyi koruyarak yeniden adlandır
    DECLARE @old NVARCHAR(400) = N'dbo.Invoice.' + QUOTENAME(@bad);
    EXEC sp_rename @old, N'DocumentNumber', N'COLUMN';
  END
  ELSE
    ALTER TABLE dbo.Invoice ADD DocumentNumber NVARCHAR(50) NULL;
END
GO

-- ─── ProductCustomerAlias: cari + cariye özel kod ile arama ─────────────────
IF OBJECT_ID(N'dbo.ProductCustomerAlias', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_ProductCustomerAlias_Customer_Code' AND object_id = OBJECT_ID(N'dbo.ProductCustomerAlias')
  )
  CREATE NONCLUSTERED INDEX IX_ProductCustomerAlias_Customer_Code
    ON dbo.ProductCustomerAlias (CustomerCardID, CustomerCode)
    INCLUDE (ProductCardID, CustomerTitle, IsActive);
GO

-- ─── YONETICI rolü ──────────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SYS_Role', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.SYS_Role WHERE Code = N'YONETICI')
  INSERT INTO dbo.SYS_Role (Code, Name, Description, IsAdmin, IsActive, AuthConfigJson, SortOrder)
  VALUES (N'YONETICI', N'Yönetici', N'Gelen e-fatura ve belge onayları', 0, 1, N'{"isAdmin":false}', 5);
GO

-- ─── Gelen e-Fatura onay süreci ─────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SYS_ProcessDef', N'U') IS NOT NULL
  AND OBJECT_ID(N'dbo.SYS_ProcessStep', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.SYS_ProcessDef WHERE Code = N'EGOV_GELEN_FATURA_ONAY')
BEGIN
  -- TriggerType 1 = Manuel (Gelen e-Faturalar → «Onaya Gönder»)
  INSERT INTO dbo.SYS_ProcessDef (Code, Name, Description, TriggerType, SourceTable, TargetTable, IsActive, SortOrder)
  VALUES (
    N'EGOV_GELEN_FATURA_ONAY',
    N'Gelen e-Fatura Kayıt Onayı',
    N'Gelen e-fatura ERP''ye alış faturası olarak kaydedilmeden önce yönetici onayı',
    1, N'EGovDocument', N'Invoice', 1, 16
  );

  DECLARE @def INT = SCOPE_IDENTITY();
  DECLARE @role INT = (SELECT TOP 1 Id FROM dbo.SYS_Role WHERE Code = N'YONETICI' AND IsActive = 1);

  IF COL_LENGTH(N'dbo.SYS_ProcessDef', N'Category') IS NOT NULL
    EXEC sp_executesql N'UPDATE dbo.SYS_ProcessDef SET Category = N''Approval'' WHERE ProcessDefID = @def', N'@def INT', @def;

  INSERT INTO dbo.SYS_ProcessStep (ProcessDefID, StepNo, Code, Title, ApproverRoleId, ActionType, IsActive)
  VALUES (@def, 1, N'YONETICI_ONAY', N'Yönetici onayı', @role, N'Approve', 1);
END
GO
