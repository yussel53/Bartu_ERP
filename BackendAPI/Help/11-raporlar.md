# Raporlar

## Genel Durum — yönetim paneli

Sol menüde **Genel Durum** (Özet sekmesi) en üstte yönetim panelini gösterir; **Yenile** ile güncellenir, her kartta **Aç** ilgili ekrana gider.

| Kart | İçerik |
|---|---|
| Alacak / borç vadeleri | Vadesi geçen alacak ve cari sayısı, 7 gün içinde vadesi gelen; vadesi geçen / 7 gün içinde ödenecek borçlar; en çok geciken 5 cari (FIFO kapama sonrası) |
| Satış | Bugün, bu ay ve geçen ayın aynı dönemi (KDV hariç, iadeler düşülmüş); son 7 gün grafiği; açık satış siparişleri |
| Çek / senet | 7 / 30 gün içinde tahsil edilecek müşteri belgeleri, 30 gün içinde ödenecek kendi belgelerimiz, vadesi geçmiş portföy |
| Kritik stok | Eldeki miktarı malzeme kartındaki **Kritik Stok (min.)** değerine ya da altına inen ya da eksiye düşen malzemeler |
| Onay bekleyenler | Size (rolünüze / onay grubunuza) düşen bekleyen onaylar |
| Döviz | Son TCMB satış kurları; para birimine göre kasa + banka bakiyeleri |

Yetki kapsamınız dışındaki carilerin vadeleri panelde görünmez.

## Standart raporlar

İlgili modülün **Raporlar → Standart Raporlar** menüsünde hazır gelir. Hepsi SQL Rapor Tasarımcısı raporudur: filtrelenir, sıralanır,
CSV / Excel'e alınır, istenirse kopyalanıp değiştirilebilir (*Rapor Üretici → SQL Rapor Tasarımcı*).

| Rapor | Menü | Ne gösterir |
|---|---|---|
| **Mizan** | Genel Muhasebe | Hesap başına devir, dönem borç / alacak, borç ya da alacak bakiye. Alt hesaplar üst hesaplara toplanır; **Seviye** 1 yalnız ana hesaplar, 2 bir alt seviye … (0 tümü). |
| **Muavin Defter** | Genel Muhasebe | Kodu yazılan hesap ve alt hesapları: devir satırı, fiş satırları, yürüyen bakiye. |
| **Stok Yaşlandırma** | Malzeme Yönetimi | Eldeki stok en son girişlerden kaldığı varsayılarak giriş tarihine göre 0-30 / 31-60 / 61-90 / 91-180 / 180+ gün; değer giriş fiyatıyla. Ambar ID ile tek ambar. |
| **Satış Analizi** | Satış | Satış faturaları (iadeler düşülür): miktar, net satış, KDV, maliyet (ağırlıklı ortalama), brüt kâr, kâr %. **Gruplama**: cari, malzeme ya da ay. |
| **Cari Yaşlandırma** | Finans → Raporlar | Açık kalemlerin vadeye göre dağılımı (bkz. *Cari kartlar*). |

Tarih filtrelerinin öndeğerleri: Mizan ve Muavin yıl başından, Satış Analizi ay başından bugüne.

## Zamanlanmış raporlar

*Rapor Üretici → SQL Raporlar → Zamanlanmış Raporlar* (yönetici). Bir rapor seçilir, alıcılar (virgülle), sıklık (günlük / haftalık / aylık),
gün ve saat girilir; rapor o saatte çalıştırılıp **Excel eki** ile e-postalanır.

- Gönderim, zamanlamayı oluşturan kullanıcının mail tanımıyla yapılır (*CRM → Mail tanımları*; yoksa genel SMTP ayarı).
- **Parametreler** boşsa raporun öndeğerleri kullanılır. Örnek — geçen ayın satışları:
  `{"start_date":"prev_month_start","end_date":"prev_month_end","group_by":"malzeme"}`.
  Tarih anahtarları: boş (bugün), `-7 days`, `month_start`, `year_start`, `prev_month_start`, `prev_month_end`.
- Satırdaki düğmeler: **Excel indir** (göndermeden önizleme), **Şimdi gönder**, düzenle, sil. Son çalışma zamanı ve sonucu listede görünür.
- Görev 5 dakikada bir bakar; sunucudaki her firma veritabanı için ayrı çalışır.
