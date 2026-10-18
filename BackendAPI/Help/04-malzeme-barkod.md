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

## Stok ve ambar

Stok, malzeme fişleri ve irsaliyelerden hesaplanır: devir, alış, satış iadesi, üretimden giriş **artırır**; satış, alış iadesi,
sarf ve fire **azaltır**; ambar transferi kaynak ambardan düşüp hedef ambara ekler. Sayım ve maliyet dağıtım fişleri stoğu değiştirmez.

Malzeme üzerinde sağ tık → **Ekstre → Ambar Durumu**: ambar bazında giriş, çıkış ve kalan.

### Eksi stok kontrolü

*Sistem → Parametreler* altındaki **STK_NEG_CTRL**:

| Değer | Davranış |
|---|---|
| 0 | Eksi stoğa izin verilir (varsayılan) |
| 1 | Kayıt yapılır, mesajda «eksi stok uyarısı» gösterilir |
| 2 | Çıkış ambardaki stoğu aşıyorsa kayıt **engellenir** |

## Maliyetlendirme

*Malzeme Yönetimi → İşlemler → Maliyetlendirme*: **ağırlıklı ortalama maliyet**. Girişler satır tutarıyla, satış iadesi o anki
ortalama ile stoğa girer; çıkışlar o anki ortalama ile değerlenir. **Maliyeti yeniden hesapla** (yönetici) tüm hareketleri tarih
sırasıyla yeniden hesaplar — geriye dönük girilen fişten sonra çalıştırın.

Ekranda malzeme bazında eldeki miktar, ortalama maliyet, stok değeri ve seçilen tarih aralığında satış tutarı, satış maliyeti ve
**brüt kâr**. Parametre **STK_COST_SCOPE**: 0 firma geneli, 1 ambar bazında maliyet.
