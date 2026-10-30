import React from 'react';
import { AlertTriangle, Ban, CheckCircle2, PiggyBank } from 'lucide-react';
import { apiJson } from '../config/api';

interface Bar {
  budgetID: number;
  title: string;
  kind: number;
  overAction: number;
  target?: string | null;
  month: number;
  monthBudget: number;
  monthActual: number;
  docAmount: number;
  yearBudget: number;
  yearActual: number;
  over: boolean;
  level?: string;
}

const n = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const num = (v: unknown) => {
  const x = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};

function levelOf(b: Bar): 'ok' | 'warn' | 'stop' | 'info' {
  if (b.level === 'ok' || b.level === 'warn' || b.level === 'stop' || b.level === 'info') return b.level;
  if (!b.over) return 'ok';
  if (b.overAction === 2) return 'stop';
  if (b.overAction === 1) return 'warn';
  return 'info';
}

const PANEL: Record<string, string> = {
  ok: 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40',
  warn: 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40',
  stop: 'border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
  info: 'border-sky-300 bg-sky-50/80 dark:border-sky-800 dark:bg-sky-950/40',
};

const ROW_ICON = {
  ok: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />,
  stop: <Ban className="w-3.5 h-3.5 shrink-0 text-red-600" />,
  info: <PiggyBank className="w-3.5 h-3.5 shrink-0 text-sky-600" />,
};

const ACTION_LABEL: Record<number, string> = {
  0: 'Devam et',
  1: 'Uyar',
  2: 'Durdur',
};

/**
 * Fatura altı bütçe çubuğu — boyut / hesap / malzeme.
 * Renk: yeşil OK · amber Uyar · kırmızı Durdur · mavi Devam et (aşımda).
 */
export const BudgetBar: React.FC<{
  invoiceType: unknown;
  date: unknown;
  lines: Record<string, unknown>[] | undefined;
  invoiceId?: number;
}> = ({ invoiceType, date, lines, invoiceId }) => {
  const [bars, setBars] = React.useState<Bar[]>([]);
  const key = JSON.stringify([
    invoiceType,
    date,
    (lines ?? []).map((l) => [
      l.ProductCardID ?? l.ItemsID,
      l.TotalPrice,
      l.CostDimCardID1,
      l.CostDimCardID2,
      l.CostDimCardID3,
      l.CostDimCardID4,
      l.CostDimCardID5,
    ]),
  ]);

  React.useEffect(() => {
    const t = Number(invoiceType);
    const d = String(date ?? '').slice(0, 10);
    const ls = (lines ?? [])
      .map((l) => ({
        productCardID: Number(l.ProductCardID ?? l.ItemsID) || null,
        amount: num(l.TotalPrice),
        costDimCardID1: Number(l.CostDimCardID1) || null,
        costDimCardID2: Number(l.CostDimCardID2) || null,
        costDimCardID3: Number(l.CostDimCardID3) || null,
        costDimCardID4: Number(l.CostDimCardID4) || null,
        costDimCardID5: Number(l.CostDimCardID5) || null,
      }))
      .filter(
        (l) =>
          l.amount &&
          (l.productCardID ||
            l.costDimCardID1 ||
            l.costDimCardID2 ||
            l.costDimCardID3 ||
            l.costDimCardID4 ||
            l.costDimCardID5),
      );
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

  const worst = bars.reduce<'ok' | 'warn' | 'stop' | 'info'>((acc, b) => {
    const lv = levelOf(b);
    const rank = { ok: 0, info: 1, warn: 2, stop: 3 };
    return rank[lv] > rank[acc] ? lv : acc;
  }, 'ok');

  return (
    <div className={`shrink-0 rounded-md border px-3 py-2 space-y-1.5 ${PANEL[worst]}`}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1">
          <PiggyBank className="w-3.5 h-3.5" />
          Bütçe (boyut / hedef)
        </span>
        <span className="normal-case font-medium">
          {worst === 'stop' && 'Aşım — kayıt durdurulur'}
          {worst === 'warn' && 'Aşım — uyarı ile kaydedilir'}
          {worst === 'info' && 'Aşım — devam edilebilir'}
          {worst === 'ok' && 'Limit içinde'}
        </span>
      </div>
      {bars.map((b) => {
        const lv = levelOf(b);
        const total = b.monthActual + b.docAmount;
        const scale = Math.max(b.monthBudget, total, 1);
        const pctActual = (Math.max(b.monthActual, 0) / scale) * 100;
        const pctDoc = (Math.max(b.docAmount, 0) / scale) * 100;
        const pctBudget = (b.monthBudget / scale) * 100;
        const left = b.monthBudget - total;
        const barDoc =
          lv === 'stop' ? 'bg-red-500' : lv === 'warn' ? 'bg-amber-500' : lv === 'info' ? 'bg-sky-500' : 'bg-emerald-500';
        return (
          <div
            key={b.budgetID}
            className={`flex items-center gap-2 text-[11px] rounded px-1.5 py-1 ${
              lv === 'stop'
                ? 'bg-red-100/70 dark:bg-red-900/30'
                : lv === 'warn'
                  ? 'bg-amber-100/70 dark:bg-amber-900/30'
                  : lv === 'info' && b.over
                    ? 'bg-sky-100/60 dark:bg-sky-900/30'
                    : 'bg-white/60 dark:bg-slate-900/40'
            }`}
          >
            {ROW_ICON[lv]}
            <span className="w-52 truncate text-slate-800 dark:text-slate-100 font-medium" title={`${b.title}${b.target ? ` · ${b.target}` : ''}`}>
              {b.title}
              {b.target ? <span className="font-normal text-slate-500"> · {b.target}</span> : null}
              <span className="font-normal text-slate-500"> · {MONTHS[b.month - 1]}</span>
            </span>
            <div
              className="relative flex-1 h-3.5 rounded-sm bg-slate-200/80 dark:bg-slate-800 overflow-hidden"
              title={`Bütçe ${n(b.monthBudget)} · gerçekleşen ${n(b.monthActual)} · bu belge ${n(b.docAmount)}`}
            >
              <div className="absolute inset-y-0 left-0 bg-slate-400/80" style={{ width: `${pctActual}%` }} />
              <div className={`absolute inset-y-0 ${barDoc}`} style={{ left: `${pctActual}%`, width: `${pctDoc}%` }} />
              {b.monthBudget > 0 && (
                <div className="absolute inset-y-0 w-0.5 bg-slate-900 dark:bg-white" style={{ left: `calc(${pctBudget}% - 1px)` }} />
              )}
            </div>
            <span
              className={`w-60 text-right tabular-nums ${
                lv === 'stop'
                  ? 'text-red-800 dark:text-red-300 font-semibold'
                  : lv === 'warn'
                    ? 'text-amber-900 dark:text-amber-200 font-semibold'
                    : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {b.monthBudget > 0
                ? left >= 0
                  ? `Kalan ${n(left)}`
                  : `Aşım ${n(-left)} · ${ACTION_LABEL[b.overAction] ?? ''}`
                : 'Bu ay bütçe yok'}
              <span className="text-slate-400 font-normal"> / {n(b.monthBudget)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};
