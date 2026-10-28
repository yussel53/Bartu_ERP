-- 20261028_160556: dnm.xls öncelikli öndeğer/parametre batch 2
IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(250), Value nvarchar(100), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'FAT_PRINT_COPIES', N'Fatura Yazım Sayısı', N'1', N'fatura'),
    (N'FAT_BATCH_RULE', N'Toplu Faturalama Kuralı', N'runtime', N'fatura'),
    (N'FAT_PARTIAL_SHIP', N'Parçalı Sipariş Sevkiyatı', N'1', N'fatura'),
    (N'FAT_WP_CTRL', N'İşyeri / Ambar Kontrolü (Fatura)', N'warn', N'fatura'),
    (N'FAT_CUST_PROD', N'Fişlerde Cari Hesap / Malzeme Uygunluk Kontrolü', N'warn', N'fatura'),
    (N'FAT_TEVK_ACT', N'Faturada Tevkifat Uygulanmışsa', N'continue', N'fatura'),
    (N'FAT_EXEMPT_CTRL', N'KDV Muafiyet Sebebi Kontrolü', N'0', N'fatura'),
    (N'FAT_DESP_FROM_INV', N'İrsaliye Bilgisini Faturadan Alsın', N'0', N'fatura'),
    (N'FAT_UPD_DESP_SEC', N'Fatura Kaydında Bağlı İrsaliye Bölüm Bilgisini Güncelle', N'1', N'fatura'),
    (N'FAT_SHIP_ADDR', N'Siparişte Sevkiyat Adresi Kontrolü', N'continue', N'fatura'),
    (N'FAT_CREATE_WH_VOUCH', N'Ambar Fişi Oluşturulsun', N'0', N'fatura'),
    (N'PUR_PRICE_VAT', N'Satınalma Fiyatları - KDV', N'excl', N'fatura'),
    (N'SAL_PRICE_VAT', N'Satış Fiyatları - KDV', N'excl', N'fatura'),
    (N'SAL_PRINT_COPIES', N'İrsaliye Yazım Sayısı', N'1', N'fatura'),
    (N'ORD_PRINT_COPIES', N'Sipariş Yazım Sayısı', N'1', N'fatura'),
    (N'STK_WP_CTRL', N'İşyeri / Fabrika / Ambar Kontrolü', N'1', N'stok'),
    (N'STK_SERIAL_QTY', N'Fişlerde Seri/Lot Miktar Kontrolü', N'continue', N'stok'),
    (N'STK_CUST_PROD', N'Fişlerde Cari Hesap / Malzeme Uygunluk Kontrolü', N'continue', N'stok'),
    (N'STK_UNIT_DIV', N'Birim - Bölünebilir', N'0', N'stok'),
    (N'STK_LOC_TRACK', N'Stok Yeri Takibi', N'0', N'stok'),
    (N'CAR_BANK_STATUS', N'Banka Fişleri Durumu', N'0', N'cari'),
    (N'CAR_CHEQUE_STATUS', N'Çek / Senet Bordro Durumu', N'0', N'cari'),
    (N'CAR_ACC_STATUS', N'Muhasebe Fiş Durumu', N'0', N'cari'),
    (N'CAR_ACC_HDR_CUR', N'Kullanılacak Para Birimi - Muhasebe (Genel)', N'doc', N'cari'),
    (N'CAR_ACC_LINE_CUR', N'Kullanılacak Para Birimi - Muhasebe (Satır)', N'local', N'cari'),
    (N'CAR_EFT_FEE', N'Gelen Havale / EFT Masraf Tutarı', N'add', N'cari'),
    (N'CAR_BANK_HDR_CUR', N'Kullanılacak Para Birimi - Banka Fişi (Genel)', N'doc', N'cari'),
    (N'CAR_BANK_LINE_CUR', N'Kullanılacak Para Birimi - Banka Fişi (Satır)', N'local', N'cari'),
    (N'KASA_HDR_CUR', N'Kullanılacak Para Birimi - Kasa (Genel)', N'local', N'kasa');

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
