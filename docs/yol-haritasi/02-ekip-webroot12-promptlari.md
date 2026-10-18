# Yol Haritası — @WebRoot12 (E-Devlet modülü) için Claude Code promptları

Her başlık **ayrı bir Claude Code oturumunda** kullanılmak üzere yazıldı: kod bloğunun içini olduğu gibi yapıştırın.
Yusuf'un işleri: [01-yusuf-promptlari.md](01-yusuf-promptlari.md) — ortak takvim ve çakışma noktaları o dosyanın sonunda.

**Ortak kurallar (her prompt bunlara uyar — CLAUDE.md / CONTRIBUTING.md):**
- İş `feature/egov-<konu>` veya `fix/egov-<konu>` dalında yapılır, PR açılır; `main`'e doğrudan push yok.
  Her gün başta `git fetch` + `git rebase origin/main`.
- Şema değişikliği = yeni idempotent `SqlUpdates/NN_egov_<konu>.sql` (NN = main'deki en yüksek + 1;
  birleştirmeden hemen önce kontrol et, alınmışsa bir sonrakine taşı). **main'e girmiş script düzenlenmez —
  yorum satırı dahil** (75 numarada bu oldu; düzeltme için yeni script).
- Ortak dosyalar (`DynamicFormEngine.tsx`, `DocumentFormEngine.tsx`, `FieldRenderer.tsx`, `formSchemas.ts`,
  `modules.ts`, `formTypes.ts`, `Program.cs`, `RecordsRepository.cs`, `Create_DB.sql`) → en küçük değişiklik,
  PR açıklamasında "Ortak dosya değişti" + Yusuf reviewer. Modüle özel mantık E-Devlet dosyalarına
  (`Services/ELogo*`, `Repositories/EGov*`, `pages/EGov*`, `components/EGov*`, `data/egovTypes.ts`).
- Gizli bilgi yok: entegratör kullanıcı/şifre `SYS_Companies`'te kalır, mali mühür/sertifika repoya girmez.
- Gerçek GİB'e test belgesi gönderme: eLogo **test ortamı** kullanılır (pb-demo / test hesabı); canlı hesapla
  yalnızca liste/sorgu.
- Doğrulama: `dotnet build BackendAPI` 0 hata, `cd FrontendUI && npx tsc -b` 0 hata, tarayıcıda dene.
- Arayüz Türkçe; belge başlıkları yan yana 3 sütun ve kısa.

**Mevcut durum (main, 18.10.2026):** e-Logo belge çekme (pb.elogo.com.tr PostBox), gelen e-fatura onay akışı
+ onay grupları, gelen faturayı alış/iade/hizmet/fiyat farkı olarak kaydetme, bilgi satırları, belge
görüntüleyici + PDF, XSLT tasarım şablonları, mükellef (PK/GB) sorgusu, "e-Faturadan cari kartı aç"
(form doldurulur, kayıt kullanıcıda — `EGovPartyCard*`, Yusuf ekledi).

---

### E-01 · Kimlik doğrulama uyumu (Yusuf'un Y-01'i birleşince)
Bağımlılık: **Y-01 main'de olmalı.**
```text
Yusuf giriş ekranı + JWT ekledi; tüm API'ler artık token istiyor ve kullanıcı kimliği token'dan
alınıyor (body/query'deki userId yok sayılıyor). E-Devlet tarafını buna uyarla:
1. EGovIncomingController (send/approve/reject/save), ApprovalGroups, Process ile ilgili E-Devlet
   uçlarında kullanıcıyı token'dan oku (Yusuf'un eklediği yardımcıyı kullan, kendi yöntemini yazma).
2. Frontend: egovIncomingApi.ts, approvalGroupsApi.ts vb. userId göndermeyi bıraksın (ya da zararsız
   kalsın); getCurrentUserId() kullanımlarını /api/auth/me tabanlı yeni yapıya geçir.
3. Hosted/arka plan işler (E-02 otomatik çekme) kullanıcısız çalışır → "sistem" kullanıcısıyla
   işaretlensin, onay kuyruğuna düşerken atanan kişi/rol bozulmasın.
Kabul: Giriş yapmış kullanıcı gelen faturayı onaya gönderip onaylayabiliyor; onay kayıtlarında doğru
kullanıcı adı görünüyor; token'sız istek 401.
```

