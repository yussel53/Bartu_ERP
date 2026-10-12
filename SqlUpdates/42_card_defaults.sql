-- 42: Kart öndeğer şablonları (ID = -1)
-- CustomerCard / ProductCard / BankCard / SafeCard şablon kayıtları

-- CustomerCard -1
IF OBJECT_ID(N'dbo.CustomerCard', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.CustomerCard WHERE CustomerCardID = -1)
BEGIN
  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.CustomerCard'), N'CustomerCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.CustomerCard ON;

  DECLARE @cols nvarchar(max) = N'CustomerCardID, Code, Title';
  DECLARE @vals nvarchar(max) = N'-1, N''120.*'', N''Öndeğer Cari''';

  IF COL_LENGTH(N'dbo.CustomerCard', N'AccountGroupID') IS NOT NULL
  BEGIN SET @cols += N', AccountGroupID'; SET @vals += N', 1'; END
  IF COL_LENGTH(N'dbo.CustomerCard', N'Type_') IS NOT NULL
  BEGIN SET @cols += N', Type_'; SET @vals += N', 3'; END
  IF COL_LENGTH(N'dbo.CustomerCard', N'TaxType') IS NOT NULL
  BEGIN SET @cols += N', TaxType'; SET @vals += N', 1'; END
  IF COL_LENGTH(N'dbo.CustomerCard', N'Active') IS NOT NULL
  BEGIN SET @cols += N', Active'; SET @vals += N', 1'; END
  IF COL_LENGTH(N'dbo.CustomerCard', N'IsActive') IS NOT NULL
  BEGIN SET @cols += N', IsActive'; SET @vals += N', 1'; END

  EXEC(N'INSERT INTO dbo.CustomerCard (' + @cols + N') VALUES (' + @vals + N')');

  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.CustomerCard'), N'CustomerCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.CustomerCard OFF;
END
GO

-- ProductCard -1
IF OBJECT_ID(N'dbo.ProductCard', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.ProductCard WHERE ProductCardID = -1)
BEGIN
  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.ProductCard'), N'ProductCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.ProductCard ON;

  DECLARE @pcols nvarchar(max) = N'ProductCardID, Code, Title';
  DECLARE @pvals nvarchar(max) = N'-1, N''150.*'', N''Öndeğer Malzeme''';

  IF COL_LENGTH(N'dbo.ProductCard', N'AccountGroupID') IS NOT NULL
  BEGIN SET @pcols += N', AccountGroupID'; SET @pvals += N', 1'; END
  IF COL_LENGTH(N'dbo.ProductCard', N'ProductType') IS NOT NULL
  BEGIN SET @pcols += N', ProductType'; SET @pvals += N', 1'; END
  IF COL_LENGTH(N'dbo.ProductCard', N'IsActive') IS NOT NULL
  BEGIN SET @pcols += N', IsActive'; SET @pvals += N', 1'; END

  EXEC(N'INSERT INTO dbo.ProductCard (' + @pcols + N') VALUES (' + @pvals + N')');

  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.ProductCard'), N'ProductCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.ProductCard OFF;
END
GO

-- BankCard -1
IF OBJECT_ID(N'dbo.BankCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.BankCard', N'BankCardID') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.BankCard WHERE BankCardID = -1)
BEGIN
  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.BankCard'), N'BankCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.BankCard ON;

  DECLARE @bcols nvarchar(max) = N'BankCardID, Code, Title';
  DECLARE @bvals nvarchar(max) = N'-1, N''102.*'', N''Öndeğer Banka''';

  IF COL_LENGTH(N'dbo.BankCard', N'IsActive') IS NOT NULL
  BEGIN SET @bcols += N', IsActive'; SET @bvals += N', 1'; END

  EXEC(N'INSERT INTO dbo.BankCard (' + @bcols + N') VALUES (' + @bvals + N')');

  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.BankCard'), N'BankCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.BankCard OFF;
END
GO

-- SafeCard -1
IF OBJECT_ID(N'dbo.SafeCard', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.SafeCard', N'SafeCardID') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.SafeCard WHERE SafeCardID = -1)
BEGIN
  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.SafeCard'), N'SafeCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.SafeCard ON;

  DECLARE @scols nvarchar(max) = N'SafeCardID';
  DECLARE @svals nvarchar(max) = N'-1';

  IF COL_LENGTH(N'dbo.SafeCard', N'Code') IS NOT NULL
  BEGIN SET @scols += N', Code'; SET @svals += N', N''100.*'''; END
  IF COL_LENGTH(N'dbo.SafeCard', N'Title') IS NOT NULL
  BEGIN SET @scols += N', Title'; SET @svals += N', N''Öndeğer Kasa'''; END
  IF COL_LENGTH(N'dbo.SafeCard', N'IsActive') IS NOT NULL
  BEGIN SET @scols += N', IsActive'; SET @svals += N', 1'; END

  EXEC(N'INSERT INTO dbo.SafeCard (' + @scols + N') VALUES (' + @svals + N')');

  IF COLUMNPROPERTY(OBJECT_ID(N'dbo.SafeCard'), N'SafeCardID', 'IsIdentity') = 1
    SET IDENTITY_INSERT dbo.SafeCard OFF;
END
GO
