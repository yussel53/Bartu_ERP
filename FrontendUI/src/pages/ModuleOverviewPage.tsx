import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Table2 } from 'lucide-react';
import {
  fetchModuleOverview,
  type ModuleOverview,
  type OverviewKpi,
} from '../api/moduleOverviewApi';
import { loadChartJs } from '../utils/chartJsLoader';
import type { AppModule, MenuGroup } from '../types/formTypes';

interface ModuleOverviewPageProps {
  module: AppModule;
  group?: MenuGroup | null;
  /** Ekran detay raporu için Type_ filtresi */
  typeFilter?: number | null;
  titleOverride?: string;
  breadcrumb?: string;
  onNavigate: (path: string) => void;
  /** Liste ekranına geçiş (Detay Tablosu / Liste) */
  listPath?: string | null;
  compact?: boolean;
}

const TONE: Record<string, string> = {
  slate: 'border-slate-200 bg-white',
  blue: 'border-sky-200 bg-white',
  emerald: 'border-emerald-200 bg-white',
  amber: 'border-amber-200 bg-white',
  rose: 'border-rose-200 bg-white',
  violet: 'border-violet-200 bg-white',
};

const ICON_TONE: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  violet: 'bg-violet-100 text-violet-700',
};

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function yearStartIso() {
  return `${new Date().getFullYear()}-01-01`;
}

