import { apiJson } from '../config/api';

/** Gelen e-İrsaliye → alış irsaliyesi (E-05) — api/egov/despatch */

export interface EGovDespatchPreviewLine {
  lineNo: number;
  sellerCode?: string | null;
  name?: string | null;
  description?: string | null;
  quantity: number;
  unitCode?: string | null;
  productCardID?: number | null;
  productCode?: string | null;
  productTitle?: string | null;
  productType?: number | null;
}

export interface EGovDespatchPreview {
  despatchNo?: string | null;
  uuid?: string | null;
  issueDate?: string | null;
  actualDespatchDate?: string | null;
  profileId?: string | null;
  typeCode?: string | null;
  supplierTaxNr?: string | null;
  supplierName?: string | null;
  supplierCardID?: number | null;
  supplierCode?: string | null;
  supplierTitle?: string | null;
  orderRefs: string[];
  plateNo?: string | null;
  driverName?: string | null;
  productVoucherID?: number | null;
  lines: EGovDespatchPreviewLine[];
}

export function getEGovDespatchPreview(id: number): Promise<EGovDespatchPreview> {
  return apiJson(`/api/egov/despatch/${id}/save-preview`);
}

export function saveEGovDespatch(
  id: number,
  body: {
    companyId?: number | null;
    whouseId: number;
    description?: string | null;
    /** exclude: true → satır irsaliyeye yazılmaz */
    lines: { lineNo: number; productCardID: number; exclude?: boolean }[];
  },
): Promise<{ success: boolean; message: string; productVoucherId: number }> {
  return apiJson(`/api/egov/despatch/${id}/save`, { method: 'POST', body: JSON.stringify(body) });
}
