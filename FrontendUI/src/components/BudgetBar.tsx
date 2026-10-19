import React from 'react';
import { PiggyBank } from 'lucide-react';
import { apiJson } from '../config/api';

interface Bar {
  budgetID: number;
  title: string;
  kind: number;
  overAction: number;
  month: number;
  monthBudget: number;
  monthActual: number;
  docAmount: number;
  yearBudget: number;
  yearActual: number;
  over: boolean;
}

const n = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const num = (v: unknown) => {
  const x = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};

/**
 * Y-17: faturada satırların düştüğü bütçelerin aylık kullanım çubuğu.
 * Gri: bu belge hariç gerçekleşen · mavi / kırmızı: bu belge · çizgi: aylık bütçe. Bütçe yoksa hiçbir şey göstermez.
 */
export const BudgetBar: React.FC<{ invoiceType: unknown; date: unknown; lines: Record<string, unknown>[] | undefined; invoiceId?: number }> = ({
  invoiceType,
  date,
  lines,
  invoiceId,
}) => {
  const [bars, setBars] = React.useState<Bar[]>([]);
  const key = JSON.stringify([
    invoiceType,
    date,
    (lines ?? []).map((l) => [l.ProductCardID ?? l.ItemsID, l.TotalPrice]),
  ]);

  React.useEffect(() => {
    const t = Number(invoiceType);
    const d = String(date ?? '').slice(0, 10);
    const ls = (lines ?? [])
      .map((l) => ({ productCardID: Number(l.ProductCardID ?? l.ItemsID) || null, amount: num(l.TotalPrice) }))
      .filter((l) => l.productCardID && l.amount);
    if (!t || !d || ls.length === 0) {
      setBars([]);
      return;
    }
    let alive = true;
    const h = window.setTimeout(() => {
      apiJson<Bar[]>('/api/budget/check-invoice', {
        method: 'POST',
        body: JSON.stringify({ invoiceType: t, date: d, invoiceId: invoiceId ?? 0, lines: ls }),
      })
        .then((r) => alive && setBars(r))
        .catch(() => alive && setBars([]));
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, invoiceId]);

  if (bars.length === 0) return null;
  return (
    <div className="shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 space-y-1">
      {bars.map((b) => {
        const total = b.monthActual + b.docAmount;
        const scale = Math.max(b.monthBudget, total, 1);
        const pctActual = (Math.max(b.monthActual, 0) / scale) * 100;
        const pctDoc = (Math.max(b.docAmount, 0) / scale) * 100;
        const pctBudget = (b.monthBudget / scale) * 100;
        const left = b.monthBudget - total;
        return (
          <div key={b.budgetID} className="flex items-center gap-2 text-[11px]">
            <PiggyBank className={`w-3.5 h-3.5 shrink-0 ${b.over ? 'text-red-600' : 'text-slate-400'}`} />
            <span className="w-48 truncate text-slate-700 dark:text-slate-200" title={b.title}>
              {b.title} · {MONTHS[b.month - 1]}
            </span>
            <div className="relative flex-1 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`Bütçe ${n(b.monthBudget)} · gerçekleşen ${n(b.monthActual)} · bu belge ${n(b.docAmount)}`}>
              <div className="absolute inset-y-0 left-0 bg-slate-400/70" style={{ width: `${pctActual}%` }} />
              <div
                className={`absolute inset-y-0 ${b.over ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ left: `${pctActual}%`, width: `${pctDoc}%` }}
              />
              {b.monthBudget > 0 && <div className="absolute inset-y-0 w-0.5 bg-slate-800 dark:bg-slate-200" style={{ left: `calc(${pctBudget}% - 1px)` }} />}
            </div>
            <span className={`w-56 text-right tabular-nums ${b.over ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
              {b.monthBudget > 0 ? (left >= 0 ? `Kalan ${n(left)}` : `Aşım ${n(-left)}${b.overAction === 2 ? ' · engellenir' : ''}`) : 'Bu ay bütçe yok'}
              <span className="text-slate-400 font-normal"> / {n(b.monthBudget)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};
