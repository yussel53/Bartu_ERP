import { isoToDisplay } from './dateFormat';
import type { CardSectionColumn } from '../api/cardStatementApi';

const moneyFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });

export type StatementNumFormat = 'money' | 'qty';

export function fmtNum(v: unknown, format: StatementNumFormat): string {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return format === 'money' ? moneyFmt.format(n) : qtyFmt.format(n);
}

export function fmtDate(v: unknown): string {
  if (v == null || v === '') return '';
  return isoToDisplay(String(v).slice(0, 10));
}

export function fmtCell(v: unknown, col: CardSectionColumn): string {
  if (col.format === 'date') return fmtDate(v);
  if (col.format === 'money' || col.format === 'qty') return fmtNum(v, col.format);
  return v == null ? '' : String(v);
}

/** Borç/alacaklı kartlarda bakiye mutlak değer + (B)/(A); giriş/çıkışlı kartlarda işaretli */
export function fmtBalance(v: number, format: StatementNumFormat, debitCredit: boolean): string {
  if (!debitCredit || v === 0) return fmtNum(v, format);
  return `${fmtNum(Math.abs(v), format)} ${v > 0 ? '(B)' : '(A)'}`;
}

export function downloadCsv(fileName: string, headers: string[], rows: string[][]) {
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const body = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
