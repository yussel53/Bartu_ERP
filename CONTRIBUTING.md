# Ortak Çalışma Kuralları — Bartu ERP

Bu proje birden fazla geliştiriciyle paralel ilerliyor. Amaç: `main` her zaman çalışır durumda kalsın, kimse başkasının işini ezmesin, veritabanı scriptleri çakışmasın.

> Kurallar öneri olarak hazırlandı; ekip olarak gözden geçirip gerekirse güncelleyin.

---

## 1. Modül sahipliği

| Alan | Sorumlu | Notlar |
|------|---------|--------|
| E-Devlet (e-Fatura, e-Arşiv, e-İrsaliye, e-Defter, eLogo/entegratör, GİB mükellef listesi) | @WebRoot12 | |
| Diğer modüller (Malzeme, Finans, Satış, Satınalma, CRM, Süreç, Muhasebe, Rapor, Sistem…) | @yussel53 | |

- Sahibi olmadığınız modülde değişiklik gerekiyorsa önce haber verin, PR'da sahibini **reviewer** olarak ekleyin.
- Sahiplik "kim karar verir / kim inceler" demektir; başkasının modülüne dokunmak yasak değildir.

### E-Devlet modülüne ait başlıca dosyalar

- Backend: `Controllers/EFaturaMukellefController.cs`, `Controllers/ELogoController.cs`, `Repositories/EFaturaMukellefRepository.cs`, `Services/ELogo*.cs`, `Services/GibEFaturaUserListService.cs`, `Services/IntegratorMukellefService.cs`
- Frontend: `api/efaturaMukellefApi.ts`, `api/elogoApi.ts`, `components/EinvoiceMukellefCheck.tsx`, `data/egovTypes.ts`, `pages/ELogoSyncPage.tsx`
- SQL: `*_egov_*`, `*_efatura_*`, `*_eledger*` adlı SqlUpdates scriptleri

## 2. Ortak (çakışmaya açık) dosyalar

Aşağıdaki dosyalar tüm modüllerce kullanılıyor ve en sık değişen dosyalar. Burada yapılan değişiklik herkesi etkiler:

| Dosya | Neden riskli |
|-------|--------------|
| `FrontendUI/src/components/DynamicFormEngine.tsx` | Tüm kart ekranlarını çizer |
| `FrontendUI/src/components/DocumentFormEngine.tsx` | Tüm fiş/belge ekranlarını çizer |
| `FrontendUI/src/components/FieldRenderer.tsx`, `FormFieldContext.tsx` | Tüm alan tipleri |
| `FrontendUI/src/data/formSchemas.ts`, `modules.ts`, `types/formTypes.ts` | Tüm ekran ve menü tanımları |
| `BackendAPI/Program.cs` | DI kayıtları (her yeni repository/servis buraya eklenir) |
| `BackendAPI/Repositories/RecordsRepository.cs` | Genel CRUD (`api/records/{tablo}`) |
| `Create_DB.sql` | Temel şema |

Kurallar:

1. Ortak dosyadaki değişiklikleri **küçük ve ayrı bir PR** olarak açın; modül işiyle karıştırmayın.
2. PR açıklamasında "Ortak dosya değişti: …" diye belirtin ve diğer geliştiriciyi reviewer ekleyin.
3. Bu dosyalarda toplu biçimlendirme, sıralama ya da yeniden adlandırma yapmayın; gereksiz satır farkı çakışma demektir.
4. Bu dosyalardan birinde uzun süren bir iş varsa ekip kanalında haber verin.
5. Modüle özel mantığı mümkünse modüle ait dosyalara koyun (ör. `data/egovTypes.ts`, ayrı bir component). Ortak motora yalnızca genel bir yetenek ekleyin.

## 3. Dal (branch) akışı

- `main` = çalışan, birleştirilmiş kod. **`main`'e doğrudan push yapılmaz.** Her değişiklik PR ile gelir.
  - **İstisna:** depo sahibi @yussel53 (ve onun Claude oturumu) işlerini doğrudan `main`'e gönderir. Göndermeden önce `main`'i çeker, bekleyen ekip dallarını birleştirir; `dotnet build BackendAPI` ve `npx tsc -b` 0 hata vermelidir. Diğer geliştiriciler dal + PR ile çalışır.
- Dal adları:
  - `feature/<modul>-<konu>` → `feature/edevlet-earsiv-iptal`, `feature/finans-cek-portfoy`
  - `fix/<konu>` → `fix/db-bootstrap-use-statement`
  - `docs/<konu>`
- Dallar kısa ömürlü olsun: birkaç gün içinde PR. Uzun işleri parçalara bölün.
- Birleştirilen dal silinir.

### Günlük akış

```bash
git switch main
git pull
git switch -c feature/edevlet-<konu>
# ... geliştir, commit et ...
git fetch origin
git rebase origin/main          # main'deki yenilikleri al, çakışmaları kendi dalında çöz
git push -u origin feature/edevlet-<konu>
gh pr create --base main
```

- Her gün işe başlarken `main`'i çekip dalınızı güncelleyin (`git rebase origin/main` veya `git merge origin/main`).
- Rebase yaptıktan sonra dalı zaten push'ladıysanız `git push --force-with-lease` kullanın (asla düz `--force` kullanmayın).

## 4. Veritabanı scriptleri (SqlUpdates)

