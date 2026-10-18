# Kalan işler

Yol haritasından **henüz bitmemiş** işler. Biten iş bu listeden silinir (ayrıntı: commit geçmişi ve
[01-yusuf-promptlari.md](01-yusuf-promptlari.md) / [02-ekip-webroot12-promptlari.md](02-ekip-webroot12-promptlari.md)).
Son güncelleme: 18.10.2026.

## Yusuf (Claude oturumu)

- [ ] **Y-09 Fatura → otomatik muhasebe fişi** — satış / alış / iade faturasında cari (120/320), satış-alış (600/153),
  KDV (391/191) satırları; hesaplar AccountLinkDetail'den (kart, yoksa öndeğer −1). Kasa / banka / cari fişleri için aynı.
  *Not: hesap planı (AccountCard) şu an boş — kullanmadan önce muhasebe hesapları girilmeli.*
- [ ] **Y-10 Tahsilat / ödeme eşleştirme ve vade yaşlandırma** — açık kalemler, FIFO kapama, cari listesinde «Vadesi geçen»,
  yaşlandırma raporu (0-30 / 31-60 / 61-90 / 90+). Sonra e-belge kuralına `{Cari.GecikenVade}`.
- [ ] **Y-11 Çek / senet portföy hareketleri** — portföy → ciro / tahsile / teminat → tahsil / karşılıksız; bordrolar,
  vade takvimi.
- [ ] **Y-12 Risk limiti** — açık bakiye + açık sipariş + portföy; sipariş / irsaliye / faturada uyar / onaya düşür / engelle.
- [ ] **Y-13 Standart raporlar** — mizan, muavin, cari yaşlandırma, stok yaşlandırma, satış analizi; rapor üreticide
  kayıtlı parametreli rapor, zamanlanmış e-posta.
- [ ] **Y-14 Yönetim paneli** — vadesi gelen / geçen, kritik stok, onay bekleyenler, günlük satış, döviz pozisyonu.
- [ ] **Y-15 Değişiklik geçmişi + sunucu tarafı sayfalama** — SYS_AuditLog, kart / fiş sağ tık «Değişiklik Geçmişi»;
  listelerde 500 kayıt sınırı yerine sunucuda sayfalama / filtre.
- [ ] **Y-16 Logo / Mikro aktarımı + dönem kapanış / açılış**.

## @WebRoot12 (E-Devlet)

Bitenler: E-01 (oturum token'ı), E-02 (otomatik çekme), E-05 gelen e-İrsaliye, E-06 (GİB mükellef senkronu),
e-Belge Konsolu.

- [ ] **E-03 Giden e-fatura** — UBL üret → `EGovRuleEngine.ApplyForSendAsync` (belge kuralları) → XSLT → eLogo gönderim → durum /
  uygulama yanıtı.
- [ ] **E-04 e-Arşiv** (E-03'e bağlı).
- [ ] **E-05 giden e-İrsaliye** (gelen kısmı bitti).
- [ ] **E-07 e-Defter** (Y-09'a bağlı).
- [ ] **E-08 KDV beyan raporu ve Ba / Bs** (Y-09 önerilir).
- [ ] **E-09 e-Belge hata izleme** — konsol bitti; gönderim hata günlüğü ve «yeniden dene» E-03 ile.

## Bekleyen küçük işler

- [ ] Tanıtım sitesi (`website/index.html`): iletişim e-posta / telefonu gerçek bilgilerle değiştirilmeli.
- [ ] Canlıda «Şimdi uygula» ile bekleyen SQL scriptleri (81–84) kayda geçirilmeli (81–82 veritabanında var, 83–84 yeni).
