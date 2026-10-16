import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, FilterX, Printer, Search } from 'lucide-react';
import type { CardStatementResult, CardStatementRow } from '../api/cardStatementApi';
import { loadChartJs } from '../utils/chartJsLoader';
import { fmtBalance, fmtDate, fmtNum, type StatementNumFormat } from '../utils/cardStatementFormat';

/**
 * Rapor tasarımcısı (SqlReportDashboard) görünümünde ekstre:
 * KPI kartları + isteğe bağlı grafikler + aylık ara toplamlı tablo + yazdır.
 */

interface CardStatementReportProps {
  data: CardStatementResult;
  kindTitle: string;
  reportTitle: string;
  rangeFrom: string | null;
  rangeTo: string | null;
}

type ChartKey = 'balance' | 'monthly' | 'bySource' | 'byType' | 'byParty';

const CHART_DEFS: { key: ChartKey; title: string; type: 'line' | 'bar' | 'doughnut' | 'pie' }[] = [
  { key: 'balance', title: 'Bakiye Seyri', type: 'line' },
  { key: 'monthly', title: 'Aylık Hareket', type: 'bar' },
  { key: 'bySource', title: 'Belge Türüne Göre', type: 'doughnut' },
  { key: 'byType', title: 'Fiş Türüne Göre', type: 'pie' },
  { key: 'byParty', title: 'İlgili Bazında (ilk 10)', type: 'bar' },
];

const CHART_COLORS = [
  'rgba(30, 136, 229, 0.75)',
  'rgba(6, 182, 212, 0.75)',
  'rgba(34, 197, 94, 0.75)',
  'rgba(245, 158, 11, 0.75)',
  'rgba(239, 68, 68, 0.75)',
  'rgba(168, 85, 247, 0.75)',
  'rgba(236, 72, 153, 0.75)',
  'rgba(99, 102, 241, 0.75)',
];
const DEBIT_COLOR = 'rgba(30, 136, 229, 0.75)';
const CREDIT_COLOR = 'rgba(245, 158, 11, 0.8)';

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* gizli pencere vb. */
  }
}

