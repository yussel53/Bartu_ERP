import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calculator, Loader2 } from 'lucide-react';
import { apiJson } from '../config/api';
import { useAuth } from '../components/AuthGate';
import { FilterInput, SortLabel, useGridSortFilter } from '../components/GridSortFilter';

interface Row {
  productCardID: number;
  code?: string | null;
  title?: string | null;
  qty: number;
  avgCost: number;
  stockValue: number;
  salesQty: number;
  salesAmount: number;
  salesCost: number;
  grossProfit: number;
}

const n = (v: number, d = 2) => v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });

const COLS: { key: keyof Row; label: string; num?: boolean; dec?: number }[] = [
  { key: 'code', label: 'Kod' },
  { key: 'title', label: 'Malzeme' },
  { key: 'qty', label: 'Eldeki', num: true, dec: 2 },
  { key: 'avgCost', label: 'Ort. maliyet', num: true, dec: 4 },
  { key: 'stockValue', label: 'Stok değeri', num: true },
  { key: 'salesQty', label: 'Satılan', num: true },
  { key: 'salesAmount', label: 'Satış tutarı', num: true },
  { key: 'salesCost', label: 'Satış maliyeti', num: true },
  { key: 'grossProfit', label: 'Brüt kâr', num: true },
];

/** Malzeme → İşlemler → Maliyetlendirme (Y-07): ağırlıklı ortalama maliyet, stok değeri, brüt kâr */
export const StockCostingPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const isAdmin = !!useAuth()?.user.isAdmin;
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ scope: string; negativeControl: string } | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    try {
      const r = await apiJson<{ scope: string; negativeControl: string; rows: Row[] }>(`/api/stock/cost-report?${q}`);
      setRows(r.rows);
      setMeta({ scope: r.scope, negativeControl: r.negativeControl });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const recalc = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiJson<{ message: string }>('/api/stock/cost/recalculate', { method: 'POST' });
      setMsg({ text: r.message });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  const cellText = (r: Row, key: string) => {
    const c = COLS.find((x) => x.key === key);
    const v = r[key as keyof Row];
    return c?.num ? n(Number(v) || 0, c.dec ?? 2) : String(v ?? '');
  };
  const grid = useGridSortFilter(rows, cellText);
  const totals = useMemo(
    () => ({
      stockValue: grid.view.reduce((s, r) => s + r.stockValue, 0),
      salesAmount: grid.view.reduce((s, r) => s + r.salesAmount, 0),
      salesCost: grid.view.reduce((s, r) => s + r.salesCost, 0),
      grossProfit: grid.view.reduce((s, r) => s + r.grossProfit, 0),
    }),
    [grid.view],
  );
  const neg = { '0': 'izin verilir', '1': 'uyarı verilir', '2': 'engellenir' }[meta?.negativeControl ?? '0'];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-500" /> Maliyetlendirme
          </h1>
          <p className="text-[12px] text-slate-500">
            Karttaki maliyet yöntemi ({meta?.scope === 'ambar' ? 'ambar bazında' : 'firma geneli'}) · eksi stok {neg} · parametreler:
            Sistem → Parametreler (STK_COST_SCOPE, STK_NEG_CTRL)
          </p>
        </div>
        <div className="flex items-end gap-2 text-xs">
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Satış başlangıç</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 px-2 border border-slate-300 rounded-sm" />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Bitiş</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 px-2 border border-slate-300 rounded-sm" />
          </label>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void recalc()}
              disabled={busy}
              className="h-7 px-3 rounded-sm bg-blue-700 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Maliyeti yeniden hesapla
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`px-3 py-1.5 rounded-md text-xs border ${msg.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(
          [
            ['Stok değeri', totals.stockValue],
            ['Satış tutarı', totals.salesAmount],
            ['Satış maliyeti', totals.salesCost],
            ['Brüt kâr', totals.grossProfit],
          ] as [string, number][]
        ).map(([l, v]) => (
          <div key={l} className="bg-white border border-slate-200 rounded-md px-3 py-2">
            <div className="text-[11px] text-slate-500">{l}</div>
            <div className={`text-[15px] font-semibold tabular-nums ${l === 'Brüt kâr' && v < 0 ? 'text-red-700' : 'text-slate-800'}`}>{n(v)}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={`px-2 py-1.5 font-semibold text-slate-700 ${c.num ? 'text-right' : 'text-left'}`}>
                  <SortLabel colKey={c.key} label={c.label} sort={grid.sort} onSort={grid.toggleSort} align={c.num ? 'right' : 'left'} />
                </th>
              ))}
            </tr>
            <tr>
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
                <td colSpan={COLS.length} className="px-3 py-4 text-center text-slate-400">
                  Hareket yok. {isAdmin ? '«Maliyeti yeniden hesapla» ile hesaplayın.' : ''}
                </td>
              </tr>
            )}
            {grid.view.map((r) => (
              <tr key={r.productCardID} className="border-b border-slate-100 hover:bg-blue-50/40">
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-1 whitespace-nowrap ${c.num ? 'text-right tabular-nums' : ''} ${
                      c.key === 'grossProfit' && r.grossProfit < 0 ? 'text-red-700 font-semibold' : ''
                    }`}
                  >
                    {cellText(r, c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
