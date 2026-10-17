import { apiJson } from '../config/api';

/** Backend CardStatementRepository kart türleri */
export type CardStatementKind =
  | 'customer'
  | 'product'
  | 'bank'
  | 'bankAccount'
  | 'safe'
  | 'account'
  | 'bound';

export interface CardStatementRow {
  date?: string | null;
  docNo?: string | null;
  source: string;
  typeLabel?: string | null;
  description?: string | null;
  party?: string | null;
  debit: number;
  credit: number;
  balance: number;
  price?: number | null;
  amount?: number | null;
  dueDate?: string | null;
  sourceTable?: string | null;
  sourceId?: number | null;
}

export interface CardSectionColumn {
  key: string;
  label: string;
  format: 'text' | 'date' | 'money' | 'qty';
}

export interface CardSection {
  key: string;
  title: string;
  columns: CardSectionColumn[];
  rows: Record<string, unknown>[];
  note?: string | null;
}

export interface CardStatementResult {
  kind: CardStatementKind;
  cardId: number;
  cardCode?: string | null;
  cardTitle?: string | null;
  unit: 'money' | 'qty';
  debitLabel: string;
  creditLabel: string;
  from?: string | null;
  to?: string | null;
  opening: number;
  totalDebit: number;
  totalCredit: number;
  closing: number;
  statement: CardStatementRow[];
  statementNote?: string | null;
  sections: CardSection[];
  warnings: string[];
}

/** Cari listesi özet satırı — bakiye ve önemli bilgiler */
export interface CustomerListSummary {
  customerCardID: number;
  debit: number;
  credit: number;
  /** Borç − Alacak (pozitif: borçlu) */
  balance: number;
  lastMoveDate?: string | null;
  moveCount: number;
  openOrders: number;
  city?: string | null;
  town?: string | null;
  phone?: string | null;
  email?: string | null;
  riskGroup?: string | null;
}

export function getCustomerSummaries(): Promise<CustomerListSummary[]> {
  return apiJson<CustomerListSummary[]>('/api/card-statement/customer-summaries');
}

export async function getCardStatement(
  kind: CardStatementKind,
  id: number,
  range?: { from?: string | null; to?: string | null },
): Promise<CardStatementResult> {
  const q = new URLSearchParams();
  if (range?.from) q.set('from', range.from);
  if (range?.to) q.set('to', range.to);
  const qs = q.toString();
  return apiJson<CardStatementResult>(
    `/api/card-statement/${encodeURIComponent(kind)}/${id}${qs ? `?${qs}` : ''}`,
  );
}

/** Müşteri (CardKind=1) → Cari (CardKind=2) */
export async function convertCustomerToCari(id: number): Promise<{ success: boolean; message: string }> {
  return apiJson<{ success: boolean; message: string }>(`/api/customers/${id}/to-cari`, { method: 'POST' });
}
