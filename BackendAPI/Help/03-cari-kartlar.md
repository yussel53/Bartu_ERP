# Cari kartlar ve müşteriler

## Cari ve müşteri farkı

Aynı tabloda tutulur, tipi ile ayrılır:

- **Müşteri (aday)**: CRM'de takip edilen, henüz alış-veriş yapılmamış firma. *Finans → Ana Kayıtlar → Müşteri Kartları*.
- **Cari**: hesap hareketi olan firma. *Finans → Ana Kayıtlar → Cari Kartlar*.

Müşteri, satış yapılınca kendiliğinden cariye dönüşür; ya da listede sağ tık → **Cariye Dönüştür**.
Her cari aynı zamanda müşteridir, her müşteri cari değildir.

## Cari listesi

Listede kod, unvan, VKN ve tür yanında:

| Sütun | Açıklama |
|---|---|
| Borç / Alacak | Cari fişleri + faturalar + banka hareketlerinin toplamı (ekstre ile aynı) |
| Bakiye, B/A | Borç − alacak; **B** borçlu (kırmızı), **A** alacaklı (yeşil) |
| Son hareket | En son hareket tarihi |
| Vadesi geçen | Vadesi geçmiş açık borç ve en eski gecikme (gün) — bkz. *Vade yaşlandırma* |
| Açık sip. | Açık / kısmi siparişler |
| İl / İlçe, Telefon | Varsayılan adres ve ilk ilgili kişi |
| Risk grubu | Kartta seçili risk grubu |

## Ekstre ve hareketler

Cari üzerinde sağ tık:

- **Ekstre**: rapor görünümünde tarih aralıklı ekstre — devir, borç, alacak, kümülatif bakiye, isteğe bağlı grafik; Excel / yazdır.
- **Hareketler**: düz hareket listesi.
- **Siparişler, Malzeme Hareketleri, Ödeme Planı, Çek / Senet** ve CRM (Fırsatlar, Teklifler, Görüşmeler, Yazışmalar) — **Müşteri 360°**.

Aynı sağ tık menüsü malzeme, banka, kasa, muhasebe ve çek/senet kartlarında da vardır.

## Vade yaşlandırma

*Finans → Raporlar → Cari Yaşlandırma*. Her carinin açık kalemleri vadeye göre: **vadesi gelmemiş, 1-30, 31-60, 61-90, 90+ gün**;
vadesi geçen toplam, en eski ve ortalama gecikme. Satıra tıklayınca açık kalemler (belge, vade, kalan tutar, gün) açılır.
*Tarih itibarıyla* ile geçmiş bir güne göre bakılabilir.

- **Kapama FIFO'dur**: tahsilatlar (kasa, banka, cari fişi, iade faturası) en eski vadeli borçtan başlayarak düşülür; elle eşleştirme gerekmez.
  Alacaklı caride (ör. tedarikçi) aynı hesap ters yönde yapılır, tutarlar eksi görünür.
- **Vade**: hareketin vadesi; faturada ödeme planı (taksitli planda her taksit ayrı kalem, yoksa plan gün sayısı); hiçbiri yoksa belge tarihi.
- e-Belge kurallarında `{Cari.GecikenVade}` (vadesi geçmiş borç) ve `{Cari.GecikenGun}` kullanılabilir.

## Kart

- **Adresler**: listede seçip sağda düzenleyin. Tip / kod / ad tek satırda; ülke / il / ilçe / mahalle tek satırda.
  e-Fatura kutusu: posta kutusu (PK), gönderici birim (GB) etiketleri, e-Fatura geçiş tarihi. **e-Fatura Mükellef Kontrol**
  ile etiketler GİB listesinden ya da entegratörden doldurulur.
- **Yetkililer, Muhasebe hesapları, Özel kodlar**: satır satır eklenir.

## Kasa fişleri

*Finans → Hareketler → Kasa Fişleri*. Fiş tipleri:

