import { apiJson } from '../config/api';

export interface ELogoCompany {
  companyId: number;
  title: string;
  integratorName?: string | null;
  integratorWsUrl?: string | null;
  integratorUser?: string | null;
  hasPassword: boolean;
  integratorVkN?: string | null;
}

export interface ELogoSyncRequest {
  companyId?: number;
  beginDate: string;
  endDate: string;
  /** 1 Gelen · 2 Giden */
  direction: number;
  /** 1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye */
  docKind: number;
  downloadPdf?: boolean;
  downloadXml?: boolean;
  startProcess?: boolean;
  startedBy?: number;
}

export interface ELogoSyncItem {
  uuid: string;
  documentNo?: string | null;
  eGovDocumentId?: number | null;
  action: string;
  pdfSaved: boolean;
  processStarted: boolean;
  error?: string | null;
}

export interface ELogoSyncResult {
  ok: boolean;
  message: string;
  fetched: number;
  inserted: number;
  updated: number;
  pdfSaved: number;
  processStarted: number;
  items: ELogoSyncItem[];
}

export async function listELogoCompanies(): Promise<ELogoCompany[]> {
  return apiJson<ELogoCompany[]>('/api/elogo/companies');
}

export async function syncELogoDocuments(body: ELogoSyncRequest): Promise<ELogoSyncResult> {
  return apiJson<ELogoSyncResult>('/api/elogo/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
