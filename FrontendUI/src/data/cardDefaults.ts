/**
 * Öndeğer şablonları — negatif ID'li kayıtlardan yeni kayda alan kopyalanır.
 *
 * Kartlar: tablo başına tek şablon, ID = -1 (CustomerCard, ProductCard, BankCard, SafeCard).
 * Fişler: aynı tabloyu paylaşan fiş türleri ayrı ID alır (form koduna göre):
 *   OrderVoucher   -1 Satış Siparişi · -2 Alış Siparişi · -3 Satış Talebi · -4 Alış Talebi
 *   ProductVoucher -1 Satış İrsaliyesi · -2 Alış İrsaliyesi
 *   Invoice        -1 Satış Faturası · -2 Alış Faturası
 * Fiş şablonu yalnız başlık alanlarını taşır (satır, ödeme planı, özel kod yok).
 * ID < 0 kayıtlar listelerde gizlidir; sunucu bu kayıtlarda stok / risk / bütçe / muhasebe /
 * kaydet sonrası işlemlerini çalıştırmaz.
 */

export const CARD_DEFAULT_TEMPLATE_ID = -1;

export type CardDefaultKind = {
  id: string;
  title: string;
  subtitle: string;
  tableName: string;
  primaryKeyColumn: string;
  formCode: string;
  /** Şablon kaydının ID'si (negatif) */
  templateId: number;
  /** card: tablo bazında eşleşir · voucher: yalnız aynı form kodunda */
  group: 'card' | 'voucher';
  /** Şablon ilk kez oluşturulurken yazılan değerler */
  seed?: Record<string, unknown>;
  /** Liste ekranı yolu (bilgi) */
  listPath?: string;
};

const card = (k: Omit<CardDefaultKind, 'group' | 'templateId'>): CardDefaultKind => ({
  ...k,
  group: 'card',
  templateId: CARD_DEFAULT_TEMPLATE_ID,
});

const voucher = (
  k: Omit<CardDefaultKind, 'group' | 'subtitle'> & { subtitle?: string },
): CardDefaultKind => ({
  ...k,
  group: 'voucher',
  subtitle: k.subtitle || `${k.tableName} · ID = ${k.templateId}`,
});

export const CARD_DEFAULT_KINDS: CardDefaultKind[] = [
  card({
    id: 'customer',
    title: 'Cari Kart',
    subtitle: 'CustomerCard · ID = -1',
    tableName: 'CustomerCard',
    primaryKeyColumn: 'CustomerCardID',
    formCode: 'CustomerCardForm',
    seed: { Code: '120.*', Type_: 3, TaxType: 1, Active: true, AccountGroupID: 1 },
    listPath: 'finans/ana-kayitlar/cari-kartlar',
  }),
  card({
    id: 'product',
    title: 'Malzeme Kartı',
    subtitle: 'ProductCard · ID = -1',
    tableName: 'ProductCard',
    primaryKeyColumn: 'ProductCardID',
    formCode: 'ProductCardForm',
    seed: {
      Code: '150.*',
      ProductType: 1,
      IsActive: true,
      AccountGroupID: 1,
      TrackingMode: 0,
      AllowLotSplit: false,
      TrackLocation: false,
      IssuePolicy: 0,
      CostMethod: 0,
    },
    listPath: 'malzeme/ana-kayitlar/malzeme-kartlari',
  }),
  card({
    id: 'bank',
    title: 'Banka Kartı',
    subtitle: 'BankCard · ID = -1',
    tableName: 'BankCard',
    primaryKeyColumn: 'BankCardID',
    formCode: 'BankCardForm',
    seed: { Code: '102.*', IsActive: true },
    listPath: 'finans/ana-kayitlar/banka',
  }),
  card({
    id: 'safe',
    title: 'Kasa Kartı',
    subtitle: 'SafeCard · ID = -1',
    tableName: 'SafeCard',
    primaryKeyColumn: 'SafeCardID',
    formCode: 'SafeCardForm',
    seed: { Code: '100.*', IsActive: true },
    listPath: 'finans/ana-kayitlar/kasa-kartlari',
  }),

  // ── Fiş öndeğerleri ──────────────────────────────────────────────
  voucher({
    id: 'sales-request',
    title: 'Satış Talebi',
    tableName: 'OrderVoucher',
    primaryKeyColumn: 'OrderVoucherID',
    formCode: 'SalesRequestForm',
    templateId: -3,
    listPath: 'satis/hareketler/talep',
  }),
  voucher({
    id: 'sales-order',
    title: 'Satış Siparişi',
    tableName: 'OrderVoucher',
    primaryKeyColumn: 'OrderVoucherID',
    formCode: 'SalesOrderForm',
    templateId: -1,
    listPath: 'satis/hareketler/siparis',
  }),
  voucher({
    id: 'sales-dispatch',
    title: 'Satış İrsaliyesi',
    tableName: 'ProductVoucher',
    primaryKeyColumn: 'ProductVoucherID',
    formCode: 'SalesDispatchForm',
    templateId: -1,
    listPath: 'satis/hareketler/irsaliye',
  }),
  voucher({
    id: 'sales-invoice',
    title: 'Satış Faturası',
    tableName: 'Invoice',
    primaryKeyColumn: 'InvoiceID',
    formCode: 'SalesInvoiceForm',
    templateId: -1,
    listPath: 'satis/hareketler/fatura',
  }),
  voucher({
    id: 'purchase-request',
    title: 'Alış Talebi',
    tableName: 'OrderVoucher',
    primaryKeyColumn: 'OrderVoucherID',
    formCode: 'PurchaseRequestForm',
    templateId: -4,
    listPath: 'satinalma/hareketler/talep',
  }),
  voucher({
    id: 'purchase-order',
    title: 'Alış Siparişi',
    tableName: 'OrderVoucher',
    primaryKeyColumn: 'OrderVoucherID',
    formCode: 'PurchaseOrderForm',
    templateId: -2,
    listPath: 'satinalma/hareketler/siparis',
  }),
  voucher({
    id: 'purchase-dispatch',
    title: 'Alış İrsaliyesi',
    tableName: 'ProductVoucher',
    primaryKeyColumn: 'ProductVoucherID',
    formCode: 'PurchaseDispatchForm',
    templateId: -2,
    listPath: 'satinalma/hareketler/irsaliye',
  }),
  voucher({
    id: 'purchase-invoice',
    title: 'Alış Faturası',
    tableName: 'Invoice',
    primaryKeyColumn: 'InvoiceID',
    formCode: 'PurchaseInvoiceForm',
    templateId: -2,
    listPath: 'satinalma/hareketler/fatura',
  }),
];