### E-02 · Gelen belgeleri otomatik çekme (zamanlanmış iş)
Bağımlılık: yok (E-01 ile birlikte test edilir).
```text
Şu an gelen e-fatura/e-arşiv/e-irsaliye "E-Devlet → İşlemler → e-Logo Belge Çekme" ekranından elle
çekiliyor (ELogoDocumentSyncService.SyncAsync, ELogoController /api/elogo/sync).
1. Hosted service (CurrencyRateJob deseni): firma bazında ayarlanabilir aralıkla (ör. 30 dk) son N gün
   gelen belgeleri çek; çakışmayı önlemek için tek seferde tek çalışma (kilit).
2. Ayar ekranı (E-Devlet → Tanımlar): firma, belge türleri, aralık, PDF/XML indir, onay kuyruğuna
   düşür, "son çalışma / son hata" bilgisi. Ayar tablosu yeni SqlUpdates scripti.
3. Yeni belge gelince bildirim: onay grubuna/atanana uygulama içi bildirim (+ isteğe bağlı e-posta,
   CrmMailService altyapısı Yusuf'ta — kullanılabilir).
4. Çekme günlüğü: tarih, getirilen/yeni/güncellenen, hata; ekranda listelensin.
Kabul: Ayar açıkken yeni gelen fatura 30 dk içinde Gelen kutusunda ve onay kuyruğunda; eLogo erişilemezse
hata günlüğe yazılıyor, servis düşmüyor.
```

### E-03 · Giden e-fatura gönderimi (UBL üret → eLogo → durum)
Bağımlılık: Yusuf'un Y-05 (numara kayıtta) ve Y-09 (muhasebe) işleriyle **ortak nokta** — başlamadan konuşun.
```text
Projede giden belge üretimi yok (UBL writer yok; ELogoPostBoxClient yalnızca Login/GetDocumentList/
GetDocumentData/Logout). Referans proje: D:\Dosyalar\YAZILIMLARIMIZ\eftaura_elogo_kontrol
(ELogoSoapClient.cs, SoapLabForm.cs — SOAPAction'lar sabit yazılmalı, WSDL keşfi InternalServiceFault veriyor).
1. UblInvoiceWriter (Services): Invoice + satırlar + cari + firma bilgisinden UBL-TR 1.2 XML
   (TEMELFATURA/TICARIFATURA/IHRACAT/ISTISNA/TEVKIFAT/IADE profilleri; KDV, tevkifat, istisna kodları,
   iskonto, döviz). Mevcut UblInvoiceReader ile gidiş-dönüş testi (yaz → oku → aynı toplamlar).
2. Belge kuralları: UBL üretildikten sonra, XSLT gömme ve imzadan ÖNCE
   EGovRuleEngine.ApplyForSendAsync(xml, docKind, invoiceId, egovDocumentId, companyId) çağrılsın
   (E-Devlet → Tanımlar → Belge Kuralları; ayrıntı docs/egov-belge-kurallari.md — Yusuf ekledi).
   XSLT: mevcut EGovXsltDesign şablonu UBL'e gömülsün (önizleme EGovDesignTemplatesPage'de var).
3. Gönderim: eLogo SendDocument (test ortamı) → EGovDocument (Direction=2) kaydı, ETTN, durum.
   Alıcı etiketi (PK) cari adresindeki PostLabel'dan; yoksa mükellef sorgusu (IntegratorMukellefService).
   e-Fatura mükellefi değilse e-Arşiv'e yönlendir (E-04).
4. Durum takibi: GetDocumentStatus ile GİB iletim durumu + INVOICEAPPRESP ile KABUL/RED
   (referans projedeki notlar: UUID + DOCUMENTTYPE=INVOICEAPPRESP). Hosted service ile periyodik.
5. Satış faturası ekranında "e-Fatura Gönder" butonu, gönderilmiş faturada değişiklik kilidi,
   iptal/iade akışı. Fatura ekranı ortak dosya (DocumentFormEngine) → buton ayrı component olarak eklensin.
Kabul: Test ortamında örnek fatura gönderiliyor, ETTN dönüyor, durum "Başarılı", alıcı yanıtı izleniyor;
UBL GİB şematron doğrulamasından geçiyor.
```

### E-04 · e-Arşiv fatura
Bağımlılık: E-03.
```text
1. E-03'teki UBL üreticisiyle EARSIVFATURA profili; internet satışı alanları (ödeme şekli, taşıyıcı,
   web adresi), kâğıt/elektronik gönderim tipi.
2. eLogo e-Arşiv gönderimi (test), PDF'in müşteriye e-posta ile gönderimi.
3. e-Arşiv iptal (GİB süre kuralı) ve günlük e-Arşiv raporu durumu.
4. Satış faturasında alıcı e-Fatura mükellefi değilse otomatik e-Arşiv seçimi.
Kabul: Mükellef olmayan cariye kesilen fatura e-Arşiv olarak gidiyor; iptal edilebiliyor.
Not: e-Arşiv liste sorgusunda BEGINDATE = ENDDATE zorunlu (gün gün döngü — mevcut kodda var).
```

