# Sistem yönetimi

## Güncelleme

Yeni sürüm yayımlandığında servis kendini birkaç dakika içinde günceller (otomatik güncelleme açıksa). Yöneticiye üst bantta
**Yeni sürümü yükle** de görünür. Güncelleme sırasında servis birkaç saniye durur; kaydedilmemiş fişleri önce kaydedin.
Yeni sürüm açılmazsa önceki sürüme kendiliğinden dönülür.

Sürüm bilgisi sol altta (sürüm · kod · derleme zamanı).

## Veritabanı güncelleme

*Sistem Yönetimi → İşlemler → Veritabanı Güncelleme*. Yeni sürümle gelen numaralı scriptler (SqlUpdates) burada listelenir;
yöneticiye üst bantta «Şimdi uygula» çıkar. Scriptler tekrar çalıştırılabilir yazılmıştır. **Uygulamadan önce otomatik yedek alınır.**
Birden çok veritabanı varsa her veritabanında ayrı uygulanır (o veritabanında oturum açıp).

## Yedek

Aynı ekranda **Veritabanı Yedeği**: «Şimdi yedek al», son yedekler. Her gece 02:00'de ve SQL güncellemesinden önce otomatik
yedek alınır; son 7 yedek tutulur. Yedekler SQL Server'ın yedek klasörüne yazılır.

## Döviz kurları

*Sistem Yönetimi → Tanımlar → Döviz Kurları*: TCMB kurları her iş günü otomatik iner (ilk kurulumda USD, EUR, GBP; diğerleri işaretlenirse).
Elle indirme ve geçmiş günler için de kullanılır.

## Firma / işyeri / ambar

*Sistem Yönetimi → Tanımlar*: firma kartı (e-Fatura entegratör bilgileri dahil), işyerleri, ambarlar, organizasyon birimleri.

## Birden çok veritabanı

Aynı SQL sunucusunda birden çok Kavi Soft veritabanı çalışabilir. Girişte yazılan veritabanı geçerli bir Kavi Soft veritabanı
olmalıdır; başka programların veritabanları ve sistem veritabanları kabul edilmez. İstenirse sunucu ayarında izin verilen
veritabanları listesi tanımlanır (`Tenancy:AllowedDatabases`).
