-- Trade fiş başlığı: ödeme planı, bölüm, birim (Order / İrsaliye / Fatura)

DECLARE @tables TABLE (name SYSNAME);
INSERT INTO @tables (name) VALUES (N'OrderVoucher'), (N'ProductVoucher'), (N'Invoice');

DECLARE @t SYSNAME;
DECLARE @sql NVARCHAR(MAX);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @tables;
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @t, N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH(N'dbo.' + @t, N'PaidPlanID') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD PaidPlanID INT NULL;';
      EXEC sys.sp_executesql @sql;
    END

    IF COL_LENGTH(N'dbo.' + @t, N'OrgUnitID') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD OrgUnitID INT NULL;';
      EXEC sys.sp_executesql @sql;
    END

    IF COL_LENGTH(N'dbo.' + @t, N'UnitID') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD UnitID INT NULL;';
      EXEC sys.sp_executesql @sql;
    END

    IF COL_LENGTH(N'dbo.' + @t, N'CustomerAdressID') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD CustomerAdressID INT NULL;';
      EXEC sys.sp_executesql @sql;
    END
  END
  FETCH NEXT FROM c INTO @t;
END
CLOSE c;
DEALLOCATE c;
GO