`.cursor/rules/sql-updates.mdc` kuralları aynen geçerli (zaman damgalı, idempotent, uygulanmış script değiştirilmez). Paralel çalışma için ek kurallar:

1. **Dosya adı:** `yyyyMMdd_HHmmss_modul_konu.sql` (ör. `20261028_115800_acc_pool.sql`). Modül öneki açıklamada kalsın (`_egov_`, `_crm_`, `_fin_`).
2. **Eski `NN_xxx.sql` (01–110…) dokunulmaz**; yeni scriptler yalnızca zaman damgası kullanır.
3. **Damga çakışırsa** bir saniye ileri alın. Paralel PR’larda dosya adı benzersiz olduğu için numara yarışı olmaz.
4. **`main`'e girmiş bir scriptin adı asla değiştirilmez.** Uygulanan scriptler `SYS_DbUpdates.ScriptName` alanında **dosya adıyla** izlenir; ad değişirse script tüm veritabanlarında tekrar çalışır.
5. Bir scripti düzeltmek gerekiyorsa yeni bir `yyyyMMdd_HHmmss_…` scripti açın.
6. Scriptler idempotent olsun (`IF OBJECT_ID(...) IS NULL`, `IF COL_LENGTH(...) IS NULL`).

## 5. Commit mesajları

Mevcut stil sürdürülür: **Türkçe, kısa ve ne yapıldığını anlatan** bir başlık; gerekirse boş satırdan sonra açıklama.

```
e-Arşiv: iptal edilen faturalar listede ayrı durumla gösterilir

Entegratörden iptal yanıtı gelen belgeler listede "İptal" olarak işaretlenir.
```

## 6. PR kontrol listesi

PR açmadan önce:

- [ ] `main` güncel ve dal rebase/merge edildi
- [ ] Backend derleniyor: `dotnet build BackendAPI` → **0 hata**
- [ ] Frontend tip kontrolü yeni hata eklemiyor: `cd FrontendUI && npx tsc -b` (bkz. not)
- [ ] Değişiklik yerelde uygulama açılarak denendi
- [ ] Şema değiştiyse `SqlUpdates/yyyyMMdd_HHmmss_<modul>_xxx.sql` eklendi ve boş/test DB'de çalıştı
- [ ] Ortak dosya değiştiyse PR açıklamasında belirtildi
- [ ] Gizli bilgi yok (bkz. Bölüm 7)
- [ ] GitHub **CI yeşil** (`.github/workflows/ci.yml`: backend build, `tsc -b` + vite build, SqlUpdates adı/damga tekrarı ve main'deki scriptin değişmemesi). CI kırmızıyken PR birleştirilmez.

> **Not:** `main` üzerindeki 21 TypeScript hatası `fix/frontend-build-errors` ile temizlendi (17.10.2026); `npx tsc -b` artık 0 hata veriyor. Kural: **yeni TypeScript hatası eklenmez**, `npm run build` her PR'da hatasız geçmeli.

PR açıklamasında şunlar olsun: ne değişti, neden, nasıl test edildi, varsa eklenen SqlUpdates scriptleri.

İnceleme: diğer geliştirici en az bir kez bakar. Küçük düzeltmelerde (yazım, tek satır) inceleme beklemeden birleştirmek ekipçe kararlaştırılabilir.

## 7. Gizli bilgiler

Aşağıdakiler **asla repoya girmez**:

- `BackendAPI/Data/dbsettings.json` (yerel SQL bağlantısı; `.gitignore`'da)
- e-Fatura/eLogo entegratör kullanıcı adı, şifre, API anahtarları
- Mali mühür ve sertifika dosyaları (`*.pfx`, `*.pem`)
- Gerçek müşteri verisi içeren SQL dökümleri

Entegratör bilgileri veritabanında veya `appsettings.*.local.json` gibi git'e girmeyen yerel dosyalarda tutulur. Test için entegratörlerin **test ortamı** hesapları kullanılır.

## 8. Yerel kurulum

Gereksinimler: .NET 10 SDK, Node.js, SQL Server.

```bash
cd FrontendUI && npm install
dotnet build BackendAPI
dotnet run --project BackendAPI --launch-profile http   # http://localhost:5205
cd FrontendUI && npm run dev                            # http://localhost:5173
```

1. Tarayıcıda `http://localhost:5173` adresini açın, SQL bağlantı ekranında sunucu ve veritabanı adını girip kaydedin.
2. **Veritabanı Yönetimi → Sıfırdan Oluştur** ile veritabanını oluşturun (Create_DB → SYS_Tables → SqlUpdates).
3. Başkasının yeni scriptlerini almak için `main`'i çektikten sonra **Veritabanı Yönetimi → Güncelleme** ekranından bekleyen scriptleri uygulayın.

Her geliştirici kendi yerel veritabanında çalışır; ortak bir geliştirme veritabanı paylaşılmaz.

## 9. Depo sahibi için önerilen GitHub ayarları

Bu ayarları yalnızca depo sahibi yapabilir (**Settings**):

- **Branches → Branch protection rule (`main`)**: "Require a pull request before merging" (1 onay). Depo sahibi doğrudan gönderdiği için "Do not allow bypassing" **açılmaz** (Bölüm 3, istisna)
- **General → Pull Requests**: "Automatically delete head branches"
- İleride: her PR'da `dotnet build` ve `npx tsc -b` çalıştıran bir GitHub Actions iş akışı
