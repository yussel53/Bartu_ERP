# -*- coding: utf-8 -*-
codes = [
    ("FAT_FILL_ACC", "Faturalardaki Bos Muhasebe Kodlarini Otomatik Doldur", "1", "fatura"),
    ("FAT_FILL_SMM", "Faturalardaki Bos SMM Muhasebe Kodlarini Otomatik Doldur", "1", "fatura"),
    ("FAT_PAY_OVER", "Odeme Tutari Fatura/Siparis Tutarindan Fazla Olursa", "block", "fatura"),
    ("FAT_PRICE_CTRL", "Fatura Satirlarinda Birim Fiyat Kontrolu", "warn", "fatura"),
    ("FAT_CUR_HDR", "Kullanilacak Para Birimi - Fatura (Genel)", "doc", "fatura"),
    ("FAT_CUR_LINE", "Kullanilacak Para Birimi - Fatura (Satir)", "local", "fatura"),
    ("FAT_STATUS_DEF", "Fatura Durumu Ondegeri", "0", "fatura"),
    ("FAT_TEVK_PAY", "Tevkifat Payi", "2", "fatura"),
    ("FAT_TEVK_PAYDA", "Tevkifat Paydasi", "3", "fatura"),
    ("FAT_DISC_ROUND", "Indirimde Yuvarlama", "1", "fatura"),
    ("FAT_OPEN_CASH", "Faturalarda Nakit Odeme/Tahsilat Fisi Otomatik Acilsin", "1", "fatura"),
    ("FAT_CANCEL_DESP", "Fatura Iptal Edildiginde Bagli Irsaliye Iptal Edilsin", "1", "fatura"),
    ("FAT_LINES_PRINT", "Fatura Satirlari", "separate", "fatura"),
    ("FAT_AUTO_PRINT", "Otomatik Fatura Basimi", "0", "fatura"),
    ("FAT_EINV_PRINT", "E-Faturalar Basilsin", "1", "fatura"),
    ("FAT_SALESMAN_EDIT", "Fis Satirlari Satis Elemani Bilgisi Degistirilebilsin", "0", "fatura"),
    ("FAT_WHOUSE_EDIT", "Fis Satirlari Ambar Bilgisi Degistirilebilsin", "0", "fatura"),
    ("FAT_WHOUSE_WARN", "Fis Satirlari Ambar Bilgisi Guncellenirken Uyar", "1", "fatura"),
    ("PUR_PRICE_DEF", "Birim Fiyat Ondegeri (Satinalma)", "purchase", "fatura"),
    ("PUR_PAY_MODE", "Faturada Odeme Hareketleri (Satinalma)", "partial", "fatura"),
    ("SAL_PRICE_DEF", "Birim Fiyat Ondegeri (Satis)", "sales", "fatura"),
    ("SAL_PAY_MODE", "Faturada Odeme Hareketleri (Satis)", "partial", "fatura"),
    ("STK_KDV_PUR", "Satinalma KDV Orani (%)", "20", "stok"),
    ("STK_KDV_SAL", "Satis KDV Orani (%)", "20", "stok"),
    ("STK_KDV_RET", "Iade KDV Orani (%)", "20", "stok"),
    ("STK_NEG_CTRL", "Negatif Stok Seviyesi Kontrolu", "continue", "stok"),
    ("STK_MIN_CTRL", "Asgari Stok Seviyesi Kontrolu", "continue", "stok"),
    ("STK_MAX_CTRL", "Azami Stok Seviyesi Kontrolu", "continue", "stok"),
    ("STK_COST_METHOD", "Stok Maliyet Turu", "fifo", "stok"),
    ("STK_FILL_ACC", "Malzeme Fislerindeki Bos Muhasebe Kodlarini Otomatik Doldur", "0", "stok"),
    ("STK_LINE_CUR", "Kullanilacak Para Birimi - Malzeme (Satir)", "local", "stok"),
    ("STK_WHOUSE_EDIT", "Fis Satirlari Ambar Bilgisi Degistirilebilsin", "0", "stok"),
    ("STK_AUTO_PRINT", "Otomatik Fis Basimi", "0", "stok"),
    ("STK_LEVEL_BASE", "Stok Seviye Kontrolleri", "actual", "stok"),
    ("CAR_PRICE_DEC", "Birim Fiyat Kurus Hanesi", "6", "cari"),
    ("CAR_FX_DEC", "Gunluk Doviz Kurus Hanesi", "2", "cari"),
    ("CAR_VAT_ROUND", "KDV Hesaplamasinda Yuvarlama Sekli", "amount", "cari"),
    ("CAR_RISK_ORDER", "Sipariste Risk Limiti Asildiginda", "continue", "cari"),
    ("CAR_RISK_DESP", "Irsaliyede Risk Limiti Asildiginda", "block", "cari"),
    ("CAR_RISK_OPEN", "Acik Hesaplarda Risk Limiti Asildiginda", "continue", "cari"),
    ("CAR_FILL_ACC", "Cari Hesap Fislerindeki Bos Muhasebe Kodlarini Otomatik Doldur", "0", "cari"),
    ("CAR_BLACK_ORDER", "Kara Listedeki Cariye Siparis Kesildiginde", "continue", "cari"),
    ("CAR_BLACK_DESP", "Kara Listedeki Cariye Irsaliye Kesildiginde", "continue", "cari"),
    ("CAR_DUE_DAYS", "Vade Takibi Yapilacak Gun Sayisi", "30", "cari"),
    ("CAR_DUE_ACT", "Vade Takibi Yapildiginda", "continue", "cari"),
    ("CAR_DOCNO_INV", "Faturalarda Cari Bazinda Belge No Tekrarlandiginda", "continue", "cari"),
    ("CAR_LINE_CUR", "Kullanilacak Para Birimi - Cari Hesap (Satir)", "local", "cari"),
    ("CAR_SALESMAN_CTRL", "Satis Elemani Kontrolu", "0", "cari"),
    ("CAR_TAXNR_CTRL", "Cari Hesap Vergi Numarasi Kontrolu", "continue", "cari"),
]

path = r"d:\Dosyalar\YAZILIMLARIMIZ\Bartu_ERP\SqlUpdates\20261028_152747_module_params_seed.sql"
vals = ",\n".join(f"    (N'{c}', N'{t}', N'{v}', N'{m}')" for c, t, v, m in codes)
sql = f"""-- 20261028_152747: Fatura / Stok / Cari parametre seed (ModuleKey)
-- Basliklar UI kaydinda Turkce guncellenir

IF OBJECT_ID(N'dbo.Setting', N'U') IS NOT NULL
BEGIN
  DECLARE @seed TABLE (Code nvarchar(50), Title nvarchar(250), Value nvarchar(100), ModuleKey nvarchar(20));
  INSERT INTO @seed (Code, Title, Value, ModuleKey) VALUES
{vals};

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
"""
open(path, "w", encoding="utf-8").write(sql)
print("wrote", path, "n=", len(codes))
