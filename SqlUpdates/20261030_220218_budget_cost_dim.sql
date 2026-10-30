-- Bütçe: masraf boyutu kartı (CostDimCard) hedefi + fatura satırında boyut kolonları
-- OverAction: 0 Devam et · 1 Uyar · 2 Durdur

IF OBJECT_ID(N'dbo.Budget', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.Budget', N'CostDimCardID') IS NULL
    ALTER TABLE dbo.Budget ADD CostDimCardID INT NULL;

  IF COL_LENGTH(N'dbo.Budget', N'CostDimNo') IS NULL
    ALTER TABLE dbo.Budget ADD CostDimNo TINYINT NULL;
END
GO

IF OBJECT_ID(N'dbo.Budget', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Budget_CostDimCard' AND object_id = OBJECT_ID(N'dbo.Budget')
  )
  CREATE NONCLUSTERED INDEX IX_Budget_CostDimCard
    ON dbo.Budget (CostDimCardID)
    WHERE CostDimCardID IS NOT NULL;
GO

-- Fatura / irsaliye satırında boyut kartları
IF OBJECT_ID(N'dbo.ProductTrans', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.ProductTrans', N'CostDimCardID1') IS NULL
    ALTER TABLE dbo.ProductTrans ADD CostDimCardID1 INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'CostDimCardID2') IS NULL
    ALTER TABLE dbo.ProductTrans ADD CostDimCardID2 INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'CostDimCardID3') IS NULL
    ALTER TABLE dbo.ProductTrans ADD CostDimCardID3 INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'CostDimCardID4') IS NULL
    ALTER TABLE dbo.ProductTrans ADD CostDimCardID4 INT NULL;
  IF COL_LENGTH(N'dbo.ProductTrans', N'CostDimCardID5') IS NULL
    ALTER TABLE dbo.ProductTrans ADD CostDimCardID5 INT NULL;
END
GO
