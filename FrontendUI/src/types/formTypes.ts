export type FieldType = 'text' | 'number' | 'date' | 'select' | 'lookup' | 'checkbox' | 'textarea' | 'password';

export interface FormFieldDto {
  fieldId: number;
  fieldName: string;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  colSpan: number;
  orderIndex: number;
  optionsJson?: string;
  defaultValue?: string;
  /** Aynı group → formda groupbox (fieldset) */
  group?: string;
  /** true → başlık satırının sağında (Aktif/Pasif) */
  headerRight?: boolean;
  /**
   * true: textbox + «…» listeden seçim (cari/malzeme vb.)
   * false: select zorla (kısa tip listeleri)
   * undefined: alan adına göre otomatik
   */
  useLookup?: boolean;
  /** true → alan salt okunur (ör. mükellef kontrol sonucu) */
  isReadOnly?: boolean;
  /** Alanın altında kısa açıklama */
  helpText?: string;
  /** Sayı alanı ondalık hane (ör. 2 = kuruş); alandan çıkınca yuvarlanır */
  decimals?: number;
}

/** Kaydet butonundan sonra çalışacak SQL veya API komutu */
export interface PostSaveAction {
  /** sql | api */
  type: 'sql' | 'api';
  /**
   * sql: UPDATE dbo.Invoice SET Status_ = 1 WHERE InvoiceID = {recId}
   * api: POST /api/... veya GET https://...
   * Yer tutucular: {recId}, {CustomerID}, form alan adları
   */
  command: string;
  title?: string;
}

