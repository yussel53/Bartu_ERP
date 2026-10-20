import { apiJson } from '../config/api';

/** Gelen TİCARİ faturaya KABUL / RED ve harici itiraz / iptal kaydı — api/egov/response */

export interface EGovObjection {
  eGovDocumentObjectionID: number;
  /** ITIRAZ · IPTAL */
  kind: string;
  /** KEP · NOTER · TELGRAF · TAAHHUTLU_MEKTUP · GIB_PORTAL */
  method: string;
  objectionDate: string;
  objectionDocNo?: string | null;
  description: string;
  isActive: boolean;
  createdAt: string;
  createdByName?: string | null;
  cancelledAt?: string | null;
}

export interface EGovResponseState {
  eGovDocumentID: number;
  documentNo?: string | null;
  customerTitle?: string | null;
  profileId?: string | null;
  /** 1 Gelen · 2 Giden */
  direction: number;
  docKind: number;
  invoiceID?: number | null;
  status?: string | null;
  deadline?: string | null;
  daysLeft?: number | null;
  canRespond: boolean;
  respondBlockReason?: string | null;
  isLive: boolean;
  responseCode?: string | null;
  responseNote?: string | null;
  responseAt?: string | null;
  responseStatus?: string | null;
  responseError?: string | null;
  objections: EGovObjection[];
  invoiceWarning?: string | null;
}

export const OBJECTION_METHODS: { value: string; label: string }[] = [
  { value: 'KEP', label: 'KEP (kayıtlı elektronik posta)' },
  { value: 'NOTER', label: 'Noter' },
  { value: 'TELGRAF', label: 'Telgraf' },
  { value: 'TAAHHUTLU_MEKTUP', label: 'Taahhütlü mektup' },
  { value: 'GIB_PORTAL', label: 'GİB portalı (iptal / itiraz talebi)' },
];

export const methodLabel = (m: string) => OBJECTION_METHODS.find((x) => x.value === m)?.label ?? m;

export const getResponseState = (id: number) => apiJson<EGovResponseState>(`/api/egov/response/${id}`);

export const respondInvoice = (id: number, code: 'KABUL' | 'RED', note: string | null) =>
  apiJson<EGovResponseState>(`/api/egov/response/${id}/respond`, { method: 'POST', body: JSON.stringify({ code, note }) });

export const addObjection = (
  id: number,
  o: { kind: string; method: string; date: string; docNo: string | null; description: string },
) => apiJson<EGovResponseState>(`/api/egov/response/${id}/objection`, { method: 'POST', body: JSON.stringify(o) });

export const cancelObjection = (id: number, objectionId: number) =>
  apiJson<EGovResponseState>(`/api/egov/response/${id}/objection/${objectionId}`, { method: 'DELETE' });
