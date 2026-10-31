import { listRecords } from './recordsApi';
import { getCustomerSummaries } from './cardStatementApi';

export interface LookupOptionMeta {
  /** product */
  stockQty?: number | string;
  mainUnit?: string;
  salesOrderQty?: number | string;
  purchaseOrderQty?: number | string;
  /** customer */
  kind?: 'product' | 'customer';
  taxNr?: string;
  balance?: number;
  ba?: string;
  cityTown?: string;
  phone?: string;
  lastMoveDate?: string;
  riskGroup?: string;
  overdue?: number;
  /** CostDimCard: bağlı üst boyut kartı */
  linkedCostDimCardId?: string;
  dimNo?: number;
}

export interface LookupOption {
  label: string;
  value: string;
  /** Malzeme: stok / birim · Cari: bakiye / iletişim */
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
  /** ProductCard seçiminde stok / birim / sipariş */
  productStats?: boolean;
  /** CustomerCard seçiminde bakiye / il / telefon / son hareket */
  customerStats?: boolean;
  /**
   * AccountCard: altı olan (MainAccountID veya kod öneki) üst hesapları listeden çıkar.
   * Muhasebe fişi / hareket — yalnızca yaprak hesap.
   */
  leafOnly?: boolean;
};

/** Form alan adı → SQL lookup kaynağı */
const FIELD_LOOKUP: Record<string, LookupSource> = {
  CustomerID: {
    table: 'CustomerCard',
    pk: 'CustomerCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    take: 10000,
    createFormCode: 'CustomerCardForm',
    createTitle: 'Yeni Cari',
    customerStats: true,
  },
  CustomerCardID: {
    table: 'CustomerCard',
    pk: 'CustomerCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    take: 10000,
    createFormCode: 'CustomerCardForm',
    createTitle: 'Yeni Cari',
    customerStats: true,
  },
  ProductCardID: {
    table: 'ProductCard',
    pk: 'ProductCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    take: 10000,
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
    take: 2000,
    leafOnly: true,
    createFormCode: 'AccountCardForm',
    createTitle: 'Yeni Muhasebe Hesabı',
  },
  AccountCardID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    take: 2000,
    leafOnly: true,
    createFormCode: 'AccountCardForm',
    createTitle: 'Yeni Muhasebe Hesabı',
  },
  CrossAccountID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    take: 2000,
    leafOnly: true,
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
  CostDimID: {
    table: 'CostDim',
    pk: 'CostDimID',
    codeCols: ['DimNo', 'Code'],
    titleCols: ['Title'],
    createFormCode: 'CostDimForm',
    createTitle: 'Yeni Masraf Boyutu',
  },
  CostDimCardID: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  LinkedCostDimCardID: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  CostDimCardID1: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    filterColumn: 'DimNo',
    filterValue: 1,
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  CostDimCardID2: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    filterColumn: 'DimNo',
    filterValue: 2,
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  CostDimCardID3: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    filterColumn: 'DimNo',
    filterValue: 3,
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  CostDimCardID4: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    filterColumn: 'DimNo',
    filterValue: 4,
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  CostDimCardID5: {
    table: 'CostDimCard',
    pk: 'CostDimCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    filterColumn: 'DimNo',
    filterValue: 5,
    createFormCode: 'CostDimCardForm',
    createTitle: 'Yeni Boyut Kartı',
  },
  MainAccountID: {
    table: 'AccountCard',
    pk: 'AccountCardID',
    codeCols: ['Code'],
    titleCols: ['Title'],
    take: 2000,
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

/** Kod — Ad (üst hesap vb. seçili satır etiketi) */
export function formatLookupLabel(
  row: Record<string, unknown>,
  src: Pick<LookupSource, 'codeCols' | 'titleCols' | 'pk'>,
  fallbackId?: string,
): string {
  const code = pick(row, src.codeCols);
  const title = pick(row, src.titleCols);
  const label = [code, title].filter(Boolean).join(' — ');
  if (label) return label;
  const id = fallbackId || String(row[src.pk] ?? row.id ?? '');
  return id ? `#${id}` : '';
}

/** Liste sınırlıyken seçili ID listede yoksa tek kayıt çek → Code — Title */
export async function resolveLookupOption(
  fieldName: string,
  id: string,
): Promise<LookupOption | null> {
  const src = FIELD_LOOKUP[fieldName];
  if (!src || !id || id === '0') return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    const { getRecord } = await import('./recordsApi');
    const rec = await getRecord(src.table, n, src.pk);
    const row: Record<string, unknown> = {
      ...(rec.standardFields || {}),
      [src.pk]: n,
      id: n,
    };
    const label = formatLookupLabel(row, src, String(n));
    if (!label) return null;
    const opt: LookupOption = { value: String(n), label };
    injectLookupOption(fieldName, opt);
    return opt;
  } catch {
    return null;
  }
}

