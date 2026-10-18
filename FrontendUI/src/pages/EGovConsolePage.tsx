import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Clock, Inbox, RefreshCw, Send } from 'lucide-react';
import { EGovConsoleSummary, getEGovConsole } from '../api/egovConsoleApi';
import { loadChartJs } from '../utils/chartJsLoader';
import { isoToDisplay } from '../utils/dateFormat';

const KINDS: { value: number; label: string; key: string }[] = [
  { value: 1, label: 'e-Fatura', key: 'e-fatura' },
  { value: 2, label: 'e-Arşiv', key: 'e-arsiv' },
  { value: 3, label: 'e-İrsaliye', key: 'e-irsaliye' },
];

const STAGES: { key: string; label: string; color: string; path?: string }[] = [
  { key: 'new', label: 'Yeni', color: '#94a3b8', path: 'edevlet/e-fatura/gelen' },
  { key: 'pending', label: 'Onayda', color: '#eda100', path: 'edevlet/e-fatura/onay-bekleyenler' },
  { key: 'approved', label: 'Onaylandı', color: '#1baf7a', path: 'edevlet/e-fatura/onaylananlar' },
  { key: 'saved', label: 'Kaydedildi', color: '#2a78d6', path: 'edevlet/e-fatura/kaydedilenler' },
  { key: 'rejected', label: 'Reddedildi', color: '#e34948', path: 'edevlet/e-fatura/gelen' },
];

