import { listRecords } from './recordsApi';

export interface LookupOptionMeta {
  stockQty?: number | string;
  mainUnit?: string;
  salesOrderQty?: number | string;
  purchaseOrderQty?: number | string;
}

export interface LookupOption {
  label: string;
  value: string;
  /** Malzeme seçiminde stok / birim / sipariş */
  meta?: LookupOptionMeta;
}

export type LookupSource = {
  table: string;
  pk: string;
  codeCols: string[];
  titleCols: string[];
  filterColumn?: string;
  filterValue?: string | number;
  take?: number;
  /** Lookup’tan «Yeni ekle» ile açılacak form */
  createFormCode?: string;
  createTitle?: string;
  /** ProductCard seçiminde ek kolonlar */
  productStats?: boolean;
};

/** Form alan adı → SQL lookup kaynağı */
const FIELD_LOOKUP: Record<string, LookupSource> = {
  CustomerID: {
    table: 'CustomerCard',
    pk: 'CustomerCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'CustomerCardForm',
    createTitle: 'Yeni Cari',
  },
  CustomerCardID: {
    table: 'CustomerCard',
    pk: 'CustomerCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'CustomerCardForm',
    createTitle: 'Yeni Cari',
  },
  ProductCardID: {
    table: 'ProductCard',
    pk: 'ProductCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'ProductCardForm',
    createTitle: 'Yeni Malzeme',
    productStats: true,
  },
  SubProductCardID: {
    table: 'ProductCard',
    pk: 'ProductCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'ProductCardForm',
    createTitle: 'Yeni Malzeme',
    productStats: true,
  },
  ItemsID: {
    table: 'ProductCard',
    pk: 'ProductCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'ProductCardForm',
    createTitle: 'Yeni Malzeme',
    productStats: true,
  },
  MainProductCardID: {
    table: 'ProductCard',
    pk: 'ProductCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'ProductCardForm',
    createTitle: 'Yeni Malzeme',
    productStats: true,
  },
  AccountID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'AccountCardForm',
    createTitle: 'Yeni Muhasebe Hesabı',
  },
  AccountCardID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'AccountCardForm',
    createTitle: 'Yeni Muhasebe Hesabı',
  },
  CrossAccountID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'AccountCardForm',
    createTitle: 'Yeni Muhasebe Hesabı',
  },
  CostCenterID: {
    table: 'CostCenter',
    pk: 'CostCenterID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'CostCenterForm',
    createTitle: 'Yeni Masraf Merkezi',
  },
  ProjectCardID: {
    table: 'ProjectCard',
    pk: 'ProjectCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'ProjectCardForm',
    createTitle: 'Yeni Proje',
  },
  MainAccountID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'AccountCardForm',
    createTitle: 'Yeni Muhasebe Hesabı',
  },
  BankCardID: {
    table: 'BankCard',
    pk: 'BankCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'BankCardForm',
    createTitle: 'Yeni Banka',
  },
  BankAccountCardID: {
    table: 'BankAccountCard',
    pk: 'BankAccountCardID',
    codeCols: ['Code', 'IbanNO', 'AccountNO'],
    titleCols: ['Title'],
    createFormCode: 'BankAccountCardForm',
    createTitle: 'Yeni Banka Hesabı',
  },
  BankAccountID: {
    table: 'BankAccountCard',
    pk: 'BankAccountCardID',
    codeCols: ['Code', 'IbanNO', 'AccountNO'],
    titleCols: ['Title'],
    createFormCode: 'BankAccountCardForm',
    createTitle: 'Yeni Banka Hesabı',
  },
  WhouseID: {
    table: 'SYS_Whouse',
    pk: 'WhouseId',
    codeCols: ['WhouseCode'],
    titleCols: ['Name', 'Title'],
    createFormCode: 'WarehouseForm',
    createTitle: 'Yeni Depo',
  },
  CompanyID: {
    table: 'SYS_Companies',
    pk: 'CompanyId',
    codeCols: ['CompanyCode'],
    titleCols: ['Title'],
    createFormCode: 'CompanyForm',
    createTitle: 'Yeni Firma',
  },
  DefultCompanyID: {
    table: 'SYS_Companies',
    pk: 'CompanyId',
    codeCols: ['CompanyCode'],
    titleCols: ['Title'],
    createFormCode: 'CompanyForm',
    createTitle: 'Yeni Firma',
  },
  TaxCardID: {
    table: 'TaxCard',
    pk: 'TaxCardID',
    codeCols: ['Code'],
    titleCols: ['Title', 'Rate'],
    createFormCode: 'TaxCardForm',
    createTitle: 'Yeni Vergi Kartı',
  },
  SafeCardID: {
    table: 'SafeCard',
    pk: 'SafeCardID',
    codeCols: ['Code'],
    titleCols: ['Defintion', 'Title'],
    createFormCode: 'SafeCardForm',
    createTitle: 'Yeni Kasa',
  },
  /** Kasa → Kasa virmanında hedef kasa */
  AimSafeCardID: {
    table: 'SafeCard',
    pk: 'SafeCardID',
    codeCols: ['Code'],
    titleCols: ['Defintion', 'Title'],
  },
  RiskGroupID: {
    table: 'RiskGroup',
    pk: 'RiskGroupID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'RiskGroupForm',
    createTitle: 'Yeni Risk Grubu',
  },
  AccountGroupID: {
    table: 'AccountGroup',
    pk: 'AccountGroupID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'AccountGroupForm',
    createTitle: 'Yeni Hesap Grubu',
  },
  BoundCardID: {
    table: 'BoundCard',
    pk: 'BoundCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'BoundCardForm',
    createTitle: 'Yeni Çek / Senet',
  },
  CheckID: {
    table: 'BoundCard',
    pk: 'BoundCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'BoundCardForm',
    createTitle: 'Yeni Çek / Senet',
  },
  PaidPlanCardID: {
    table: 'PaidPlanCard',
    pk: 'PaidPlanID',
    codeCols: ['Code'],
    titleCols: ['Title', 'Decription', 'Description'],
    createFormCode: 'PaidPlanCardForm',
    createTitle: 'Yeni Ödeme Planı',
  },
  PaidPlanID: {
    table: 'PaidPlanCard',
    pk: 'PaidPlanID',
    codeCols: ['Code'],
    titleCols: ['Title', 'Decription', 'Description'],
    createFormCode: 'PaidPlanCardForm',
    createTitle: 'Yeni Ödeme Planı',
  },
  CustomerAdressID: {
    table: 'CustomerAdress',
    pk: 'CustomerAdressID',
    codeCols: ['AdressCode', 'CTDCode'],
    titleCols: ['Adress', 'Title'],
  },
};

