# Genel muhasebe ve muhasebeleştirme

## Hazırlık

1. **Hesap kartları** (*Genel Muhasebe → Ana Kayıtlar → Hesap Kartları*): kullanılacak hesaplar (100, 120, 153, 191, 320, 391, 600, 610 …).
2. **Muhasebe bağlantıları**: hangi işlemin hangi hesaba gideceği.
   - Kartın kendi **Muhasebe Hesapları** sekmesi (cari, malzeme, kasa, banka): o karta özel hesap.
   - *Genel Muhasebe → Ana Kayıtlar → Muhasebe Bağlantıları*: öndeğer satırlar — kartta tanım yoksa bunlar kullanılır.

| Bağlantı | Tür | Örnek hesap |
|---|---|---|
| Cari | Kart muhasebe kodu | 120 / 320 |
| Malzeme | Satış · Alış · Satış iade · Alış iade | 600 · 153 · 610 · 153 |
| Fatura (malzemede yoksa) | Fatura türü | 600 / 153 / 770 … |
| KDV | KDV satış · KDV alış · KDV satış iade · KDV alış iade | 391 · 191 · 391 · 191 |
| Kasa | Nakit giriş · Nakit çıkış | 100 |
| Banka | Fiş türü | 102 |

## Faturadan muhasebe fişi

| Fatura | Borç | Alacak |
|---|---|---|
| Satış, satış fiyat farkı | Cari (KDV dahil) | Satış hesabı (KDV hariç), KDV satış |
| Alış, alınan hizmet, alış fiyat farkı | Alış hesabı, KDV alış | Cari |
| Satış iade | Satış iade hesabı, KDV satış iade | Cari |
| Alış iade | Cari | Alış iade hesabı, KDV alış iade |

Aynı hesaba giden satırlar tek satırda toplanır. Fiş türü *Mahsup*; fişte kaynak belge (fatura) saklanır.

## Kasa fişinden muhasebe fişi

Kasa hesabı kasa kartından, karşı hesap satırdan gelir: tahsilat / tediye → cari, kasa ↔ banka → banka hesabı, virman → hedef kasa,
masraf → satırda seçilen muhasebe hesabı. Tahsilat *Tahsil*, tediye *Tediye*, diğerleri *Mahsup* fişi olur.

## Ne zaman oluşur?

- **Kayıtta otomatik**: *Sistem → Parametreler*'de **Otomatik Mahsup** (`ACC_AUTO_POST`) = 1 ise fatura ya da kasa fişi kaydedilince.
  Bağlantı eksikse belge yine kaydedilir, mesajda «Muhasebeleştirilmedi: …» ve eksik hesap yazar.
- **Elle / toplu**: *Genel Muhasebe → İşlemler → Muhasebeleştirme* — fişi oluşmamış belgeler listelenir; satırda **Muhasebeleştir**
  ya da tarih aralığı için **Tümünü muhasebeleştir**. Hata veren belgeler nedeniyle birlikte listelenir.

Belge değişip yeniden kaydedilince (ya da yeniden muhasebeleştirilince) eski fiş silinip yenisi oluşur; belge silinince fişi de silinir.
**Yevmiye numarası almış** fiş korunur: belge değiştirilse de fiş değişmez, belge silinemez — önce yevmiye numarasını geri alın.

## Bütçe

*Genel Muhasebe → Ana Kayıtlar → Bütçeler*: yıl, ad, tür (**Gider** / **Gelir**), hedef ve Ocak – Aralık tutarları.

- **Hedef**: bir **muhasebe hesabı** (alt hesaplarıyla; gerçekleşen muhasebe fişlerinden) ya da bir **malzeme / hizmet kartı**
  (gerçekleşen faturalardan, KDV hariç; giderde alış − alış iade, gelirde satış − satış iade).
- **Faturada bütçe çubuğu**: fatura satırlarının düştüğü bütçeler ekranın altında, Kaydet düğmesinin üstünde çubuk olarak görünür — gri bu ay gerçekleşen,
  mavi bu fatura (aşımda kırmızı), dikey çizgi aylık bütçe; sağda kalan ya da aşım. Malzemenin hesap bütçesine düşmesi için
  malzemenin muhasebe bağlantısı (alış / satış hesabı) tanımlı olmalı.
- **Aylık bütçe aşılınca**: yalnız göster · uyar (kayıt yapılır, mesajda yazar) · faturayı engelle. Tutarı artmayan düzenleme engellenmez.
- *Genel Muhasebe → Raporlar → Bütçe / Gerçekleşen*: her bütçe için aylık gerçekleşen / bütçe, seçilen aya kadar kümülatif ve yüzde;
  giderde aşım, gelirde bütçenin altı kırmızı.

## Yevmiye numaralandırma

*Genel Muhasebe → İşlemler → Yevmiye Madde Numaralandırma*: fişler tarih + saat sırasıyla numaralanır.
