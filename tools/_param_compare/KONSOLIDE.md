# Parametreler — konsolide (sorular hariç tamam)

Bu dosya canlı durum özeti. Birlikte karar listesi agent store: `parametreler-konsolide.md`.

## Yapıldı
- ModuleParams UI + seed (kasa/fatura/stok/cari)
- SqlUpdates: `125304` kasa · `152747` seed · `155558` ondeger · `160556` batch2
- Çalışan: FAT_FILL_ACC, FAT_PAY_OVER, FAT_PRICE_CTRL, FAT_WP_CTRL, FAT_CUST_PROD, STK_NEG_CTRL, Kasa SafeParams
- **STK_KDV_*** kart öndeğeri: `STK_KDV_SAL` → yeni malzeme / şablon `TaxCardID` (`/api/module-params/tax-card/...`)

## upcoming = motor sonra (soru değil)
Ekranda var; bağlanınca upcoming kaldırılır.

## Sorular
1. ~~E-belge eşleşme~~ → **Karar:** e-fatura satırı→sipariş/irsaliye; e-irsaliye satırı→sipariş (malzeme bazlı; UI/API sonra)
2–3. Hizmet dağıtım · MM/proje→KDV — geçildi
4. ~~ÖTV KDV~~ → **Vergi kartında** yöntem/seçenek (ayrı dnm param yok)
5. ~~Muhasebeleşmiş~~ → muhasebe alanları kilit; ödeme planı serbest; detay değişim = fiş çıkar → düzenle → tekrar muhasebeleştir
5b–8. belge no/virman · Status_ · fiyat KDV hariç/dahil · yazım/sevk/toplu öncelik
