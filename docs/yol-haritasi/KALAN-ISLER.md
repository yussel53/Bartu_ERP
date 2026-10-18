# Kalan işler

Yol haritasından **henüz bitmemiş** işler. Biten iş bu listeden silinir (ayrıntı: commit geçmişi ve
[01-yusuf-promptlari.md](01-yusuf-promptlari.md) / [02-ekip-webroot12-promptlari.md](02-ekip-webroot12-promptlari.md)).
Son güncelleme: 18.10.2026.

## Yusuf (Claude oturumu)

Bitenler: Y-01 … Y-12 (Y-09: fatura / kasa fişi → muhasebe fişi, *Genel Muhasebe → İşlemler → Muhasebeleştirme* —
kullanmadan önce hesap kartları ve muhasebe bağlantıları girilmeli; Y-10: *Finans → Raporlar → Cari Yaşlandırma*, FIFO kapama;
Y-11: *Finans → Hareketler → Çek / Senet Portföyü* — bordrolar, konum, vade takvimi;
Y-12: risk grubu / cari limiti, satış belgesinde uyar / yönetici onayı / engelle).

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
- [ ] **E-07 e-Defter** (Y-09 bitti, başlanabilir).
- [ ] **E-08 KDV beyan raporu ve Ba / Bs** (Y-09 bitti).
- [ ] **E-09 e-Belge hata izleme** — konsol bitti; gönderim hata günlüğü ve «yeniden dene» E-03 ile.

## Bekleyen küçük işler

- [ ] Tanıtım sitesi (`website/index.html`): iletişim e-posta / telefonu gerçek bilgilerle değiştirilmeli.
- [ ] Canlıda «Şimdi uygula» ile bekleyen SQL scriptleri (81–87) kayda geçirilmeli (81–82 veritabanında var, 83–87 yeni).