function formatMoneyTr(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} Mr TL`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} Mn TL`;
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL`;
}

function KpiCard({ k }: { k: OverviewKpi }) {
  const tone = k.tone || 'slate';
  return (
    <div className={`rounded-xl border px-3.5 py-3 shadow-sm ${TONE[tone] || TONE.slate}`}>
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${ICON_TONE[tone] || ICON_TONE.slate}`}>
          {(k.title || '?').slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-slate-500 truncate">{k.title}</div>
          <div className="text-[18px] font-bold text-slate-900 leading-tight mt-0.5 truncate">{k.value}</div>
          {k.subtitle && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{k.subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

export const ModuleOverviewPage: React.FC<ModuleOverviewPageProps> = ({
  module,
  group,
  typeFilter,
  titleOverride,
  breadcrumb,
  onNavigate,
  listPath,
  compact = false,
}) => {
  const [dateFrom, setDateFrom] = useState(yearStartIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [data, setData] = useState<ModuleOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const donutRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<{ donut?: { destroy: () => void }; bar?: { destroy: () => void } }>({});

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchModuleOverview({
        modulePath: module.path,
        group: group?.key,
        dateFrom,
        dateTo,
        typeFilter,
      });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Özet okunamadı');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [module.path, group?.key, dateFrom, dateTo, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!data) return;
      const Chart = await loadChartJs();
      if (cancelled) return;

      chartsRef.current.donut?.destroy();
      chartsRef.current.bar?.destroy();
      chartsRef.current = {};

      if (donutRef.current && data.statusSlices.length > 0) {
        const total = data.statusSlices.reduce((s, x) => s + x.count, 0);
        chartsRef.current.donut = new Chart(donutRef.current, {
          type: 'doughnut',
          data: {
            labels: data.statusSlices.map((s) => s.label),
            datasets: [
              {
                data: data.statusSlices.map((s) => s.count),
                backgroundColor: data.statusSlices.map((s) => s.color || '#94a3b8'),
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: { dataIndex: number }) => {
                    const s = data.statusSlices[ctx.dataIndex];
                    return `${s.label}: ${s.count} · ${formatMoneyTr(s.amount)}`;
                  },
                },
              },
            },
            cutout: '68%',
          },
          plugins: [
            {
              id: 'centerText',
              afterDraw(chart: {
                ctx: CanvasRenderingContext2D;
                chartArea?: { left: number; right: number; top: number; bottom: number };
              }) {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const x = (chartArea.left + chartArea.right) / 2;
                const y = (chartArea.top + chartArea.bottom) / 2;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 18px system-ui,sans-serif';
                ctx.fillText(String(total), x, y - 4);
                ctx.fillStyle = '#64748b';
                ctx.font = '11px system-ui,sans-serif';
                ctx.fillText('adet', x, y + 14);
                ctx.restore();
              },
            },
          ],
        });
      }

      if (barRef.current && data.monthlyBars.length > 0) {
        chartsRef.current.bar = new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: data.monthlyBars.map((b) => b.label),
            datasets: [
              {
                label: 'Tutar',
                data: data.monthlyBars.map((b) => b.value),
                backgroundColor: 'rgba(37, 99, 235, 0.75)',
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 10 } } },
              y: {
                ticks: {
                  font: { size: 10 },
                  callback: (v: string | number) => formatMoneyTr(Number(v)),
                },
              },
            },
          },
        });
      }
    };
    void run();
    return () => {
      cancelled = true;
      chartsRef.current.donut?.destroy();
      chartsRef.current.bar?.destroy();
      chartsRef.current = {};
    };
  }, [data]);

  const crumbs = useMemo(() => {
    if (breadcrumb) return breadcrumb;
    const parts = [module.title];
    if (group) parts.push(group.title);
    return parts.join(' / ');
  }, [breadcrumb, module.title, group]);

  const title = titleOverride || data?.title || module.title;
  const detailListPath =
    listPath ||
    group?.screens[0]?.path ||
    module.groups.find((g) => g.screens.length)?.screens[0]?.path ||
    null;

  const maxBar = (vals: number[]) => Math.max(...vals, 1);

  return (
    <div className={`${compact ? '' : 'max-w-[1400px] mx-auto'} space-y-3`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{crumbs}</p>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{title}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-slate-600">
            Tarih aralığı
            <div className="mt-0.5 flex items-center gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-[12px]"
              />
            </div>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Yenile
          </button>
          {detailListPath && (
            <button
              type="button"
              onClick={() => onNavigate(detailListPath)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-slate-800 text-white text-[12px] font-semibold hover:bg-slate-900"
            >
              <Table2 className="w-3.5 h-3.5" />
              Detay Tablosu
            </button>
          )}
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{err}</div>
      )}
      {data?.warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {data.warning}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {(data?.kpis || []).map((k) => (
          <KpiCard key={k.key} k={k} />
        ))}
        {busy && !data && (
          <div className="col-span-full py-8 text-center text-[12px] text-slate-400">Yükleniyor…</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Durum Dağılımı</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-44 h-44 shrink-0">
              <canvas ref={donutRef} />
              {(!data || data.statusSlices.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
                  Veri yok
                </div>
              )}
            </div>
            <ul className="flex-1 space-y-1.5 w-full min-w-0">
              {(data?.statusSlices || []).map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-[12px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color || '#94a3b8' }} />
                  <span className="flex-1 truncate text-slate-700">{s.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{s.count}</span>
                  <span className="text-slate-400 text-[11px] tabular-nums w-24 text-right">
                    {formatMoneyTr(s.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Aylık Tutar</h3>
          <div className="h-52 relative">
            <canvas ref={barRef} />
            {(!data || data.monthlyBars.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-400">
                Aylık veri yok
              </div>
            )}
          </div>
        </section>
      </div>

      {(data?.rankPanels?.length || 0) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data!.rankPanels.map((p) => {
            const mx = maxBar(p.bars.map((b) => b.value));
            return (
              <section key={p.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-[13px] font-semibold text-slate-800 mb-3">{p.title}</h3>
                {p.bars.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-4 text-center">Veri yok</p>
                ) : (
                  <ul className="space-y-2">
                    {p.bars.map((b) => (
                      <li key={b.label}>
                        <div className="flex justify-between gap-2 text-[11px] mb-0.5">
                          <span className="truncate text-slate-700 font-medium">{b.label}</span>
                          <span className="tabular-nums text-slate-900 font-semibold shrink-0">
                            {formatMoneyTr(b.value)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.max(4, (b.value / mx) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!compact && group && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-slate-800 mb-2">{group.title} ekranları</h3>
          <div className="flex flex-wrap gap-2">
            {group.screens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onNavigate(s.path)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
              >
                {s.title}
              </button>
            ))}
            {group.screens.length === 0 && (
              <span className="text-[12px] text-slate-400">Bu grupta ekran yok</span>
            )}
          </div>
        </section>
      )}

      {!compact && !group && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-slate-800 mb-2">Gruplar</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {module.groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => onNavigate(`${module.path}/${g.key}`)}
                className="text-left rounded-lg border border-slate-200 px-3 py-2.5 hover:border-blue-300 hover:bg-sky-50/50"
              >
                <div className="text-[13px] font-semibold text-slate-800">{g.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{g.screens.length} ekran</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
