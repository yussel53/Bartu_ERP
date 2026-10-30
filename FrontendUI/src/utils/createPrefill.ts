import type { DynamicFormDataDto } from '../types/formTypes';

const KEY = 'bartu.createPrefill';

/** Yeni fiş açılmadan önce öndeğer stokla (fişten tahsilat vb.) */
export function stashCreatePrefill(formCode: string, data: DynamicFormDataDto): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ formCode, data, at: Date.now() }));
  } catch {
    /* quota */
  }
}

/** Create yüklemesinde bir kez oku ve sil */
export function takeCreatePrefill(formCode: string): DynamicFormDataDto | undefined {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(KEY);
    const p = JSON.parse(raw) as { formCode?: string; data?: DynamicFormDataDto; at?: number };
    if (p.formCode !== formCode || !p.data) return undefined;
    if (typeof p.at === 'number' && Date.now() - p.at > 90_000) return undefined;
    return p.data;
  } catch {
    return undefined;
  }
}
