# Malzeme ve barkod

## Barkod benzersizdir

Bir barkod **yalnız bir malzemede** kullanılabilir. Kartta aynı barkodu yazınca kaydetmeden önce kırmızı uyarı çıkar ve
hangi malzemede kayıtlı olduğu gösterilir. Veritabanı da ikinci kaydı reddeder.

## Barkod tipleri

| Tip | Kullanım |
|---|---|
| EAN-13 | Standart ürün barkodu |
| İç kod | Firmanın kendi kodu |
| QR | Karekod |
| Code128 | Alfanümerik etiket barkodu |
| Birim barkodu (miktarlı) | Tartılı / adetli ürün: miktar barkodun içinde |

## Birim barkodu

Örnek: `27000000500` → sondaki **500**, miktarı gösterir (500 adet ya da 500 gram).

Kartta birim barkodu satırına **örnek tam barkodu** yazın ve:

- **Miktar hanesi**: sondaki kaç hane miktar (örnekte 3).
- **Bölen**: okunan sayı bununla bölünür — 1 (adet), 1000 (gram → kg) gibi.
- **Kontrol hanesi**: barkodun sonunda EAN kontrol hanesi varsa işaretleyin (miktar ondan önceki hanelerdir).

Fişte `27000000500` okutulunca malzeme bulunur, miktar 500 (ya da 0,5 kg) yazılır. Aynı öneki (`27000000`) iki malzeme kullanamaz.

## Birim çevrimleri

Kartın birim sekmesinde ana birim ve çevrimler (koli = 24 adet gibi) tanımlanır; barkodlar birim başına girilir.
