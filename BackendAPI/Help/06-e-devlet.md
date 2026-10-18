# e-Devlet (e-Fatura, e-Arşiv, e-İrsaliye)

## Belge çekme (e-Logo)

*E-Devlet → İşlemler → e-Logo Belge Çekme*: firma, tarih aralığı (en fazla 92 gün), yön (gelen / giden) ve belge türü seçip
**e-Logo'dan çek**. Belgeler PDF ve UBL (XML) ile birlikte kaydedilir; gelen faturalar istenirse onay kuyruğuna düşer.

Firma kartındaki entegratör bilgileri (kullanıcı / şifre) kullanılır; liste ve PDF için eLogo PostBox servisi (pb.elogo.com.tr) çağrılır.

## Gelen e-fatura

*E-Fatura → Gelen*: kutular — Gelen, Onay Bekleyenler, Onaylananlar, Kaydedilenler.

1. **Onaya Gönder**: açıklama ve onay grubu seçilir.
2. **Onayla / Reddet**: onay grubundaki kişiler.
3. **ERP'ye Kaydet**: alış / iade / hizmet / fiyat farkı faturası olarak. Satırlar malzemeye eşlenir; eşleme malzeme kartındaki
   cari bağlantısına yazılır, sonraki faturalarda kendiliğinden gelir. Toplama dahil olmayan bilgi satırları dışarıda kalır.

## e-Faturadan cari kartı

Gelen listesinde satırdaki 👤+ düğmesi (ya da ERP'ye kaydet ekranında «e-Faturadan cari kartı aç»):

- Unvan, VKN/TCKN, vergi dairesi, adres, telefon / e-posta faturanın UBL'inden; **posta kutusu (PK)** ve **gönderici (GB)**
  etiketleri ile e-Fatura geçiş tarihi GİB listesinden okunur.
- **Cari yoksa**: bilgiler yeni cari kart formuna yerleştirilir — kontrol edip **kaydetmek size kalır**.
- **Cari varsa**: «**Kayıt güncellenecek**» uyarısı ve yapılacaklar listesi gelir. Yalnız **boş alanlar** doldurulur; dolu alanlar,
  mevcut adresler ve ilgili kişiler **değiştirilmez**, farklı adres / kişi **yeni satır** olarak eklenir. Kart «Değiştir» modunda açılır.

## Belge kuralları

Giden belgeler gönderilmeden önce uygulanan değişiklikler — bkz. [Belge kuralları](belge-kurallari).

## Tasarım şablonları

*E-Devlet → Tanımlar → Tasarım Şablonları*: XSLT tasarımları ve hangi belgede hangi tasarımın kullanılacağı (belge türü, cari…).
Önizleme örnek belge üzerinde yapılır.
