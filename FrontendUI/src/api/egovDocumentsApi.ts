import { apiJson } from '../config/api';

export interface EGovDocumentRow {
  eGovDocumentID: number;
  documentNo?: string | null;
  uuid?: string | null;
  documentDate?: string | null;
  customerCode?: string | null;
  customerTitle?: string | null;
  taxNr?: string | null;
  profileId?: string | null;
  amount?: number | null;
  taxAmount?: number | null;
  currencyCode?: string | null;
  status?: string | null;
  isActive: boolean;
  invoiceID?: number | null;
  orderVoucherID?: number | null;
  processInstanceID?: number | null;
  hasPdf: boolean;
  hasXml: boolean;
}

export interface EGovDocumentList {
  total: number;
  rows: EGovDocumentRow[];
  statusCounts: { status: string; count: number }[];
  warning?: string | null;
}

export interface EGovDocumentListParams {
  docKind: number;
  direction: number;
  archived?: boolean;
  /** yyyy-MM-dd */
  from?: string | null;
  to?: string | null;
  search?: string | null;
  status?: string | null;
  take?: number;
}

export function listEGovDocuments(p: EGovDocumentListParams): Promise<EGovDocumentList> {
  const qs = new URLSearchParams({
    docKind: String(p.docKind),
    direction: String(p.direction),
    archived: String(Boolean(p.archived)),
  });
  if (p.from) qs.set('from', p.from);
  if (p.to) qs.set('to', p.to);
  if (p.search?.trim()) qs.set('search', p.search.trim());
  if (p.status != null) qs.set('status', p.status);
  if (p.take) qs.set('take', String(p.take));
  return apiJson<EGovDocumentList>(`/api/egov/documents?${qs.toString()}`);
}
