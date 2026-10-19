# Kalan işler

Yol haritasından **henüz bitmemiş** işler. Biten iş bu listeden silinir (ayrıntı: commit geçmişi ve
[01-yusuf-promptlari.md](01-yusuf-promptlari.md) / [02-ekip-webroot12-promptlari.md](02-ekip-webroot12-promptlari.md)).
Son güncelleme: 18.10.2026.

## Yusuf (Claude oturumu)

Bitenler: Y-01 … Y-15 (Y-09: fatura / kasa fişi → muhasebe fişi, *Genel Muhasebe → İşlemler → Muhasebeleştirme* —
kullanmadan önce hesap kartları ve muhasebe bağlantıları girilmeli; Y-10: *Finans → Raporlar → Cari Yaşlandırma*, FIFO kapama;
Y-11: *Finans → Hareketler → Çek / Senet Portföyü* — bordrolar, konum, vade takvimi;
Y-12: risk grubu / cari limiti, satış belgesinde uyar / yönetici onayı / engelle;
Y-13: Mizan, Muavin, Stok Yaşlandırma, Satış Analizi standart raporları + zamanlanmış Excel e-postası;
Y-14: Genel Durum yönetim paneli — vadeler, satış, çek / senet, kritik stok, onaylar, döviz;
Y-15: SYS_AuditLog + sağ tık «Değişiklik Geçmişi», listelerde sunucu sayfalama / arama).

- [ ] **Y-17 Bütçe (sıradaki iş)** — muhasebe hesabı / masraf merkezi / cari grubu bazında aylık bütçe; bütçe-gerçekleşen raporu;
  fatura ve sipariş girerken ilgili bütçenin kullanım çubuğu (kalan / aşım uyarısı); yönetim panelinde sapma.
- [ ] **Y-16 Logo / Mikro aktarımı + dönem kapanış / açılış** — servis `wip/y16-logo-mikro-aktarim` dalında (test edilmedi);
  kalan: önizleme testi, ekran, dönem kilidi (bu tarihe kadar fiş değişmez), gelir tablosu kapanış fişi.

## Planlanan (sonra yapılacak — şimdilik yapılmıyor)

- [ ] **P-01 E-posta altyapısı** — ortak gönderim kuyruğu ve şablonlar; cari mutabakat e-postası (bakiye onayı bağlantıyla döner),
  vadesi geçen tahsilat hatırlatması (`{Cari.GecikenVade}`), gönderim günlüğü. Zamanlanmış rapor SMTP altyapısı kullanılır.
- [ ] **P-02 Kampanya modülü** — tarih aralığı, cari / cari grubu, malzeme / grup koşulu; iskonto, X al Y öde, hediye ürün;
  sipariş ve faturada otomatik uygulama, kampanya raporu.
- [ ] **P-03 Kur farkı faturası** — dövizli carilerde ödeme günü kuru ile fatura kuru farkı; kur farkı / vade farkı faturası önerisi.
- [ ] **P-04 Doküman ekleri** — her kart ve fişe PDF / resim / dosya ekleme (sözleşme, fatura görüntüsü), önizleme, yetki.
- [ ] **P-05 Farklı veritabanı desteği (PostgreSQL vb.)** — veri erişimini SQL Server'a özgü sözdiziminden ayırma
  (TOP / OFFSET, ISNULL, IDENTITY, sys.* sorguları), SqlUpdates için veritabanı türüne göre betik, bağlantı ayarında sağlayıcı seçimi.

## @WebRoot12 (E-Devlet)

Bitenler: E-01 (oturum token'ı), E-02 (otomatik çekme), E-05 gelen e-İrsaliye, E-06 (GİB mükellef senkronu),
e-Belge Konsolu, E-08 (KDV özeti ve Ba / Bs), gelen e-faturada otomatik muhasebe (Y-09) + yetki kapsamı (Y-02).

- [ ] **E-03 Giden e-fatura** — UBL üret → `EGovRuleEngine.ApplyForSendAsync` (belge kuralları) → XSLT → eLogo gönderim → durum /
  uygulama yanıtı.
- [ ] **E-04 e-Arşiv** (E-03'e bağlı).
- [ ] **E-05 giden e-İrsaliye** (gelen kısmı bitti).
- [ ] **E-07 e-Defter** (Y-09 bitti, başlanabilir).
- [ ] **E-09 e-Belge hata izleme** — konsol bitti; gönderim hata günlüğü ve «yeniden dene» E-03 ile.

## Bekleyen küçük işler

- [ ] Tanıtım sitesi (`website/index.html`): iletişim e-posta / telefonu gerçek bilgilerle değiştirilmeli.
- [ ] Canlıda «Şimdi uygula» ile bekleyen SQL scriptleri (81–91) kayda geçirilmeli (81–82 veritabanında var, 83–91 yeni).