export interface FormSchemaDto {
  formId: number;
  formCode: string;
  title: string;
  tableName: string;
  fields: FormFieldDto[];
  /** Kurumsal form ızgarası sütun sayısı (varsayılan 2) — geniş kartlar için 3 */
  formColumns?: 2 | 3;
  /** Özel Alanlar sekmesinde gösterilecek alanlar (U_*) */
  customFields?: FormFieldDto[];
  lineFields?: FormFieldDto[];
  /** Cari adres satır alanları (CustomerAdress) */
  addressFields?: FormFieldDto[];
  /** Cari yetkili satır alanları (CustomerContact) — kart içinde sekme */
  contactFields?: FormFieldDto[];
  /** Banka hesap satır alanları (BankAccountCard) — banka kartı içinde sekme */
  accountFields?: FormFieldDto[];
  /** Malzeme barkod satırları (ProductBarcode) — birim çevirimi altında */
  barcodeFields?: FormFieldDto[];
  /** Birim çevirimi satır alanları (ProductUnit) */
  unitConvFields?: FormFieldDto[];
  /** Alt malzeme / reçete satırları (ProductSub) — malzeme kartı içinde sekme */
  productSubFields?: FormFieldDto[];
  /** Cariye özel malzeme kodu/adı (ProductCustomerAlias) — malzeme kartı içinde sekme */
  customerAliasFields?: FormFieldDto[];
  /** Varyant satırları (VariantCard) — malzeme kartı içinde sekme */
  variantFields?: FormFieldDto[];
  /** Malzeme kartı varyant sekmesinde şablon seçimi (VariantTemplate) */
  variantTemplateField?: FormFieldDto;
  /** Kart → muhasebe hesabı (AccountLinkDetail) — Muhasebe Hesapları sekmesi */
  accountLinkFields?: FormFieldDto[];
  /** AccountLinkDetail.Module (1 Product / 2 Customer / 3 BankAccount …) */
  accountLinkModule?: number;
  /**
   * true: tek satır (cari kart — şimdilik yalnızca Kart Muhasebe Kodu).
   * false/undefined: çoklu satır (ekle/sil).
   */
  accountLinkSingle?: boolean;
  /**
   * true: sabit tip satırları (malzeme — Alış/Satış/İade);
   * ekle/sil yok, Type alanı kilitli.
   */
  accountLinkFixed?: boolean;
  primaryKeyColumn?: string;
  /** Kayıtta her zaman yazılacak sabit alanlar (örn. ProductType) */
  fixedStandardFields?: Record<string, string | number | boolean>;
  /** true ise formda Genel + Özel Alanlar sekmeleri açılır */
  enableCustomFieldsTab?: boolean;
  /** true ise Adresler sekmesi açılır (en az bir adres zorunlu) */
  enableAddressesTab?: boolean;
  /** true ise Yetkililer sekmesi açılır (cari kart içinde) */
  enableContactsTab?: boolean;
  /** true ise Hesaplar sekmesi açılır (banka kartı içinde) */
  enableAccountsTab?: boolean;
  /** true ise Barkodlar sekmesi açılır (eski; birim çevirimi tercih edilir) */
  enableBarcodesTab?: boolean;
  /** true ise Birim Çevirimi sekmesi (ProductUnit + birim altı barkod) */
  enableUnitConvsTab?: boolean;
  /** true ise Alt Malzeme / Reçete sekmesi açılır (ProductSub) */
  enableProductSubsTab?: boolean;
  /** true ise Cari Malzeme sekmesi açılır (ProductCustomerAlias) */
  enableCustomerAliasesTab?: boolean;
  /** true ise Varyantlar sekmesi açılır (VariantCard) */
  enableVariantsTab?: boolean;
  /** true ise Muhasebe Hesapları sekmesi açılır (AccountLinkDetail) */
  enableAccountLinksTab?: boolean;
  /** true ise Özel Kodlar sekmesi (AuxilCodeTrans) */
  enableAuxilCodesTab?: boolean;
  /** Özel kod satır alanları */
  auxilCodeFields?: FormFieldDto[];
  /** AuxilCodeTrans.ModuleNr (kart/fiş filtresi) */
  auxilCodeModuleNr?: number;
  /** Özel kod tanımı → değer/açıklama listesi (AuxilCodeValue) */
  enableAuxilValuesTab?: boolean;
  auxilValueFields?: FormFieldDto[];
  /** Firma kartı → İşyerleri (SYS_Workplace) */
  enableWorkplacesTab?: boolean;
  workplaceFields?: FormFieldDto[];
  /** Firma kartı → Ambarlar (SYS_Whouse) */
  enableWhousesTab?: boolean;
  whouseFields?: FormFieldDto[];
  /** Kaydet sonrası çalışacak komutlar (şema + SYS_FormPostSave birleşir) */
  postSave?: PostSaveAction[];
  /**
   * trade: sipariş/irsaliye/fatura — üst kompakt başlık, kalemler, altta detay sekmeleri + para birimi/toplam
   * classic / undefined: mevcut dikey düzen
   */
  documentLayout?: 'classic' | 'trade';
  /** true → trade düzeninde Ödeme Planı sekmesi gizlenir (muhasebe fişi) */
  hidePaymentPlan?: boolean;
  /**
   * Satıra tıklanınca altta açılan dağıtım detayı (AccountTransDetail — masraf merkezi / proje).
   * Satır alanları; satır tutarı lineAmountFields'tan okunur.
   */
  lineDistributionFields?: FormFieldDto[];
  /** Dağıtılacak satır tutarı alanları (ilk dolu olan) — örn. Debit, Credit */
  lineDistributionAmountFields?: string[];
  /**
   * Borç/alacak dengesi zorunlu fiş (muhasebe): satır toplamları kuruşuna kadar eşit olmalı,
   * satırda tek taraf dolu olmalı. Denge yoksa kaydedilmez.
   */
  balanceFields?: { debit: string; credit: string };
  /** trade düzeninde «e-Defter» detay sekmesi alanları (başlık kolonları) */
  eLedgerFields?: FormFieldDto[];
}

