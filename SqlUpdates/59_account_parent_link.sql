-- Hesap hiyerarşisi: AccountCard.MainAccountID = üst hesap
-- Kural: Kodda '.' varsa üst hesap = son noktadan önceki kod (100.01 → 100, 100.01.02 → 100.01)
-- Noktasız kodlarda MainAccountID manuel seçilebilir (1 ← 10 ← 100)

IF OBJECT_ID(N'dbo.AccountCard', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.AccountCard', N'MainAccountID') IS NULL
    ALTER TABLE dbo.AccountCard ADD MainAccountID INT NULL;

  IF COL_LENGTH(N'dbo.AccountCard', N'MainAccount') IS NULL
    ALTER TABLE dbo.AccountCard ADD MainAccount BIT NULL;
END
GO

IF OBJECT_ID(N'dbo.AccountCard', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AccountCard_Code' AND object_id = OBJECT_ID(N'dbo.AccountCard')
  )
    CREATE NONCLUSTERED INDEX IX_AccountCard_Code
      ON dbo.AccountCard (Code)
      WHERE Code IS NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_AccountCard_MainAccountID' AND object_id = OBJECT_ID(N'dbo.AccountCard')
  )
    CREATE NONCLUSTERED INDEX IX_AccountCard_MainAccountID
      ON dbo.AccountCard (MainAccountID)
      WHERE MainAccountID IS NOT NULL;
END
GO

-- Mevcut noktalı kodları üst hesaba bağla (üst kod bulunursa)
IF OBJECT_ID(N'dbo.AccountCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountCard', N'MainAccountID') IS NOT NULL
BEGIN
  ;WITH dotted AS (
    SELECT
      c.AccountCardID,
      c.Code,
      ParentCode = LEFT(c.Code, LEN(c.Code) - CHARINDEX(N'.', REVERSE(c.Code)))
    FROM dbo.AccountCard c
    WHERE c.Code LIKE N'%.%'
      AND LEN(c.Code) > 1
      AND CHARINDEX(N'.', c.Code) > 1
  )
  UPDATE c
  SET
    c.MainAccountID = p.AccountCardID,
    c.MainAccount = 0
  FROM dbo.AccountCard c
  INNER JOIN dotted d ON d.AccountCardID = c.AccountCardID
  INNER JOIN dbo.AccountCard p ON p.Code = d.ParentCode
  WHERE c.MainAccountID IS NULL
     OR c.MainAccountID <> p.AccountCardID;
END
GO

-- Hiyerarşi okuma kolaylığı (rapor / ekran)
IF OBJECT_ID(N'dbo.vw_AccountCardTree', N'V') IS NOT NULL
  DROP VIEW dbo.vw_AccountCardTree;
GO

IF OBJECT_ID(N'dbo.AccountCard', N'U') IS NOT NULL
BEGIN
  EXEC(N'
  CREATE VIEW dbo.vw_AccountCardTree AS
  SELECT
    c.AccountCardID,
    c.Code,
    c.Title,
    c.MainAccountID AS ParentAccountID,
    p.Code AS ParentCode,
    p.Title AS ParentTitle,
    c.MainAccount,
    c.Type_,
    c.IsActive,
    c.CompanyID
  FROM dbo.AccountCard c
  LEFT JOIN dbo.AccountCard p ON p.AccountCardID = c.MainAccountID
  ');
END
GO
