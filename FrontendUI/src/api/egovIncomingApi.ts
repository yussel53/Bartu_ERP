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
  /** Eşlenen kartın ProductCard.ProductType'ı (1 Malzeme · 3 Alınan Hizmet) */
  productType?: number | null;
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
  /** Önerilen Invoice.InvoiceType (bkz. EGOV_INCOMING_INVOICE_TYPES) */
  invoiceType: number;
  /** Satırların mal/hizmet tutarı toplamı */
  linesTotal?: number;
  /** Satır toplamı fatura toplamını tutmuyor ve bilgi satırlarıyla açıklanamıyor */
  totalsMismatch?: boolean;
  lines: EGovIncomingPreviewLine[];
  /** Faturadaki irsaliye referansları ve gelen e-İrsaliye karşılıkları (E-05) */
  despatchRefs?: { documentNo: string; eGovDocumentID?: number | null; productVoucherID?: number | null }[];
}

type Result = { success: boolean; message: string };

/**
 * Gelen e-faturanın çevrilebileceği fatura türleri (Invoice.InvoiceType — documentTypes.InvoiceType).
 * productType: satır eşlemesinde önerilen kart türü (ProductCard.ProductType); null → tüm kartlar.
 */
export const EGOV_INCOMING_INVOICE_TYPES: {
  value: number;
  label: string;
  menuLabel: string;
  productType: number | null;
  needsWarehouse: boolean;
}[] = [
  { value: 2, label: 'Satınalma Faturası', menuLabel: 'Satınalma Faturasına Çevir', productType: 1, needsWarehouse: true },
  { value: 5, label: 'Alınan Hizmet Faturası', menuLabel: 'Hizmet Faturasına Çevir', productType: 3, needsWarehouse: false },
  { value: 3, label: 'Toptan Satış İade Faturası', menuLabel: 'Toptan Satış İade Faturasına Çevir', productType: 1, needsWarehouse: true },
  { value: 6, label: 'Satınalma Fiyat Farkı Faturası', menuLabel: 'Satınalma Fiyat Farkı Faturasına Çevir', productType: null, needsWarehouse: false },
  { value: 7, label: 'Satış Fiyat Farkı Faturası', menuLabel: 'Satış Fiyat Farkı Faturasına Çevir', productType: null, needsWarehouse: false },
];

// İşlemi yapan kullanıcı gönderilmez: sunucu oturum token'ından alır.

/** comment: onay açıklaması (zorunlu) · groupId: onay grubu (SYS_ApprovalGroup) */
export function sendEGovIncoming(id: number, comment: string, groupId?: number | null): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/send`, { method: 'POST', body: JSON.stringify({ comment, groupId }) });
}

export function approveEGovIncoming(id: number, comment?: string): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/approve`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function rejectEGovIncoming(id: number, comment: string): Promise<Result> {
  return apiJson(`/api/egov/incoming/${id}/reject`, { method: 'POST', body: JSON.stringify({ comment }) });
}

export function getEGovIncomingSavePreview(
  id: number,
): Promise<{ stage: string; invoiceId?: number | null; preview: EGovIncomingPreview }> {
  return apiJson(`/api/egov/incoming/${id}/save-preview`);
}

export function saveEGovIncoming(
  id: number,
  body: {
    companyId?: number | null;
    whouseId?: number | null;
    description?: string | null;
    /** Kaydedilecek fatura türü (EGOV_INCOMING_INVOICE_TYPES); boşsa önerilen */
    invoiceType?: number | null;
    /** exclude: true → satır faturaya yazılmaz (bilgi satırı), eşleme gerekmez */
    lines: { lineNo: number; productCardID: number; exclude?: boolean }[];
  },
): Promise<Result & { invoiceId: number }> {
  return apiJson(`/api/egov/incoming/${id}/save`, { method: 'POST', body: JSON.stringify(body) });
}
