-- 37: SYS_TypeDef başlangıç kayıtları (fiş / malzeme / cari türleri)
-- Tablo boşsa tohumlar; mevcut Kind+Code çakışmaz.

IF OBJECT_ID(N'dbo.SYS_TypeDef', N'U') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM dbo.SYS_TypeDef)
BEGIN
  INSERT INTO dbo.SYS_TypeDef (Kind, Code, Title, ModuleKey, TargetTable, IsActive, SortOrder) VALUES
  -- Satış faturaları (Kind=1 Fiş)
  (1, N'TSF', N'Toptan Satış Faturası', N'satis', N'Invoice', 1, 10),
  (1, N'PSF', N'Perakende Satış Faturası', N'satis', N'Invoice', 1, 20),
  (1, N'SIF', N'Satış İade Faturası', N'satis', N'Invoice', 1, 30),
  -- Satınalma
  (1, N'AF', N'Alış Faturası', N'satinalma', N'Invoice', 1, 10),
  (1, N'AIF', N'Alış İade Faturası', N'satinalma', N'Invoice', 1, 20),
  -- Banka
  (1, N'1', N'Banka İşlem Fişi', N'finans', N'BankVoucher', 1, 10),
  (1, N'2', N'Banka Virman Fişi', N'finans', N'BankVoucher', 1, 20),
  (1, N'3', N'Gelen Havale/EFT', N'finans', N'BankVoucher', 1, 30),
  (1, N'4', N'Gönderilen Havale/EFT', N'finans', N'BankVoucher', 1, 40),
  -- Cari fiş / ödeme / çek
  (1, N'NT', N'Nakit Tahsilat', N'finans', N'CustomerVoucher', 1, 10),
  (1, N'NO', N'Nakit Ödeme', N'finans', N'CustomerVoucher', 1, 20),
  (1, N'CKG', N'Çek Girişi', N'finans', N'BoundTrans', 1, 10),
  -- Sipariş / irsaliye
  (1, N'SS', N'Satış Siparişi', N'satis', N'OrderVoucher', 1, 10),
  (1, N'AS', N'Alış Siparişi', N'satinalma', N'OrderVoucher', 1, 10),
  (1, N'SI', N'Satış İrsaliyesi', N'satis', N'ProductVoucher', 1, 10),
  (1, N'AI', N'Alış İrsaliyesi', N'satinalma', N'ProductVoucher', 1, 10),
  -- Muhasebe
  (1, N'MH', N'Mahsup Fişi', N'muhasebe', N'AccountVoucher', 1, 10),
  -- Malzeme türleri (Kind=2)
  (2, N'1', N'Malzeme', N'malzeme', N'ProductCard', 1, 10),
  (2, N'2', N'Verilen Hizmet', N'satis', N'ProductCard', 1, 20),
  (2, N'3', N'Alınan Hizmet', N'satinalma', N'ProductCard', 1, 30),
  -- Cari türleri (Kind=3)
  (3, N'1', N'Müşteri', N'finans', N'CustomerCard', 1, 10),
  (3, N'2', N'Tedarikçi', N'finans', N'CustomerCard', 1, 20),
  (3, N'3', N'Müşteri + Tedarikçi', N'finans', N'CustomerCard', 1, 30);
END
GO
