-- Cari fiş: kaynak belge bağı + ödeme linki (iyzico / manuel)
IF OBJECT_ID(N'dbo.CustomerVoucher', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.CustomerVoucher', N'SourceTable') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD SourceTable NVARCHAR(64) NULL;

  IF COL_LENGTH(N'dbo.CustomerVoucher', N'SourceID') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD SourceID INT NULL;

  IF COL_LENGTH(N'dbo.CustomerVoucher', N'PaymentProvider') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD PaymentProvider NVARCHAR(32) NULL;

  IF COL_LENGTH(N'dbo.CustomerVoucher', N'PaymentLinkUrl') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD PaymentLinkUrl NVARCHAR(500) NULL;

  IF COL_LENGTH(N'dbo.CustomerVoucher', N'PaymentLinkToken') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD PaymentLinkToken NVARCHAR(64) NULL;

  IF COL_LENGTH(N'dbo.CustomerVoucher', N'PaymentLinkStatus') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD PaymentLinkStatus TINYINT NULL;
    -- 0 yok · 1 bekliyor · 2 ödendi · 3 iptal/süresi doldu

  IF COL_LENGTH(N'dbo.CustomerVoucher', N'PaymentLinkAt') IS NULL
    ALTER TABLE dbo.CustomerVoucher ADD PaymentLinkAt DATETIME NULL;
END
GO

SET QUOTED_IDENTIFIER ON;
GO
IF OBJECT_ID(N'dbo.CustomerVoucher', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerVoucher', N'SourceTable') IS NOT NULL
  AND COL_LENGTH(N'dbo.CustomerVoucher', N'SourceID') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerVoucher_Source'
      AND object_id = OBJECT_ID(N'dbo.CustomerVoucher')
  )
BEGIN
  CREATE NONCLUSTERED INDEX IX_CustomerVoucher_Source
    ON dbo.CustomerVoucher (SourceTable, SourceID)
    WHERE SourceTable IS NOT NULL AND SourceID IS NOT NULL;
END
GO

-- Ödeme linki ayarları (iyzico anahtarları dolunca gerçek checkout; boşken manuel link)
IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(250), Value nvarchar(100), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'PAY_PROVIDER', N'Ödeme sağlayıcı (manual / iyzico)', N'manual', N'finans'),
    (N'PAY_LINK_BASE_URL', N'Ödeme linki taban URL', N'', N'finans'),
    (N'IYZICO_API_KEY', N'iyzico API Key', N'', N'finans'),
    (N'IYZICO_SECRET_KEY', N'iyzico Secret Key', N'', N'finans');

  DECLARE @code nvarchar(50), @title nvarchar(250), @val nvarchar(100), @mod nvarchar(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Code, Title, Value, ModuleKey FROM @seed;
  OPEN c;
  FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Setting WHERE Code = @code)
    BEGIN
      DECLARE @nextId int = ISNULL((SELECT MAX(SettingID) FROM dbo.Setting), 0) + 1;
      INSERT INTO dbo.Setting (SettingID, Code, Title, Value, ModuleKey)
      VALUES (@nextId, @code, @title, @val, @mod);
    END
    FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  END
  CLOSE c;
  DEALLOCATE c;
END
GO
