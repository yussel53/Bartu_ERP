# Kullanıcılar ve yetkiler

## Kullanıcılar

*Sistem Yönetimi → Tanımlar → Kullanıcılar* (yalnız yönetici). Kullanıcı kartında:

- **Kullanıcı adı**, ad / soyad, **Tip** (Admin / Kullanıcı), aktif.
- **Şifre**: en az 6 karakter. Şifre özetlenerek saklanır (kimse — yönetici dahil — okuyamaz). Yeni şifre yazıp kaydedince
  hesap kilidi de açılır. Boş bırakılırsa mevcut şifre değişmez.
- Varsayılan firma / işyeri / ambar / birim, yetki kodu.

Kullanıcı kendi şifresini sol alttaki 🔑 düğmesiyle değiştirir.

## Roller ve ekran yetkileri

*Sistem Yönetimi → Tanımlar → Roller & Yetkiler*: roller tanımlanır, kullanıcıya bir ya da daha çok rol verilir.
Rolde ekran bazında görüntüle / ekle / değiştir / sil, alan bazında gizle / salt-okunur, firma / işyeri / ambar kapsamı ve
yetki kodları ayarlanır. «Yönetici» işaretli rol her şeyi görür.

Kullanıcı, rol, firma (entegratör şifreleri) ve rapor yetkisi kayıtlarını yalnız yönetici değiştirebilir.

## Güvenlik

- Tüm işlemler giriş ister; oturum açmadan hiçbir veri okunamaz.
- Kullanıcı yalnız girişte seçtiği veritabanında çalışır; başka veritabanına geçemez.
- 5 hatalı girişte hesap 15 dakika kilitlenir.
- Yardım sayfaları da yalnız program içinden, oturum açıkken görülebilir.
