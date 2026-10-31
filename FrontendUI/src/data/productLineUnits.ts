/**
 * Belge / fiyat satırlarındaki Birim seçenekleri —
 * yalnızca malzeme kartındaki ProductUnit kayıtları.
 */
import { getRecord, listRecords } from '../api/recordsApi';

export type UnitModuleFilter = 'sales' | 'purchase' | 'material' | 'all';

export type ProductUnitOption = { label: string; value: string };

export type ProductUnitsInfo = {
  productCardId: number;
  options: ProductUnitOption[];
  optionsJson: string;
  defaultUnitId: string | null;
};

export type UnitMaster = {
  id: string;
  code: string;
  title: string;
  globalCode: string;
  active: boolean;
};

/** Kart birim çeviriminde kullanılan katalog (UnitID → ad). Global kod UnitCard’tan gelir. */
export const UNIT_CATALOG: ProductUnitOption[] = [
  { label: 'Adet', value: '1' },
  { label: 'Koli', value: '2' },
  { label: 'Paket', value: '3' },
  { label: 'Kg', value: '4' },
  { label: 'Litre', value: '5' },
  { label: 'Metre', value: '6' },
  { label: 'Saat', value: '7' },
  { label: 'Gün', value: '8' },
];

const UNIT_FALLBACK: UnitMaster[] = [
  { id: '1', code: 'ADT', title: 'Adet', globalCode: 'EA', active: true },
  { id: '2', code: 'KOLI', title: 'Koli', globalCode: 'BX', active: true },
  { id: '3', code: 'PKT', title: 'Paket', globalCode: 'PA', active: true },
  { id: '4', code: 'KG', title: 'Kg', globalCode: 'KGM', active: true },
  { id: '5', code: 'LT', title: 'Litre', globalCode: 'LTR', active: true },
  { id: '6', code: 'MT', title: 'Metre', globalCode: 'MTR', active: true },
  { id: '7', code: 'SAAT', title: 'Saat', globalCode: 'HUR', active: true },
  { id: '8', code: 'GUN', title: 'Gün', globalCode: 'DAY', active: true },
];

let unitMasters: UnitMaster[] | null = null;
let unitMastersLoad: Promise<UnitMaster[]> | null = null;

function asActive(v: unknown): boolean {
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  return true;
}

/** Ana birim / birim seçim etiketi: Adet (EA) */
export function unitOptionLabel(title: string, globalCode?: string): string {
  const name = title.trim();
  const code = (globalCode || '').trim();
  return code ? `${name} (${code})` : name;
}

export function currentUnitMasters(): UnitMaster[] {
  return unitMasters ?? UNIT_FALLBACK;
}

export function unitSelectOptionsJson(): string {
  const rows = currentUnitMasters().filter((u) => u.active);
  const src = rows.length ? rows : UNIT_FALLBACK;
  return JSON.stringify(src.map((u) => ({ label: unitOptionLabel(u.title, u.globalCode), value: u.id })));
}

export function resetUnitCatalog(): void {
  unitMasters = null;
  unitMastersLoad = null;
}

/** UnitCard ana kaydı. Tablo yoksa sabit katalog. */
export function loadUnitCatalog(): Promise<UnitMaster[]> {
  if (unitMasters) return Promise.resolve(unitMasters);
  if (!unitMastersLoad) {
    unitMastersLoad = listRecords('UnitCard', { take: 300 })
      .then((res) => {
        const rows: UnitMaster[] = [];
        for (const row of res.rows || []) {
          const id = String(fieldOf(row, 'UnitID') ?? '').trim();
          const title = String(fieldOf(row, 'Title') ?? '').trim();
          if (!id || !title) continue;
          rows.push({
            id,
            code: String(fieldOf(row, 'Code') ?? '').trim(),
            title,
            globalCode: String(fieldOf(row, 'GlobalCode') ?? '').trim(),
            active: asActive(fieldOf(row, 'IsActive')),
          });
        }
        rows.sort((a, b) => Number(a.id) - Number(b.id));
        unitMasters = rows.length ? rows : UNIT_FALLBACK;
        return unitMasters;
      })
      .catch(() => {
        unitMasters = UNIT_FALLBACK;
        return unitMasters;
      });
  }
  return unitMastersLoad;
}

/** Malzeme yok / birim yok: boş liste — placeholder ("—", "Birim") yazılmaz */
const EMPTY_OPTIONS_JSON = '[]';
const NO_UNITS_JSON = '[]';

const cache = new Map<string, ProductUnitsInfo>();

function catalogLabel(unitId: string): string {
  const row = currentUnitMasters().find((u) => u.id === unitId);
  if (row) return row.title;
  return UNIT_CATALOG.find((u) => u.value === unitId)?.label || unitId;
}

function fieldOf(row: Record<string, unknown>, name: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? row[key] : undefined;
}

function asBool(v: unknown, fallback = true): boolean {
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return fallback;
}