const cache = new Map<string, Promise<LookupOption[]>>();

function pick(row: Record<string, unknown>, cols: string[]): string {
  for (const c of cols) {
    const v = row[c] ?? row[c.toLowerCase()] ?? row[c.charAt(0).toLowerCase() + c.slice(1)];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  for (const [k, v] of Object.entries(row)) {
    if (cols.some((c) => c.toLowerCase() === k.toLowerCase()) && v != null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

function cacheKey(src: LookupSource): string {
  return `${src.table}|${src.pk}|${src.filterColumn || ''}|${src.filterValue ?? ''}`;
}

export function lookupSourceForField(fieldName: string): LookupSource | null {
  return FIELD_LOOKUP[fieldName] || null;
}

/**
 * Bağlı seçim listeleri: alan, aynı yerdeki üst alanın değerine göre süzülür.
 * Örn. Adres → yalnız seçili carinin adresleri (CustomerAdress.CustomerCardID = CustomerID).
 */
export const DEPENDENT_LOOKUPS: Record<string, { parentField: string; filterColumn: string; emptyText: string }> = {
  CustomerAdressID: { parentField: 'CustomerID', filterColumn: 'CustomerCardID', emptyText: 'Önce cari seçin' },
};

/** Üst alan değerine göre süzülmüş seçenekler (önbellekli) */
export async function loadDependentLookupOptions(
  fieldName: string,
  parentValue: string | number,
): Promise<LookupOption[]> {
  const dep = DEPENDENT_LOOKUPS[fieldName];
  const base = FIELD_LOOKUP[fieldName];
  if (!dep || !base) return [];
  return (await loadLookupOptions(fieldName, { filterColumn: dep.filterColumn, filterValue: parentValue })) || [];
}

export async function loadLookupOptions(
  fieldName: string,
  override?: Partial<LookupSource>,
): Promise<LookupOption[] | null> {
  const baseSrc = FIELD_LOOKUP[fieldName];
  if (!baseSrc) return null;
  const src: LookupSource = override ? { ...baseSrc, ...override } : baseSrc;

  const key = cacheKey(src);
  // Malzeme stok/sipariş güncel kalsın — productStats için önbellek kullanma
  if (!src.productStats) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const pending = (async () => {
    try {
      const res = await listRecords(src.table, {
        pk: src.pk,
        filterColumn: src.filterColumn,
        filterValue: src.filterValue,
        take: src.take ?? 500,
      });
      return (res.rows || [])
        .map((row) => {
          const r = row as Record<string, unknown>;
          const id = row[src.pk] ?? row.id ?? row.Id;
          const code = pick(r, src.codeCols);
          const title = pick(r, src.titleCols);
          const label = [code, title].filter(Boolean).join(' — ') || String(id ?? '');
          const opt: LookupOption = { label, value: String(id ?? '') };
          if (src.productStats) {
            const num = (v: unknown) => {
              if (v == null || v === '') return 0;
              const n = Number(v);
              return Number.isFinite(n) ? n : 0;
            };
            opt.meta = {
              stockQty: num(r.StockQty ?? r.stockQty),
              mainUnit: String(r.MainUnitName ?? r.mainUnitName ?? r.MainUnit ?? r.mainUnit ?? ''),
              salesOrderQty: num(r.SalesOrderQty ?? r.salesOrderQty),
              purchaseOrderQty: num(r.PurchaseOrderQty ?? r.purchaseOrderQty),
            };
          }
          return opt;
        })
        .filter((o) => o.value !== '');
    } catch {
      return [];
    }
  })();
  if (!src.productStats) cache.set(key, pending);
  return pending;
}

/** Cache temizleyip alanı yeniden yükle (yeni kayıt sonrası) */
export async function reloadLookupOptions(fieldName: string): Promise<LookupOption[]> {
  const src = FIELD_LOOKUP[fieldName];
  if (!src) return [];
  cache.delete(cacheKey(src));
  return (await loadLookupOptions(fieldName)) || [];
}

export function clearLookupCache(): void {
  cache.clear();
}

/** Şema select alanlarının optionsJson’unu SQL listeleriyle doldur */
export async function enrichSchemaLookups<T extends {
  fields: { fieldName: string; fieldType: string; optionsJson?: string }[];
  lineFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  addressFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  contactFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  barcodeFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  unitConvFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  productSubFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  customerAliasFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  variantFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  accountFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
  accountLinkFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
}>(schema: T): Promise<T> {
  const groups = [
    schema.fields,
    schema.lineFields,
    schema.addressFields,
    schema.contactFields,
    schema.barcodeFields,
    schema.unitConvFields,
    schema.productSubFields,
    schema.customerAliasFields,
    schema.variantFields,
    schema.accountFields,
    schema.accountLinkFields,
  ].filter(Boolean) as { fieldName: string; fieldType: string; optionsJson?: string }[][];

  const needed = new Set<string>();
  for (const list of groups) {
    for (const f of list) {
      if ((f.fieldType === 'select' || f.fieldType === 'lookup') && FIELD_LOOKUP[f.fieldName]) {
        needed.add(f.fieldName);
      }
    }
  }

  const loaded = new Map<string, LookupOption[]>();
  await Promise.all(
    [...needed].map(async (name) => {
      const opts = await loadLookupOptions(name);
      if (opts) loaded.set(name, opts);
    }),
  );

  const patch = <F extends { fieldName: string; fieldType: string; optionsJson?: string }>(f: F): F => {
    const opts = loaded.get(f.fieldName);
    if (!opts || opts.length === 0) return f;
    return { ...f, optionsJson: JSON.stringify(opts) };
  };

  return {
    ...schema,
    fields: schema.fields.map(patch),
    lineFields: schema.lineFields?.map(patch),
    addressFields: schema.addressFields?.map(patch),
    contactFields: schema.contactFields?.map(patch),
    barcodeFields: schema.barcodeFields?.map(patch),
    unitConvFields: schema.unitConvFields?.map(patch),
    productSubFields: schema.productSubFields?.map(patch),
    customerAliasFields: schema.customerAliasFields?.map(patch),
    variantFields: schema.variantFields?.map(patch),
    accountFields: schema.accountFields?.map(patch),
    accountLinkFields: schema.accountLinkFields?.map(patch),
  };
}
