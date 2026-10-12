/** Malzeme birim çevirimi + birim altı barkod birleştirme / düzleştirme
 * Oran: MainQty (ana birim) = UnitQty (çevrim birimi)
 * Ölçü: Weight / Length / Width / Height — birim başına
 * Geçerlilik: UseInMaterial / UseInSales / UseInPurchase
 */

export type UnitConvFormRow = {
  UnitID: string | number;
  MainQty: string | number;
  UnitQty: string | number;
  Weight?: string | number;
  Length?: string | number;
  Width?: string | number;
  Height?: string | number;
  UseInMaterial?: boolean;
  UseInSales?: boolean;
  UseInPurchase?: boolean;
  /** @deprecated eski alan — okuma uyumluluğu */
  ConvFactor?: string | number;
  IsMain?: boolean | number;
  LineNr?: number;
  barcodes?: Record<string, unknown>[];
};

function isMainFlag(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

function asBool(v: unknown, fallback = true): boolean {
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return fallback;
}

function numOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function optNum(v: unknown): number | '' {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

function resolveRatio(u: Record<string, unknown>, main: boolean): { MainQty: number; UnitQty: number } {
  if (main) return { MainQty: 1, UnitQty: 1 };
  if (u.MainQty != null || u.UnitQty != null) {
    return { MainQty: numOr(u.MainQty, 1), UnitQty: numOr(u.UnitQty, 1) };
  }
  if (u.ConvFactor != null) {
    return { MainQty: numOr(u.ConvFactor, 1), UnitQty: 1 };
  }
  return { MainQty: 1, UnitQty: 1 };
}

function dimsFrom(u: Record<string, unknown>): Pick<UnitConvFormRow, 'Weight' | 'Length' | 'Width' | 'Height'> {
  return {
    Weight: optNum(u.Weight),
    Length: optNum(u.Length),
    Width: optNum(u.Width),
    Height: optNum(u.Height),
  };
}

function validFrom(u?: Record<string, unknown>): Pick<
  UnitConvFormRow,
  'UseInMaterial' | 'UseInSales' | 'UseInPurchase'
> {
  return {
    UseInMaterial: asBool(u?.UseInMaterial, true),
    UseInSales: asBool(u?.UseInSales, true),
    UseInPurchase: asBool(u?.UseInPurchase, true),
  };
}

const emptyDims = { Weight: '' as const, Length: '' as const, Width: '' as const, Height: '' as const };
const defaultValid = { UseInMaterial: true, UseInSales: true, UseInPurchase: true };

/** API unitConvs + barcodes → form satırları (ana birim üstte) */
export function buildUnitConvFormRows(
  unitConvs: Record<string, unknown>[] | undefined,
  barcodes: Record<string, unknown>[] | undefined,
  defaultUnitId: unknown,
): UnitConvFormRow[] {
  const byUnit = new Map<string, Record<string, unknown>[]>();
  for (const b of barcodes || []) {
    const uid = String(b.UnitID ?? '').trim();
    if (!byUnit.has(uid)) byUnit.set(uid, []);
    byUnit.get(uid)!.push({
      Barcode: b.Barcode ?? '',
      Type: b.Type ?? '1',
      LineNr: b.LineNr,
    });
  }

  const rows: UnitConvFormRow[] = [];
  const seen = new Set<string>();
  const mainId = String(defaultUnitId ?? '').trim();

  if (mainId) {
    const existing = (unitConvs || []).find(
      (u) => String(u.UnitID ?? '') === mainId || isMainFlag(u.IsMain),
    );
    rows.push({
      UnitID: mainId,
      MainQty: 1,
      UnitQty: 1,
      IsMain: true,
      LineNr: 1,
      ...(existing ? dimsFrom(existing) : emptyDims),
      ...validFrom(existing),
      barcodes: byUnit.get(mainId) || [],
    });
    seen.add(mainId);
  }

  const sorted = [...(unitConvs || [])].sort(
    (a, b) => Number(a.LineNr ?? 0) - Number(b.LineNr ?? 0),
  );

  for (const u of sorted) {
    const uid = String(u.UnitID ?? '').trim();
    if (!uid) continue;
    const main = isMainFlag(u.IsMain) || uid === mainId;
    if (main) {
      if (seen.has(uid)) continue;
      rows.push({
        UnitID: uid,
        MainQty: 1,
        UnitQty: 1,
        IsMain: true,
        LineNr: rows.length + 1,
        ...dimsFrom(u),
        ...validFrom(u),
        barcodes: byUnit.get(uid) || [],
      });
      seen.add(uid);
      continue;
    }
    if (seen.has(uid)) continue;
    const ratio = resolveRatio(u, false);
    rows.push({
      UnitID: uid,
      MainQty: ratio.MainQty,
      UnitQty: ratio.UnitQty,
      IsMain: false,
      LineNr: rows.length + 1,
      ...dimsFrom(u),
      ...validFrom(u),
      barcodes: byUnit.get(uid) || [],
    });
    seen.add(uid);
  }

  for (const [uid, list] of byUnit) {
    if (!uid || seen.has(uid)) continue;
    rows.push({
      UnitID: uid,
      MainQty: 1,
      UnitQty: 1,
      IsMain: uid === mainId,
      LineNr: rows.length + 1,
      ...emptyDims,
      ...defaultValid,
      barcodes: list,
    });
    seen.add(uid);
  }

  if (rows.length === 0) {
    rows.push({
      UnitID: mainId || '',
      MainQty: 1,
      UnitQty: 1,
      IsMain: true,
      LineNr: 1,
      ...emptyDims,
      ...defaultValid,
      barcodes: [],
    });
  }

  return rows;
}

/** Form satırlarından kaydetme payload'ı */
export function flattenUnitConvPayload(unitRows: UnitConvFormRow[] | undefined): {
  unitConvs: Record<string, unknown>[];
  barcodes: Record<string, unknown>[];
} {
  const rows = unitRows || [];
  const unitConvs: Record<string, unknown>[] = [];
  const barcodes: Record<string, unknown>[] = [];

  rows.forEach((u, i) => {
    const uid = String(u.UnitID ?? '').trim();
    if (!uid) return;
    const main = isMainFlag(u.IsMain);
    const mainQty = main ? 1 : numOr(u.MainQty, 1);
    const unitQty = main ? 1 : numOr(u.UnitQty, 1);
    unitConvs.push({
      UnitID: uid,
      MainQty: mainQty,
      UnitQty: unitQty,
      ConvFactor: unitQty !== 0 ? mainQty / unitQty : mainQty,
      IsMain: main,
      LineNr: i + 1,
      Weight: optNum(u.Weight) === '' ? null : optNum(u.Weight),
      Length: optNum(u.Length) === '' ? null : optNum(u.Length),
      Width: optNum(u.Width) === '' ? null : optNum(u.Width),
      Height: optNum(u.Height) === '' ? null : optNum(u.Height),
      UseInMaterial: asBool(u.UseInMaterial, true),
      UseInSales: asBool(u.UseInSales, true),
      UseInPurchase: asBool(u.UseInPurchase, true),
    });
    const bars = (u.barcodes || []).filter((b) => String(b?.Barcode ?? '').trim() !== '');
    bars.forEach((b, j) => {
      barcodes.push({
        Barcode: String(b.Barcode).trim(),
        Type: b.Type ?? '1',
        LineNr: j + 1,
        UnitID: uid,
      });
    });
  });

  return { unitConvs, barcodes };
}

export function parseUnitSelectOptions(
  optionsJson?: string,
): { label: string; value: string }[] {
  if (!optionsJson) return [];
  try {
    const arr = JSON.parse(optionsJson) as { label?: string; value?: string }[];
    return (arr || []).map((o) => ({
      label: String(o.label ?? o.value ?? ''),
      value: String(o.value ?? ''),
    }));
  } catch {
    return [];
  }
}

export function unitLabel(
  unitId: unknown,
  options: { label: string; value: string }[],
): string {
  const v = String(unitId ?? '').trim();
  if (!v) return '—';
  return options.find((o) => o.value === v)?.label || v;
}
