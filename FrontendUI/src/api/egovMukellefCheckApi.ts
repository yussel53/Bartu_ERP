import { apiJson } from '../config/api';

/** Cari toplu mükellef kontrolü (E-06) — api/egov/mukellef-check */

export interface MukellefCheckRow {
  customerCardID: number;
  customerAdressID?: number | null;
  code?: string | null;
  title?: string | null;
  addressTitle?: string | null;
  taxNr?: string | null;
  isMukellef: boolean;
  gibTitle?: string | null;
  /** CustomerCard.EinvoiceType: 0 Yok · 1 e-Fatura · 2 e-Arşiv */
  einvoiceType?: number | null;
  suggestedEinvoiceType?: number | null;
  einvoiceEntryDate?: string | null;
  suggestedEntryDate?: string | null;
  postLabel?: string | null;
  suggestedPostLabel?: string | null;
  senderLabel?: string | null;
  suggestedSenderLabel?: string | null;
  lastCheckAt?: string | null;
  hasChanges: boolean;
}

export interface MukellefCheckResult {
  localListCount: number;
  lastSyncAt?: string | null;
  /** Yerel liste tam ve güncel — «mükellef değil» sonucu güvenilir */
  authoritative: boolean;
  totalCustomers: number;
  mukellefCount: number;
  changeCount: number;
  rows: MukellefCheckRow[];
}

export function checkCustomerMukellef(onlyChanges: boolean): Promise<MukellefCheckResult> {
  return apiJson(`/api/egov/mukellef-check?onlyChanges=${onlyChanges}`);
}

export function applyCustomerMukellef(
  items: { customerCardID: number; customerAdressID?: number | null }[],
): Promise<{ success: boolean; message: string }> {
  return apiJson('/api/egov/mukellef-check/apply', { method: 'POST', body: JSON.stringify({ items }) });
}
