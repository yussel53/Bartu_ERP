-- Ek alanlar AdditionalFields JSON'undan gerçek U_ kolonuna taşınır.
-- Taşınan satırlarda JSON kolonu boşaltılır.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

IF OBJECT_ID(N'tempdb..#UdfPromote') IS NOT NULL DROP TABLE #UdfPromote;
CREATE TABLE #UdfPromote (
  TableName nvarchar(128) COLLATE DATABASE_DEFAULT NOT NULL,
  FieldName nvarchar(128) COLLATE DATABASE_DEFAULT NOT NULL,
  TypeDdl nvarchar(40) COLLATE DATABASE_DEFAULT NOT NULL,
  TypeKind nvarchar(10) COLLATE DATABASE_DEFAULT NOT NULL
);

INSERT INTO #UdfPromote (TableName, FieldName, TypeDdl, TypeKind) VALUES
  (N'ProductCard', N'U_Description', N'NVARCHAR(MAX)', N'text'),
  (N'ProductCard', N'U_UnitPrice', N'FLOAT', N'float'),
  (N'ProductCard', N'U_MaterialKind', N'NVARCHAR(40)', N'text'),
  (N'CustomerCard', N'U_Phone', N'NVARCHAR(50)', N'text'),
  (N'CustomerCard', N'U_Email', N'NVARCHAR(150)', N'text'),
  (N'ProductVoucher', N'U_PlateNo', N'NVARCHAR(20)', N'text'),
  (N'ProductVoucher', N'U_DriverName', N'NVARCHAR(80)', N'text'),
  (N'ProductVoucher', N'U_WaybillNo', N'NVARCHAR(40)', N'text'),
  (N'Invoice', N'U_DueDate', N'DATETIME', N'date'),
  (N'Invoice', N'U_PaymentType', N'NVARCHAR(40)', N'text');

DECLARE @tables TABLE (name sysname PRIMARY KEY);
INSERT INTO @tables (name)
SELECT t.name
FROM sys.tables t
INNER JOIN sys.columns c ON c.object_id = t.object_id AND c.name = N'AdditionalFields'
WHERE SCHEMA_NAME(t.schema_id) = N'dbo';

DECLARE @t sysname;
DECLARE tc CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @tables;
OPEN tc;
FETCH NEXT FROM tc INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @discover nvarchar(max) = N'
    INSERT INTO #UdfPromote (TableName, FieldName, TypeDdl, TypeKind)
    SELECT DISTINCT @tn, j.[key], N''NVARCHAR(500)'', N''text''
    FROM dbo.' + QUOTENAME(@t) + N' AS x
    CROSS APPLY OPENJSON(x.AdditionalFields) AS j
    WHERE ISJSON(x.AdditionalFields) = 1
      AND j.[key] LIKE N''U[_]%''
      AND j.[key] NOT LIKE N''%[^A-Za-z0-9_]%''
      AND LEN(j.[key]) BETWEEN 3 AND 62
      AND NOT EXISTS (
        SELECT 1 FROM #UdfPromote p
        WHERE p.TableName = @tn COLLATE DATABASE_DEFAULT
          AND p.FieldName = j.[key] COLLATE DATABASE_DEFAULT
      );';
  EXEC sp_executesql @discover, N'@tn sysname', @tn = @t;
  FETCH NEXT FROM tc INTO @t;
END
CLOSE tc;
DEALLOCATE tc;

DECLARE @tn sysname, @fn sysname, @ddl nvarchar(40), @kind nvarchar(10);
DECLARE cc CURSOR LOCAL FAST_FORWARD FOR
  SELECT p.TableName, p.FieldName, p.TypeDdl, p.TypeKind
  FROM #UdfPromote p
  WHERE OBJECT_ID(N'dbo.' + p.TableName, N'U') IS NOT NULL;
OPEN cc;
FETCH NEXT FROM cc INTO @tn, @fn, @ddl, @kind;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF @fn LIKE N'U[_]%'
     AND @fn NOT LIKE N'%[^A-Za-z0-9_]%'
     AND COL_LENGTH(N'dbo.' + @tn, @fn) IS NULL
  BEGIN
    DECLARE @alter nvarchar(max) =
      N'ALTER TABLE dbo.' + QUOTENAME(@tn) + N' ADD ' + QUOTENAME(@fn) + N' ' + @ddl + N' NULL';
    EXEC sp_executesql @alter;
  END

  IF COL_LENGTH(N'dbo.' + @tn, N'AdditionalFields') IS NOT NULL
     AND COL_LENGTH(N'dbo.' + @tn, @fn) IS NOT NULL
  BEGIN
    DECLARE @copy nvarchar(max);
    IF @kind = N'float'
      SET @copy = N'
        UPDATE x
           SET ' + QUOTENAME(@fn) + N' = TRY_CONVERT(float, REPLACE(j.[value], N'','', N''.''))
          FROM dbo.' + QUOTENAME(@tn) + N' AS x
          CROSS APPLY OPENJSON(x.AdditionalFields) AS j
         WHERE ISJSON(x.AdditionalFields) = 1
           AND j.[key] = @fn
           AND x.' + QUOTENAME(@fn) + N' IS NULL
           AND NULLIF(LTRIM(RTRIM(j.[value])), N'''') IS NOT NULL;';
    ELSE IF @kind = N'date'
      SET @copy = N'
        UPDATE x
           SET ' + QUOTENAME(@fn) + N' = TRY_CONVERT(datetime, j.[value])
          FROM dbo.' + QUOTENAME(@tn) + N' AS x
          CROSS APPLY OPENJSON(x.AdditionalFields) AS j
         WHERE ISJSON(x.AdditionalFields) = 1
           AND j.[key] = @fn
           AND x.' + QUOTENAME(@fn) + N' IS NULL
           AND NULLIF(LTRIM(RTRIM(j.[value])), N'''') IS NOT NULL;';
    ELSE
      SET @copy = N'
        UPDATE x
           SET ' + QUOTENAME(@fn) + N' = j.[value]
          FROM dbo.' + QUOTENAME(@tn) + N' AS x
          CROSS APPLY OPENJSON(x.AdditionalFields) AS j
         WHERE ISJSON(x.AdditionalFields) = 1
           AND j.[key] = @fn
           AND NULLIF(LTRIM(RTRIM(j.[value])), N'''') IS NOT NULL
           AND (x.' + QUOTENAME(@fn) + N' IS NULL
                OR LTRIM(RTRIM(CONVERT(nvarchar(max), x.' + QUOTENAME(@fn) + N'))) = N'''');';
    EXEC sp_executesql @copy, N'@fn sysname', @fn = @fn;
  END

  FETCH NEXT FROM cc INTO @tn, @fn, @ddl, @kind;
END
CLOSE cc;
DEALLOCATE cc;

DECLARE zc CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @tables;
OPEN zc;
FETCH NEXT FROM zc INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE @clear nvarchar(max) =
    N'UPDATE dbo.' + QUOTENAME(@t) + N' SET AdditionalFields = NULL WHERE AdditionalFields IS NOT NULL';
  EXEC sp_executesql @clear;
  FETCH NEXT FROM zc INTO @t;
END
CLOSE zc;
DEALLOCATE zc;
GO