function monthKey(date?: string | null): string {
  return date ? date.slice(0, 7) : 'Tarihsiz';
}
function monthLabel(key: string): string {
  if (key === 'Tarihsiz') return key;
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

/** Filtre: grafik tıklaması veya seçim kutusundan */
interface RowFilter {
  field: 'source' | 'typeLabel' | 'party' | 'month';
  value: string;
  label: string;
}

function rowField(r: CardStatementRow, f: RowFilter['field']): string {
  if (f === 'month') return monthKey(r.date);
  return String(r[f] ?? '').trim() || '(Boş)';
}

export const CardStatementReport: React.FC<CardStatementReportProps> = ({
  data,
  kindTitle,
  reportTitle,
  rangeFrom,
  rangeTo,
}) => {
  const numFmt: StatementNumFormat = data.unit === 'qty' ? 'qty' : 'money';
  const debitCredit = data.debitLabel === 'Borç';
  const bal = (v: number) => fmtBalance(v, numFmt, debitCredit);
  const chartStoreKey = `bartu.cardStatement.charts.${data.kind}`;
  const subtotalStoreKey = 'bartu.cardStatement.subtotals';

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RowFilter | null>(null);
  const [showCharts, setShowCharts] = useState<boolean>(() => storageGet(`${chartStoreKey}.on`) === '1');
  const [charts, setCharts] = useState<ChartKey[]>(() => {
    const raw = storageGet(chartStoreKey);
    if (raw) {
      try {
        const v = JSON.parse(raw) as ChartKey[];
        if (Array.isArray(v)) return v.filter((k) => CHART_DEFS.some((d) => d.key === k));
      } catch {
        /* yoksay */
      }
    }
    return ['balance', 'monthly', 'bySource'];
  });
  const [subtotals, setSubtotals] = useState<boolean>(() => storageGet(subtotalStoreKey) !== '0');

  useEffect(() => storageSet(chartStoreKey, JSON.stringify(charts)), [chartStoreKey, charts]);
  useEffect(() => storageSet(`${chartStoreKey}.on`, showCharts ? '1' : '0'), [chartStoreKey, showCharts]);
  useEffect(() => storageSet(subtotalStoreKey, subtotals ? '1' : '0'), [subtotals]);

  const sources = useMemo(
    () => [...new Set(data.statement.map((r) => r.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
    [data.statement],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr-TR');
    return data.statement.filter((r) => {
      if (filter && rowField(r, filter.field) !== filter.value) return false;
      if (!needle) return true;
      return [r.docNo, r.source, r.typeLabel, r.description, r.party, fmtDate(r.date)]
        .some((v) => String(v ?? '').toLocaleLowerCase('tr-TR').includes(needle));
    });
  }, [data.statement, search, filter]);

  const filtered = rows.length !== data.statement.length;
  const totals = useMemo(() => {
    const debit = rows.reduce((a, r) => a + r.debit, 0);
    const credit = rows.reduce((a, r) => a + r.credit, 0);
    const last = rows.reduce<string | null>((a, r) => (r.date && (!a || r.date > a) ? r.date : a), null);
    const priced = rows.filter((r) => r.price != null && r.debit > 0);
    const avgPrice = priced.length
      ? priced.reduce((a, r) => a + (r.price ?? 0) * r.debit, 0) / priced.reduce((a, r) => a + r.debit, 0)
      : null;
    return { debit, credit, last, avgPrice };
  }, [rows]);

  // Tablo: aylık gruplar (ara toplamlı)
  const groups = useMemo(() => {
    const list: { key: string; rows: CardStatementRow[]; debit: number; credit: number; endBalance: number }[] = [];
    for (const r of rows) {
      const k = monthKey(r.date);
      let g = list[list.length - 1];
      if (!g || g.key !== k) {
        g = { key: k, rows: [], debit: 0, credit: 0, endBalance: 0 };
        list.push(g);
      }
      g.rows.push(r);
      g.debit += r.debit;
      g.credit += r.credit;
      g.endBalance = r.balance;
    }
    return list;
  }, [rows]);

  const kpis: { title: string; value: string; color: string; hint?: string }[] = [
    ...(rangeFrom ? [{ title: 'Devir', value: bal(data.opening), color: '#64748b' }] : []),
    { title: `Toplam ${data.debitLabel}`, value: fmtNum(totals.debit, numFmt), color: '#1e88e5' },
    { title: `Toplam ${data.creditLabel}`, value: fmtNum(totals.credit, numFmt), color: '#f59e0b' },
    {
      title: data.unit === 'qty' ? 'Mevcut' : 'Bakiye',
      value: bal(filtered ? totals.debit - totals.credit + (rangeFrom ? data.opening : 0) : data.closing),
      color: data.closing < 0 && !debitCredit ? '#ef4444' : '#22c55e',
      hint: filtered ? 'Filtrelenmiş satırlara göre' : undefined,
    },
    { title: 'Hareket Sayısı', value: rows.length.toLocaleString('tr-TR'), color: '#a855f7' },
    data.unit === 'qty' && totals.avgPrice != null
      ? { title: 'Ort. Giriş Fiyatı', value: fmtNum(totals.avgPrice, 'money'), color: '#06b6d4' }
      : { title: 'Son Hareket', value: totals.last ? fmtDate(totals.last) : '—', color: '#06b6d4' },
  ];

  const toggleChart = (k: ChartKey) =>
    setCharts((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const periodText =
    rangeFrom || rangeTo
      ? `${rangeFrom ? fmtDate(rangeFrom) : '…'} – ${rangeTo ? fmtDate(rangeTo) : '…'}`
      : 'Tüm dönemler';
  const cardText = [data.cardCode, data.cardTitle].filter(Boolean).join(' · ') || `#${data.cardId}`;

  const print = () => {
    const esc = (s: unknown) =>
      String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const body = groups
      .map((g) => {
        const lines = g.rows
          .map(
            (r) =>
              `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.docNo)}</td><td>${esc(r.source)}</td><td>${esc(r.typeLabel)}</td><td>${esc(r.description)}</td><td>${esc(r.party)}</td><td class="n">${r.debit ? esc(fmtNum(r.debit, numFmt)) : ''}</td><td class="n">${r.credit ? esc(fmtNum(r.credit, numFmt)) : ''}</td><td class="n">${esc(bal(r.balance))}</td></tr>`,
          )
          .join('');
        const sub = subtotals
          ? `<tr class="sub"><td colspan="6">${esc(monthLabel(g.key))} toplamı</td><td class="n">${esc(fmtNum(g.debit, numFmt))}</td><td class="n">${esc(fmtNum(g.credit, numFmt))}</td><td class="n">${esc(bal(g.endBalance))}</td></tr>`
          : '';
        return lines + sub;
      })
      .join('');
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(reportTitle)} - ${esc(cardText)}</title>
<style>
body{font:12px system-ui,Segoe UI,sans-serif;color:#0f172a;margin:24px}
h1{font-size:18px;margin:0}.muted{color:#64748b;font-size:11px}
.kpis{display:flex;gap:8px;margin:14px 0}.kpi{flex:1;border:1px solid #e2e8f0;border-left-width:5px;padding:6px 8px;border-radius:4px}
.kpi b{display:block;font-size:15px;margin-top:2px}.kpi span{font-size:9px;text-transform:uppercase;color:#64748b}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
th{background:#f1f5f9}.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.sub td{background:#f8fafc;font-weight:600}.tot td{background:#e2e8f0;font-weight:700}
@media print{body{margin:10mm}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end">
<div><div class="muted">${esc(kindTitle)}</div><h1>${esc(reportTitle)}</h1><div>${esc(cardText)}</div></div>
<div class="muted" style="text-align:right">Dönem: ${esc(periodText)}<br>Yazdırma: ${esc(new Date().toLocaleString('tr-TR'))}${filtered ? '<br>Filtre uygulanmış' : ''}</div></div>
<div class="kpis">${kpis.map((k) => `<div class="kpi" style="border-left-color:${k.color}"><span>${esc(k.title)}</span><b>${esc(k.value)}</b></div>`).join('')}</div>
<table><thead><tr><th>Tarih</th><th>Belge No</th><th>Belge Türü</th><th>Tür</th><th>Açıklama</th><th>İlgili</th><th class="n">${esc(data.debitLabel)}</th><th class="n">${esc(data.creditLabel)}</th><th class="n">Bakiye</th></tr></thead>
<tbody>${rangeFrom ? `<tr class="sub"><td>${esc(fmtDate(rangeFrom))}</td><td colspan="7">Devir</td><td class="n">${esc(bal(data.opening))}</td></tr>` : ''}${body}</tbody>
<tfoot><tr class="tot"><td colspan="6">Genel Toplam</td><td class="n">${esc(fmtNum(totals.debit, numFmt))}</td><td class="n">${esc(fmtNum(totals.credit, numFmt))}</td><td class="n">${esc(kpis.find((k) => k.title === 'Bakiye' || k.title === 'Mevcut')?.value)}</td></tr></tfoot></table>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const th = 'px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap';
  const thR = 'px-2 py-1.5 text-right font-medium text-slate-500 whitespace-nowrap';
  const td = 'px-2 py-1 whitespace-nowrap text-slate-700 dark:text-slate-200';
  const tdR = 'px-2 py-1 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="p-3 space-y-3 bg-slate-50/60 dark:bg-slate-900">
      {/* Rapor başlığı */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{kindTitle}</p>
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white leading-tight">{reportTitle}</h2>
          <p className="text-[11px] text-slate-500 truncate">
            {cardText} · Dönem: {periodText}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowCharts((v) => !v)}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] font-medium ${
              showCharts
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Grafikler
          </button>
          <button
            type="button"
            onClick={print}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Yazdır
          </button>
        </div>
      </div>

      {data.statementNote && (
        <p className="text-[11px] text-slate-500 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
          {data.statementNote}
        </p>
      )}

      {/* KPI kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {kpis.map((k) => (
          <div
            key={k.title}
            className="rounded-md bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700"
            style={{ borderLeftWidth: 6, borderLeftColor: k.color }}
            title={k.hint}
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium truncate">{k.title}</div>
            <div className="text-[17px] font-semibold text-slate-800 dark:text-white mt-0.5 tabular-nums truncate">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Grafikler (isteğe bağlı) */}
      {showCharts && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">Gösterilecek grafikler:</span>
            {CHART_DEFS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleChart(c.key)}
                className={`h-6 px-2 rounded-full border text-[11px] ${
                  charts.includes(c.key)
                    ? 'border-blue-300 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>
          {charts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {CHART_DEFS.filter((c) => charts.includes(c.key)).map((c) => (
                <StatementChart
                  key={c.key}
                  def={c}
                  rows={rows}
                  data={data}
                  numFmt={numFmt}
                  onPick={(f) => setFilter((prev) => (prev && prev.field === f.field && prev.value === f.value ? null : f))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tablo */}
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                className="border border-slate-200 dark:border-slate-600 rounded-md pl-7 pr-2 py-1 text-[12px] w-56 bg-white dark:bg-slate-900"
                placeholder="Ekstrede ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-[12px] bg-white dark:bg-slate-900"
              value={filter?.field === 'source' ? filter.value : ''}
              onChange={(e) =>
                setFilter(e.target.value ? { field: 'source', value: e.target.value, label: e.target.value } : null)
              }
            >
              <option value="">Tüm belge türleri</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {filter && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1"
              >
                <FilterX className="w-3 h-3" />
                {filter.label}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <label className="inline-flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" checked={subtotals} onChange={(e) => setSubtotals(e.target.checked)} />
              Aylık ara toplam
            </label>
            <span>
              {rows.length} / {data.statement.length} satır
            </span>
          </div>
        </div>

        <div className="overflow-auto max-h-[55vh]">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className={th}>Tarih</th>
                <th className={th}>Belge No</th>
                <th className={th}>Belge Türü</th>
                <th className={th}>Tür</th>
                <th className={th}>Açıklama</th>
                <th className={th}>İlgili</th>
                {data.unit === 'qty' && <th className={thR}>Birim Fiyat</th>}
                {data.unit === 'qty' && <th className={thR}>Tutar</th>}
                <th className={thR}>{data.debitLabel}</th>
                <th className={thR}>{data.creditLabel}</th>
                <th className={thR}>Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {rangeFrom && !filtered && (
                <tr className="border-t border-slate-100 bg-amber-50/70 dark:bg-amber-900/10">
                  <td className={td}>{fmtDate(rangeFrom)}</td>
                  <td className={`${td} font-semibold`} colSpan={data.unit === 'qty' ? 9 : 7}>
                    Devir
                  </td>
                  <td className={`${tdR} font-semibold`}>{bal(data.opening)}</td>
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-[12px] text-slate-400">
                    {data.statement.length === 0 ? 'Hareket yok' : 'Filtreye uyan satır yok'}
                  </td>
                </tr>
              )}
              {groups.map((g) => (
                <React.Fragment key={g.key}>
                  {g.rows.map((r, i) => (
                    <tr
                      key={`${g.key}-${i}`}
                      className="border-t border-slate-100 dark:border-slate-800 hover:bg-blue-50/40 dark:hover:bg-slate-800/40 even:bg-slate-50/40"
                    >
                      <td className={td}>{fmtDate(r.date)}</td>
                      <td className={`${td} font-medium`}>{r.docNo}</td>
                      <td className={td}>
                        <span className="inline-block rounded px-1.5 py-px bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {r.source}
                        </span>
                      </td>
                      <td className={td}>{r.typeLabel}</td>
                      <td className={`${td} max-w-[240px] truncate`} title={r.description ?? ''}>
                        {r.description}
                      </td>
                      <td className={`${td} max-w-[200px] truncate`} title={r.party ?? ''}>
                        {r.party}
                      </td>
                      {data.unit === 'qty' && <td className={tdR}>{fmtNum(r.price, 'money')}</td>}
                      {data.unit === 'qty' && <td className={tdR}>{fmtNum(r.amount, 'money')}</td>}
                      <td className={`${tdR} text-blue-700 dark:text-blue-300`}>
                        {r.debit ? fmtNum(r.debit, numFmt) : ''}
                      </td>
                      <td className={`${tdR} text-amber-700 dark:text-amber-300`}>
                        {r.credit ? fmtNum(r.credit, numFmt) : ''}
                      </td>
                      <td className={`${tdR} font-semibold text-slate-800 dark:text-white`}>{bal(r.balance)}</td>
                    </tr>
                  ))}
                  {subtotals && (
                    <tr className="border-t border-slate-200 bg-slate-100/80 dark:bg-slate-800/70">
                      <td className={`${td} font-semibold`} colSpan={data.unit === 'qty' ? 8 : 6}>
                        {monthLabel(g.key)} toplamı · {g.rows.length} hareket
                      </td>
                      <td className={`${tdR} font-semibold`}>{fmtNum(g.debit, numFmt)}</td>
                      <td className={`${tdR} font-semibold`}>{fmtNum(g.credit, numFmt)}</td>
                      <td className={`${tdR} font-semibold`}>{bal(g.endBalance)}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-200/90 dark:bg-slate-700">
                <tr>
                  <td className={`${td} font-bold`} colSpan={data.unit === 'qty' ? 8 : 6}>
                    Genel Toplam{filtered ? ' (filtreli)' : ''}
                  </td>
                  <td className={`${tdR} font-bold`}>{fmtNum(totals.debit, numFmt)}</td>
                  <td className={`${tdR} font-bold`}>{fmtNum(totals.credit, numFmt)}</td>
                  <td className={`${tdR} font-bold`}>{kpis.find((k) => k.title === 'Bakiye' || k.title === 'Mevcut')?.value}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Grafik kartı ─────────────────────────────────────────────────────

function StatementChart({
  def,
  rows,
  data,
  numFmt,
  onPick,
}: {
  def: (typeof CHART_DEFS)[number];
  rows: CardStatementRow[];
  data: CardStatementResult;
  numFmt: StatementNumFormat;
  onPick: (f: RowFilter) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const [failed, setFailed] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  const series = useMemo(() => {
    const vol = (r: CardStatementRow) => r.debit + r.credit;
    const groupBy = (field: RowFilter['field'], take?: number) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(rowField(r, field), (m.get(rowField(r, field)) || 0) + vol(r));
      let list = [...m.entries()].sort((a, b) => b[1] - a[1]);
      if (take) list = list.slice(0, take);
      return list;
    };
    switch (def.key) {
      case 'balance':
        return {
          field: null as RowFilter['field'] | null,
          keys: rows.map((r) => r.date ?? ''),
          labels: rows.map((r) => fmtDate(r.date) || '—'),
          datasets: [{ label: 'Bakiye', data: rows.map((r) => r.balance), color: 'rgba(30, 136, 229, 1)' }],
        };
      case 'monthly': {
        const m = new Map<string, { d: number; c: number }>();
        for (const r of rows) {
          const k = monthKey(r.date);
          const v = m.get(k) || { d: 0, c: 0 };
          v.d += r.debit;
          v.c += r.credit;
          m.set(k, v);
        }
        const keys = [...m.keys()].sort();
        return {
          field: 'month' as const,
          keys,
          labels: keys.map(monthLabel),
          datasets: [
            { label: data.debitLabel, data: keys.map((k) => m.get(k)!.d), color: DEBIT_COLOR },
            { label: data.creditLabel, data: keys.map((k) => m.get(k)!.c), color: CREDIT_COLOR },
          ],
        };
      }
      default: {
        const field: RowFilter['field'] = def.key === 'bySource' ? 'source' : def.key === 'byType' ? 'typeLabel' : 'party';
        const list = groupBy(field, def.key === 'byParty' ? 10 : undefined);
        return {
          field,
          keys: list.map(([k]) => k),
          labels: list.map(([k]) => k),
          datasets: [{ label: 'Hacim', data: list.map(([, v]) => v), color: '' }],
        };
      }
    }
  }, [def.key, rows, data.debitLabel, data.creditLabel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Chart = await loadChartJs();
        if (cancelled || !canvasRef.current) return;
        chartRef.current?.destroy();
        const isPie = def.type === 'pie' || def.type === 'doughnut';
        const horizontal = def.key === 'byParty';
        chartRef.current = new Chart(canvasRef.current.getContext('2d')!, {
          type: def.type,
          data: {
            labels: series.labels,
            datasets: series.datasets.map((ds) => ({
              label: ds.label,
              data: ds.data,
              backgroundColor: ds.color
                ? def.type === 'line'
                  ? 'rgba(30, 136, 229, 0.12)'
                  : ds.color
                : series.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
              borderColor: ds.color || '#fff',
              borderWidth: def.type === 'line' ? 2 : 1,
              pointRadius: def.type === 'line' ? 2 : undefined,
              tension: 0.25,
              fill: def.type === 'line',
              stepped: def.type === 'line' ? 'before' : undefined,
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: horizontal ? 'y' : 'x',
            onClick: (_evt: unknown, elements: Array<{ index: number }>) => {
              if (!elements?.length || !series.field) return;
              const key = series.keys[elements[0].index];
              if (key != null)
                pickRef.current({ field: series.field, value: key, label: series.labels[elements[0].index] });
            },
            plugins: {
              legend: { display: isPie || series.datasets.length > 1, position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (ctx: { dataset: { label?: string }; parsed: number | { x: number; y: number } }) => {
                    const v = typeof ctx.parsed === 'number' ? ctx.parsed : horizontal ? ctx.parsed.x : ctx.parsed.y;
                    return `${ctx.dataset.label ?? ''}: ${fmtNum(v, numFmt)}`;
                  },
                },
              },
            },
            scales: isPie
              ? {}
              : {
                  y: { beginAtZero: def.type !== 'line' },
                  x: { ticks: { maxRotation: 45, minRotation: 0, autoSkip: true } },
                },
          },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [def, series, numFmt]);

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">{def.title}</h3>
        <span className="text-[10px] text-slate-400 uppercase">{def.type}</span>
      </div>
      {failed ? (
        <p className="text-[12px] text-slate-500 py-8 text-center">Grafik kütüphanesi yüklenemedi (internet bağlantısı?)</p>
      ) : series.labels.length === 0 ? (
        <p className="text-[12px] text-slate-500 py-8 text-center">Grafik için veri yok</p>
      ) : (
        <div className="h-[220px] relative">
          <canvas ref={canvasRef} />
        </div>
      )}
      {series.field && <p className="text-[10px] text-slate-400 mt-1">Dilim/çubuğa tıklayınca ekstre filtrelenir</p>}
    </div>
  );
}
