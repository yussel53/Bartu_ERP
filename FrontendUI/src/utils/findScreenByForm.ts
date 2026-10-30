import type { AppModule, MenuScreen } from '../types/formTypes';

/** formCode (+ isteğe bağlı tip) ile menü ekran yolu bul */
export function findScreenByFormCode(
  modules: AppModule[],
  formCode: string,
  typeHint?: number | null,
): MenuScreen | null {
  const hits: MenuScreen[] = [];
  for (const m of modules) {
    for (const g of m.groups || []) {
      for (const s of g.screens || []) {
        if (s.formCode === formCode) hits.push(s);
        for (const c of s.children || []) {
          if (c.formCode === formCode) hits.push(c);
        }
      }
    }
  }
  if (hits.length === 0) return null;
  if (typeHint != null && typeHint !== 0) {
    const typed = hits.find((s) => String(s.documentTypeFilter ?? '') === String(typeHint));
    if (typed) return typed;
  }
  return hits[0];
}
