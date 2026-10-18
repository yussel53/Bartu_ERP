import { apiJson } from '../config/api';

/** Gelen e-belgeleri otomatik çekme (E-02) — api/egov/auto-fetch */

export interface EGovAutoFetchSetting {
  companyId: number;
  companyTitle?: string | null;
  integratorName?: string | null;
  /** Firma kartında e-Logo kullanıcı / şifre girili mi */
  hasCredentials: boolean;
  isEnabled: boolean;
  intervalMinutes: number;
  daysBack: number;
  fetchEInvoice: boolean;
  fetchEArchive: boolean;
  fetchEDespatch: boolean;
  downloadPdf: boolean;
  downloadXml: boolean;
  autoSendToApproval: boolean;
  approvalGroupId?: number | null;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  nextRunAt?: string | null;
}

export interface EGovAutoFetchLog {
  eGovAutoFetchLogID: number;
  companyId: number;
  companyTitle?: string | null;
  /** 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye */
  docKind: number;
  /** auto · manual */
  triggerKind: string;
  startedByName?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  ok: boolean;
  fetched: number;
  inserted: number;
  updated: number;
  queuedForApproval: number;
  message?: string | null;
}

export function listEGovAutoFetchSettings(): Promise<EGovAutoFetchSetting[]> {
  return apiJson('/api/egov/auto-fetch');
}

export function saveEGovAutoFetchSetting(s: EGovAutoFetchSetting): Promise<{ success: boolean; message: string }> {
  return apiJson(`/api/egov/auto-fetch/${s.companyId}`, { method: 'PUT', body: JSON.stringify(s) });
}

export function runEGovAutoFetch(
  companyId: number,
): Promise<{ ok: boolean; message: string; fetched: number; inserted: number; queuedForApproval: number }> {
  return apiJson(`/api/egov/auto-fetch/${companyId}/run`, { method: 'POST' });
}

export function listEGovAutoFetchLogs(companyId?: number | null, take = 100): Promise<EGovAutoFetchLog[]> {
  const q = new URLSearchParams({ take: String(take) });
  if (companyId) q.set('companyId', String(companyId));
  return apiJson(`/api/egov/auto-fetch/logs?${q}`);
}
