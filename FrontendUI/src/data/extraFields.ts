import {
  ExtraFieldDataType,
  ExtraFieldDef,
  ExtraFieldTarget,
  listExtraFieldTargets,
  listExtraFields,
} from '../api/extraFieldsApi';
import { coerceFormulaValue, evaluateFormula } from './formulaEval';
import { FieldType, FormFieldDto } from '../types/formTypes';

/**
 * Ek alanlar (U_*) — tanım SYS_ExtraFields'ta, değer hedef tablonun gerçek kolonunda.
 * Form şemaları senkron kurulduğu için tanımlar burada önbelleğe alınır.
 */
const cache = new Map<string, ExtraFieldDef[]>();
let targets: ExtraFieldTarget[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function extraFieldTypeToFormType(dataType: ExtraFieldDataType): FieldType {
  if (dataType === 'float') return 'number';
  if (dataType === 'date') return 'date';
  return 'text';
}

function rebuild(items: ExtraFieldDef[]) {
  cache.clear();
  for (const def of items) {
    const list = cache.get(def.tableName) ?? [];
    list.push(def);
    cache.set(def.tableName, list);
  }
  for (const list of cache.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex || a.label.localeCompare(b.label, 'tr'));
  }
}

export async function loadExtraFields(force = false): Promise<void> {
  if (loaded && !force) return;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    try {
      const [items, tg] = await Promise.all([
        listExtraFields(),
        targets.length ? Promise.resolve(targets) : listExtraFieldTargets(),
      ]);
      rebuild(items);
      targets = tg;
      loaded = true;
      listeners.forEach((fn) => fn());
    } catch {
      // API yoksa ek alansız devam et
      loaded = true;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function onExtraFieldsChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getExtraFieldTargets(): ExtraFieldTarget[] {
  return targets;
}

export function getExtraFields(tableName?: string): ExtraFieldDef[] {
  if (!tableName) return [...cache.values()].flat();
  return cache.get(tableName) ?? [];
}

/** Belge başlığı → satır tablosu (RecordsRepository.NestedByParent "lines") */
const LINE_TABLE_BY_PARENT: Record<string, string> = {
  Invoice: 'ProductTrans',
  ProductVoucher: 'ProductTrans',
  OrderVoucher: 'OrderTrans',
  CustomerVoucher: 'CustomerTrans',
  BankVoucher: 'BankTrans',
  AccountVoucher: 'AccountTrans',
};

export function lineTableFor(parentTable: string): string | undefined {
  return LINE_TABLE_BY_PARENT[parentTable];
}

export function extraFieldsToFormFields(tableName: string): FormFieldDto[] {
  return getExtraFields(tableName).map((f, i) => ({
    fieldId: 9000 + i,
    fieldName: f.fieldName,
    label: f.label,
    fieldType: extraFieldTypeToFormType(f.dataType),
    isRequired: f.isRequired && !f.formulaText,
    colSpan: f.colSpan || 6,
    orderIndex: f.orderIndex,
    // Formüllü alan elle değiştirilemez
    isReadOnly: Boolean(f.formulaText?.trim()),
    helpText: f.formulaText?.trim() ? `Formül: ${f.formulaText.trim()}` : undefined,
    decimals: f.dataType === 'float' ? 2 : undefined,
  }));
}

/** Formülü olan ek alanlar — kaydetmeden önce hesaplanır */
export function formulaExtraFields(tableName: string): ExtraFieldDef[] {
  return getExtraFields(tableName).filter((f) => Boolean(f.formulaText?.trim()));
}

/**
 * Formüllü alanları hesaplar. values = kayıt/satır alanları (standart + U_).
 * Sonuç yalnızca değişen alanları içerir.
 */
export function computeFormulaValues(
  tableName: string,
  values: Record<string, unknown>,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const def of formulaExtraFields(tableName)) {
    const { value, error } = evaluateFormula(def.formulaText || '', { ...values, ...out });
    if (error) continue;
    const next = coerceFormulaValue(value, def.dataType);
    const prev = values[def.fieldName];
    const same =
      next === prev ||
      (next === null && (prev === '' || prev === undefined)) ||
      String(next ?? '') === String(prev ?? '');
    if (!same) out[def.fieldName] = next;
  }
  return out;
}