### E-05 · e-İrsaliye (gelen ve giden)
Bağımlılık: Yusuf'un **Y-06 (stok)** — stok hareketi Yusuf'un stok servisinden çağrılır, ayrıca yazılmaz.
```text
1. Giden: satış irsaliyesi → DespatchAdvice UBL → eLogo gönderim → durum + alıcı yanıtı (ReceiptAdvice).
   Plaka, şoför, taşıyıcı alanları (irsaliye ekranına ayrı component).
2. Gelen: e-İrsaliye çekme (mevcut EDESPATCHDETAIL), onay → alış irsaliyesi olarak kaydet (gelen e-fatura
   kaydetme ekranındaki malzeme eşleme mantığı yeniden kullanılsın: ProductCustomerAlias), kayıtla stok girişi.
3. Gelen irsaliyeye yanıt (kabul / kısmi kabul / red) gönderimi.
4. Gelen faturanın ilgili irsaliyelerle eşleşmesi (DespatchDocumentReference).
Kabul: Gelen e-irsaliye kaydedilince stok artıyor; giden irsaliye test ortamında iletiliyor.
```

### E-06 · GİB mükellef / etiket toplu senkronu
Bağımlılık: yok.
```text
GibEFaturaUserListService ve EFaturaMukellef tablosu var; tekil sorgu ve "Listeyi GİB'den Güncelle" butonu
mevcut. Ekle:
1. Gece çalışan iş: GİB PK/GB listesinin tamamı (zip) → EFaturaMukellef (fark güncellemesi, silinen
   etiketler pasif). SYS_EFaturaMukellefSync'e günlük.
2. Cari kartlar için toplu kontrol: tüm carilerin VKN'si listeyle karşılaştırılsın; adreslerdeki
   PostLabel/SenderLabel boş ya da eskiyse güncelleme önerisi listesi (toplu uygula), CustomerCard.
   EinvoiceType ve EinvoiceEntryDate güncellensin.
3. "e-Faturadan cari kartı aç" (EGovPartyCardRepository) önce yerel listeye bakıyor; senkron sonrası
   canlı eLogo sorgusuna daha az düşer — gerekirse orada eLogo sorgusunu ayara bağla.
Kabul: Senkron sonrası rastgele 10 VKN'de etiketler GİB ile aynı; cari toplu kontrol ekranı çalışıyor.
```

### E-07 · e-Defter (berat akışı)
Bağımlılık: Yusuf'un **Y-09** (muhasebe fişleri) ve yevmiye numaralandırma (JournalNumberingController).
```text
ELedger tablosu ve e-Defter alanları (CompanyForm "e-Defter" sekmesi) var.
1. Dönem seçimi → yevmiye ve kebir XBRL-GL dosyaları (GİB e-Defter paketi), şube ayrımı.
2. Doğrulama (GİB e-Defter şematronu), hata listesi kayıt bazında ("şu fişte hesap kodu eksik").
3. Entegratör üzerinden imzalama/yükleme (eLogo e-Defter servisi) veya imzasız paket indirme seçeneği.
4. Berat takibi ve dönem kilidi: beratı alınan dönemde muhasebe fişi değiştirilemez (Yusuf ile
   kilit kontrolünün nereye konacağını konuşun — RecordsRepository ortak dosya).
Kabul: Test döneminde paket şematrondan geçiyor; kilitli dönemde fiş kaydı reddediliyor.
```

### E-08 · KDV beyan raporu ve Ba / Bs formları
Bağımlılık: Yusuf'un **Y-09** (fatura → muhasebe) önerilir; yalnız fatura tablolarından da başlanabilir.
```text
1. KDV raporu: dönem içi satış/alış KDV'si oran bazında, tevkifat ve istisna kodlarıyla (KDV1 beyanname
   kalemleri), indirilecek/hesaplanan, devreden; Excel.
2. Ba/Bs: belge sayısı ve KDV hariç tutarı 5.000 TL (parametrik) üzeri olan cariler, VKN bazında
   birleştirme; GİB'e uygun Excel/XML çıktısı; mutabakat mektubu (cari bazında PDF/e-posta).
3. Raporlar Yusuf'un rapor altyapısını (SqlReports / Rapor Üretici) kullansın; yeni ekran gerekiyorsa
   E-Devlet → Raporlar altına.
Kabul: Örnek dönemde KDV toplamları fatura satırlarıyla tutar; Ba/Bs listesi elle kontrolle aynı.
```

### E-09 · e-Belge izleme ve hata ekranı
Bağımlılık: E-02, E-03.
```text
Tek ekranda: gönderilemeyen / GİB'de hatalı / alıcı yanıtı bekleyen / RED alan belgeler, son eLogo
çağrılarının günlüğü (istek tipi, süre, sonuç, hata mesajı — ham XML isteğe bağlı ve şifre/oturum
bilgisi maskeli), "yeniden dene" butonu, firma bazında entegratör bağlantı testi
(ServiceUrlProbe benzeri: hangi adres çalışıyor). Kritik hatada yöneticiye bildirim.
Kabul: Kasıtlı yanlış şifreyle bağlantı testi anlaşılır hata veriyor; hatalı belge yeniden denenebiliyor.
```

---

**Sıra önerisi:** E-02 → E-06 → (Y-01 birleşince) E-01 → E-03 → E-04 → E-05 → E-08 → E-07 → E-09.
Başlamadan önce Yusuf ile konuşulacaklar: E-03 (fatura kaydetme ve numara), E-05 (stok servisi), E-07 (dönem kilidi).
