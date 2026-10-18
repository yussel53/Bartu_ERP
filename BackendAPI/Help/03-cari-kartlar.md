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
| Açık sip. | Açık / kısmi siparişler |
| İl / İlçe, Telefon | Varsayılan adres ve ilk ilgili kişi |
| Risk grubu | Kartta seçili risk grubu |

## Ekstre ve hareketler

Cari üzerinde sağ tık:

- **Ekstre**: rapor görünümünde tarih aralıklı ekstre — devir, borç, alacak, kümülatif bakiye, isteğe bağlı grafik; Excel / yazdır.
- **Hareketler**: düz hareket listesi.
- **Siparişler, Malzeme Hareketleri, Ödeme Planı, Çek / Senet** ve CRM (Fırsatlar, Teklifler, Görüşmeler, Yazışmalar) — **Müşteri 360°**.

Aynı sağ tık menüsü malzeme, banka, kasa, muhasebe ve çek/senet kartlarında da vardır.

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

## e-Faturadan cari

Gelen e-faturadan cari açmak için bkz. [e-Devlet](e-devlet#e-faturadan-cari-karti).
