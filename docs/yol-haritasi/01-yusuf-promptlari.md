# Yol Haritası — @yussel53 (Yusuf) için Claude Code promptları

Her başlık **ayrı bir Claude Code oturumunda** kullanılmak üzere yazıldı: kod bloğunun içini olduğu gibi yapıştırın.
Sıra önemlidir; bağımlılıklar her promptun başında yazıyor. Ekip arkadaşının (@WebRoot12) işleri:
[02-ekip-webroot12-promptlari.md](02-ekip-webroot12-promptlari.md). Ortak takvim ve çakışma noktaları en altta.

**Ortak kurallar (her prompt bunlara uyar — CLAUDE.md / CONTRIBUTING.md):**
- Çalışma klasörü `D:\Dosyalar\YAZILIMLARIMIZ\Bartu_ERP`. Başta `git pull`, bekleyen ekip dalları geçici dalda birleştirilip derlenir; iş bitince `main`'e push (kural 5 istisnası).
- Şema değişikliği = yeni idempotent `SqlUpdates/NN_<modul>_<konu>.sql` (NN = main'deki en yüksek + 1). main'deki script düzenlenmez.
- Ortak dosyalar (`DynamicFormEngine.tsx`, `DocumentFormEngine.tsx`, `FieldRenderer.tsx`, `formSchemas.ts`, `modules.ts`, `formTypes.ts`, `Program.cs`, `RecordsRepository.cs`, `Create_DB.sql`) → en küçük değişiklik, dokunulanlar raporda listelenir.
- E-Devlet dosyalarına (@WebRoot12) dokunulursa raporda belirtilir.
- Numara sayaçlarına (SYS_NumberCounter) testte dokunulmaz; testte «Yeni» fiş açmak numara tüketir.
- Doğrulama: `dotnet build BackendAPI` 0 hata, `cd FrontendUI && npx tsc -b` 0 hata, değişiklik tarayıcıda denenir; SQL scripti test DB'de iki kez hatasız çalışır.
- Arayüz Türkçe; belge başlıkları her zaman yan yana 3 sütun ve kısa.

---

## Faz 0 — Güvenli ve kurulabilir hale getirme (önce bunlar)

### Y-01 · Giriş ekranı + JWT + tüm API'lerde yetki  🔴
Bağımlılık: yok. **Bitince @WebRoot12'ye haber ver (E-01 buna bağlı).**
```text
Bartu ERP'de kimlik doğrulama yok: API'ler [Authorize] olmadan açık ve kullanıcı kimliği tarayıcıdaki
localStorage 'bartu_erp_current_user_id' anahtarından (FrontendUI/src/data/permissions.ts) okunuyor.
8090 ağdan erişilebilir olduğu için bu en öncelikli iş.

Yapılacaklar:
1. Backend: SYS_Users tablosunu incele (parola alanı var mı, nasıl saklanıyor). Yoksa yeni SqlUpdates
   scripti ile PasswordHash (PBKDF2/BCrypt), PasswordChangedAt, FailedLoginCount, LockedUntil, LastLoginAt
   kolonlarını ekle. Düz metin parola asla saklanmaz.
2. POST /api/auth/login (kullanıcı adı + parola → JWT access token 8 saat + refresh token),
   POST /api/auth/refresh, POST /api/auth/logout, POST /api/auth/change-password.
   JWT imza anahtarı repoya yazılmaz: BackendAPI/Data altında yerel dosyada ya da ortam değişkeninde
   (ilk açılışta yoksa rastgele üretip kaydet).
3. Program.cs: AddAuthentication().AddJwtBearer + varsayılan politika olarak tüm controller'larda yetki
   (FallbackPolicy). Yalnızca /api/auth/login, /api/auth/refresh, /api/db-settings/status ve ilk kurulum
   (DbBootstrap) uçları [AllowAnonymous]. 5 hatalı girişte 15 dk kilit.
4. Kullanıcı kimliği her yerde token'dan alınsın: body/query'de userId alan uçlar (ör. EGovIncoming
   send/approve, Process, SqlReports menus?userId=, roles/effective/{id}) token'daki kullanıcıyı kullansın;
   gönderilen userId yok sayılsın (geriye uyum için parametre kalabilir).
5. Frontend: Giriş sayfası (kurumsal, sade), token'ın saklanması (sessionStorage + "beni hatırla" ise
   localStorage), config/api.ts içinde her isteğe Authorization başlığı, 401'de refresh dene → olmazsa
   giriş sayfasına dön. Sağ üstte kullanıcı adı + Çıkış + Parola değiştir.
   permissions.ts'deki localStorage kullanıcı seçimi kaldırılsın; mevcut kullanıcı /api/auth/me'den gelsin.
6. İlk kurulum: hiç parolası olmayan admin varsa ilk girişte parola belirleme ekranı.

Kabul: Token'sız curl ile /api/records/CustomerCard → 401. Giriş → tüm ekranlar çalışır. Yanlış parola
5 kez → kilit. Rol yetkileri (api/roles/effective) token'daki kullanıcıya göre gelir.
Raporda: dokunulan ortak dosyalar, E-Devlet uçlarında yaptığın değişiklikler (@WebRoot12 için liste).
```

### Y-02 · Firma / işyeri / yetki kodu filtrelerini sunucuya taşı
Bağımlılık: Y-01.
```text
Şu an kayıt listelerinde yetki kodu ve organizasyon yetkisi tarayıcıda süzülüyor
(ModuleListPage.tsx → filterRowsByAuthCode, filterRowsByOrgAuth; data/authCodes.ts, data/orgUnits.ts).
API doğrudan çağrılınca tüm kayıtlar geliyor.

Yapılacaklar:
1. Kullanıcının yetki kodlarını (SYS_UserAuthCode) ve org yetkilerini (SYS_UserOrgAuth: firma/işyeri/ambar)
   token'daki kullanıcıdan okuyan bir servis yaz (istek başına önbellekli).
2. RecordsRepository list/get/save/delete: tabloda AuthCode / CompanyID / WorkplaceID / WhouseID kolonu
   varsa WHERE koşulu otomatik eklensin; yetkisiz kayda get/save/delete → 403.
   RecordsRepository ortak dosya: değişikliği tek bir yardımcı metotla sınırlı tut.
3. CardStatement, Dashboard, SqlReports, CRM uçlarında da aynı filtre.
4. Admin rolü filtresiz.
5. Frontend'deki süzme şimdilik kalsın (çift güvenlik) ama veri artık sunucudan süzülmüş gelir.

Kabul: Yetki kodu 'SAT' olan kullanıcı API'den 'MUH' kodlu cariyi alamaz (403/listede yok).
Raporda: hangi uçlarda filtre eklendi, performans (500+ kayıtta liste süresi).
```

### Y-03 · Yönetici gerektirmeyen dağıtım + bekleyen SQL uyarısı + yedek
Bağımlılık: yok (Y-01 ile paralel yapılabilir).
```text
Dağıtım şu an elle: frontend dist → iis-site\wwwroot, backend dotnet publish → iis-site-staging, sonra
kullanıcı yönetici olarak deploy-swap.cmd çalıştırıyor (Windows servisi 'BartuERP',
iis-site\BackendAPI.exe --urls http://0.0.0.0:8090). Bu adım sık unutuluyor / takılıyor.

Yapılacaklar:
1. Servisin kendini güncellemesi: iis-site-staging içinde yeni BackendAPI.dll varsa ve sürüm farklıysa,
   uygulama içinden "Sistem → Güncelleme" ekranında "Yeni sürümü yükle" butonu. Önerilen yol: servis
   kurulumunda servis hesabına iis-site klasöründe yazma yetkisi + servisin kendi kendini yeniden başlatması
   (Windows Service Recovery: hata durumunda yeniden başlat → uygulama Environment.Exit(1) ile çıkar, yeni
   dosyalar bir launcher ile kopyalanır). Alternatif daha basit bir yol bulursan öner ve uygula.
   install-service.ps1 bu yetkiyi tek seferlik (yönetici) versin.
2. Uygulama açılışında SqlUpdates'te uygulanmamış script varsa üst bantta uyarı + yöneticiye
   "Şimdi uygula" butonu (DbUpdatesController zaten var).
3. "Sistem → Veritabanı Yedeği": BACKUP DATABASE ... TO DISK (yol ayarlanabilir), son 7 yedeği tut,
   her gece 02:00 hosted service (CurrencyRateJob deseni). Script uygulamadan önce otomatik yedek.
4. Sürüm bilgisi: /api/system/info'ya build zamanı + git commit; arayüzde sol altta göster.

Kabul: Yönetici hakkı olmadan, uygulama içinden güncelleme yapılabiliyor; bekleyen SQL uyarısı görünüyor;
yedek dosyası oluşuyor. deploy-swap.cmd yedek yol olarak kalır.
```

### Y-04 · GitHub Actions: derleme + tip kontrolü
Bağımlılık: yok.
```text
.github/workflows/ci.yml oluştur: push ve pull_request'te
- windows-latest veya ubuntu-latest: .NET 10 SDK → dotnet build BackendAPI -c Release (0 hata şart)
- Node 22 → FrontendUI: npm ci → npx tsc -b → npx vite build
- SqlUpdates dosya adları NN_ ile başlıyor mu, aynı numara iki kez var mı kontrolü (küçük bir script)
- main'e girmiş bir SqlUpdates dosyası PR'da değiştirilmiş/yeniden adlandırılmışsa hata (git diff --name-status)
README/CONTRIBUTING'e rozet ve "PR'ı CI geçmeden birleştirme" notu ekle.
GitHub'da branch protection için önerilen ayarları raporda yaz (ben uygularım).
Kabul: Örnek bir PR'da CI çalışıyor ve kasıtlı tip hatasında kırmızı oluyor.
```

### Y-05 · Numara şablonu: numara kayıtta alınsın
Bağımlılık: yok.
```text
Fiş numaraları (SYS_NumberTemplate / SYS_NumberCounter, NumberTemplateController) fiş "Yeni" açılırken
alınıyor; kaydedilmeyen fişler numara boşluğu bırakıyor. Mevcut boşluklar ve sayaç değerleri KALSIN,
sayaçları geri alma ya da sıfırlama.

Yapılacaklar:
1. Yeni fişte numara alanı "Otomatik (kayıtta verilecek)" olarak görünsün; önizleme için sayacı
   ARTIRMAYAN bir "sıradaki numara" ucu (peek).
2. Kayıt (RecordsController.Save ve özel kayıt uçları: e-fatura → alış faturası, CRM teklif → sipariş vb.)
   aynı transaction içinde sayacı UPDLOCK ile artırıp numarayı yazsın.
3. Kullanıcı numarayı elle yazdıysa (şablon izin veriyorsa) sayaç değişmesin, benzersizlik kontrolü yapılsın.
4. Taslak sekmeler (OpenDocumentsContext) numara tutmasın.

Kabul: 5 kez "Yeni" açıp kapatınca sayaç değişmiyor; kaydedince tek artıyor; iki kullanıcı aynı anda
kaydedince aynı numara çıkmıyor. Testte gerçek sayaçları kullanma: test şablonu oluştur, sonra sil.
Raporda: dokunulan ortak dosyalar (DocumentFormEngine, RecordsRepository).
```

---

## Faz 1 — Temel iş akışları

### Y-06 · Stok: malzeme fişleri, ambar bakiyesi, irsaliye → stok
Bağımlılık: Y-05 önerilir.
```text
Veritabanında ProductVoucher / ProductTrans (+ ProductTransCostCalc, ProductTransCalcDetail,
ProductTransTrack, ProductTransSize) tabloları var. Bunları Create_DB.sql'den incele, eksik kolon varsa
yeni SqlUpdates scripti yaz.

Yapılacaklar:
1. Malzeme Yönetimi → Hareketler: Giriş, Çıkış, Ambar Transfer, Sayım, Fire, Sarf fişleri
   (DocumentFormEngine ile; başlık 3 sütun: sol Fiş No/Tarih/Durum/Yetki Kodu, orta Açıklama/Fiş İşlem
   Kodu, sağ Firma/İşyeri/Ambar/Hedef Ambar). Satırda barkod okutma ve Excel yapıştırma zaten var.
2. Satış/satınalma irsaliyesi kaydedilince ProductTrans hareketi oluşsun (iptal/silmede geri alınsın).
   Faturadan doğrudan stok (irsaliyesiz fatura) seçeneği: fatura tipine göre ayar.
3. Ambar bakiyesi: malzeme × ambar × (varyant) miktar; malzeme listesine "Eldeki" ve "Ambar dağılımı",
   malzeme kartı sağ tık → Ekstre zaten var (CardStatementRepository product) → ambar durumu bölümü buna bağlansın.
4. Negatif stok kontrolü: ayar (izin ver / uyar / engelle), ambar bazında.
5. Sayım fişi: sayılan − sistem farkı ile otomatik giriş/çıkış önerisi.

Kabul: Giriş 10 → çıkış 3 → transfer 2 → bakiyeler doğru; irsaliye kaydı stok düşüyor; silince geri geliyor.
```

### Y-07 · Maliyet: ağırlıklı ortalama
Bağımlılık: Y-06.
```text
ProductTransCostCalc tablosunu incele. Ağırlıklı ortalama maliyet:
- Her giriş (alış irsaliyesi/faturası, giriş fişi) birim maliyetle; çıkışlar o anki ortalama ile değerlenir.
- Geriye dönük tarihli hareket girilince o tarihten sonrası yeniden hesaplanır ("Maliyet Yeniden Hesapla"
  ekranı + gece işi). Hesap ambar bazında veya firma bazında (ayar).
- Satış faturası satırında brüt kâr (satış − maliyet) raporu.
Kabul: 3 farklı fiyatla giriş + 2 çıkış örneğinde elle hesapla aynı sonuç. Hesaplama 10.000 harekette < 30 sn.
```

### Y-08 · Kasa fişleri ve kasa hareketleri
Bağımlılık: yok.
```text
SafeCard var ama kasa hareket tablosu yok (CardStatementRepository 'safe' bölümü bunu söylüyor).
1. SqlUpdates: SafeVoucher (başlık) + SafeTrans (satır: SafeCardID, CustomerID, AccountID, Amount,
   CurrencyID, Rate, Description, TransType). Idempotent.
2. Fiş türleri: Tahsilat (cariden), Tediye (cariye), Kasa→Banka virman, Banka→Kasa, Masraf, Kasa→Kasa.
3. Kayıtta cari hareketi (CustomerTrans) ve muhasebe fişi (Y-09 hazır değilse sonra bağlanır).
4. Kasa kartı ekstresi ve kasa bakiye listesi (cari listesindeki gibi bakiye kolonu).
5. Döviz kasası: kur SYS_CurrencyRate'den (TCMB) otomatik gelsin.
Kabul: Tahsilat → cari bakiyesi düşer, kasa artar; ekstrede görünür.
```

### Y-09 · Fatura → otomatik muhasebe fişi
Bağımlılık: Y-06 (stoklu faturalar için), **@WebRoot12 ile koordinasyon** (gelen e-fatura → alış faturası
kaydı aynı kaydetme yolunu kullanıyor; E-03 ile çakışmamalı).
```text
AccountLink / AccountLinkDetail / AccountLinkTrans (hesap bağlantı kodları) ve AccountVoucher /
AccountTrans tabloları var.
1. Satış/alış/iade faturası kaydında (ve güncellemede) bağlı muhasebe fişi oluşsun/yenilensin:
   cari hesabı (120/320), satış/alış hesabı (600/153/770…) malzeme veya hizmet kartındaki bağlantıdan,
   KDV (391/191), iskonto, tevkifat, ÖTV satırları.
2. Ayar: anında / toplu ("Muhasebeleştir" ekranı tarih aralığıyla). Muhasebeleşmiş faturada değişiklik
   uyarısı.
3. Banka, kasa (Y-08), cari fişleri için aynı mekanizma.
4. Yevmiye numaralandırma zaten var (JournalNumberingController) → uyumlu olsun.
Kabul: Örnek faturada borç = alacak, hesaplar bağlantı kartına göre. Fatura silinince fiş de silinir.
Raporda: e-fatura kaydetme yoluna dokunduysan @WebRoot12 için not.
```

### Y-10 · Tahsilat/ödeme eşleştirme ve vade yaşlandırma
Bağımlılık: Y-08.
```text
PaymentTrans, PaymentClosedTrans, VoucherPaymentLine, PaidPlanCard/Line tabloları var.
1. Fatura vadeleri (ödeme planından) → açık kalemler; tahsilat/ödeme geldiğinde FIFO veya elle kapama.
2. Cari Kartlar listesine (ModuleListPage → api/card-statement/customer-summaries) "Vadesi Geçen" ve
   "Ort. Gecikme (gün)" kolonları.
3. Cari yaşlandırma raporu: 0-30 / 31-60 / 61-90 / 90+ (tarih parametreli), Excel.
4. Cari ekstresine "kapanmış / açık" işareti.
Kabul: Fatura 1000 (30 gün vade) + 400 tahsilat → açık 600, vadesi geçince "Vadesi Geçen 600".
```

### Y-11 · Çek / senet portföy hareketleri
Bağımlılık: Y-08, Y-09 önerilir.
```text
BoundCard / BoundTrans var. Portföy akışı: müşteriden alınan çek/senet → portföyde → cirolu verildi /
bankaya tahsile / teminata → tahsil edildi / karşılıksız / iade. Her durum değişikliği bir bordro (fiş)
ile; cari ve banka hareketleri ve muhasebe (101/121/103/321) otomatik. Vade takvimi ve "bu hafta vadesi
gelenler" listesi; çek kartı sağ tık → hareket geçmişi.
Kabul: Alınan çek ciro edilince alan carinin bakiyesi ve portföy listesi doğru.
```

### Y-12 · Risk limiti kontrolü
Bağımlılık: Y-10.
```text
RiskGroup / RiskGroupDetail (ModuleID, Formula) var. Cari risk = açık bakiye + açık sipariş + portföydeki
müşteri çekleri (ayar). Sipariş/irsaliye/fatura kaydında limit aşılırsa: uyar / onaya düşür (mevcut
süreç/onay altyapısı) / engelle. Cari listesinde "Risk %" kolonu. Formül alanı için güvenli bir ifade
değerlendirici (SQL enjeksiyonu yok).
Kabul: Limiti 1000 olan cariye 1200'lük sipariş → ayara göre uyarı/engel.
```

---

## Faz 3 — Raporlama ve yönetim

### Y-13 · Standart raporlar + Rapor Üretici kayıtlı rapor
Bağımlılık: Y-06, Y-09, Y-10.
```text
SqlReports altyapısı (SYS_SqlReport, SqlReportsController, SqlReportsPage) ve kart ekstrelerindeki
rapor görünümü var. Ekle:
1. Mizan (hesap planı seviyeli, tarih aralığı, açılış dahil/hariç), Muavin defter.
2. Cari yaşlandırma (Y-10), stok yaşlandırma (son giriş tarihine göre), stok değer raporu (Y-07).
3. Satış analizi: dönem / müşteri / malzeme / temsilci kırılımı, grafik.
4. Rapor Üretici: parametreli raporu kaydet, kullanıcı/rol bazında paylaş, Excel/PDF, e-posta ile
   zamanlanmış gönderim (CrmMailService altyapısı).
KDV ve Ba/Bs raporları @WebRoot12'de (E-08) — dokunma.
Kabul: Mizan borç = alacak; satış analizi fatura toplamlarıyla tutar.
```

### Y-14 · Ana sayfa / yönetim paneli
Bağımlılık: Y-10, Y-12.
```text
DashboardPage / SYS_DashboardTab altyapısı var. Kart ve grafikler: bugün/bu hafta vadesi gelen tahsilat
ve ödemeler, vadesi geçenler, kritik stok (min seviye altı), onay bekleyen belgelerim (süreç + e-fatura),
günlük satış, döviz pozisyonu (TCMB kuruyla), banka/kasa bakiyeleri. Kullanıcı kart ekleyip
kaldırabilsin; yetkiye göre süzülsün (Y-02).
```

---

## Faz 4 — Ürünleştirme

### Y-15 · Değişiklik geçmişi (audit) + sunucu tarafı sayfalama
Bağımlılık: Y-01.
```text
1. SYS_AuditLog (tablo, kayıt ID, işlem, kullanıcı, zaman, eski/yeni JSON fark). RecordsRepository
   save/delete ve özel kayıt uçlarında tek noktadan yaz. Kart/fiş sağ tık → "Değişiklik Geçmişi".
2. Listeler 500 kayıtla sınırlı (ModuleListPage take: 500): sunucu tarafı sayfalama + başlık
   filtrelerinin (GridSortFilter) sunucuya gönderilmesi + sıralama. 50.000 carili test verisiyle ölç.
```

### Y-16 · Logo / Mikro'dan aktarım + dönem kapanış/açılış
Bağımlılık: Y-06, Y-09.
```text
ImportController / DataImportPage / SpreadsheetReader var.
1. Logo Tiger/Go veritabanından (LG_XXX_CLCARD, LG_XXX_ITEMS, LG_XXX_YY_CLFLINE…) doğrudan SQL ile
   cari, malzeme, birim, barkod, açılış bakiyeleri aktarımı; eşleştirme önizlemesi; tekrar
   çalıştırılabilir (kod eşleşirse güncelle). Bağlantı bilgisi repoya yazılmaz.
   (Referans: D:\Dosyalar\YAZILIMLARIMIZ\eftaura_elogo_kontrol\LogoSqlChecker.cs)
2. Dönem kapanış: gelir-gider kapanış fişi, açılış fişi, stok devri, cari devri (yeni dönem DB'si veya
   aynı DB'de dönem kolonu — öneri sun, kararı bana sor).
```

---

## Ortak takvim ve çakışma noktaları

| Hafta | Yusuf (bu dosya) | @WebRoot12 |
|---|---|---|
| 1 | Y-01 giriş/JWT, Y-04 CI | E-02 otomatik çekme, E-06 alias senkron |
| 2 | Y-02 sunucu yetkisi, Y-03 dağıtım | **E-01 auth uyumu (Y-01 sonrası)**, E-03 giden e-fatura başlangıç |
| 3–4 | Y-05 numara, Y-06 stok | E-03 giden e-fatura |
| 5–6 | Y-07 maliyet, Y-08 kasa | E-04 e-Arşiv, E-05 e-İrsaliye |
| 7–8 | Y-09 muhasebe entegrasyonu, Y-10 eşleştirme | E-08 KDV / Ba-Bs (Y-09'a bağlı) |
| 9+ | Y-11 … Y-16 | E-07 e-Defter, E-09 izleme ekranı |

**Çakışma noktaları (iki taraf da dikkat):**
- **Y-01 ↔ E-01:** userId artık token'dan; E-Devlet uçları ve `EGovIncoming*` buna uyarlanmalı.
- **Y-05 / Y-09 ↔ E-03:** fatura numarası ve muhasebe fişi, gelen/giden e-fatura kaydında da çalışmalı;
  `EGovIncomingRepository.SaveAsync` ve fatura kaydetme yolu iki tarafın ortak noktası → önce konuşun.
- **Y-06 ↔ E-05:** e-İrsaliye kaydı stok hareketi üretir; stok servisi Y-06'da yazılır, E-05 onu çağırır.
- **SQL numaraları:** iki taraf paralel script açınca numara çakışabilir → birleştirmeden hemen önce
  main'i çek, numara alınmışsa birleştirilmemiş taraf bir sonrakine taşır (CONTRIBUTING §4).
