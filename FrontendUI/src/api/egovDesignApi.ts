import { API_BASE, apiJson } from '../config/api';

export interface EGovDesignRow {
  eGovXsltDesignID: number;
  title: string;
  fileName?: string | null;
  contentLength: number;
  contentHash?: string | null;
  isActive: boolean;
  notes?: string | null;
  /** EFATURA · EARSIV · EIRSALIYE · EMM · ESMM */
  docGroup?: string | null;
  ruleCount: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface EGovDesignRuleRow {
  eGovDesignRuleID: number;
  docType: number;
  ruleType: number;
  ruleValue?: string | null;
  priority: number;
  eGovXsltDesignID: number;
  designTitle?: string | null;
  designActive: boolean;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface EGovDesignRuleInput {
  docType: number;
  ruleType: number;
  ruleValue?: string | null;
  priority: number;
  eGovXsltDesignID: number;
  description?: string | null;
  isActive: boolean;
}

/** Tasarımın belge grubu — şablon eklenirken yalnız şablonun türüne ait tasarımlar seçilir */
export const EGOV_DESIGN_GROUPS: { value: string; label: string }[] = [
  { value: 'EFATURA', label: 'e-Fatura' },
  { value: 'EARSIV', label: 'e-Arşiv' },
  { value: 'EIRSALIYE', label: 'e-İrsaliye' },
  { value: 'EMM', label: 'e-Müstahsil Makbuzu' },
  { value: 'ESMM', label: 'e-Serbest Meslek Makbuzu' },
];

export const egovDesignGroupLabel = (g?: string | null) => EGOV_DESIGN_GROUPS.find((x) => x.value === g)?.label ?? '—';

/** Şablon belge türü → tasarım grubu (sunucudaki EGovDesignCodes.DocGroup ile aynı) */
export function egovDocTypeGroup(docType: number): string {
  if ([3, 4, 12, 13].includes(docType)) return 'EARSIV';
  if ([5, 6, 10].includes(docType)) return 'EIRSALIYE';
  if (docType === 7) return 'EMM';
  if (docType === 8) return 'ESMM';
  return 'EFATURA';
}

/** Dosya / tasarım adından grup tahmini (yüklemede öndeğer) */
export function guessEGovDesignGroup(name: string): string {
  const n = name.toLocaleLowerCase('tr-TR');
  if (n.includes('arsiv') || n.includes('arşiv')) return 'EARSIV';
  if (n.includes('irsaliye')) return 'EIRSALIYE';
  if (n.includes('mustahsil') || n.includes('müstahsil')) return 'EMM';
  if (n.includes('smm') || n.includes('serbest')) return 'ESMM';
  return 'EFATURA';
}

type Listed<T> = { ready: boolean; message?: string; rows: T[] };
type Result = { success: boolean; message?: string; id?: number };

async function sendForm<T>(path: string, form: FormData, fallback: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message || fallback);
  return data as T;
}

// ─── Tasarımlar (XSLT kütüphanesi) ─────────────────────────────────────────

export function listEGovDesigns(): Promise<Listed<EGovDesignRow>> {
  return apiJson('/api/egov/designs');
}

export function uploadEGovDesign(file: File, title?: string, docGroup?: string): Promise<Result> {
  const form = new FormData();
  form.append('file', file);
  if (title?.trim()) form.append('title', title.trim());
  if (docGroup) form.append('docGroup', docGroup);
  return sendForm('/api/egov/designs', form, 'Tasarım yüklenemedi');
}

export function replaceEGovDesignContent(id: number, file: File): Promise<Result> {
  const form = new FormData();
  form.append('file', file);
  return sendForm(`/api/egov/designs/${id}/content`, form, 'XSLT değiştirilemedi');
}

export function updateEGovDesign(
  id: number,
  body: { title: string; isActive: boolean; notes?: string | null; docGroup?: string | null },
): Promise<Result> {
  return apiJson(`/api/egov/designs/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteEGovDesign(id: number): Promise<Result> {
  return apiJson(`/api/egov/designs/${id}`, { method: 'DELETE' });
}

export function egovDesignDownloadUrl(id: number): string {
  return `${API_BASE}/api/egov/designs/${id}/download`;
}

/** HTML önizleme metni. egovDocumentId → kayıtlı belge; sample → örnek tür; ikisi de yoksa tasarımdan tahmin. */
export async function previewEGovDesign(
  id: number,
  opts: { sample?: string | null; egovDocumentId?: number | null } = {},
): Promise<string> {
  const qs = new URLSearchParams();
  if (opts.egovDocumentId) qs.set('egovDocumentId', String(opts.egovDocumentId));
  else if (opts.sample) qs.set('sample', opts.sample);
  const res = await fetch(`${API_BASE}/api/egov/designs/${id}/preview${qs.toString() ? `?${qs}` : ''}`);
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

// ─── Şablonlar (kurallar) ──────────────────────────────────────────────────

export function listEGovDesignRules(docType?: number | null): Promise<Listed<EGovDesignRuleRow>> {
  return apiJson(`/api/egov/design-rules${docType ? `?docType=${docType}` : ''}`);
}

export function createEGovDesignRule(body: EGovDesignRuleInput): Promise<Result> {
  return apiJson('/api/egov/design-rules', { method: 'POST', body: JSON.stringify(body) });
}

export function updateEGovDesignRule(id: number, body: EGovDesignRuleInput): Promise<Result> {
  return apiJson(`/api/egov/design-rules/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteEGovDesignRule(id: number): Promise<Result> {
  return apiJson(`/api/egov/design-rules/${id}`, { method: 'DELETE' });
}