| Tip | Kasa | Karşı taraf |
|---|---|---|
| Tahsilat (cariden) | Giriş | Cari **alacak** |
| Tediye (cariye) | Çıkış | Cari **borç** |
| Kasadan bankaya | Çıkış | Banka hesabı giriş |
| Bankadan kasaya | Giriş | Banka hesabı çıkış |
| Masraf | Çıkış | — |
| Kasa → Kasa virman | Çıkış | Hedef kasa giriş |

Bir fişte birden çok satır olabilir (ör. aynı gün birkaç cariden tahsilat). Tahsilat ve tediye cari ekstresinde ve bakiyesinde,
kasa ↔ banka transferleri banka ekstresinde görünür. Kasa kartında sağ tık → **Ekstre**.

## Risk limiti

*Finans → Ana Kayıtlar → Risk Grupları*: **Risk Limiti**, **Limit Aşılınca** (yalnız izle · uyar · yönetici onayı · engelle) ve riske
nelerin gireceği (açık siparişler, faturalanmamış irsaliyeler, portföydeki çek / senetler). Cari kartta **Risk Grubu** seçilir;
cariye özel **Risk Limiti** yazılırsa grubun limiti yerine o geçer.

**Risk** = cari bakiye + açık satış siparişleri + (faturalanmamış satış irsaliyeleri) + portföy / ciro / tahsil / teminattaki müşteri çek-senetleri.
Satış siparişi, satış irsaliyesi ve satış faturası kaydedilirken belge tutarı eklenir (düzenlenen belgenin eski tutarı düşülür);
limit aşılırsa:

- **Uyar**: kayıt yapılır, mesajda aşım yazar.
- **Yönetici onayı**: yönetici «Kaydedilsin mi?» sorusunu onaylarsa kayıt yapılır; diğer kullanıcılar kaydedemez.
- **Engelle**: kayıt yapılmaz.

Düzenlenen belgenin tutarı artmıyorsa kontrol yapılmaz.

## Çek / senet portföyü

*Finans → Hareketler → Çek / Senet Portföyü*. Her çek / senedin bir **konumu** vardır; konum yalnız bordroyla değişir.

| Bordro | Kabul edilen konum | Yeni konum | Etkisi |
|---|---|---|---|
| Müşteriden giriş | — (yeni belge) | Portföyde | Cari **alacak** |
| Cariye ciro | Portföyde | Ciro edildi | Ciro edilen cari **borç** |
| Bankaya tahsile / teminata | Portföyde | Tahsilde / Teminatta | — |
| Bankadan tahsil | Tahsilde, Teminatta | Tahsil edildi | Banka hesabı giriş |
| Elden / kasaya tahsil | Portföyde | Tahsil edildi | Kasa giriş |
| Portföye geri alma | Tahsilde, Teminatta | Portföyde | — |
| Müşteriye iade | Portföyde | İade edildi | Cari **borç** |
| Karşılıksız | Portföyde, Ciro, Tahsilde, Teminatta | Karşılıksız | Belgeyi veren cari **borç**; ciro edilmişse ciro edilen cari **alacak** |
| Borç çeki / senedi çıkışı | — (kendi belgemiz) | Verildi | Cari **borç** |
| Borç çeki / senedi ödemesi | Verildi | Ödendi | Banka hesabı çıkış |

- **Portföy** sekmesi: konum düğmeleriyle süzün, belgeleri işaretleyin; yalnız seçili belgelere uygun bordrolar görünür. Tarih, bordro no,
  karşı taraf (cari / banka hesabı / kasa) seçip **Bordroyu kaydet**.
- **Yeni giriş**: müşteriden alınan ya da kendi verdiğimiz çek / senetler satır satır (tür, seri no, vade, tutar, keşideci, banka, şube, hesap no).
- **Bordrolar**: silinen bordrodaki belgeler önceki konumlarına döner; belge sonraki bir bordroda işlem görmüşse önce o bordro silinmelidir.
- **Vade takvimi**: portföydeki, tahsildeki, teminattaki ve verilen belgeler ay ay — tahsil edilecek / ödenecek toplamlar. Vadesi geçenler kırmızı.

## e-Faturadan cari

Gelen e-faturadan cari açmak için bkz. [e-Devlet](e-devlet#e-faturadan-cari-karti).