export interface DynamicFormDataDto {
  recordId: number;
  standardFields: Record<string, unknown>;
  additionalFields: Record<string, unknown>;
  lines?: Record<string, unknown>[];
  /** Cari kart adresleri → CustomerAdress */
  addresses?: Record<string, unknown>[];
  /** Cari kart yetkilileri → CustomerContact */
  contacts?: Record<string, unknown>[];
  /** Banka kartı hesapları → BankAccountCard */
  accounts?: Record<string, unknown>[];
  /** Malzeme barkodları → ProductBarcode */
  barcodes?: Record<string, unknown>[];
  /** Birim çevirimleri → ProductUnit */
  unitConvs?: Record<string, unknown>[];
  /** Alt malzeme / reçete → ProductSub (MainProductCardID = kart) */
  productSubs?: Record<string, unknown>[];
  /** Cariye özel malzeme kodu/adı → ProductCustomerAlias */
  customerAliases?: Record<string, unknown>[];
  /** Varyantlar → VariantCard (ProductCardID = kart) */
  variants?: Record<string, unknown>[];
  /** Kart muhasebe bağlantıları → AccountLinkDetail */
  accountLinks?: Record<string, unknown>[];
  /** Firma → işyerleri (SYS_Workplace) */
  workplaces?: Record<string, unknown>[];
  /** Firma → ambarlar (SYS_Whouse) */
  whouses?: Record<string, unknown>[];
  /** Fiş ödeme planı satırları → VoucherPaymentLine */
  paymentPlans?: Record<string, unknown>[];
  /** Fiş satır dağıtımları → AccountTransDetail (TransLineNo ile satıra bağlı) */
  distributions?: Record<string, unknown>[];
  /** Özel kod satırları → AuxilCodeTrans */
  auxilCodes?: Record<string, unknown>[];
  /** Özel kod tanımı değerleri → AuxilCodeValue */
  auxilValues?: Record<string, unknown>[];
  /** Yeni fişte numara kayıtta verilir (Y-05): boş numara alanı + şablon isteği */
  autoNumber?: { field: string; request: Record<string, unknown> };
}

export interface ListColumn {
  key: string;
  label: string;
}

