-- Yetki kodu: SystemUser + kart / fiş tabloları
-- Kullanıcı: +A,+B veya -X ; kayıtta AuthCode; kullanıcı boşsa her şeyi görür

IF COL_LENGTH(N'dbo.SystemUser', N'AuthCode') IS NULL
BEGIN
  ALTER TABLE dbo.SystemUser ADD AuthCode NVARCHAR(100) NULL;
END
GO

DECLARE @tables TABLE (Name SYSNAME);
INSERT INTO @tables (Name) VALUES
  (N'ProductCard'),
  (N'CustomerCard'),
  (N'BankCard'),
  (N'BankAccountCard'),
  (N'SafeCard'),
  (N'BoundCard'),
  (N'VariantCard'),
  (N'TaxCard'),
  (N'AccountCard'),
  (N'PersonCard'),
  (N'RiskGroup'),
  (N'OrderVoucher'),
  (N'ProductVoucher'),
  (N'Invoice'),
  (N'BankVoucher'),
  (N'CustomerVoucher'),
  (N'PaymentTrans'),
  (N'AccountVoucher'),
  (N'PaidPlanCard');

DECLARE @t SYSNAME;
DECLARE @sql NVARCHAR(400);

DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Name FROM @tables;
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @t, N'U') IS NOT NULL
     AND COL_LENGTH(N'dbo.' + @t, N'AuthCode') IS NULL
  BEGIN
    SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ADD AuthCode NVARCHAR(50) NULL;';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM c INTO @t;
END
CLOSE c;
DEALLOCATE c;
GO
