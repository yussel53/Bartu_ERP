import { apiJson } from '../config/api';

/** KDV ve Ba / Bs raporu (E-08) — api/egov/tax-report */

export interface KdvRateRow {
  rate: number;
  salesBase: number;
  salesTax: number;
  purchaseBase: number;
  purchaseTax: number;
}

export interface KdvReport {
  from: string;
  to: string;
  calculatedTax: number;
  salesBase: number;
  issuedCount: number;
  deductibleTax: number;
  purchaseBase: number;
  receivedCount: number;
  rates: KdvRateRow[];
  withholdingTax: number;
  withholdingDocs: number;
  exemptBase: number;
  exemptDocs: number;
  exemptionCodes: string[];
  ublDocs: number;
  totalDocs: number;
  emptyDocs: number;
}

export interface BaBsRow {
  /** VKN/TCKN ya da «#kartNo» */
  key: string;
  taxNr?: string | null;
  title?: string | null;
  cardCount: number;
  /** yyyy-MM */
  period: string;
  docCount: number;
  amount: number;
}

export interface BaBsReport {
  from: string;
  to: string;
  limit: number;
  ba: BaBsRow[];
  bs: BaBsRow[];
  missingTaxNrDocs: number;
}

export interface BaBsDoc {
  invoiceID: number;
  invoiceType: number;
  documentNumber?: string | null;
  invoiceDate?: string | null;
  customerTitle?: string | null;
  amount: number;
  tax: number;
}

const q = (o: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();

export function getKdvReport(from: string, to: string, companyId?: number | null): Promise<KdvReport> {
  return apiJson(`/api/egov/tax-report/kdv?${q({ from, to, companyId })}`);
}

export function getBaBsReport(from: string, to: string, limit: number, companyId?: number | null): Promise<BaBsReport> {
  return apiJson(`/api/egov/tax-report/babs?${q({ from, to, limit, companyId })}`);
}

export function getBaBsDocs(kind: 'ba' | 'bs', key: string, from: string, to: string, companyId?: number | null): Promise<BaBsDoc[]> {
  return apiJson(`/api/egov/tax-report/babs/docs?${q({ kind, key, from, to, companyId })}`);
}
