import { FormFieldDto, FormSchemaDto } from '../types/formTypes';

/** Tasarımda tek alanın ayarı — dizideki sıra = ekrandaki sıra */
export interface LayoutFieldCfg {
  name: string;
  visible: boolean;
  /** Boşsa standart etiket */
  label?: string;
  /** Standartta zorunlu olmayan alanı zorunlu yap (standart zorunlular kapatılamaz) */
  required?: boolean;
  readOnly?: boolean;
  /** Yeni kayıtta gelecek değer */
  defaultValue?: string;
}

export interface FormLayoutDef {
  v: 1;
  /** Başlık / kart alanları */
  header: LayoutFieldCfg[];
  /** Kalem tablosu kolonları */
  lines: LayoutFieldCfg[];
  /** Ek Alanlar (U_*) sekmesi */
  custom: LayoutFieldCfg[];
}

export type LayoutSection = 'header' | 'lines' | 'custom';

const toCfg = (f: FormFieldDto): LayoutFieldCfg => ({ name: f.fieldName, visible: true });

/** Şemanın mevcut alanlarından «standart» tasarım */
export function defaultLayoutFromSchema(schema: FormSchemaDto): FormLayoutDef {
  return {
    v: 1,
    header: schema.fields.map(toCfg),
    lines: (schema.lineFields || []).map(toCfg),
    custom: (schema.customFields || []).map(toCfg),
  };
}

export function parseLayoutJson(json: string | null | undefined): FormLayoutDef | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as Partial<FormLayoutDef>;
    return { v: 1, header: d.header || [], lines: d.lines || [], custom: d.custom || [] };
  } catch {
    return null;
  }
}

/**
 * Tasarımı alan listesine uygula: sıra, görünürlük, etiket, zorunlu, salt okunur, varsayılan.
 * Tasarımda olmayan (sonradan eklenen) alanlar sona eklenir ve görünür kalır.
 * Standartta zorunlu alan gizlenemez (kayıt bozulmasın).
 */
export function applyLayoutToFields(fields: FormFieldDto[], cfgs: LayoutFieldCfg[]): FormFieldDto[] {
  if (!cfgs.length) return fields;
  const byName = new Map(fields.map((f) => [f.fieldName, f]));
  const out: FormFieldDto[] = [];
  const seen = new Set<string>();
  cfgs.forEach((c, i) => {
    const f = byName.get(c.name);
    if (!f || seen.has(c.name)) return;
    seen.add(c.name);
    if (c.visible === false && !f.isRequired) return;
    out.push({
      ...f,
      label: c.label?.trim() ? c.label.trim() : f.label,
      isRequired: f.isRequired || Boolean(c.required),
      isReadOnly: c.readOnly ?? f.isReadOnly,
      defaultValue: c.defaultValue != null && c.defaultValue !== '' ? c.defaultValue : f.defaultValue,
      orderIndex: (i + 1) * 10,
    });
  });
  fields.forEach((f, i) => {
    if (!seen.has(f.fieldName)) out.push({ ...f, orderIndex: 100000 + i });
  });
  return out;
}

export function applyFormLayout(schema: FormSchemaDto, def: FormLayoutDef | null): FormSchemaDto {
  if (!def) return schema;
  return {
    ...schema,
    fields: applyLayoutToFields(schema.fields, def.header),
    lineFields: schema.lineFields ? applyLayoutToFields(schema.lineFields, def.lines) : schema.lineFields,
    customFields: schema.customFields ? applyLayoutToFields(schema.customFields, def.custom) : schema.customFields,
  };
}

/** Tasarımı şemanın güncel alanlarıyla birleştir (yeni eklenen alanlar listeye girsin) */
export function mergeLayoutWithSchema(schema: FormSchemaDto, def: FormLayoutDef | null): FormLayoutDef {
  const base = defaultLayoutFromSchema(schema);
  if (!def) return base;
  const merge = (cur: LayoutFieldCfg[], all: LayoutFieldCfg[]) => {
    const names = new Set(all.map((c) => c.name));
    const kept = cur.filter((c) => names.has(c.name));
    const keptNames = new Set(kept.map((c) => c.name));
    return [...kept, ...all.filter((c) => !keptNames.has(c.name))];
  };
  return {
    v: 1,
    header: merge(def.header, base.header),
    lines: merge(def.lines, base.lines),
    custom: merge(def.custom, base.custom),
  };
}

/** Kullanıcının bu form için seçtiği tasarım (tarayıcıda hatırlanır) */
export function storedLayoutChoice(formCode: string, userId: string): number | null | undefined {
  try {
    const v = window.localStorage.getItem(`bartu.formLayout.${formCode}.${userId}`);
    if (v == null) return undefined;
    return v === 'std' ? null : Number(v);
  } catch {
    return undefined;
  }
}

export function storeLayoutChoice(formCode: string, userId: string, layoutId: number | null) {
  try {
    window.localStorage.setItem(`bartu.formLayout.${formCode}.${userId}`, layoutId == null ? 'std' : String(layoutId));
  } catch {
    /* gizli pencere vb. */
  }
}