const PERIODS: { key: string; label: string }[] = [
  { key: 'today', label: 'Bugün' },
  { key: '7', label: 'Son 7 gün' },
  { key: '30', label: 'Son 30 gün' },
  { key: 'month', label: 'Bu ay' },
  { key: '90', label: 'Son 90 gün' },
  { key: 'year', label: 'Bu yıl' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function periodRange(key: string): [string, string] {
  const today = new Date();
  const start = new Date(today);
  if (key === 'today') return [iso(today), iso(today)];
  if (key === 'month') start.setDate(1);
  else if (key === 'year') start.setMonth(0, 1);
  else start.setDate(start.getDate() - (Number(key) - 1));
  return [iso(start), iso(today)];
}

const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * E-Devlet → İşlemler → e-Belge Konsolu: seçilen dönemde gelen / giden e-Fatura · e-Arşiv · e-İrsaliye sayıları,
 * bekleyen ve hatalı belgeler, günlük grafik, gelen fatura onay aşamaları ve dikkat bekleyen belgeler.
 */
export const EGovConsolePage: React.FC<{ onBack: () => void; onNavigate: (path: string) => void }> = ({ onBack, onNavigate }) => {
  const [period, setPeriod] = useState('30');
  const [docKind, setDocKind] = useState<number | null>(null);
  const [data, setData] = useState<EGovConsoleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const barRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [from, to] = periodRange(period);
      setData(await getEGovConsole(from, to, docKind));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Özet okunamadı');
    } finally {
      setLoading(false);
    }
  }, [period, docKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const sum = (dir: number, kind?: number) =>
      (data?.kinds ?? []).filter((k) => k.direction === dir && (!kind || k.docKind === kind));
    const count = (dir: number, kind?: number) => sum(dir, kind).reduce((a, k) => a + k.count, 0);
    const amount = (dir: number, kind?: number) => sum(dir, kind).reduce((a, k) => a + k.amountTry, 0);
    const foreign = (dir: number, kind?: number) => sum(dir, kind).reduce((a, k) => a + k.foreignCount, 0);
    const st = data?.stages ?? {};
    return {
      count,
      amount,
      foreign,
      pending: (st.pending ?? 0) + (st.approved ?? 0) + (st.new ?? 0),
      errors: (st.rejected ?? 0) + (data?.statusErrors ?? 0),
    };
  }, [data]);

  // Grafikler (Chart.js CDN — ModuleOverviewPage ile aynı yükleyici)
  useEffect(() => {
    if (!data) return;
    let off = false;
    const charts: { destroy: () => void }[] = [];
    void loadChartJs().then((Chart) => {
      if (off) return;
      if (barRef.current) {
        charts.push(
          new Chart(barRef.current, {
            type: 'bar',
            data: {
              labels: data.daily.map((d) => isoToDisplay(d.day.slice(0, 10)).slice(0, 5)),
              datasets: [
                { label: 'Gelen', data: data.daily.map((d) => d.incoming), backgroundColor: '#2a78d6', borderRadius: 3, maxBarThickness: 14 },
                { label: 'Giden', data: data.daily.map((d) => d.outgoing), backgroundColor: '#eb6834', borderRadius: 3, maxBarThickness: 14 },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
                y: { beginAtZero: true, ticks: { font: { size: 10 }, precision: 0 } },
              },
            },
          }),
        );
      }
      const slices = STAGES.map((s) => ({ ...s, n: data.stages[s.key] ?? 0 })).filter((s) => s.n > 0);
      if (donutRef.current && slices.length > 0) {
        charts.push(
          new Chart(donutRef.current, {
            type: 'doughnut',
            data: {
              labels: slices.map((s) => s.label),
              datasets: [{ data: slices.map((s) => s.n), backgroundColor: slices.map((s) => s.color), borderColor: '#fff', borderWidth: 2 }],
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false } } },
          }),
        );
      }
    });
    return () => {
      off = true;
      charts.forEach((c) => c.destroy());
    };
  }, [data]);

  const kindLine = (dir: number) =>
    KINDS.filter((k) => !docKind || k.value === docKind)
      .map((k) => `${k.label} ${totals.count(dir, k.value)}`)
      .join(' · ');

  const card = (
    icon: React.ReactNode,
    label: string,
    value: number,
    sub: string,
    tone: 'plain' | 'warn' | 'danger',
    onClick?: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
        tone === 'warn'
          ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900'
          : tone === 'danger'
            ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-800'
            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[12px] opacity-80">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
      <div className="text-[11px] opacity-70 truncate">{sub}</div>
    </button>
  );

  const stageLabel: Record<string, { text: string; cls: string }> = {
    pending: { text: 'Onayda', cls: 'text-amber-700' },
    approved: { text: 'Onaylandı · kaydedilecek', cls: 'text-emerald-700' },
    rejected: { text: 'Reddedildi', cls: 'text-red-700' },
    error: { text: 'Hata', cls: 'text-red-700' },
  };
  const attentionPath = (stage: string, kind: number) =>
    stage === 'pending'
      ? 'edevlet/e-fatura/onay-bekleyenler'
      : stage === 'approved'
        ? 'edevlet/e-fatura/onaylananlar'
        : `edevlet/${KINDS.find((k) => k.value === kind)?.key ?? 'e-fatura'}/gelen`;

  const th = 'px-2 py-1 text-left font-medium text-slate-500 border-b border-slate-200 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-slate-100 whitespace-nowrap';

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">e-Belge Konsolu</h2>
          <p className="text-[11px] text-slate-500">
            Gelen / giden e-Fatura · e-Arşiv · e-İrsaliye özeti
            {data ? ` · ${isoToDisplay(data.from.slice(0, 10))} – ${isoToDisplay(data.to.slice(0, 10))}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white">
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={docKind ?? ''}
            onChange={(e) => setDocKind(e.target.value ? Number(e.target.value) : null)}
            className="h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white"
          >
            <option value="">Tüm belgeler</option>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yenile
          </button>
        </div>
      </div>

      {err && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{err}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {card(<Inbox className="w-3.5 h-3.5" />, 'Gelen', totals.count(1), kindLine(1), 'plain', () =>
              onNavigate(`edevlet/${KINDS.find((k) => k.value === docKind)?.key ?? 'e-fatura'}/gelen`),
            )}
            {card(<Send className="w-3.5 h-3.5" />, 'Giden', totals.count(2), kindLine(2), 'plain', () =>
              onNavigate(`edevlet/${KINDS.find((k) => k.value === docKind)?.key ?? 'e-fatura'}/giden`),
            )}
            {card(
              <Clock className="w-3.5 h-3.5" />,
              'Bekleyen',
              totals.pending,
              `Yeni ${data.stages.new ?? 0} · onayda ${data.stages.pending ?? 0} · kaydedilecek ${data.stages.approved ?? 0}`,
              'warn',
              () => onNavigate('edevlet/e-fatura/onay-bekleyenler'),
            )}
            {card(
              <AlertTriangle className="w-3.5 h-3.5" />,
              'Hatalı / reddedilen',
              totals.errors,
              `Onayda reddedilen ${data.stages.rejected ?? 0} · entegratör hatası ${data.statusErrors}`,
              'danger',
              () => onNavigate('edevlet/e-fatura/gelen'),
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2.5">
            <section className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-slate-800">Günlük belge sayısı</h3>
                <div className="flex gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#2a78d6]" /> Gelen
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#eb6834]" /> Giden
                  </span>
                </div>
              </div>
              <div className="relative h-48">
                <canvas ref={barRef} role="img" aria-label="Günlük gelen ve giden belge sayısı" />
              </div>
            </section>
            <section className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <h3 className="text-[13px] font-semibold text-slate-800">Gelen faturalar · onay aşaması</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 mt-1">
                {STAGES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => s.path && onNavigate(s.path)}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label} {data.stages[s.key] ?? 0}
                  </button>
                ))}
              </div>
              <div className="relative h-40">
                {Object.values(data.stages).some((n) => n > 0) ? (
                  <canvas ref={donutRef} role="img" aria-label="Gelen faturaların onay aşamalarına göre dağılımı" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-400">Bu dönemde gelen fatura yok</div>
                )}
              </div>
              {!data.approvalReady && (
                <div className="text-[11px] text-amber-700">Onay süreci kurulu değil — aşamalar yalnız yeni / kaydedildi.</div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {KINDS.filter((k) => !docKind || k.value === docKind).map((k) => (
              <section key={k.value} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px]">
                <h3 className="text-[13px] font-semibold text-slate-800">{k.label}</h3>
                {[1, 2].map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => onNavigate(`edevlet/${k.key}/${dir === 1 ? 'gelen' : 'giden'}`)}
                    className="flex w-full justify-between gap-2 text-slate-600 hover:text-blue-700"
                  >
                    <span>
                      {dir === 1 ? 'Gelen' : 'Giden'} {totals.count(dir, k.value)}
                    </span>
                    <span className="tabular-nums">
                      {money(totals.amount(dir, k.value))} TL
                      {totals.foreign(dir, k.value) > 0 ? ` + ${totals.foreign(dir, k.value)} dövizli` : ''}
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>

          <section className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <h3 className="text-[13px] font-semibold text-slate-800 mb-1">Dikkat bekleyenler</h3>
            {data.attention.length === 0 ? (
              <div className="text-[12px] text-slate-400 py-2">Bekleyen ya da hatalı belge yok.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>Belge</th>
                      <th className={th}>Tür</th>
                      <th className={th}>Gönderen / alıcı</th>
                      <th className={`${th} text-right`}>Tutar</th>
                      <th className={th}>Durum</th>
                      <th className={th}>Bekleyen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attention.map((a) => {
                      const s = stageLabel[a.stage] ?? { text: a.stage, cls: 'text-slate-600' };
                      return (
                        <tr
                          key={a.eGovDocumentID}
                          onClick={() => onNavigate(attentionPath(a.stage, a.docKind))}
                          className="cursor-pointer hover:bg-blue-50/50"
                          title="Listede aç"
                        >
                          <td className={`${td} font-medium`}>{a.documentNo}</td>
                          <td className={td}>
                            {KINDS.find((k) => k.value === a.docKind)?.label} · {a.direction === 1 ? 'gelen' : 'giden'}
                          </td>
                          <td className={`${td} max-w-[240px] truncate`}>{a.customerTitle}</td>
                          <td className={`${td} text-right tabular-nums`}>
                            {a.amount != null ? money(a.amount) : ''} {a.currencyCode && a.currencyCode !== 'TRY' ? a.currencyCode : ''}
                          </td>
                          <td className={`${td} ${s.cls}`} title={a.status ?? a.comment ?? undefined}>
                            {a.stage === 'error' ? a.status : s.text}
                            {a.stage === 'pending' && a.pendingRoleName ? ` · ${a.pendingRoleName}` : ''}
                          </td>
                          <td className={`${td} ${a.ageDays >= 3 ? 'text-red-700 font-medium' : 'text-slate-500'}`}>
                            {a.ageDays <= 0 ? 'bugün' : `${a.ageDays} gün`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
