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
  /** Fatura toplamına dahil olmayan bilgi satırı — kayıtta varsayılan olarak dışarıda */
  isInfoLine?: boolean;
  infoReason?: string | null;
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
  /** Satırların mal/hizmet tutarı toplamı */
  linesTotal?: number;
  /** Satır toplamı fatura toplamını tutmuyor ve bilgi satırlarıyla açıklanamıyor */
  totalsMismatch?: boolean;
  lines: EGovIncomingPreviewLine[];
}

type Result = { success: boolean; message: string };

/** comment: onay açıklaması (zorunlu) · groupId: onay grubu (SYS_ApprovalGroup) */
export function sendEGovIncoming(id: number, userId: number, comment: string, groupId?: number | null): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/send`, { method: 'POST', body: JSON.stringify({ userId, comment, groupId }) });
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
    /** exclude: true → satır faturaya yazılmaz (bilgi satırı), eşleme gerekmez */
    lines: { lineNo: number; productCardID: number; exclude?: boolean }[];
  },
): Promise<Result & { invoiceId: number }> {
  return apiJson(`/api/egov/incoming/${id}/save`, { method: 'POST', body: JSON.stringify(body) });
}
