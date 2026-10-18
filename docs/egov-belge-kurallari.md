# e-Belge Kuralları (gönderim öncesi UBL değişiklikleri)

Logo'daki **«Kural Tanımları»** (e-Fatura / e-Arşiv / e-İrsaliye gönderilmeden önce çalışan VBScript
`ProcessEvent(App)` kuralları) karşılığı. Bartu'da kural **kod yazmadan**: şablon + parametre + koşul + öncelik.

- Ekran: **E-Devlet → Tanımlar → Belge Kuralları** (kaydet / sil yalnız yönetici; «Dene» herkes, kalıcı değişiklik yok)
- Tablo: `EGovTransformRule`, günlük `EGovTransformRuleLog` (SqlUpdates/80)
- Kod: `BackendAPI/Services/EGovRules/*` — `EGovRuleEngine`, `RuleTemplates`, `RulePresets`, `RuleContext`, `UblDoc`
- API: `api/egov/transform-rules` (`catalog`, liste, kayıt, `preview`, `log`)

## Logo'dan farkları (neden daha güvenli / daha ileri)

| Logo kuralı | Bartu |
|---|---|
| Her kural ayrı VBScript; ADODB bağlantı dizesi ve **sa şifresi kuralın içinde düz metin** | Kural içinde bağlantı / şifre yok — uygulamanın kendi bağlantısı |
| `App.Doc.ModifyData "MASTER_DEF"` gibi Logo XML alan adları | Doğrudan UBL-TR (GİB'e giden belge) üzerinde, eleman sırası korunarak |
| Koşullar kodun içinde (`if turu="6"`, `If UCase(AUXIL_CODE) <> "DD"`) | Koşul alanları: cari kodu (joker), VKN, senaryo, fatura tipi, para birimi (`!TRY`), firma |
| Test için gerçek fatura gönderilir | «Dene»: örnek ya da seçilen belge üzerinde önizleme, değişiklik listesi + önce/sonra XML |
| Kural sırası belirsiz | Öncelik + «sonrakileri durdur» |
| Ne değişti bilinmez | Gönderimde her kural günlüğe yazılır (`EGovTransformRuleLog`) |
| `UQUERY_GETFLD(117,"ICUSTSUPCODE",…)` tablo numarası ezberi | Yer tutucular: `{Satir.CariKodu}`, `{Cari.BakiyeBA}`, `{Siparis.No}` … |

## Şablonlar

| Kod | Şablon | Ne yapar |
|---|---|---|
| `ADD_FIELD` | Ek alan ekle | `AdditionalDocumentReference` (ID = değer, DocumentType = ad). Tasarım bu adla okur. |
| `ADD_NOTE` | Belge notu ekle | `cbc:Note` |
| `REMOVE_NOTE` | Belge notunu kaldır | Desene uyan notları siler |
| `LINE_FIELD` | Satır alanını doldur | Malzeme adı / açıklama / satır notu / satıcı-alıcı-üretici kodu / marka / model: değiştir, sonuna/başına ekle, boşsa doldur |
| `CUSTOMER_ITEM_CODE` | Cariye özel malzeme kodu / adı | Malzeme–cari bağlantısındaki (ProductCustomerAlias) kod ve ad |
| `UNIT_CONVERT` | Birim çevrimi | Miktar × katsayı, fiyat ÷ katsayı (tutar değişmez), birim kodu; katsayı sabit ya da malzeme kartından |
| `COLLAPSE_LINES` | Satırları tek satırda topla | KDV oranı başına tek satır; tutarlar belgenin KDV dökümünden (toplamlar değişmez) |
| `DROP_ZERO_LINES` | Sıfır tutarlı satırları gönderme | Karma koli içeriği / bilgi satırları |
| `RETURN_REFERENCE` | İade faturası referansı | İADE tipinde `BillingReference` yoksa ekler |
| `PARTY_NAME` | Alıcı unvanını düzenle | Değiştir ya da sonuna ekle |
| `DESPATCH_TRANSPORT` | e-İrsaliye plaka / şoför | `Shipment/ShipmentStage` plaka, dorse, şoför |
| `SQL_VALUE_FIELD` | SQL sonucu → ek alan / not (yönetici) | Tek değerli SELECT; işlem her zaman geri alınır |
| `SQL_EXEC` | Gönderim öncesi kayıt güncelleme (yönetici) | UPDATE / INSERT; önizlemede geri alınır, gönderimde kalıcı |

SQL parametreleri: `@InvoiceID`, `@DespatchID`, `@CustomerID`, `@EGovDocumentID`, `@DocumentNo`.

## Yer tutucular

Başlık: `{Belge.No}` `{Belge.Tarih}` `{Belge.Senaryo}` `{Belge.Tip}` `{Belge.ParaBirimi}` `{Belge.Kur}` `{Belge.SatirSayisi}`
`{Belge.ToplamMiktar}` `{Belge.OdenecekTutar}` `{Belge.VadeTarihi}` `{Belge.Aciklama}` `{Cari.Kod}` `{Cari.Unvan}` `{Cari.VKN}`
`{Cari.Bakiye}` `{Cari.BakiyeBA}` `{Cari.BakiyeMutlak}` `{Cari.AcikSiparis}` `{Siparis.No}` `{Siparis.Tarih}` `{Irsaliye.No}`
`{Irsaliye.Tarih}` `{Bugun}`

Satır: `{Satir.No}` `{Satir.MalzemeKodu}` `{Satir.MalzemeAdi}` `{Satir.Aciklama}` `{Satir.Aciklama2}` `{Satir.OzelKod}`
`{Satir.Barkod}` `{Satir.CariKodu}` `{Satir.CariAdi}` `{Satir.SiparisNo}` `{Satir.SiparisTarihi}` `{Satir.IrsaliyeNo}`
`{Satir.IrsaliyeTarihi}` `{Satir.Miktar}` `{Satir.Birim}` `{Satir.Fiyat}`

Metindeki tüm yer tutucular boşsa sonuç boş sayılır («Barkod: {Satir.Barkod}» barkod yoksa yazılmaz).

## Hazır kurallar ↔ Logo örnekleri (`LOGO_TEKNIK\KURAL TANIMLARI`)

| Hazır kural | Logo kaynağı |
|---|---|
| Cari bakiye ek alanı (`BAKIYE` = «1.234,56 (B)») | Bakiye.txt · Son bakiye kuralı |
| Sipariş no / tarihi ek alanı | Sipariş no ve tarih |
| İrsaliye no / tarihi ek alanı (faturada) | Belge noyu faturada getirme · e-İrsaliyede irsaliye tarihi |
| Belge no ek alanı (e-İrsaliye) | e-İrsaliyede belge noyu ek alanla getirme |
| Toplam miktar ek alanı | Toplam miktar kuralı |
| Ödeme (vade) tarihi ek alanı | Ödeme tarihi · Vade tarihi |
| Cari kodu ek alanı | Cari kod tanımlı alana getirme |
| Döviz kuru notu (koşul: !TRY) | Raporlama döviz kuru genel açıklamaya |
| Dövizli faturada «Yalnız … TL» notunu kaldır | Dövizli faturalarda Yalnız TL ibaresinin kaldırılması |
| Satır açıklaması → malzeme adı | satır açıklaması malzeme açıklamasına.txt |
| Satır özel kodu → malzeme kodu | aynı dosya (AUXIL_CODE → MASTER_CODE) · Hareket özel kodu |
| Barkod satır notuna | Barkod satır açıklamasına · serilot_kontrol (barkod) |
| Açıklama 2 → satır notu | Malzeme açıklama2 → satır açıklaması |
| Sipariş no satır notuna | Satır açıklamasına sipariş fiş numarası |
| Cariye özel malzeme kodu ve adı | IRSALIYE_MUSTERI_TEDARIKCI_KODU_ATAMASI.txt · Go serisi müşteri tedarikçi kodu |
| Koli → adet çevrimi | kolı_adet_cevrımlerı.txt |
| Faturayı tek satır olarak gönder | SADECE ILK SATIRI BASSIN.txt |
| Sıfır tutarlı satırları gönderme | Karma koli içeriği görünmesin |
| İade faturası referansı | IADE FATURASI.txt |
| e-İrsaliye plaka / şoför | Plaka_Tanımlama.txt |
| Alıcı unvanına ikinci satır | Ünvan2 kuralı |

Henüz karşılığı olmayanlar:
- **Geciken vade**: tahsilat eşleştirme (yol haritası Y-10) gelince `{Cari.GecikenVade}` eklenecek.
- **Seri / lot**: lot takibi yok.
- **GTİP**: ihracat faturası (E-03) ile.

Bunlar şimdilik `SQL_VALUE_FIELD` ile çözülebilir.

## Tasarımda ek alanı göstermek (XSLT)

```xml
<xsl:for-each select="//cac:AdditionalDocumentReference[cbc:DocumentType='BAKIYE']">
  <xsl:value-of select="cbc:ID"/>
</xsl:for-each>
```

## Gönderim akışına bağlama (E-03 — @WebRoot12)

Giden belge UBL'i üretildikten sonra, **XSLT gömme ve imza / eLogo gönderiminden önce**:

```csharp
var r = await ruleEngine.ApplyForSendAsync(ublXml, docKind, invoiceId, egovDocumentId, companyId, ct);
ublXml = r.Xml!;   // değişmiş UBL; her kural EGovTransformRuleLog'a yazılır
```

`EGovRuleEngine` (Scoped) Program.cs'te kayıtlıdır. `SQL_EXEC` kuralları burada kalıcı çalışır.
