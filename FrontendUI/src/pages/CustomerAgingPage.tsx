import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react';
import { apiJson } from '../config/api';
import { FilterInput, SortLabel, useGridSortFilter } from '../components/GridSortFilter';

interface AgingRow {
  customerCardID: number;
  code?: string | null;
  title?: string | null;
  balance: number;
  notDue: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90Plus: number;
  overdue: number;
  maxDays: number;
  avgDays: number;
}

interface OpenItem {
  source?: string | null;
  sourceId?: number | null;
  docNo?: string | null;
  date?: string | null;
  dueDate: string;
  amount: number;
  open: number;
  daysOverdue: number;
}

const n = (v: number) => (Math.abs(v) < 0.005 ? '' : v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString('tr-TR') : '');
const SOURCE: Record<string, string> = { Invoice: 'Fatura', CustomerVoucher: 'Cari fişi', BankVoucher: 'Banka', SafeVoucher: 'Kasa fişi' };

const COLS: { key: keyof AgingRow; label: string; num?: boolean; days?: boolean }[] = [
  { key: 'code', label: 'Kod' },
  { key: 'title', label: 'Cari' },
  { key: 'balance', label: 'Açık bakiye', num: true },
  { key: 'notDue', label: 'Vadesi gelmemiş', num: true },
  { key: 'd1_30', label: '1-30', num: true },
  { key: 'd31_60', label: '31-60', num: true },
  { key: 'd61_90', label: '61-90', num: true },
  { key: 'd90Plus', label: '90+', num: true },
  { key: 'overdue', label: 'Vadesi geçen', num: true },
  { key: 'maxDays', label: 'En eski (gün)', num: true, days: true },
  { key: 'avgDays', label: 'Ort. gecikme', num: true, days: true },
];

/** Finans → Raporlar → Cari Yaşlandırma (Y-10): FIFO kapama sonrası açık kalemlerin vadeye göre dağılımı */
export const CustomerAgingPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [asOf, setAsOf] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [items, setItems] = useState<OpenItem[]>([]);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setRows(await apiJson<AgingRow[]>(`/api/card-statement/aging${asOf ? `?asOf=${asOf}` : ''}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [asOf]);

  useEffect(() => {
    void load();
    setOpen(null);
  }, [load]);

  const toggle = async (id: number) => {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    setItems([]);
    try {
      setItems(await apiJson<OpenItem[]>(`/api/card-statement/open-items/${id}${asOf ? `?asOf=${asOf}` : ''}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const cellText = (r: AgingRow, key: string) => {
    const c = COLS.find((x) => x.key === key);
    const v = r[key as keyof AgingRow];
    if (c?.days) return Number(v) > 0 ? String(v) : '';
    return c?.num ? n(Number(v) || 0) : String(v ?? '');
  };
  const grid = useGridSortFilter(rows, cellText);
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of COLS) if (c.num && !c.days) t[c.key] = grid.view.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    return t;
  }, [grid.view]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-slate-500" /> Cari Yaşlandırma
          </h1>
          <p className="text-[12px] text-slate-500">
            Ödemeler en eski vadeli borçtan kapatılır (FIFO) · vade: hareket vadesi, faturada ödeme planı, yoksa belge tarihi · eksi tutar: alacaklı cari
          </p>
        </div>
        <label className="space-y-0.5 text-xs">
          <span className="block text-[11px] text-slate-500">Tarih itibarıyla</span>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-7 px-2 border border-slate-300 rounded-sm" />
        </label>
      </div>

      {err && <div className="px-3 py-1.5 rounded-md text-xs border border-red-200 bg-red-50 text-red-700">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {(
          [
            ['Açık bakiye', totals.balance],
            ['Vadesi gelmemiş', totals.notDue],
            ['1-30', totals.d1_30],
            ['31-60', totals.d31_60],
            ['61-90', totals.d61_90],
            ['90+', totals.d90Plus],
          ] as [string, number][]
        ).map(([l, v]) => (
          <div key={l} className="bg-white border border-slate-200 rounded-md px-3 py-2">
            <div className="text-[11px] text-slate-500">{l}</div>
            <div className={`text-[15px] font-semibold tabular-nums ${l === '90+' && v > 0 ? 'text-red-700' : 'text-slate-800'}`}>{n(v) || '0,00'}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-6" />
              {COLS.map((c) => (
                <th key={c.key} className={`px-2 py-1.5 font-semibold text-slate-700 ${c.num ? 'text-right' : 'text-left'}`}>
                  <SortLabel colKey={c.key} label={c.label} sort={grid.sort} onSort={grid.toggleSort} align={c.num ? 'right' : 'left'} />
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {COLS.map((c) => (
                <th key={c.key} className="px-1 pb-1">
                  <FilterInput colKey={c.key} value={grid.filters[c.key] ?? ''} onChange={grid.setFilter} numeric={!!c.num} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.view.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} className="px-3 py-4 text-center text-slate-400">
                  Açık kalem yok.
                </td>
              </tr>
            )}
            {grid.view.map((r) => (
              <React.Fragment key={r.customerCardID}>
                <tr className="border-b border-slate-100 hover:bg-blue-50/40 cursor-pointer" onClick={() => void toggle(r.customerCardID)}>
                  <td className="pl-2 text-slate-400">
                    {open === r.customerCardID ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  {COLS.map((c) => (
                    <td
                      key={c.key}
                      className={`px-2 py-1 whitespace-nowrap ${c.num ? 'text-right tabular-nums' : ''} ${
                        (c.key === 'd90Plus' || c.key === 'overdue') && r[c.key] > 0 ? 'text-red-700 font-semibold' : ''
                      }`}
                    >
                      {cellText(r, c.key)}
                    </td>
                  ))}
                </tr>
                {open === r.customerCardID && (
                  <tr className="bg-slate-50/60">
                    <td />
                    <td colSpan={COLS.length} className="px-2 py-2">
                      <table className="text-[11px]">
                        <thead>
                          <tr className="text-slate-500">
                            {['Belge', 'No', 'Tarih', 'Vade', 'Tutar', 'Açık', 'Gün'].map((h) => (
                              <th key={h} className={`px-2 py-0.5 font-medium ${['Tutar', 'Açık', 'Gün'].includes(h) ? 'text-right' : 'text-left'}`}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((i, k) => (
                            <tr key={k}>
                              <td className="px-2 py-0.5">{SOURCE[i.source ?? ''] ?? i.source}</td>
                              <td className="px-2 py-0.5">{i.docNo}</td>
                              <td className="px-2 py-0.5">{d(i.date)}</td>
                              <td className="px-2 py-0.5">{d(i.dueDate)}</td>
                              <td className="px-2 py-0.5 text-right tabular-nums">{n(i.amount)}</td>
                              <td className="px-2 py-0.5 text-right tabular-nums font-semibold">{n(i.open)}</td>
                              <td className={`px-2 py-0.5 text-right tabular-nums ${i.daysOverdue > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                                {i.daysOverdue > 0 ? i.daysOverdue : `${-i.daysOverdue} gün var`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