/** 120.01 → üst 120: Code — Title’ı seçeneklere yaz (ham ID görünmesin) */
export function injectLookupOption(fieldName: string, opt: LookupOption): void {
  const src = FIELD_LOOKUP[fieldName];
  if (!src || !opt.value) return;
  const key = cacheKey(src);
  const prev = cache.get(key);
  cache.set(
    key,
    (prev ?? Promise.resolve([] as LookupOption[])).then((list) => {
      const rest = list.filter((o) => o.value !== opt.value);
      return [opt, ...rest];
    }),
  );
}

function cacheKey(src: LookupSource): string {
  return `${src.table}|${src.pk}|take:${src.take ?? 500}|${src.filterColumn || ''}|${src.filterValue ?? ''}|leaf:${src.leafOnly ? 1 : 0}`;
}

/** Alt hesabı olan üst hesap ID’leri (MainAccountID + kod öneki) */
function parentAccountIds(rows: Record<string, unknown>[], pk: string): Set<string> {
  const parents = new Set<string>();
  const byCode = new Map<string, string>();
  for (const r of rows) {
    const id = String(r[pk] ?? r.id ?? r.Id ?? '').trim();
    if (!id || id === '0') continue;
    const mid = r.MainAccountID ?? r.mainAccountID;
    if (mid != null && String(mid).trim() !== '' && Number(mid) > 0) parents.add(String(mid));
    const code = String(r.Code ?? r.code ?? '').trim();
    if (code) byCode.set(code.toLocaleLowerCase('tr'), id);
  }
  const codes = [...byCode.keys()];
  for (const code of codes) {
    for (const other of codes) {
      if (other.length > code.length && other.startsWith(code + '.')) {
        const id = byCode.get(code);
        if (id) parents.add(id);
        break;
      }
    }
  }
  return parents;
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

export type DependentLookupDef = { parentField: string; filterColumn: string; emptyText?: string };

/** Üst alan değerine göre süzülmüş seçenekler (önbellekli) */
export async function loadDependentLookupOptions(
  fieldName: string,
  parentValue: string | number,
  depOverride?: DependentLookupDef,
): Promise<LookupOption[]> {
  const dep = depOverride || DEPENDENT_LOOKUPS[fieldName];
  const base = FIELD_LOOKUP[fieldName];
  if (!dep || !base) return [];

  // Masraf boyutu kartları: DimNo filtresi + bağlı üst kart (istemci süzme)
  if (/^CostDimCardID[1-5]$/.test(fieldName) && dep.filterColumn === 'LinkedCostDimCardID') {
    const all = (await loadLookupOptions(fieldName)) || [];
    const pid = String(parentValue);
    return all.filter((o) => {
      const linked = o.meta?.linkedCostDimCardId;
      return !linked || linked === pid;
    });
  }

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
  // Stok / bakiye güncel kalsın — stats için önbellek kullanma
  const liveStats = Boolean(src.productStats || src.customerStats);
  if (!liveStats) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const pending = (async () => {
    try {
      const [res, summaries] = await Promise.all([
        listRecords(src.table, {
          pk: src.pk,
          filterColumn: src.filterColumn,
          filterValue: src.filterValue,
          take: src.take ?? 500,
        }),
        src.customerStats
          ? getCustomerSummaries().catch(() => [])
          : Promise.resolve([] as Awaited<ReturnType<typeof getCustomerSummaries>>),
      ]);
      const summaryById = new Map(summaries.map((s) => [String(s.customerCardID), s]));
      const num = (v: unknown) => {
        if (v == null || v === '') return 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      let rawRows = (res.rows || []) as Record<string, unknown>[];
      if (src.leafOnly && src.table === 'AccountCard') {
        const blocked = parentAccountIds(rawRows, src.pk);
        rawRows = rawRows.filter((r) => {
          const id = String(r[src.pk] ?? r.id ?? r.Id ?? '').trim();
          return id && !blocked.has(id);
        });
      }
      return rawRows
        .map((row) => {
          const r = row;
          const id = row[src.pk] ?? row.id ?? row.Id;
          const label = formatLookupLabel(r, src, id != null ? String(id) : '') || String(id ?? '');
          const opt: LookupOption = { label, value: String(id ?? '') };
          if (src.table === 'CostDimCard') {
            const linked = r.LinkedCostDimCardID ?? r.linkedCostDimCardID;
            const dimNo = Number(r.DimNo ?? r.dimNo ?? 0);
            opt.meta = {
              linkedCostDimCardId:
                linked != null && linked !== '' && Number(linked) !== 0 ? String(linked) : undefined,
              dimNo: Number.isFinite(dimNo) && dimNo > 0 ? dimNo : undefined,
            };
            if (dimNo > 0 && !src.filterColumn) {
              opt.label = `${dimNo} · ${label}`;
            }
          }
          if (src.productStats) {
            opt.meta = {
              kind: 'product',
              stockQty: num(r.StockQty ?? r.stockQty),
              mainUnit: String(r.MainUnitName ?? r.mainUnitName ?? r.MainUnit ?? r.mainUnit ?? ''),
              salesOrderQty: num(r.SalesOrderQty ?? r.salesOrderQty),
              purchaseOrderQty: num(r.PurchaseOrderQty ?? r.purchaseOrderQty),
            };
          }
          if (src.customerStats) {
            const s = summaryById.get(String(id ?? ''));
            const bal = s?.balance ?? 0;
            const tax = pick(r, ['TaxNr', 'TaxNumber']);
            opt.meta = {
              kind: 'customer',
              taxNr: tax || undefined,
              balance: bal,
              ba: !s || Math.abs(bal) < 0.005 ? '' : bal > 0 ? 'B' : 'A',
              cityTown: [s?.city, s?.town].filter(Boolean).join(' / ') || undefined,
              phone: s?.phone || undefined,
              lastMoveDate: s?.lastMoveDate
                ? String(s.lastMoveDate).slice(0, 10).split('-').reverse().join('.')
                : undefined,
              riskGroup: s?.riskGroup || undefined,
              overdue: s?.overdue && s.overdue > 0 ? s.overdue : undefined,
            };
          }
          return opt;
        })
        .filter((o) => o.value !== '');
    } catch {
      return [];
    }
  })();
  if (!liveStats) cache.set(key, pending);
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
  ibanFields?: { fieldName: string; fieldType: string; optionsJson?: string }[];
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
    schema.ibanFields,
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
    ibanFields: schema.ibanFields?.map(patch),
    barcodeFields: schema.barcodeFields?.map(patch),
    unitConvFields: schema.unitConvFields?.map(patch),
    productSubFields: schema.productSubFields?.map(patch),
    customerAliasFields: schema.customerAliasFields?.map(patch),
    variantFields: schema.variantFields?.map(patch),
    accountFields: schema.accountFields?.map(patch),
    accountLinkFields: schema.accountLinkFields?.map(patch),
  };
}
