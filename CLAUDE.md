# Bartu ERP — AI asistanı için proje rehberi

Bu dosya Claude Code (ve benzeri asistanlar) için. İnsanlar için kurallar: [CONTRIBUTING.md](CONTRIBUTING.md). Ayrıca `.cursor/rules/*.mdc` kuralları geçerlidir.

## Mimari

- **BackendAPI/**: .NET 10 Web API, Dapper ile doğrudan SQL (EF yok). Akış: `Controllers/` → `Repositories/` (+ `Services/`). Yeni repository/servis `Program.cs`'e kaydedilir.
- **FrontendUI/**: React 18 + TypeScript + Vite + Tailwind. API çağrıları `src/api/*Api.ts`; Vite `/api` isteklerini `localhost:5205`'e proxy'ler.
- **Metadata ile çalışan formlar**: Ekran ve menüler `src/data/formSchemas.ts` ile `modules.ts` içinde tanımlıdır. Bunları `DynamicFormEngine.tsx` (kart) ve `DocumentFormEngine.tsx` (fiş başlığı + satır) çizer. Genel CRUD ucu `api/records/{tableName}` (`RecordsRepository`).
- **Veritabanı**: SQL Server. Temel şema `Create_DB.sql`; değişiklikler `SqlUpdates/<sıra>_*.sql` (eski `NN_`, yeni `yyyyMMddHHmmss_`); uygulanan scriptler `SYS_DbUpdates` tablosunda dosya adıyla izlenir.
- Uygulama `FrontendUI/` altındadır.

## Kurallar

1. Ekran ve alanlar `Create_DB.sql`'deki gerçek tablo ve kolonlara dayanır; şemada olmayan tablo varsayılmaz (`.cursor/rules/create-db-modules.mdc`, `FrontendUI/src/data/schemaModuleMap.ts`).
2. Her şema değişikliği için idempotent bir `SqlUpdates/yyyyMMddHHmmss_<modul>_<konu>.sql` yazılır (scriptin yazıldığı anın zaman damgası, ör. `20261025201630_egov_xxx.sql`). Damga iki geliştiricide çakışmaz ve eski `NN_` scriptlerin hepsinden büyük olduğu için sıra korunur. Mevcut `NN_` scriptler olduğu gibi kalır. `main`'e girmiş bir script düzenlenmez ve yeniden adlandırılmaz; düzeltme için yeni script açılır.
3. Ortak dosyalar (`DynamicFormEngine.tsx`, `DocumentFormEngine.tsx`, `FieldRenderer.tsx`, `formSchemas.ts`, `modules.ts`, `formTypes.ts`, `Program.cs`, `RecordsRepository.cs`, `Create_DB.sql`) iki geliştirici tarafından da kullanılır. Bu dosyalarda yalnızca görevin gerektirdiği en küçük değişiklik yapılır; biçimlendirme, sıralama ya da yeniden adlandırma yapılmaz. Bu dosyalara dokunulduysa kullanıcıya söylenir.
4. Modül sahipliği: E-Devlet → @WebRoot12, diğer modüller → @yussel53. Sahibi olmayan modüle dokunan değişiklik kullanıcıya belirtilir.
5. Doğrudan `main`'e commit veya push yapılmaz. İş `feature/<modul>-<konu>` veya `fix/<konu>` dalında yapılır ve PR açılır.
   **İstisna:** @yussel53'ün oturumunda iş doğrudan `main`'e gönderilir: başta `git fetch` + `git pull`, bekleyen ekip dalları geçici dalda birleştirilip derlenir; iş bitince `dotnet build` ve `npx tsc -b` 0 hata ise commit + `git push origin main`.
6. Commit mesajları Türkçe; kısa başlık ve gerekirse açıklama (mevcut `git log` stili).
7. Kod yorumları mevcut dosyalardaki gibi kısa ve Türkçe olur.
8. Gizli bilgi (bağlantı dizesi, entegratör şifresi, sertifika) repoya yazılmaz. `BackendAPI/Data/dbsettings.json` yereldir.

## Doğrulama

- Backend: `dotnet build BackendAPI` → 0 hata.
- Frontend: `cd FrontendUI && npx tsc -b` → 0 hata (17.10.2026'dan beri temiz; yeni hata eklenmez).
- Çalıştırma: backend `dotnet run --project BackendAPI --launch-profile http` (:5205), frontend `npm run dev` (:5173).
- Şema scriptleri, yerel bir test veritabanında iki kez arka arkaya hatasız çalışmalı.
- Otomatik test altyapısı yok; değişiklikler uygulama açılarak denenir.
