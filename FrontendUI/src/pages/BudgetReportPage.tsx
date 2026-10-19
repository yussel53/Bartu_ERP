import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PiggyBank } from 'lucide-react';
import { apiJson } from '../config/api';

interface Row {
  budgetID: number;
  code?: string | null;
  title: string;
  kind: number;
  target?: string | null;
  budget: number[];
  actual: number[];
  yearBudget: number;
  yearActual: number;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const n = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Genel Muhasebe → Raporlar → Bütçe / Gerçekleşen (Y-17) */
export const BudgetReportPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [upTo, setUpTo] = useState(new Date().getMonth() + 1);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setRows(await apiJson<Row[]>(`/api/budget/report?year=${year}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const sum = (a: number[], k: number) => a.slice(0, k).reduce((s, x) => s + x, 0);
  const totals = useMemo(
    () => [1, 2].map((kind) => {
      const rs = rows.filter((r) => r.kind === kind);
      return { kind, budget: rs.reduce((s, r) => s + sum(r.budget, upTo), 0), actual: rs.reduce((s, r) => s + sum(r.actual, upTo), 0) };
    }),
    [rows, upTo],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-slate-500" /> Bütçe / Gerçekleşen
          </h1>
          <p className="text-[12px] text-slate-500">
            Malzeme / hizmet bütçeleri faturalardan (KDV hariç), hesap bütçeleri muhasebe fişlerinden (alt hesaplar dahil) · tanımlar: Ana Kayıtlar → Bütçeler
          </p>
        </div>
        <div className="flex items-end gap-2 text-xs">
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Yıl</span>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} className="h-7 w-20 px-2 border border-slate-300 rounded-sm" />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Kümülatif (ay)</span>
            <select value={upTo} onChange={(e) => setUpTo(Number(e.target.value))} className="h-7 px-1 border border-slate-300 rounded-sm">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  Ocak – {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {err && <div className="px-3 py-1.5 rounded-md text-xs border border-red-200 bg-red-50 text-red-700">{err}</div>}

      <div className="grid grid-cols-2 gap-2">
        {totals.map((t) => {
          const pct = t.budget ? (t.actual / t.budget) * 100 : 0;
          const bad = t.kind === 1 ? pct > 100 : pct < 100;
          return (
            <div key={t.kind} className="bg-white border border-slate-200 rounded-md px-3 py-2">
              <div className="text-[11px] text-slate-500">{t.kind === 1 ? 'Gider' : 'Gelir'} · Ocak – {MONTHS[upTo - 1]}</div>
              <div className="text-[15px] font-semibold tabular-nums text-slate-800">
                {n(t.actual)} <span className="text-slate-400 font-normal">/ {n(t.budget)}</span>{' '}
                {t.budget > 0 && <span className={`text-[12px] ${bad ? 'text-red-700' : 'text-emerald-700'}`}>%{pct.toFixed(0)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-md overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Bütçe</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-1.5 text-right font-semibold text-slate-700">
                  {m}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Kümülatif</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-4 text-center text-slate-400">
                  {year} için bütçe yok.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const cb = sum(r.budget, upTo);
              const ca = sum(r.actual, upTo);
              const over = (b: number, a: number) => (r.kind === 1 ? b > 0 && a > b : b > 0 && a < b);
              return (
                <tr key={r.budgetID} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-1">
                    <div className="font-medium text-slate-800">{r.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.kind === 1 ? 'Gider' : 'Gelir'} · {r.target}
                    </div>
                  </td>
                  {r.budget.map((b, i) => (
                    <td key={i} className={`px-2 py-1 text-right tabular-nums ${i >= upTo ? 'opacity-50' : ''}`}>
                      <div className={over(b, r.actual[i]) ? 'text-red-700 font-semibold' : 'text-slate-800'}>{n(r.actual[i])}</div>
                      <div className="text-[10px] text-slate-400">{n(b)}</div>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums">
                    <div className={over(cb, ca) ? 'text-red-700 font-semibold' : 'text-slate-800 font-semibold'}>{n(ca)}</div>
                    <div className="text-[10px] text-slate-400">
                      {n(cb)}
                      {cb > 0 ? ` · %${((ca / cb) * 100).toFixed(0)}` : ''}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">Her hücrede üstte gerçekleşen, altta bütçe. Kırmızı: giderde bütçe aşımı, gelirde bütçenin altı.</p>
    </div>
  );
};
