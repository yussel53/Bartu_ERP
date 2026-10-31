-- 20261028_125304: Kasa parametreleri (Mikro tarzı) — Setting ModuleKey=kasa
-- Kayıt kontrolleri: çalışma günü, negatif seviye, boş muhasebe kodu doldurma vb.

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.Setting', N'Title') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM sys.columns c
      JOIN sys.types t ON c.user_type_id = t.user_type_id
      WHERE c.object_id = OBJECT_ID(N'dbo.Setting') AND c.name = N'Title' AND t.name = N'nvarchar' AND c.max_length < 500
    )
  BEGIN
    ALTER TABLE dbo.Setting ALTER COLUMN Title nvarchar(250) NULL;
  END
END
GO

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (
    Code nvarchar(50),
    Title nvarchar(250),
    Value nvarchar(100),
    ModuleKey nvarchar(20),
    SortOrder int
  );
  INSERT INTO @seed (Code, Title, Value, ModuleKey, SortOrder) VALUES
    (N'KASA_WORKDAY_CTRL', N'Kasa Çalışma Günü Kontrolü', N'0', N'kasa', 10),
    (N'KASA_LINES_PRINT', N'Kasa Satırları', N'separate', N'kasa', 20),
    (N'KASA_AUTO_PRINT', N'Otomatik Kasa İşlemleri Basımı', N'0', N'kasa', 30),
    (N'KASA_STOPAJ_MAL', N'Stopaj Oranı(Mal)', N'0', N'kasa', 40),
    (N'KASA_STOPAJ_HIZMET', N'Stopaj Oranı(Hizmet)', N'0', N'kasa', 50),
    (N'KASA_FON_ORAN', N'Fon Payı Oranı', N'0', N'kasa', 60),
    (N'KASA_NEG_CTRL', N'Kasa Negatif Seviye Kontrolü', N'0', N'kasa', 70),
    (N'KASA_NEG_CUR', N'Kasa Negatif Seviye — Para Birimi', N'local', N'kasa', 80),
    (N'KASA_FX_LOCK', N'Kasa Kur Farkı İşlemlerinde Lock Kontrolü', N'1', N'kasa', 90),
    (N'KASA_FILL_ACC', N'Kasa Fişlerindeki Boş Muhasebe Kodlarını Otomatik Doldur', N'0', N'kasa', 100),
    (N'KASA_SALESMAN_CTRL', N'Satış Elemanı Kontrolü', N'0', N'kasa', 110),
    (N'KASA_SALESMAN_CUST', N'Satış Elemanı Cari Hesap Bağlantı Kontrolü', N'0', N'kasa', 120),
    (N'KASA_SALESMAN_EDIT', N'Fiş/Fiş Satırları Satış Elemanı Bilgisi Değiştirilebilsin', N'0', N'kasa', 130),
    (N'KASA_SKONSOL_PRINT', N'Skonsol Uygulaması Otomatik Kasa İşlemleri Basımı', N'0', N'kasa', 140),
    (N'KASA_LINE_CUR', N'Kullanılacak Para Birimi - Kasa (Satır)', N'local', N'kasa', 150),
    (N'KASA_SYNC_EDIT_DATE', N'Fiş Tarihi Değişince Düzenleme Tarihi de Güncellensin', N'0', N'kasa', 160),
    (N'KASA_PRINT_MERGE_INST', N'Yazdırırken Aynı Vadeli Taksit Hareketleri Birleştirilsin', N'0', N'kasa', 170),
    (N'KASA_VIRMAN_CUR_LOCK', N'Virman İşleminde Döviz Türü Değiştirilemeyecek İşareti Dikkate Alınsın', N'1', N'kasa', 180),
    (N'KASA_SALESMAN_FILTER', N'Satış Elemanı Seçiminde Yalnız Cariye Bağlı Elemanlar', N'0', N'kasa', 190);

  DECLARE @code nvarchar(50), @title nvarchar(250), @val nvarchar(100), @mod nvarchar(20);
  DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT Code, Title, Value, ModuleKey FROM @seed ORDER BY SortOrder;
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
      UPDATE dbo.Setting
      SET Title = @title, ModuleKey = ISNULL(ModuleKey, @mod)
      WHERE Code = @code;
    END
    FETCH NEXT FROM c INTO @code, @title, @val, @mod;
  END
  CLOSE c;
  DEALLOCATE c;
END
GO
