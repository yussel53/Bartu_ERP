import { apiJson } from '../config/api';

/** e-Belge (UBL) karşı tarafı — api/egov/documents/{id}/party-card */
export interface EGovPartyInfo {
  eGovDocumentID: number;
  /** 1 Gelen (satıcı) · 2 Giden (alıcı) */
  direction: number;
  documentNo?: string | null;
  profileId?: string | null;
  taxNr?: string | null;
  /** 1 Tüzel · 2 Gerçek */
  taxType?: number | null;
  title?: string | null;
  taxOffice?: string | null;
  street?: string | null;
  district?: string | null;
  town?: string | null;
  city?: string | null;
  country?: string | null;
  postalZone?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  existingCardID?: number | null;
  existingCode?: string | null;
  existingTitle?: string | null;
  suggestedCode?: string | null;
}

export function getEGovPartyCard(id: number): Promise<EGovPartyInfo> {
  return apiJson<EGovPartyInfo>(`/api/egov/documents/${id}/party-card`);
}

export function createEGovPartyCard(
  id: number,
  body: { code?: string | null; title?: string | null },
): Promise<{ success: boolean; message: string; customerCardID: number; code: string }> {
  return apiJson(`/api/egov/documents/${id}/party-card`, { method: 'POST', body: JSON.stringify(body) });
}
