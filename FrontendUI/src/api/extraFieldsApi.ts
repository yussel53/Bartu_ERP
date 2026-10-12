import { apiJson } from '../config/api';

/** Ek alan veri tipi — hedef tabloda açılan gerçek kolonun tipi */
export type ExtraFieldDataType = 'text' | 'date' | 'float';

export interface ExtraFieldDef {
  extraFieldID: number;
  tableName: string;
  /** U_Marka */
  fieldName: string;
  label: string;
  dataType: ExtraFieldDataType;
  textLength?: number | null;
  /** Doluysa alan elle girilmez, formül sonucu yazılır */
  formulaText?: string | null;
  isRequired: boolean;
  colSpan: number;
  orderIndex: number;
  isActive: boolean;
  createdBy?: string | null;
}

export interface ExtraFieldTarget {
  tableName: string;
  title: string;
  /** card = kart/başlık alanı, line = satır (hareket) alanı */
  kind: 'card' | 'line';
  group: string;
}

export async function listExtraFieldTargets(): Promise<ExtraFieldTarget[]> {
  return apiJson<ExtraFieldTarget[]>('/api/extra-fields/targets');
}

export async function listExtraFields(
  table?: string,
  includeInactive = false,
): Promise<ExtraFieldDef[]> {
  const qs = new URLSearchParams();
  if (table) qs.set('table', table);
  if (includeInactive) qs.set('includeInactive', 'true');
  const res = await apiJson<ExtraFieldDef[] | { items: ExtraFieldDef[] }>(
    `/api/extra-fields${qs.toString() ? `?${qs}` : ''}`,
  );
  return Array.isArray(res) ? res : res.items || [];
}

export async function listTableColumns(table: string): Promise<string[]> {
  return apiJson<string[]>(`/api/extra-fields/columns/${encodeURIComponent(table)}`);
}

export async function saveExtraField(
  def: Partial<ExtraFieldDef> & { tableName: string; fieldName: string; label: string },
): Promise<{ ok: boolean; message: string; field: ExtraFieldDef }> {
  return apiJson('/api/extra-fields', { method: 'POST', body: JSON.stringify(def) });
}

export async function deleteExtraField(
  id: number,
  dropColumn: boolean,
): Promise<{ ok: boolean; message: string }> {
  return apiJson(`/api/extra-fields/${id}?dropColumn=${dropColumn}`, { method: 'DELETE' });
}
