-- 74: TCMB günlük kurları
-- SYS_Currency.AutoRate   : 1 = kur TCMB'den otomatik indirilir. İlk kurulumda yalnız USD, EUR, GBP işaretlenir;
--                           diğer dövizler Döviz kartından / Döviz Kurları ekranından sonradan seçilir.
-- SYS_CurrencyRate        : (11'de açıldı) BuyRate = Döviz Alış, SellRate = Döviz Satış (1 birim için);
--                           eklenenler: Efektif alış/satış, TCMB birimi (JPY = 100), kaynak, bülten no, indirme zamanı.
-- SYS_CurrencyRateLog     : her indirme denemesinin sonucu (otomatik / elle).

IF OBJECT_ID(N'dbo.SYS_Currency', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.SYS_Currency', N'AutoRate') IS NULL
BEGIN
  ALTER TABLE dbo.SYS_Currency ADD AutoRate BIT NOT NULL
    CONSTRAINT DF_SYS_Currency_AutoRate DEFAULT (0) WITH VALUES;
  -- İlk kurulum: yalnız USD / EUR / GBP otomatik
  EXEC (N'UPDATE dbo.SYS_Currency SET AutoRate = 1 WHERE Code IN (N''USD'', N''EUR'', N''GBP'') AND ISNULL(IsLocal, 0) = 0');
END
GO

IF OBJECT_ID(N'dbo.SYS_CurrencyRate', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.SYS_CurrencyRate', N'BanknoteBuyRate') IS NULL
    ALTER TABLE dbo.SYS_CurrencyRate ADD BanknoteBuyRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.SYS_CurrencyRate', N'BanknoteSellRate') IS NULL
    ALTER TABLE dbo.SYS_CurrencyRate ADD BanknoteSellRate FLOAT NULL;
  IF COL_LENGTH(N'dbo.SYS_CurrencyRate', N'Unit') IS NULL
    ALTER TABLE dbo.SYS_CurrencyRate ADD Unit INT NULL;
  IF COL_LENGTH(N'dbo.SYS_CurrencyRate', N'Source') IS NULL
    ALTER TABLE dbo.SYS_CurrencyRate ADD Source NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.SYS_CurrencyRate', N'BulletinNo') IS NULL
    ALTER TABLE dbo.SYS_CurrencyRate ADD BulletinNo NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.SYS_CurrencyRate', N'DownloadedAt') IS NULL
    ALTER TABLE dbo.SYS_CurrencyRate ADD DownloadedAt DATETIME2 NULL;
END
GO

IF OBJECT_ID(N'dbo.SYS_CurrencyRateLog', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_CurrencyRateLog
  (
    LogID       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SYS_CurrencyRateLog PRIMARY KEY,
    RunAt       DATETIME2     NOT NULL CONSTRAINT DF_SYS_CurrencyRateLog_RunAt DEFAULT (SYSDATETIME()),
    RequestDate DATE          NULL,     -- istenen gün (null = today.xml)
    RateDate    DATE          NULL,     -- TCMB bülten tarihi
    BulletinNo  NVARCHAR(20)  NULL,
    Trigger_    NVARCHAR(20)  NOT NULL, -- Otomatik / Elle
    Success     BIT           NOT NULL,
    RateCount   INT           NOT NULL CONSTRAINT DF_SYS_CurrencyRateLog_Count DEFAULT (0),
    Message     NVARCHAR(1000) NULL
  );
  CREATE INDEX IX_SYS_CurrencyRateLog_RunAt ON dbo.SYS_CurrencyRateLog (RunAt DESC);
END
GO
