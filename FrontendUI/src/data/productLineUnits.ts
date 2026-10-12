/**
 * Belge / fiyat satırlarındaki Birim seçenekleri —
 * yalnızca malzeme kartındaki ProductUnit kayıtları.
 */
import { getRecord } from '../api/recordsApi';

export type UnitModuleFilter = 'sales' | 'purchase' | 'material' | 'all';

export type ProductUnitOption = { label: string; value: string };

export type ProductUnitsInfo = {
  productCardId: number;
  options: ProductUnitOption[];
  optionsJson: string;
  defaultUnitId: string | null;
};

/** Kart birim çeviriminde kullanılan katalog etiketleri (UnitID → ad) */
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

/** Malzeme yok / birim yok: boş liste — placeholder ("—", "Birim") yazılmaz */
const EMPTY_OPTIONS_JSON = '[]';
const NO_UNITS_JSON = '[]';

const cache = new Map<string, ProductUnitsInfo>();

function catalogLabel(unitId: string): string {
  return UNIT_CATALOG.find((u) => u.value === unitId)?.label || unitId;
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

  const key = `${productCardId}:${module}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const rec = await getRecord('ProductCard', productCardId, 'ProductCardID');
    const defaultUnitId = String(rec.standardFields?.DefaultUnitID ?? '').trim() || null;
    const rows = (rec.unitConvs || []) as Record<string, unknown>[];

    const seen = new Set<string>();
    const options: ProductUnitOption[] = [];

    const ordered = [...rows].sort((a, b) => {
      const am = isMainFlag(a.IsMain) ? 0 : 1;
      const bm = isMainFlag(b.IsMain) ? 0 : 1;
      if (am !== bm) return am - bm;
      return Number(a.LineNr ?? 0) - Number(b.LineNr ?? 0);
    });

    for (const row of ordered) {
      if (!passesModule(row, module)) continue;
      const uid = String(row.UnitID ?? '').trim();
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      options.push({ label: catalogLabel(uid), value: uid });
    }

    // unitConvs boş ama DefaultUnitID varsa yine de göster
    if (options.length === 0 && defaultUnitId) {
      options.push({ label: catalogLabel(defaultUnitId), value: defaultUnitId });
    }

    // Ana birim (IsMain) önce; yoksa DefaultUnitID; yoksa listedeki ilk
    const mainRow = ordered.find((r) => isMainFlag(r.IsMain) && passesModule(r, module));
    const mainId = mainRow ? String(mainRow.UnitID ?? '').trim() || null : null;
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
    cache.set(key, info);
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
    const uid = String(row.UnitID ?? '').trim();
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
