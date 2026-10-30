-- CRM aksiyon: belgeye bağlanabilir (fatura, irsaliye, sipariş…) + Outlook kimliği
-- OpportunityID artık zorunlu değil (yalnız belge aksiyonu olabilir)

IF OBJECT_ID(N'dbo.CRM_Action', N'U') IS NOT NULL
BEGIN
  -- Fırsat zorunluluğunu kaldır
  IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.CRM_Action') AND name = N'OpportunityID' AND is_nullable = 0
  )
  BEGIN
    ALTER TABLE dbo.CRM_Action ALTER COLUMN OpportunityID INT NULL;
  END

  IF COL_LENGTH(N'dbo.CRM_Action', N'SourceTable') IS NULL
    ALTER TABLE dbo.CRM_Action ADD SourceTable NVARCHAR(50) NULL;

  IF COL_LENGTH(N'dbo.CRM_Action', N'SourceID') IS NULL
    ALTER TABLE dbo.CRM_Action ADD SourceID INT NULL;

  IF COL_LENGTH(N'dbo.CRM_Action', N'SourceDocNo') IS NULL
    ALTER TABLE dbo.CRM_Action ADD SourceDocNo NVARCHAR(80) NULL;

  IF COL_LENGTH(N'dbo.CRM_Action', N'CustomerCardID') IS NULL
    ALTER TABLE dbo.CRM_Action ADD CustomerCardID INT NULL;

  IF COL_LENGTH(N'dbo.CRM_Action', N'Title') IS NULL
    ALTER TABLE dbo.CRM_Action ADD Title NVARCHAR(200) NULL;

  IF COL_LENGTH(N'dbo.CRM_Action', N'OutlookItemId') IS NULL
    ALTER TABLE dbo.CRM_Action ADD OutlookItemId NVARCHAR(200) NULL;
END
GO

IF OBJECT_ID(N'dbo.CRM_Action', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CRM_Action_Source' AND object_id = OBJECT_ID(N'dbo.CRM_Action')
  )
  CREATE NONCLUSTERED INDEX IX_CRM_Action_Source
    ON dbo.CRM_Action (SourceTable, SourceID)
    WHERE SourceTable IS NOT NULL AND SourceID IS NOT NULL;
GO

IF OBJECT_ID(N'dbo.CRM_Action', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CRM_Action_Customer' AND object_id = OBJECT_ID(N'dbo.CRM_Action')
  )
  CREATE NONCLUSTERED INDEX IX_CRM_Action_Customer
    ON dbo.CRM_Action (CustomerCardID)
    WHERE CustomerCardID IS NOT NULL;
GO

IF OBJECT_ID(N'dbo.CRM_Action', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CRM_Action_Outlook' AND object_id = OBJECT_ID(N'dbo.CRM_Action')
  )
  CREATE NONCLUSTERED INDEX IX_CRM_Action_Outlook
    ON dbo.CRM_Action (OutlookItemId)
    WHERE OutlookItemId IS NOT NULL;
GO

-- Örnek tip: Ödeme araması (yoksa)
IF OBJECT_ID(N'dbo.CRM_ActionType', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.CRM_ActionType WHERE Title = N'Ödeme araması')
  INSERT INTO dbo.CRM_ActionType (Title, Icon, CloseKind, SortOrder, IsActive)
  VALUES (N'Ödeme araması', N'phone', 0, 50, 1);
GO
