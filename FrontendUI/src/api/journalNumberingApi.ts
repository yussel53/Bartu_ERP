import { apiJson } from '../config/api';

export type JournalNumberingRequest = {
  startDate: string;
  endDate: string;
  startNumber: number;
  onlyUnnumbered: boolean;
  companyId?: number | null;
  note?: string;
  appliedBy?: string;
};

export type JournalNumberingRow = {
  accountVoucherID: number;
  documentNumber?: string | null;
  voucherDate?: string | null;
  voucherTime?: string | null;
  oldJournalNo?: string | null;
  newJournalNo: number;
  sumDebit?: number | null;
  sumCredit?: number | null;
};

export type JournalNumberingResult = {
  count: number;
  startNumber: number;
  endNumber?: number | null;
  applied: boolean;
  rows: JournalNumberingRow[];
};

export type JournalNumberingLogRow = {
  id: number;
  startDate: string;
  endDate: string;
  startNumber: number;
  endNumber?: number | null;
  voucherCount: number;
  onlyUnnumbered: boolean;
  note?: string | null;
  appliedBy?: string | null;
  appliedAt: string;
};

const post = (path: string, body: JournalNumberingRequest) =>
  apiJson<JournalNumberingResult>(`/api/journal-numbering/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const previewJournalNumbering = (req: JournalNumberingRequest) => post('preview', req);
export const applyJournalNumbering = (req: JournalNumberingRequest) => post('apply', req);

export async function suggestJournalStart(startDate: string, companyId?: number | null) {
  const q = new URLSearchParams({ startDate });
  if (companyId) q.set('companyId', String(companyId));
  const r = await apiJson<{ startNumber: number }>(`/api/journal-numbering/suggest-start?${q}`);
  return r.startNumber;
}

export const fetchJournalNumberingHistory = (take = 50) =>
  apiJson<JournalNumberingLogRow[]>(`/api/journal-numbering/history?take=${take}`);
