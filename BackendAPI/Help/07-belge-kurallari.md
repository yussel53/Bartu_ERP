# Belge kuralları

*E-Devlet → Tanımlar → Belge Kuralları*. Giden e-Fatura / e-Arşiv / e-İrsaliye gönderilmeden önce belgeye uygulanan
değişiklikler — kod yazmadan: **şablon + parametre + koşul + öncelik**. Kaydetme / silme yöneticidir; deneme herkese açıktır.

## Kural eklemek

- **Hazır kurallardan ekle**: sık kullanılanlar hazır (cari bakiyesi ek alanı, sipariş / irsaliye no, döviz kuru notu,
  «Yalnız … TL» kaldır, barkod satıra, cariye özel malzeme kodu, koli → adet, tek satır, iade referansı, plaka…).
- **Yeni kural**: şablon seçip parametreleri doldurun.

## Şablonlar

| Şablon | Ne yapar |
|---|---|
| Ek alan ekle | Belgeye ek alan yazar; tasarım bu alanı adıyla okur (BAKIYE, SIPARISNO…) |
| Belge notu ekle / kaldır | Not ekler ya da desene uyan notu siler |
| Satır alanını doldur | Malzeme adı, açıklama, satır notu, kodlar: değiştir, sonuna / başına ekle, boşsa doldur |
| Cariye özel malzeme kodu / adı | Malzeme kartındaki cari bağlantısından müşterinin kodu / adı |
| Birim çevrimi | Miktar × katsayı, fiyat ÷ katsayı, yeni birim (tutar değişmez) |
| Satırları tek satırda topla | KDV oranı başına tek satır; toplamlar değişmez |
| Sıfır tutarlı satırları gönderme | Karma koli içeriği, bilgi satırları |
| İade faturası referansı | İADE tipinde referans yoksa ekler |
| Alıcı unvanını düzenle | Unvana ek satır |
| e-İrsaliye plaka / şoför | Sevkiyat bilgisi |
| SQL sonucu → ek alan (yönetici) | Tek değer döndüren sorgu; salt-okunur |
| Gönderim öncesi kayıt güncelleme (yönetici) | ERP kaydında düzeltme (önizlemede geri alınır) |

## Yer tutucular

Değer alanlarına `{Cari.BakiyeBA}`, `{Siparis.No}`, `{Satir.Barkod}` gibi yer tutucular yazılır; düzenleyicide düğmelere
tıklayınca son seçtiğiniz alana eklenir. Metindeki yer tutucuların hepsi boşsa değer boş sayılır — «Barkod: {Satir.Barkod}»
barkodu olmayan satıra yazılmaz.

## Koşullar

Boş bırakılırsa kural her belgede çalışır. Doldurulursa: **cari kodu** (`120.*` joker), **VKN**, **senaryo**
(`TICARIFATURA, IHRACAT`), **fatura tipi** (`SATIS, IADE`), **para birimi** (`USD`, ya da `!TRY` = TL dışı).

## Denemek

Sayfanın altında **Dene**: örnek belge ya da e-belge numarası seçip **Bu kuralı dene** / **Tüm etkin kuralları dene**.
Her kuralın yaptığı değişiklikler listelenir, önceki / sonraki XML görülebilir. Deneme hiçbir şeyi kaydetmez.

## Tasarımda ek alanı göstermek

```xml
<xsl:for-each select="//cac:AdditionalDocumentReference[cbc:DocumentType='BAKIYE']">
  <xsl:value-of select="cbc:ID"/>
</xsl:for-each>
```
