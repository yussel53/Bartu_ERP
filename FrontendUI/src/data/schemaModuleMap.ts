/**
 * Create_DB.sql → modül / ekran referans haritası.
 * Menü ve form eklerken bu dosya + Create_DB.sql kaynak kabul edilir.
 */

export interface SchemaTableRef {
  table: string;
  module: string;
  group: 'ana-kayitlar' | 'hareketler' | 'islemler' | 'raporlar' | 'tanimlar' | 'e-fatura' | 'e-arsiv' | 'e-irsaliye' | 'e-defter';
  title: string;
  notes?: string;
}

export const SCHEMA_MODULE_MAP: SchemaTableRef[] = [
  // Malzeme
  { table: 'ProductCard', module: 'malzeme', group: 'ana-kayitlar', title: 'Malzeme Kartları', notes: 'TaxCardID vergi kartı · CostMethod 0 hareketli ortalama / 1 dönemsel ortalama / 2 FIFO / 3 LIFO / 4 son alış / 5 standart (StandardCost) · TrackingMode 0 yok / 1 Lot / 2 Seri / 3 Seri grubu · AllowLotSplit · TrackLocation · IssuePolicy 0 serbest / 1 FEFO / 2 FIFO · öndeğer ProductCardID=-1' },
  { table: 'UnitCard', module: 'malzeme', group: 'ana-kayitlar', title: 'Birimler', notes: 'UnitID 1–8 mevcut katalog · GlobalCode e-belge (EA, KGM, LTR, MTR)' },
  { table: 'StockLocation', module: 'malzeme', group: 'ana-kayitlar', title: 'Stok Yeri Kodları', notes: 'Raf / göz · WhouseID boşsa genel · kod depo içinde tek' },
  { table: 'ProductSerialLot', module: 'malzeme', group: 'hareketler', title: 'Lot / Seri', notes: 'Bir satırda N lot/seri · ExpireDate · Description · StockLocationID · Kind 1 Lot · 2 Seri · 3 Seri grubu' },
  { table: 'ProductUnit', module: 'malzeme', group: 'ana-kayitlar', title: 'Birim Çevirimi', notes: 'Sol birim listesi · sağda çevrim + ölçü (Weight/Length/Width/Height) + barkod grid' },
  { table: 'ProductBarcode', module: 'malzeme', group: 'ana-kayitlar', title: 'Barkodlar', notes: 'Birim çevirimi altında · ProductCardID + UnitID · bir birime N barkod' },
  { table: 'ProductSub', module: 'malzeme', group: 'ana-kayitlar', title: 'Alt Malzeme / Reçete', notes: 'ProductCard formu içinde sekme · MainProductCardID' },
  { table: 'ProductCustomerAlias', module: 'malzeme', group: 'ana-kayitlar', title: 'Cari Malzeme', notes: 'ProductCard formu içinde sekme · cari veya vergi/TCK no ile özel kod/ad' },
  { table: 'VariantCard', module: 'malzeme', group: 'ana-kayitlar', title: 'Varyant Kartları', notes: 'ProductCard formu içinde sekme · ProductCardID' },
  { table: 'VariantTemplate', module: 'malzeme', group: 'ana-kayitlar', title: 'Varyant Şablonları', notes: 'Özellik eksenleri + değerler → kartta kombinasyon üretir' },
  { table: 'VariantTemplateDim', module: 'malzeme', group: 'ana-kayitlar', title: 'Şablon Özellikleri', notes: 'VariantTemplate satırları · ValuesText' },
  { table: 'VaritantProperties', module: 'malzeme', group: 'ana-kayitlar', title: 'Varyant Özellikleri', notes: 'Create_DB sözlük; şablon değerleri ile ilişkilendirilebilir' },
  { table: 'TaxCard', module: 'malzeme', group: 'ana-kayitlar', title: 'Vergi Kartları' },
  { table: 'ProductVoucher', module: 'malzeme', group: 'hareketler', title: 'Malzeme Fişleri', notes: 'VoucherType: Devir/Ambar/Sarf/Üretim/Fire · Maliyet Dağıtım ayrı hareket · Sayım işlemlerde' },
  { table: 'ProductTrans', module: 'malzeme', group: 'hareketler', title: 'Malzeme Fiş Satırları' },
  { table: 'ProductTransCostCalc', module: 'malzeme', group: 'islemler', title: 'Maliyetlendirme', notes: 'Dönem maliyet hesabı · Maliyet Dağıtım fişinden ayrı' },

  // Finans
  { table: 'CustomerCard', module: 'finans', group: 'ana-kayitlar', title: 'Cari Kartlar' },
  { table: 'CustomerAdress', module: 'finans', group: 'ana-kayitlar', title: 'Cari Adresler', notes: 'PostLabel Gelen(PK) · SenderLabel Giden(GB) · e-Fatura Mükellef Kontrol → EFaturaMukellef' },
  { table: 'CustomerContact', module: 'finans', group: 'ana-kayitlar', title: 'Cari Yetkililer', notes: 'CustomerCard formu içinde sekme' },
  { table: 'CustomerEinvoiceDetail', module: 'finans', group: 'ana-kayitlar', title: 'e-Fatura Detay' },
  { table: 'EFaturaMukellef', module: 'edevlet', group: 'e-fatura', title: 'e-Fatura Mükellefler', notes: 'VKN + Alias (PK/GB) · cari adres sorgusu' },
  { table: 'EGovDocument', module: 'edevlet', group: 'e-fatura', title: 'e-Fatura / e-Arşiv / e-İrsaliye', notes: 'DocKind 1 Fatura / 2 Arşiv / 3 İrsaliye · Direction 1 Gelen / 2 Giden · PdfContent DB · OrderVoucherID bağ · ProcessInstanceID' },
  { table: 'ELedger', module: 'edevlet', group: 'e-defter', title: 'e-Defter' },
  { table: 'RiskGroup', module: 'finans', group: 'ana-kayitlar', title: 'Risk Grupları' },
  { table: 'BankCard', module: 'finans', group: 'ana-kayitlar', title: 'Banka', notes: 'Hesaplar (BankAccountCard) form içinde sekme' },
  { table: 'BankAccountCard', module: 'finans', group: 'ana-kayitlar', title: 'Banka Hesapları', notes: 'BankCard formu içinde sekme · BankCardID · Integ* entegrasyon · süreç işi BankFetch' },
  { table: 'SafeCard', module: 'finans', group: 'ana-kayitlar', title: 'Kasa Kartları' },
  { table: 'BoundCard', module: 'finans', group: 'ana-kayitlar', title: 'Çek / Senet Kartları' },
  { table: 'PaidPlanCard', module: 'finans', group: 'ana-kayitlar', title: 'Ödeme / Tahsilat Planları', notes: 'PlanType 1 Ödeme / 2 Tahsilat / 3 Her ikisi · PaidPlanLine' },
  { table: 'PaidPlanLine', module: 'finans', group: 'ana-kayitlar', title: 'Ödeme Plan Satırları' },
  { table: 'BankCredit', module: 'finans', group: 'ana-kayitlar', title: 'Banka Kredileri' },
  { table: 'BankCreditInstallment', module: 'finans', group: 'hareketler', title: 'Kredi Taksitleri' },
  { table: 'CustomerVoucher', module: 'finans', group: 'hareketler', title: 'Cari Fişler', notes: 'Type fiş tipi · satırlar CustomerTrans (1→N) · veri aktarımı customer-voucher' },
  { table: 'CustomerTrans', module: 'finans', group: 'hareketler', title: 'Cari Fiş Satırları', notes: 'CustomerVoucherID + CustomerID + Amount' },
  { table: 'PaymentTrans', module: 'finans', group: 'hareketler', title: 'Ödeme Hareketi', notes: 'Cari fiş satırı / kapama · Type_: 1 Tahsilat, 2 Ödeme' },
  { table: 'BankVoucher', module: 'finans', group: 'hareketler', title: 'Banka Fişleri', notes: 'Type_ fiş tipi · satırlar BankTrans (1→N)' },
  { table: 'BankTrans', module: 'finans', group: 'hareketler', title: 'Banka Fiş Satırları', notes: 'BankVoucherID + CustomerID + Amount' },
  { table: 'BoundTrans', module: 'finans', group: 'hareketler', title: 'Çek / Senet Fişleri', notes: 'Type_: giriş/çıkış/bordro (14 tip) · CheckID → BoundCard' },
  { table: 'PaymentClosedTrans', module: 'finans', group: 'islemler', title: 'Ödeme Kapama' },

  // Satış / Satınalma
  { table: 'ProductPrice', module: 'satis|satinalma', group: 'ana-kayitlar', title: 'Fiyatlar', notes: 'Type_ 1 Satış / 2 Alış · malzeme + hizmet aynı şablon · ProductCardID' },
  { table: 'TradeTarget', module: 'satis|satinalma', group: 'ana-kayitlar', title: 'Alım / Satış Hedefleri', notes: 'Direction 1 Satış / 2 Alım · M1–M12 tutar · Q1–Q12 miktar · cari ve malzeme isteğe bağlı' },
  { table: 'OrderVoucher', module: 'satis|satinalma', group: 'hareketler', title: 'Sipariş / Talep', notes: 'Type_ 1 Satış / 2 Alış / 5 Alış Talep / 6 Satış Talep · SourceOrderVoucherID talep→sipariş' },
  { table: 'OrderTrans', module: 'satis|satinalma', group: 'hareketler', title: 'Sipariş Satırları' },
  { table: 'SYS_ProcessDef', module: 'surec', group: 'ana-kayitlar', title: 'Süreçler', notes: 'TriggerType 1–8 · TriggerConfigJson · Category' },
  { table: 'SYS_ProcessStep', module: 'surec', group: 'ana-kayitlar', title: 'Süreç Adımları', notes: 'NodeType · ConfigJson · ApproverRoleId' },
  { table: 'SYS_ProcessInstance', module: 'surec', group: 'hareketler', title: 'Süreç Örnekleri', notes: 'DataJson: belge, cari, adres, satir — her başlangıçta aynı nesne' },
  { table: 'SYS_ProcessTask', module: 'surec', group: 'hareketler', title: 'Onay Kuyruğu', notes: 'Kullanıcı onay görevleri' },
  { table: 'SYS_ProcessDocLink', module: 'surec', group: 'islemler', title: 'Belge Bağları', notes: 'TalepToOrder · EGovToOrder' },
  { table: 'Invoice', module: 'satis|satinalma', group: 'hareketler', title: 'Fatura', notes: 'InvoiceType ile satış/alış/iade/alınan hizmet · veri aktarımı invoice' },

  // Muhasebe
  {
    table: 'AccountCard',
    module: 'muhasebe',
    group: 'ana-kayitlar',
    title: 'Hesap Kartları',
    notes: 'MainAccountID üst hesap · kodda . varsa otomatik (100.01→100), yoksa manuel (1←10←100)',
  },
  { table: 'AccountGroup', module: 'muhasebe', group: 'ana-kayitlar', title: 'Hesap Grupları' },
  { table: 'AccountLink', module: 'muhasebe', group: 'ana-kayitlar', title: 'Muhasebe Bağlantıları', notes: 'Ekle: Modul+Fiş türü+Hesap+Koşul · Product/Tax/Bank/Bound/Customer' },
  { table: 'AccountLinkDetail', module: 'muhasebe', group: 'ana-kayitlar', title: 'Kart / Bağlantı Detay', notes: 'Kart sekmesi + AccountLink satırları · ConditionTitle/ConditionJson' },
  { table: 'AccountVoucher', module: 'muhasebe', group: 'hareketler', title: 'Muhasebe Fişleri', notes: 'Veri aktarımı account-voucher · e-Defter yevmiye XML' },
  { table: 'AccountTrans', module: 'muhasebe', group: 'hareketler', title: 'Muhasebe Hareketleri' },
  { table: 'AccountLinkTrans', module: 'muhasebe', group: 'islemler', title: 'Ön / Resmi Muhasebe Bağlantı' },

  // Sistem
  { table: 'SystemUser', module: 'sistem', group: 'tanimlar', title: 'Kullanıcılar', notes: 'AuthCode + DefaultCompany/Workplace/Whouse/OrgUnit' },
  { table: 'SYS_Companies', module: 'sistem', group: 'tanimlar', title: 'Firmalar', notes: 'Üst kurum' },
  { table: 'SYS_Workplace', module: 'sistem', group: 'tanimlar', title: 'İşyerleri', notes: 'Firmaya bağlı' },
  { table: 'SYS_Whouse', module: 'sistem', group: 'tanimlar', title: 'Ambarlar', notes: 'İşyerine bağlı (WorkplaceID)' },
  { table: 'SYS_OrgUnit', module: 'sistem', group: 'tanimlar', title: 'Bölüm / Birim', notes: 'Bağımsız; opsiyonel CompanyID' },
  { table: 'SYS_Currency', module: 'sistem', group: 'tanimlar', title: 'Dövizler', notes: 'TRY yerel; USD/EUR/GBP üstte; ISO 4217 dünya listesi' },
  { table: 'SYS_CurrencyRate', module: 'sistem', group: 'tanimlar', title: 'Döviz Kurları', notes: 'Tarihli alım/satım kuru' },
  { table: 'SYS_FormPostSave', module: 'sistem', group: 'tanimlar', title: 'Kaydet Sonrası Komut', notes: 'FormCode + sql/api · {recId} {ID} {Code} {VoucherNo} {DocumentNumber} · Yardım' },
  { table: 'SYS_NumberTemplate', module: 'sistem', group: 'tanimlar', title: 'Fiş Numarası Şablonu', notes: 'Geçerlilik tarihi · Firma/İşyeri/Ambar/Kullanıcı · {CO}{WP}{WH}{USR}{YYYY}{MM}{WW}{Q}{SEQ}' },
  { table: 'SYS_UserOrgAuth', module: 'sistem', group: 'islemler', title: 'Kullanıcı Org Yetkisi', notes: 'Firma / İşyeri / Ambar' },
  { table: 'SYS_UserAuthCode', module: 'sistem', group: 'islemler', title: 'Kullanıcı Yetki Kodları', notes: 'Firma × Kayıt Türü × AuthCode (Logo)' },
  { table: 'SYS_City', module: 'sistem', group: 'tanimlar', title: 'Şehirler (eski)', notes: 'Yerine SYS_Province' },
  { table: 'SYS_Country', module: 'sistem', group: 'tanimlar', title: 'Ülke' },
  { table: 'SYS_Province', module: 'sistem', group: 'tanimlar', title: 'İl', notes: 'Türkiye 81 il' },
  { table: 'SYS_District', module: 'sistem', group: 'tanimlar', title: 'İlçe', notes: '973 ilçe' },
  { table: 'SYS_Neighborhood', module: 'sistem', group: 'tanimlar', title: 'Mahalle', notes: '32.254 mahalle · TurkiyeAPI 2025' },
  { table: 'Setting', module: 'sistem', group: 'tanimlar', title: 'Ayarlar' },
  { table: 'VoucherType', module: 'sistem', group: 'tanimlar', title: 'Fiş Tipleri (eski)', notes: 'Create_DB; yeni: SYS_TypeDef' },
  { table: 'SYS_TypeDef', module: 'sistem', group: 'tanimlar', title: 'Tür Tanımları', notes: 'Kind 1 Fiş / 2 Malzeme / 3 Cari · ModuleKey + TargetTable' },
  { table: 'AuxilCodes', module: 'sistem', group: 'tanimlar', title: 'Özel Kodlar (AUXIL)', notes: 'Tanım + AuxilCodeValue listeleri; kart/fişte AuxilCodeTrans (AuxilTrans) 1…N' },
  { table: 'AuxilCodeTrans', module: 'sistem', group: 'tanimlar', title: 'Özel Kod Hareketi (AuxilTrans)', notes: 'MainCardID × ModuleNr — tanım, kod, açıklama, tarih' },
  { table: 'AuxilCodeValue', module: 'sistem', group: 'tanimlar', title: 'Özel Kod Değerleri', notes: 'ValueKind 1=Kod 2=Açıklama' },
  { table: 'TLanguage', module: 'sistem', group: 'tanimlar', title: 'Diller' },

  // Personel
  { table: 'PersonCard', module: 'personel', group: 'ana-kayitlar', title: 'Personel Kartları' },
  { table: 'PersonDocument', module: 'personel', group: 'ana-kayitlar', title: 'Personel Belgeleri' },
  { table: 'JobRegion', module: 'personel', group: 'ana-kayitlar', title: 'İş Bölgeleri' },
  { table: 'DailyAction', module: 'personel', group: 'hareketler', title: 'Günlük Puantaj' },
  { table: 'MonthlyAction', module: 'personel', group: 'hareketler', title: 'Aylık Puantaj' },
];
