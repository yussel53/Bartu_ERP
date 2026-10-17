import { API_BASE, apiJson } from '../config/api';

export interface EGovXsltRow {
  eGovXsltTemplateID: number;
  docKind: number;
  companyId?: number | null;
  companyTitle?: string | null;
  title: string;
  fileName?: string | null;
  contentLength: number;
  contentHash?: string | null;
  isDefault: boolean;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface EGovXsltList {
  ready: boolean;
  message?: string;
  rows: EGovXsltRow[];
}

async function sendForm<T>(path: string, form: FormData, fallback: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || fallback);
  return data as T;
}

export function listEGovXslt(docKind: number): Promise<EGovXsltList> {
  return apiJson<EGovXsltList>(`/api/egov/xslt?docKind=${docKind}`);
}

export function uploadEGovXslt(p: {
  docKind: number;
  file: File;
  title?: string;
  companyId?: number | null;
  isDefault?: boolean;
  notes?: string;
}): Promise<{ success: boolean; id: number; message: string }> {
  const form = new FormData();
  form.append('docKind', String(p.docKind));
  form.append('file', p.file);
  if (p.title?.trim()) form.append('title', p.title.trim());
  if (p.companyId) form.append('companyId', String(p.companyId));
  form.append('isDefault', String(Boolean(p.isDefault)));
  if (p.notes?.trim()) form.append('notes', p.notes.trim());
  return sendForm('/api/egov/xslt', form, 'XSLT yüklenemedi');
}

export function replaceEGovXsltContent(id: number, file: File): Promise<{ success: boolean; message: string }> {
  const form = new FormData();
  form.append('file', file);
  return sendForm(`/api/egov/xslt/${id}/content`, form, 'XSLT değiştirilemedi');
}

export function updateEGovXslt(
  id: number,
  body: { title: string; companyId?: number | null; isActive: boolean; notes?: string | null },
): Promise<{ success: boolean }> {
  return apiJson(`/api/egov/xslt/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function setEGovXsltDefault(id: number, isDefault: boolean): Promise<{ success: boolean; message: string }> {
  return apiJson(`/api/egov/xslt/${id}/default`, { method: 'POST', body: JSON.stringify({ isDefault }) });
}

export function deleteEGovXslt(id: number): Promise<{ success: boolean }> {
  return apiJson(`/api/egov/xslt/${id}`, { method: 'DELETE' });
}

export function egovXsltDownloadUrl(id: number): string {
  return `${API_BASE}/api/egov/xslt/${id}/download`;
}

/** HTML önizleme metni; egovDocumentId verilirse o belgenin UBL'i, yoksa örnek belge kullanılır. */
export async function previewEGovXslt(id: number, egovDocumentId?: number | null): Promise<string> {
  const qs = egovDocumentId ? `?egovDocumentId=${egovDocumentId}` : '';
  const res = await fetch(`${API_BASE}/api/egov/xslt/${id}/preview${qs}`);
  const text = await res.text();
  if (!res.ok) {
    let msg = 'Önizleme oluşturulamadı';
    try {
      msg = (JSON.parse(text) as { message?: string }).message || msg;
    } catch {
      /* düz metin */
    }
    throw new Error(msg);
  }
  return text;
}
