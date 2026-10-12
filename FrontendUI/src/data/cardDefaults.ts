/** Kart öndeğer şablonları — ID = -1 kayıttan kopyalanır */

export const CARD_DEFAULT_TEMPLATE_ID = -1;

export type CardDefaultKind = {
  id: string;
  title: string;
  subtitle: string;
  tableName: string;
  primaryKeyColumn: string;
  formCode: string;
  /** Liste ekranı yolu (bilgi) */
  listPath?: string;
};

export const CARD_DEFAULT_KINDS: CardDefaultKind[] = [
  {
    id: 'customer',
    title: 'Cari Kart',
    subtitle: 'CustomerCard · ID = -1',
    tableName: 'CustomerCard',
    primaryKeyColumn: 'CustomerCardID',
    formCode: 'CustomerCardForm',
    listPath: 'finans/ana-kayitlar/cari-kartlar',
  },
  {
    id: 'product',
    title: 'Malzeme Kartı',
    subtitle: 'ProductCard · ID = -1',
    tableName: 'ProductCard',
    primaryKeyColumn: 'ProductCardID',
    formCode: 'ProductCardForm',
    listPath: 'malzeme/ana-kayitlar/malzeme-kartlari',
  },
  {
    id: 'bank',
    title: 'Banka Kartı',
    subtitle: 'BankCard · ID = -1',
    tableName: 'BankCard',
    primaryKeyColumn: 'BankCardID',
    formCode: 'BankCardForm',
    listPath: 'finans/ana-kayitlar/banka',
  },
  {
    id: 'safe',
    title: 'Kasa Kartı',
    subtitle: 'SafeCard · ID = -1',
    tableName: 'SafeCard',
    primaryKeyColumn: 'SafeCardID',
    formCode: 'SafeCardForm',
    listPath: 'finans/ana-kayitlar/kasa-kartlari',
  },
];

export const CARD_DEFAULT_TABLES = new Set(CARD_DEFAULT_KINDS.map((k) => k.tableName));

/** Şablon kaydından yeni forma aktarılmayacak alanlar */
export function stripTemplateMeta(
  standard: Record<string, unknown>,
  primaryKeyColumn?: string,
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
    // Seed başlığı yeni karta taşınmasın
    if (k === 'Title' && typeof v === 'string' && /^Öndeğer\b/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}
