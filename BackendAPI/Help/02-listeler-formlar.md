# Listeler ve formlar

## Listeler

- **Sıralama**: sütun başlığına tıklayın (bir kez artan, bir kez azalan).
- **Filtre**: başlığın altındaki kutuya yazın. Sayısal sütunlarda `>1000`, `<0`, `100..500` kullanılabilir.
- **Sağ tık menüsü**: kayıt üzerinde sağ tıklayınca İncele, Değiştir, Kopyala, Sil ve karta özel bölümler (Ekstre, Hareketler…).
- **Liste / Detay Rapor**: liste görünümü ile rapor görünümü arasında geçiş.

## Kart formları

Kart formları (cari, malzeme, banka…) kurumsal düzende, alanlar etiketleriyle yan yana yerleşir. Adres, ilgili kişi,
muhasebe hesapları ve özel kodlar satır satır eklenir.

- **Kaydet** formu kaydeder; **İptal** değişiklikleri bırakır.
- Zorunlu alanlar `*` ile işaretlidir.

## Fiş formları (sipariş, irsaliye, fatura, cari / banka / muhasebe fişleri)

Fiş başlığı her zaman **üç sütun** yan yana:

| Sol | Orta | Sağ |
|---|---|---|
| Fiş no, tarih, durum, yetki kodu | Cari, adres (varsayılan adres kendiliğinden gelir), ödeme planı, fiş işlem kodu | Firma, işyeri, ambar, bölüm / birim |

Cari seçildikten sonra **adres** listesinde yalnız o cariye ait adresler görünür.

### Satırlar

- **Excel'den yapıştırma**: Excel'de malzeme kodu / adı / miktar / fiyat sütunlarını kopyalayıp satır tablosuna yapıştırın.
  İlk satır başlıksa (Malzeme Kodu, Miktar, Fiyat…) sütunlar başlığa göre eşlenir. Malzeme koddan, addan ya da barkoddan bulunur.
- **Barkod okut**: satır tablosunun üstündeki «Barkod okut + Enter» kutusuna okutun. Birim barkodunda miktar barkoddan okunur
  (bkz. [Malzeme ve barkod](malzeme-barkod)).

## Ekran tasarımı (yönetici)

Formun sağ üstündeki **Tasarla** ile alanların yeri, sırası ve görünürlüğü değiştirilip kullanıcıya / role özel kaydedilir.
Bir kullanıcıda varsayılan düzen gelirken diğerinde ek alan / sütun gösterilebilir.

## Açık fişler

Kaydedilmemiş fişler sağ üstteki **Açık fişler** tepsisinde durur; başka ekrana geçip geri dönebilirsiniz. Yeni fişte numara
kaydederken verilir — açıp vazgeçmek numara tüketmez.