export const CARD_DEFAULT_TABLES = new Set(
  CARD_DEFAULT_KINDS.filter((k) => k.group === 'card').map((k) => k.tableName),
);

/**
 * Yeni kayıt açılırken kullanılacak öndeğer şablonu.
 * Fiş: form kodu birebir eşleşmeli (aynı tabloda farklı türler var).
 * Kart: tablo eşleşmesi yeter (ör. Müşteri Kartı da CustomerCard -1'i kullanır).
 */
export function findDefaultTemplate(formCode: string, tableName: string): CardDefaultKind | null {
  const byForm = CARD_DEFAULT_KINDS.find((k) => k.group === 'voucher' && k.formCode === formCode);
  if (byForm) return byForm;
  return CARD_DEFAULT_KINDS.find((k) => k.group === 'card' && k.tableName === tableName) || null;
}

/** Fiş şablonundan yeni fişe taşınmayacak alanlar: numara, tarih, tutar, durum izleri, e-belge bağları */
const VOUCHER_SKIP_EXACT = new Set([
  'DocumentNumber',
  'OrderSlipNo',
  'VoucherNo',
  'InvoiceNo',
  'journalNO',
  'Status_',
  'Status',
  'CurrencyRate',
  'UUID',
  'GUID',
  'ETTN',
  'EGovDocumentID',
  'SourceOrderVoucherID',
  'OrderVoucherID',
  'ProductVoucherID',
  'InvoiceID',
  'CreateUserID',
  'UpdateUserID',
  'ApproveUserID',
  'CancelUserID',
]);
const VOUCHER_SKIP_PATTERN = /(Date|Time|Total|Amount|Tutar|Approv|Cancel|Posted|AccountVoucher|EGov|Einvoice|EInvoice)/i;

/** Şablon kaydından yeni forma aktarılmayacak alanlar */
export function stripTemplateMeta(
  standard: Record<string, unknown>,
  primaryKeyColumn?: string,
  group: 'card' | 'voucher' = 'card',
): Record<string, unknown> {
  const skip = new Set(
    [
      primaryKeyColumn,
      'id',
      'Id',
      'CustomerCardID',
      'ProductCardID',
      'BankCardID',
      'SafeCardID',
      'TaxCardID',
      'BankAccountCardID',
      'CreatedDate',
      'ModifiedDate',
      'CreateDate',
      'UpdateDate',
    ].filter(Boolean) as string[],
  );
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(standard)) {
    if (skip.has(k)) continue;
    if (v == null || v === '') continue;
    if (group === 'voucher' && (VOUCHER_SKIP_EXACT.has(k) || VOUCHER_SKIP_PATTERN.test(k))) continue;
    // Seed başlığı / açıklaması yeni kayda taşınmasın
    if ((k === 'Title' || k === 'Description') && typeof v === 'string' && /^Öndeğer\b/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}
