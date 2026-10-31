-- AccountCard.Type_: 1 Bilanço · 2 Ana · 3 Alt · 4 Detay (koda göre yeniden sınıfla)
-- Örnek: 1/10 → 1 · 100 → 2 · 100.01 → 3 · 100.01.001 → 4

IF OBJECT_ID(N'dbo.AccountCard', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.AccountCard', N'Type_') IS NOT NULL
   AND COL_LENGTH(N'dbo.AccountCard', N'Code') IS NOT NULL
BEGIN
  UPDATE c
  SET
    Type_ = CASE
      WHEN x.Parts >= 3 THEN CAST(4 AS tinyint)
      WHEN x.Parts = 2 THEN CAST(3 AS tinyint)
      WHEN x.Parts = 1 AND LEN(x.Head) BETWEEN 1 AND 2 AND x.Head NOT LIKE '%[^0-9]%' THEN CAST(1 AS tinyint)
      WHEN x.Parts = 1 THEN CAST(2 AS tinyint)
      ELSE c.Type_
    END,
    MainAccount = CASE
      WHEN x.Parts >= 3 THEN CAST(0 AS bit)
      WHEN x.Parts = 2 THEN CAST(0 AS bit)
      WHEN x.Parts = 1 AND LEN(x.Head) BETWEEN 1 AND 2 AND x.Head NOT LIKE '%[^0-9]%' THEN CAST(1 AS bit)
      WHEN x.Parts = 1 THEN CAST(1 AS bit)
      ELSE c.MainAccount
    END
  FROM dbo.AccountCard c
  CROSS APPLY (
    SELECT
      LTRIM(RTRIM(ISNULL(c.Code, N''))) AS CodeNorm
  ) n
  CROSS APPLY (
    SELECT
      CASE WHEN n.CodeNorm = N'' THEN 0
           ELSE LEN(n.CodeNorm) - LEN(REPLACE(n.CodeNorm, N'.', N'')) + 1
      END AS Parts,
      CASE
        WHEN CHARINDEX(N'.', n.CodeNorm) > 0 THEN LEFT(n.CodeNorm, CHARINDEX(N'.', n.CodeNorm) - 1)
        ELSE n.CodeNorm
      END AS Head
  ) x
  WHERE NULLIF(n.CodeNorm, N'') IS NOT NULL;
END
GO
