import { API_BASE, ApiError, apiJson } from '../config/api';

/** Giden e-fatura (E-03) — api/egov/outgoing */

export interface OutgoingOptions {
  /** TEMELFATURA · TICARIFATURA */
  profile?: string | null;
  returnInvoiceNo?: string | null;
  /** yyyy-MM-dd */
  returnInvoiceDate?: string | null;
  html?: boolean;
}

export interface OutgoingIssue {
  level: 'error' | 'warning' | 'info';
  source: string;
  message: string;
}

export interface OutgoingRuleStep {
  ruleId: number;
  ruleName: string;
  status?: string | null;
  message?: string | null;
  changes: unknown[];
}

export interface OutgoingTotals {
  lineExtension: number;
  allowance: number;
  taxExclusive: number;
  tax: number;
  taxInclusive: number;
  withholding: number;
  payable: number;
}

/** E-04: faturanın e-Arşiv bilgileri */
export interface EArchiveInfo {
  invoiceID: number;
  /** ELEKTRONIK · KAGIT */
  sendType: string;
  email?: string | null;
  isInternetSale: boolean;
  webAddress?: string | null;
  /** KREDIKARTI/BANKAKARTI · EFT/HAVALE · KAPIDAODEME · ODEMEARACISI · DIGER */
  paymentMethod?: string | null;
  paymentNote?: string | null;
  paymentAgent?: string | null;
  /** yyyy-MM-dd */
  paymentDate?: string | null;
  despatchDate?: string | null;
  carrierTaxNr?: string | null;
  carrierName?: string | null;
  saved: boolean;
}

export const PAYMENT_METHODS = ['KREDIKARTI/BANKAKARTI', 'EFT/HAVALE', 'KAPIDAODEME', 'ODEMEARACISI', 'DIGER'];

export interface OutgoingPreview {
  invoiceId: number;
  documentNumber?: string | null;
  companyId?: number | null;
  /** 1 e-Fatura · 2 e-Arşiv */
  docKind: number;
  profileId: string;
  typeCode: string;
  invoiceNo: string;
  invoiceNoIsProjected: boolean;
  receiverAlias?: string | null;
  /** cari · gib · yok */
  receiverAliasSource: string;
  totals: OutgoingTotals;
  programTax: number;
  programTotal: number;
  roundTrip: { ok: boolean; diffs: string[] };
  issues: OutgoingIssue[];
  ruleSteps: OutgoingRuleStep[];
  designTitle?: string | null;
  html?: string | null;
  htmlError?: string | null;
  isLive: boolean;
  integratorUrl?: string | null;
  sendAllowed: boolean;
  sendBlockReason?: string | null;
  eGovDocumentId?: number | null;
  sendStatus?: string | null;
  sentAt?: string | null;
  eArchive?: EArchiveInfo | null;
  cancelAllowed: boolean;
  cancelBlockReason?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

export interface SendSetting {
  companyId: number;
  eInvoicePrefix?: string | null;
  eArchivePrefix?: string | null;
  eDespatchPrefix?: string | null;
  defaultProfile: string;
  allowLiveSend: boolean;
  eArchiveWebAddress?: string | null;
  /** ELEKTRONIK · KAGIT */
  eArchiveSendType: string;
  updatedAt?: string | null;
}

export interface SendCounter {
  prefix: string;
  year: number;
  lastValue: number;
  seenMax?: number | null;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body ?? {}) });

export const previewOutgoing = (invoiceId: number, o: OutgoingOptions) =>
  apiJson<OutgoingPreview>(`/api/egov/outgoing/invoice/${invoiceId}/preview`, post(o));

export const sendOutgoing = (invoiceId: number, o: OutgoingOptions) =>
  apiJson<OutgoingPreview>(`/api/egov/outgoing/invoice/${invoiceId}/send`, post(o));

export const saveEArchiveInfo = (invoiceId: number, info: EArchiveInfo) =>
  apiJson<{ message: string }>(`/api/egov/outgoing/invoice/${invoiceId}/earchive`, { method: 'PUT', body: JSON.stringify(info) });

export const cancelOutgoing = (invoiceId: number, reason: string) =>
  apiJson<OutgoingPreview>(`/api/egov/outgoing/invoice/${invoiceId}/cancel`, post({ reason }));

export const outgoingStatus = (egovDocumentId: number) =>
  apiJson<Record<string, string>>(`/api/egov/outgoing/document/${egovDocumentId}/status`);

/** UBL XML'i dosya olarak indirir */
export async function downloadOutgoingUbl(invoiceId: number, o: OutgoingOptions): Promise<void> {
  const res = await fetch(`${API_BASE}/api/egov/outgoing/invoice/${invoiceId}/ubl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(o ?? {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError((data as { message?: string }).message || res.statusText, res.status, data);
  }
  const blob = await res.blob();
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(res.headers.get('content-disposition') || '')?.[1] ?? `fatura-${invoiceId}.xml`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = decodeURIComponent(name);
  a.click();
  URL.revokeObjectURL(url);
}

export const getSendSettings = (companyId: number) =>
  apiJson<{ setting: SendSetting; counters: SendCounter[] }>(`/api/egov/outgoing/settings/${companyId}`);

export const saveSendSettings = (companyId: number, s: Partial<SendSetting>) =>
  apiJson<{ message: string }>(`/api/egov/outgoing/settings/${companyId}`, { method: 'PUT', body: JSON.stringify(s) });

export const setSendCounter = (companyId: number, c: { prefix: string; year: number; lastValue: number }) =>
  apiJson<{ message: string }>(`/api/egov/outgoing/settings/${companyId}/counter`, { method: 'PUT', body: JSON.stringify(c) });
