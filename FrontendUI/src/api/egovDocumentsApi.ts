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
  /** Gelen e-İrsaliyenin kaydedildiği alış irsaliyesi */
  productVoucherID?: number | null;
  orderVoucherID?: number | null;
  processInstanceID?: number | null;
  hasPdf: boolean;
  hasXml: boolean;
  /** Gelen e-fatura onay aşaması */
  approvalStage?: EGovApprovalStage | null;
  approvalComment?: string | null;
  pendingTaskID?: number | null;
  pendingRoleName?: string | null;
  /** Gelen TİCARİ faturaya verilen yanıt: KABUL · RED */
  responseCode?: string | null;
  responseStatus?: string | null;
  /** Etkin harici itiraz / iptal kaydı var */
  hasObjection?: boolean;
}

/** new · pending · approved · rejected · saved */
export type EGovApprovalStage = 'new' | 'pending' | 'approved' | 'rejected' | 'saved';

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
  /** Gelen e-fatura liste aşaması (new = yeni + reddedilen) */
  stage?: 'new' | 'pending' | 'approved' | 'saved' | null;
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
  if (p.stage) qs.set('stage', p.stage);
  if (p.take) qs.set('take', String(p.take));
  return apiJson<EGovDocumentList>(`/api/egov/documents?${qs.toString()}`);
}
