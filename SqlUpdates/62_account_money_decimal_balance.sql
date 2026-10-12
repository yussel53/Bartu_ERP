-- Muhasebe fişi veri bütünlüğü
-- 1) Tutar kolonları her zaman 2 hane kuruş: FLOAT → DECIMAL(18,2)
-- 2) Satırda tek taraf: borç ve alacak birlikte dolu olamaz, negatif olamaz
-- 3) Borç = alacak kontrolü: kayıt API'sinde zorunlu; dengesiz fişler vw_AccountVoucherBalance ile izlenir
--    (Satırlar fiş kaydında silinip yeniden yazıldığı için satır bazlı trigger ile denge kontrolü yapılmaz.)

DECLARE @cols TABLE (tbl SYSNAME, col SYSNAME);
INSERT INTO @cols (tbl, col) VALUES
  (N'AccountTrans',       N'Debit'),
  (N'AccountTrans',       N'Credit'),
  (N'AccountTrans',       N'Amount'),
  (N'AccountTrans',       N'CurrencyAmount'),
  (N'AccountVoucher',     N'SumDebit'),
  (N'AccountVoucher',     N'SumCredit'),
  (N'AccountTransDetail', N'Amount'),
  (N'AccountTransDetail', N'CurrencyAmount');

DECLARE @tbl SYSNAME, @col SYSNAME, @sql NVARCHAR(MAX), @nullable BIT;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
  SELECT @nullable = c.is_nullable
  FROM sys.columns c
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID(N'dbo.' + @tbl)
    AND c.name = @col
    AND NOT (ty.name = N'decimal' AND c.scale = 2);

  IF @@ROWCOUNT > 0
  BEGIN
    SET @sql = N'UPDATE dbo.' + QUOTENAME(@tbl) + N' SET ' + QUOTENAME(@col) + N' = ROUND(' + QUOTENAME(@col) + N', 2) WHERE ' + QUOTENAME(@col) + N' IS NOT NULL;'
             + N'ALTER TABLE dbo.' + QUOTENAME(@tbl) + N' ALTER COLUMN ' + QUOTENAME(@col) + N' DECIMAL(18,2) '
             + CASE WHEN @nullable = 1 THEN N'NULL' ELSE N'NOT NULL' END + N';';
    EXEC sp_executesql @sql;
  END

  FETCH NEXT FROM cur INTO @tbl, @col;
END
CLOSE cur;
DEALLOCATE cur;
GO

-- Mevcut satırlarda tek taraf + toplam alanlarını doldur (eski kayıtlar)
IF OBJECT_ID(N'dbo.AccountTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'Debit') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'Credit') IS NOT NULL
BEGIN
  UPDATE dbo.AccountTrans
  SET Amount = CASE WHEN ISNULL(Debit, 0) > 0 THEN Debit ELSE Credit END,
      TotalType_ = CASE WHEN ISNULL(Debit, 0) > 0 THEN 1 WHEN ISNULL(Credit, 0) > 0 THEN -1 ELSE TotalType_ END
  WHERE ISNULL(Debit, 0) > 0 OR ISNULL(Credit, 0) > 0;
END
GO

IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'AccountVoucherID') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'Debit') IS NOT NULL
BEGIN
  UPDATE v
  SET v.SumDebit = t.D, v.SumCredit = t.C
  FROM dbo.AccountVoucher v
  JOIN (
    SELECT AccountVoucherID, SUM(ISNULL(Debit, 0)) AS D, SUM(ISNULL(Credit, 0)) AS C
    FROM dbo.AccountTrans
    GROUP BY AccountVoucherID
  ) t ON t.AccountVoucherID = v.AccountVoucherID;
END
GO

-- Satır kuralı: negatif yok, borç ve alacak birlikte dolu olamaz
IF OBJECT_ID(N'dbo.AccountTrans', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'Debit') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'Credit') IS NOT NULL
  AND OBJECT_ID(N'dbo.CK_AccountTrans_OneSide', N'C') IS NULL
BEGIN
  DECLARE @bad INT = (
    SELECT COUNT(*) FROM dbo.AccountTrans
    WHERE ISNULL(Debit, 0) < 0 OR ISNULL(Credit, 0) < 0
       OR (ISNULL(Debit, 0) > 0 AND ISNULL(Credit, 0) > 0)
  );
  DECLARE @ck NVARCHAR(MAX) =
    N'ALTER TABLE dbo.AccountTrans WITH ' + CASE WHEN @bad = 0 THEN N'CHECK' ELSE N'NOCHECK' END +
    N' ADD CONSTRAINT CK_AccountTrans_OneSide CHECK (
        ISNULL(Debit, 0) >= 0 AND ISNULL(Credit, 0) >= 0
        AND NOT (ISNULL(Debit, 0) > 0 AND ISNULL(Credit, 0) > 0))';
  EXEC sp_executesql @ck;
END
GO

-- Dengesiz fiş kontrolü (rapor / denetim)
IF OBJECT_ID(N'dbo.vw_AccountVoucherBalance', N'V') IS NOT NULL
  DROP VIEW dbo.vw_AccountVoucherBalance;
GO

IF OBJECT_ID(N'dbo.AccountVoucher', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'AccountVoucherID') IS NOT NULL
  AND COL_LENGTH(N'dbo.AccountTrans', N'Debit') IS NOT NULL
BEGIN
  EXEC(N'
  CREATE VIEW dbo.vw_AccountVoucherBalance AS
  SELECT
    v.AccountVoucherID,
    v.DocumentNumber,
    v.VoucherDate,
    v.journalNO,
    ISNULL(t.SumDebit, 0)  AS SumDebit,
    ISNULL(t.SumCredit, 0) AS SumCredit,
    ISNULL(t.SumDebit, 0) - ISNULL(t.SumCredit, 0) AS Difference,
    ISNULL(t.LineCount, 0) AS LineCount,
    CAST(CASE WHEN ISNULL(t.SumDebit, 0) = ISNULL(t.SumCredit, 0) AND ISNULL(t.LineCount, 0) >= 2
              THEN 1 ELSE 0 END AS BIT) AS IsBalanced
  FROM dbo.AccountVoucher v
  LEFT JOIN (
    SELECT AccountVoucherID,
           SUM(ISNULL(Debit, 0))  AS SumDebit,
           SUM(ISNULL(Credit, 0)) AS SumCredit,
           COUNT(*)               AS LineCount
    FROM dbo.AccountTrans
    GROUP BY AccountVoucherID
  ) t ON t.AccountVoucherID = v.AccountVoucherID
  ');
END
GO
