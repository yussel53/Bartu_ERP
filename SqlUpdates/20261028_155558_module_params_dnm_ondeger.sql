-- 20261028_155558: dnm.xls öndeğer / seviye parametreleri (KDV genişletme + stok kontroller)
-- Idempotent: Code yoksa ekler

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(250), Value nvarchar(100), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'STK_KDV_RETAIL_SAL', N'Perakende Satış KDV Oranı (%)', N'20', N'stok'),
    (N'STK_KDV_RETAIL_RET', N'Perakende İade KDV Oranı (%)', N'20', N'stok'),
    (N'STK_KDV_EXPENSE', N'Masraf KDV Oranı (%)', N'20', N'stok'),
    (N'STK_KDV_FX', N'Kur Farkı KDV Oranı (%)', N'20', N'stok'),
    (N'STK_SAFE_CTRL', N'Güvenlik Stok Seviyesi Kontrolü', N'continue', N'stok'),
    (N'STK_IN_CTRL', N'Giriş Kontrolü', N'continue', N'stok'),
    (N'STK_OUT_CTRL', N'Çıkış Kontrolü', N'continue', N'stok'),
    (N'STK_HDR_CUR', N'Kullanılacak Para Birimi - Malzeme (Genel)', N'doc', N'stok'),
    (N'STK_VOUCH_OUT_STATUS', N'Malzeme Fişleri Durumu (Ambar Çıkış)', N'0', N'stok'),
    (N'STK_VOUCH_IN_STATUS', N'Malzeme Fişleri Durumu (Ambar Giriş)', N'0', N'stok'),
    (N'STK_WHOUSE_WARN', N'Fiş Satırları Ambar Bilgisi Güncellenirken Uyar', N'1', N'stok'),
    (N'STK_SERIAL_POPUP', N'Seri/Lot Miktar Değişince Otomatik Pencere', N'1', N'stok'),
    (N'STK_FX_DATE_REP', N'Tarih Değişikliğinde Raporlama Dövizi Kuru', N'update', N'stok'),
    (N'CAR_BSMV', N'BSMV Oranı (%)', N'5', N'cari'),
    (N'CAR_DAMGA', N'Damga Vergisi Oranı (%)', N'0.75', N'cari'),
    (N'CAR_HDR_CUR', N'Kullanılacak Para Birimi - Cari Hesap (Genel)', N'doc', N'cari');

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
    ELSE
      UPDATE dbo.Setting SET ModuleKey = ISNULL(ModuleKey, @mod) WHERE Code = @code AND (ModuleKey IS NULL OR ModuleKey = N'');
    FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  END
  CLOSE c; DEALLOCATE c;
END
GO
