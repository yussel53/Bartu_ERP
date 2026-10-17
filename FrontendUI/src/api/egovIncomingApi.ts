import { apiJson } from '../config/api';

/** Gelen e-fatura onay akışı — api/egov/incoming */

export interface EGovIncomingPreviewLine {
  lineNo: number;
  sellerCode?: string | null;
  name?: string | null;
  description?: string | null;
  quantity: number;
  unitCode?: string | null;
  price: number;
  discount: number;
  lineAmount: number;
  taxRate: number;
  taxAmount: number;
  productCardID?: number | null;
  productCode?: string | null;
  productTitle?: string | null;
}

export interface EGovIncomingPreview {
  invoiceNo?: string | null;
  uuid?: string | null;
  issueDate?: string | null;
  profileId?: string | null;
  typeCode?: string | null;
  currency?: string | null;
  supplierTaxNr?: string | null;
  supplierName?: string | null;
  supplierCardID?: number | null;
  supplierCode?: string | null;
  supplierTitle?: string | null;
  lineExtensionAmount: number;
  taxTotal: number;
  payableAmount: number;
  /** Invoice.InvoiceType: 2 Alış · 3 Satış İade */
  invoiceType: number;
  lines: EGovIncomingPreviewLine[];
}

type Result = { success: boolean; message: string };

export function sendEGovIncoming(id: number, userId: number, comment?: string): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/send`, { method: 'POST', body: JSON.stringify({ userId, comment }) });
}

export function approveEGovIncoming(id: number, userId: number, comment?: string): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/approve`, { method: 'POST', body: JSON.stringify({ userId, comment }) });
}

export function rejectEGovIncoming(id: number, userId: number, comment: string): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/reject`, { method: 'POST', body: JSON.stringify({ userId, comment }) });
}

export function getEGovIncomingSavePreview(
  id: number,
): Promise<{ stage: string; invoiceId?: number | null; preview: EGovIncomingPreview }> {
  return apiJson(`/api/egov/incoming/${id}/save-preview`);
}

export function saveEGovIncoming(
  id: number,
  body: {
    userId: number;
    companyId?: number | null;
    whouseId: number;
    description?: string | null;
    lines: { lineNo: number; productCardID: number }[];
  },
): Promise<Result & { invoiceId: number }> {
  return apiJson(`/api/egov/incoming/${id}/save`, { method: 'POST', body: JSON.stringify(body) });
}
