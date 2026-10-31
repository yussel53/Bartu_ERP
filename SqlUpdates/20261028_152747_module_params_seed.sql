-- 20261028_152747: Fatura / Stok / Cari parametre seed (ModuleKey)
-- Basliklar UI kaydinda Turkce guncellenir

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(250), Value nvarchar(100), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
    (N'FAT_FILL_ACC', N'Faturalardaki Bos Muhasebe Kodlarini Otomatik Doldur', N'1', N'fatura'),
    (N'FAT_FILL_SMM', N'Faturalardaki Bos SMM Muhasebe Kodlarini Otomatik Doldur', N'1', N'fatura'),
    (N'FAT_PAY_OVER', N'Odeme Tutari Fatura/Siparis Tutarindan Fazla Olursa', N'block', N'fatura'),
    (N'FAT_PRICE_CTRL', N'Fatura Satirlarinda Birim Fiyat Kontrolu', N'warn', N'fatura'),
    (N'FAT_CUR_HDR', N'Kullanilacak Para Birimi - Fatura (Genel)', N'doc', N'fatura'),
    (N'FAT_CUR_LINE', N'Kullanilacak Para Birimi - Fatura (Satir)', N'local', N'fatura'),
    (N'FAT_STATUS_DEF', N'Fatura Durumu Ondegeri', N'0', N'fatura'),
    (N'FAT_TEVK_PAY', N'Tevkifat Payi', N'2', N'fatura'),
    (N'FAT_TEVK_PAYDA', N'Tevkifat Paydasi', N'3', N'fatura'),
    (N'FAT_DISC_ROUND', N'Indirimde Yuvarlama', N'1', N'fatura'),
    (N'FAT_OPEN_CASH', N'Faturalarda Nakit Odeme/Tahsilat Fisi Otomatik Acilsin', N'1', N'fatura'),
    (N'FAT_CANCEL_DESP', N'Fatura Iptal Edildiginde Bagli Irsaliye Iptal Edilsin', N'1', N'fatura'),
    (N'FAT_LINES_PRINT', N'Fatura Satirlari', N'separate', N'fatura'),
    (N'FAT_AUTO_PRINT', N'Otomatik Fatura Basimi', N'0', N'fatura'),
    (N'FAT_EINV_PRINT', N'E-Faturalar Basilsin', N'1', N'fatura'),
    (N'FAT_SALESMAN_EDIT', N'Fis Satirlari Satis Elemani Bilgisi Degistirilebilsin', N'0', N'fatura'),
    (N'FAT_WHOUSE_EDIT', N'Fis Satirlari Ambar Bilgisi Degistirilebilsin', N'0', N'fatura'),
    (N'FAT_WHOUSE_WARN', N'Fis Satirlari Ambar Bilgisi Guncellenirken Uyar', N'1', N'fatura'),
    (N'PUR_PRICE_DEF', N'Birim Fiyat Ondegeri (Satinalma)', N'purchase', N'fatura'),
    (N'PUR_PAY_MODE', N'Faturada Odeme Hareketleri (Satinalma)', N'partial', N'fatura'),
    (N'SAL_PRICE_DEF', N'Birim Fiyat Ondegeri (Satis)', N'sales', N'fatura'),
    (N'SAL_PAY_MODE', N'Faturada Odeme Hareketleri (Satis)', N'partial', N'fatura'),
    (N'STK_KDV_PUR', N'Satinalma KDV Orani (%)', N'20', N'stok'),
    (N'STK_KDV_SAL', N'Satis KDV Orani (%)', N'20', N'stok'),
    (N'STK_KDV_RET', N'Iade KDV Orani (%)', N'20', N'stok'),
    (N'STK_NEG_CTRL', N'Negatif Stok Seviyesi Kontrolu', N'continue', N'stok'),
    (N'STK_MIN_CTRL', N'Asgari Stok Seviyesi Kontrolu', N'continue', N'stok'),
    (N'STK_MAX_CTRL', N'Azami Stok Seviyesi Kontrolu', N'continue', N'stok'),
    (N'STK_COST_METHOD', N'Stok Maliyet Turu', N'fifo', N'stok'),
    (N'STK_FILL_ACC', N'Malzeme Fislerindeki Bos Muhasebe Kodlarini Otomatik Doldur', N'0', N'stok'),
    (N'STK_LINE_CUR', N'Kullanilacak Para Birimi - Malzeme (Satir)', N'local', N'stok'),
    (N'STK_WHOUSE_EDIT', N'Fis Satirlari Ambar Bilgisi Degistirilebilsin', N'0', N'stok'),
    (N'STK_AUTO_PRINT', N'Otomatik Fis Basimi', N'0', N'stok'),
    (N'STK_LEVEL_BASE', N'Stok Seviye Kontrolleri', N'actual', N'stok'),
    (N'CAR_PRICE_DEC', N'Birim Fiyat Kurus Hanesi', N'6', N'cari'),
    (N'CAR_FX_DEC', N'Gunluk Doviz Kurus Hanesi', N'2', N'cari'),
    (N'CAR_VAT_ROUND', N'KDV Hesaplamasinda Yuvarlama Sekli', N'amount', N'cari'),
    (N'CAR_RISK_ORDER', N'Sipariste Risk Limiti Asildiginda', N'continue', N'cari'),
    (N'CAR_RISK_DESP', N'Irsaliyede Risk Limiti Asildiginda', N'block', N'cari'),
    (N'CAR_RISK_OPEN', N'Acik Hesaplarda Risk Limiti Asildiginda', N'continue', N'cari'),
    (N'CAR_FILL_ACC', N'Cari Hesap Fislerindeki Bos Muhasebe Kodlarini Otomatik Doldur', N'0', N'cari'),
    (N'CAR_BLACK_ORDER', N'Kara Listedeki Cariye Siparis Kesildiginde', N'continue', N'cari'),
    (N'CAR_BLACK_DESP', N'Kara Listedeki Cariye Irsaliye Kesildiginde', N'continue', N'cari'),
    (N'CAR_DUE_DAYS', N'Vade Takibi Yapilacak Gun Sayisi', N'30', N'cari'),
    (N'CAR_DUE_ACT', N'Vade Takibi Yapildiginda', N'continue', N'cari'),
    (N'CAR_DOCNO_INV', N'Faturalarda Cari Bazinda Belge No Tekrarlandiginda', N'continue', N'cari'),
    (N'CAR_LINE_CUR', N'Kullanilacak Para Birimi - Cari Hesap (Satir)', N'local', N'cari'),
    (N'CAR_SALESMAN_CTRL', N'Satis Elemani Kontrolu', N'0', N'cari'),
    (N'CAR_TAXNR_CTRL', N'Cari Hesap Vergi Numarasi Kontrolu', N'continue', N'cari');

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
  CLOSE c;
  DEALLOCATE c;
END
GO