/** Sol menüdeki tıklanabilir ekran */
export interface MenuScreen {
  id: string;
  /** hash path, örn: malzeme/ana-kayitlar/malzeme-kartlari */
  path: string;
  title: string;
  subtitle?: string;
  formCode?: string;
  /** ProductCard listelerinde tip filtresi */
  productTypeFilter?: string;
  /** Belge tip filtresi (Order Type_ / Dispatch VoucherType / Invoice InvoiceType) */
  documentTypeFilter?: string;
  /** Birden fazla belge tipi (örn. malzeme fişleri: Devir/Transfer/Sarf…) — istemci tarafı filtre */
  documentTypeFilters?: string[];
  /** Özel Alanlar admin ekranı — hedef tablo adı */
  customFieldsTable?: string;
  /** Bu ekran özel alan yönetim UI'sı mı */
  isCustomFieldsAdmin?: boolean;
  /** Döviz Kurları (TCMB günlük kur) ekranı */
  isCurrencyRates?: boolean;
  /** E-Devlet → Tasarım Şablonları (EGovXsltDesign + EGovDesignRule) */
  isEGovDesignTemplates?: boolean;
  /** E-Devlet → Belge Kuralları (EGovTransformRule — gönderim öncesi UBL değişikliği) */
  isEGovRules?: boolean;
  /** Malzeme → Maliyetlendirme (ağırlıklı ortalama maliyet, stok değeri, brüt kâr) */
  isStockCosting?: boolean;
  /** Genel Muhasebe → Muhasebeleştirme (fatura / kasa fişi → muhasebe fişi) */
  isAccountingPost?: boolean;
  /** Finans → Raporlar → Cari Yaşlandırma (açık kalemler, vade dağılımı) */
  isCustomerAging?: boolean;
  /** Finans → Çek / Senet Portföyü (bordrolar, konum, vade takvimi) */
  isBoundPortfolio?: boolean;
  /** Rapor Üretici → Zamanlanmış Raporlar (Excel e-postası) */
  isReportSchedules?: boolean;
  /** Onay grupları (SYS_ApprovalGroup) */
  isApprovalGroups?: boolean;
  /** E-Devlet → Tanımlar → Otomatik Belge Çekme (E-02) */
  isEGovAutoFetch?: boolean;
  /** E-Devlet → İşlemler → Cari Mükellef Kontrolü (E-06) */
  isEGovMukellefCheck?: boolean;
  /** E-Devlet → İşlemler → e-Belge Konsolu */
  isEGovConsole?: boolean;
  /** E-Devlet → Raporlar → KDV ve Ba / Bs (E-08) */
  isEGovTaxReport?: boolean;
  /** Veritabanı SqlUpdates (01_xxx.sql) güncelleme ekranı */
  isDbUpdatesAdmin?: boolean;
  /** Muhasebe → Yevmiye madde numaralandırma işlemi */
  isJournalNumbering?: boolean;
  /** Sistem → Excel/CSV veri aktarımı (malzeme, cari, hesap kodu) */
  isDataImport?: boolean;
  /** SQL bağlantı ayarları */
  isDbSettingsAdmin?: boolean;
  /** Kullanıcı yetki tanım ekranı */
  isUserPermissionsAdmin?: boolean;
  /** Adres tanımları (ülke/il/ilçe/mahalle) */
  isAddressAdmin?: boolean;
  addressLevel?: 'country' | 'province' | 'district' | 'neighborhood';
  /** Öndeğerler (ID=-1 şablon kartlar) */
  isCardDefaultsAdmin?: boolean;
  /** Öndeğer kart türü: customer | product | bank | safe */
  cardDefaultKind?: string;
  /** Süreç yönetimi (onay kuyruğu / tanımlar / aktarım) */
  isProcessAdmin?: boolean;
  /** inbox | defs | instances | actions */
  processAdminTab?: 'inbox' | 'defs' | 'instances' | 'actions';
  /** Onay Tanımları tasarımcısı (tetik + parça paleti) */
  isProcessDesigner?: boolean;
  /** CRM / Teklif Yönetimi çalışma alanı (Fırsat → Aksiyon → Teklif) */
  isCrmWorkspace?: boolean;
  /** CRM ayarları (Outlook entegrasyonu, SMTP, aksiyon tipleri) */
  isCrmSettings?: boolean;
  /** e-Logo PostBox belge çekme / senkron */
  isELogoSync?: boolean;
  /** E-Devlet kutusu (EGovDocument) — DocKind / Direction / IsArchived ile api/egov/documents listesi */
  egovList?: {
    docKind: number;
    direction: number;
    archived: boolean;
    /** Gelen e-fatura onay aşaması: new · pending · approved · saved */
    stage?: 'new' | 'pending' | 'approved' | 'saved';
  };
  /** Native SQL Raporlama Tools (SYS_SqlReport) */
  isSqlReportsAdmin?: boolean;
  /** designer | runner */
  sqlReportsView?: 'designer' | 'runner';
  /** Dinamik SQL rapor menü klasörü */
  isSqlReportFolder?: boolean;
  /** Dinamik menüden açılan tek SQL rapor */
  isSqlReportRunner?: boolean;
  /** SYS_SqlReport.Id */
  sqlReportId?: number;
  /** Sistem Yönetimi → tür tanımı ekranı (fiş / malzeme / cari) */
  typeDefKind?: 'voucher' | 'product' | 'customer';
  listColumns?: ListColumn[];
  sampleRows?: Record<string, string | number>[];
  /** Firma altı ambar / işyeri gibi iç menüler */
  children?: MenuScreen[];
  /** Harici sistem (ör. Raporlama PHP) */
  externalUrl?: string;
  /** true: ERP içinde iframe; false/undefined: yeni sekme önerisi + iframe */
  embedExternal?: boolean;
  comingSoon?: boolean;
}

export type MenuGroupKey =
  | 'ana-kayitlar'
  | 'hareketler'
  | 'islemler'
  | 'raporlar'
  | 'tanimlar'
  | 'ek-alanlar'
  | 'ozel-kodlar'
  | 'ondegerler'
  | 'parametreler'
  | 'e-fatura'
  | 'e-arsiv'
  | 'e-irsaliye'
  | 'e-defter';

export interface MenuGroup {
  key: MenuGroupKey;
  title: string;
  screens: MenuScreen[];
}

export type ModuleIcon =
  | 'package'
  | 'wallet'
  | 'trendingUp'
  | 'shoppingCart'
  | 'bookOpen'
  | 'barChart'
  | 'settings'
  | 'sliders'
  | 'users'
  | 'landmark'
  | 'gitBranch'
  | 'handshake';

export interface AppModule {
  id: string;
  path: string;
  title: string;
  subtitle: string;
  icon: ModuleIcon;
  groups: MenuGroup[];
}
