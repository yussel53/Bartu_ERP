-- 43: Setting.ModuleKey — Finans / Satış / Satınalma / Muhasebe parametre grupları

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.Setting', N'ModuleKey') IS NULL
BEGIN
  ALTER TABLE dbo.Setting ADD ModuleKey nvarchar(20) NULL;
END
GO

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.Setting', N'ModuleKey') IS NOT NULL
BEGIN
  -- Genel ayarlar (tarih formatı vb.)
  UPDATE dbo.Setting
  SET ModuleKey = N'genel'
  WHERE ModuleKey IS NULL
    AND Code IN (N'DateFormat');

  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(50), Value nvarchar(50), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'FIN_RISK_CTRL', N'Risk Kontrolü', N'1', N'finans'),
    (N'FIN_CUR_DEF', N'Öndeğer Döviz', N'TRY', N'finans'),
    (N'SAL_PRICE_LIST', N'Fiyat Listesi Zorunlu', N'0', N'satis'),
    (N'SAL_DISC_MAX', N'Maks. İskonto %', N'20', N'satis'),
    (N'PUR_APPR', N'Satınalma Onayı', N'0', N'satinalma'),
    (N'PUR_QTY_TOL', N'Miktar Toleransı %', N'5', N'satinalma'),
    (N'ACC_AUTO_POST', N'Otomatik Mahsup', N'0', N'muhasebe'),
    (N'ACC_YEAR', N'Muhasebe Yılı', N'2026', N'muhasebe');

  DECLARE @code nvarchar(50), @title nvarchar(50), @val nvarchar(50), @mod nvarchar(20);
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
    ELSE
    BEGIN
      UPDATE dbo.Setting SET ModuleKey = @mod WHERE Code = @code AND ModuleKey IS NULL;
    END
    FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  END
  CLOSE c;
  DEALLOCATE c;
END
GO