function isMainFlag(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

function passesModule(row: Record<string, unknown>, module: UnitModuleFilter): boolean {
  if (module === 'all') return true;
  if (module === 'sales') return asBool(row.UseInSales, true);
  if (module === 'purchase') return asBool(row.UseInPurchase, true);
  if (module === 'material') return asBool(row.UseInMaterial, true);
  return true;
}

export function emptyProductUnits(productCardId = 0): ProductUnitsInfo {
  return {
    productCardId,
    options: [],
    optionsJson: productCardId > 0 ? NO_UNITS_JSON : EMPTY_OPTIONS_JSON,
    defaultUnitId: null,
  };
}

export function clearProductUnitsCache(productCardId?: number): void {
  if (productCardId == null) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${productCardId}:`)) cache.delete(key);
  }
}

/** Malzeme kartının birimlerini getir (önbellekli). */
export async function fetchProductUnitOptions(
  productCardId: number,
  module: UnitModuleFilter = 'all',
): Promise<ProductUnitsInfo> {
  if (!productCardId || productCardId <= 0) return emptyProductUnits(0);

  await loadUnitCatalog();

  try {
    const rec = await getRecord('ProductCard', productCardId, 'ProductCardID');
    const std = (rec.standardFields || {}) as Record<string, unknown>;
    const defaultUnitId = String(fieldOf(std, 'DefaultUnitID') ?? '').trim() || null;
    let rows = (rec.unitConvs || []) as Record<string, unknown>[];
    if (!rows.length) {
      try {
        const listed = await listRecords('ProductUnit', {
          filterColumn: 'ProductCardID',
          filterValue: productCardId,
          take: 100,
        });
        rows = (listed.rows || []) as Record<string, unknown>[];
      } catch {
        /* kart yanıtındaki set yeterli */
      }
    }

    const seen = new Set<string>();
    const options: ProductUnitOption[] = [];

    const ordered = [...rows].sort((a, b) => {
      const am = isMainFlag(fieldOf(a, 'IsMain')) ? 0 : 1;
      const bm = isMainFlag(fieldOf(b, 'IsMain')) ? 0 : 1;
      if (am !== bm) return am - bm;
      return Number(fieldOf(a, 'LineNr') ?? 0) - Number(fieldOf(b, 'LineNr') ?? 0);
    });

    const mainRowAll = ordered.find((r) => isMainFlag(fieldOf(r, 'IsMain')));
    const mainIdAll = mainRowAll ? String(fieldOf(mainRowAll, 'UnitID') ?? '').trim() : '';
    const mainLabel = catalogLabel(mainIdAll || defaultUnitId || '');

    const pushRow = (row: Record<string, unknown>) => {
      const uid = String(fieldOf(row, 'UnitID') ?? '').trim();
      if (!uid || seen.has(uid)) return;
      seen.add(uid);
      const name = catalogLabel(uid);
      const main = isMainFlag(fieldOf(row, 'IsMain'));
      const mainQty = Number(fieldOf(row, 'MainQty'));
      const unitQty = Number(fieldOf(row, 'UnitQty'));
      let label = name;
      if (!main && mainQty > 0 && unitQty > 0 && mainQty !== unitQty && mainLabel) {
        const per = mainQty / unitQty;
        const perText = Number.isInteger(per) ? String(per) : String(Math.round(per * 1000) / 1000);
        label = `${name} (${perText} ${mainLabel})`;
      }
      options.push({ label, value: uid });
    };

    const filtered = ordered.filter((row) => passesModule(
      {
        UseInSales: fieldOf(row, 'UseInSales'),
        UseInPurchase: fieldOf(row, 'UseInPurchase'),
        UseInMaterial: fieldOf(row, 'UseInMaterial'),
      },
      module,
    ));
    // Ekran filtresi seti boşaltırsa karttaki tüm birimler gelsin
    const source = filtered.length > 0 ? filtered : ordered;
    for (const row of source) pushRow(row);

    // unitConvs boş ama DefaultUnitID varsa yine de göster
    if (options.length === 0 && defaultUnitId) {
      options.push({ label: catalogLabel(defaultUnitId), value: defaultUnitId });
    }

    // Ana birim (IsMain) önce; yoksa DefaultUnitID; yoksa listedeki ilk
    const mainRow = source.find((r) => isMainFlag(fieldOf(r, 'IsMain')));
    const mainId = mainRow ? String(fieldOf(mainRow, 'UnitID') ?? '').trim() || null : null;
    let preferred =
      (mainId && options.some((o) => o.value === mainId) ? mainId : null) ||
      (defaultUnitId && options.some((o) => o.value === defaultUnitId) ? defaultUnitId : null) ||
      options[0]?.value ||
      null;

    const info: ProductUnitsInfo = {
      productCardId,
      options,
      optionsJson:
        options.length > 0
          ? JSON.stringify(options)
          : NO_UNITS_JSON,
      defaultUnitId: preferred,
    };
    return info;
  } catch {
    // Geçici ağ hatasında önbelleğe boş yazma — sonraki seçimde tekrar dene
    return emptyProductUnits(productCardId);
  }
}

/** Mevcut birim listede yoksa varsayılanı döndür. */
export function resolveLineUnitId(
  current: unknown,
  info: ProductUnitsInfo,
): string | null {
  const cur = String(current ?? '').trim();
  if (cur && info.options.some((o) => o.value === cur)) return cur;
  return info.defaultUnitId;
}

/** Formdaki unitConvs satırlarından select seçenekleri (aynı kart içi varyant vb.). */
export function unitsFromFormConvs(
  unitConvs: Record<string, unknown>[] | undefined,
  defaultUnitId?: unknown,
  module: UnitModuleFilter = 'all',
): ProductUnitsInfo {
  const seen = new Set<string>();
  const options: ProductUnitOption[] = [];
  for (const row of unitConvs || []) {
    if (!passesModule(row, module)) continue;
    const uid = String(fieldOf(row, 'UnitID') ?? '').trim();
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    options.push({ label: catalogLabel(uid), value: uid });
  }
  const def = String(defaultUnitId ?? '').trim() || null;
  if (options.length === 0 && def) {
    options.push({ label: catalogLabel(def), value: def });
  }
  const preferred =
    def && options.some((o) => o.value === def) ? def : options[0]?.value ?? null;
  return {
    productCardId: 0,
    options,
    optionsJson: options.length > 0 ? JSON.stringify(options) : NO_UNITS_JSON,
    defaultUnitId: preferred,
  };
}
