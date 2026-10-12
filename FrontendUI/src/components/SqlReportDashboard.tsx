import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FilterX, Loader2, SlidersHorizontal } from 'lucide-react';
import type { SqlReportAuxDataset } from '../api/sqlReportsApi';
import { loadChartJs } from '../utils/chartJsLoader';
import {
  buildCalendarEvents,
  buildChartSeries,
  buildPivot,
  cellStyleForRules,
  computeKpi,
  exportRowsCsv,
  filterRowsByColumn,
  filterRowsByText,
  formatCellValue,
  formatKpiValue,
  guessNumericColumns,
  parseCalendar,
  parseCharts,
  parseCondRules,
  parseKpis,
  parsePivot,
  type SqlReportChartDef,
  type SqlReportKpiDef,
} from '../utils/sqlReportViz';

interface ColFormat {
  col: string;
  format: string;
  label?: string;
  show?: boolean;
  pattern?: string;
}

interface Props {
  columns: string[];
  rows: Record<string, unknown>[];
  kpiConfigJson?: string | null;
  chartConfigJson?: string | null;
  pivotConfigJson?: string | null;
  calendarConfigJson?: string | null;
  columnFormatsJson?: string | null;
  conditionalFormattingJson?: string | null;
  showDataTable?: boolean;
  showPivotTable?: boolean;
  showCalendar?: boolean;
  allowSimulation?: boolean;
  auxDatasets?: SqlReportAuxDataset[];
  reportName?: string;
  busy?: boolean;
  onSimulationChange?: (percents: Record<string, number>) => void;
  simulationPercents?: Record<string, number>;
}

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

function parseFormats(raw?: string | null): ColFormat[] {
  if (!raw?.trim()) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as ColFormat[]) : [];
  } catch {
    return [];
  }
}

export const SqlReportDashboard: React.FC<Props> = ({
  columns,
  rows,
  kpiConfigJson,
  chartConfigJson,
  pivotConfigJson,
  calendarConfigJson,
  columnFormatsJson,
  conditionalFormattingJson,
  showDataTable = true,
  showPivotTable = false,
  showCalendar = false,
  allowSimulation = false,
  auxDatasets,
  reportName = 'rapor',
  busy,
  onSimulationChange,
  simulationPercents = {},
}) => {
  const kpis = useMemo(() => parseKpis(kpiConfigJson), [kpiConfigJson]);
  const charts = useMemo(() => parseCharts(chartConfigJson), [chartConfigJson]);
  const pivotCfg = useMemo(() => parsePivot(pivotConfigJson), [pivotConfigJson]);
  const calendarCfg = useMemo(() => parseCalendar(calendarConfigJson), [calendarConfigJson]);
  const formats = useMemo(() => parseFormats(columnFormatsJson), [columnFormatsJson]);
  const condRules = useMemo(() => parseCondRules(conditionalFormattingJson), [conditionalFormattingJson]);
  const formatMap = useMemo(() => {
    const m = new Map<string, ColFormat>();
    for (const f of formats) if (f.col) m.set(f.col.toLowerCase(), f);
    return m;
  }, [formats]);

  const [search, setSearch] = useState('');
  const [chartFilter, setChartFilter] = useState<{ col: string; value: string } | null>(null);
  const [showSim, setShowSim] = useState(false);
  const [localSim, setLocalSim] = useState<Record<string, number>>(simulationPercents);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [auxTab, setAuxTab] = useState(0);

  useEffect(() => {
    setLocalSim(simulationPercents);
  }, [simulationPercents]);

  const filtered = useMemo(() => {
    let list = rows;
    if (chartFilter) list = filterRowsByColumn(list, chartFilter.col, chartFilter.value);
    list = filterRowsByText(list, columns, search);
    return list;
  }, [rows, columns, search, chartFilter]);

  const kpiValues = useMemo(
    () => kpis.map((k) => ({ def: k, value: computeKpi(k, filtered) })),
    [kpis, filtered],
  );

  const pivot = useMemo(
    () => (showPivotTable ? buildPivot(filtered, pivotCfg) : null),
    [showPivotTable, filtered, pivotCfg],
  );

  const calEvents = useMemo(
    () => (showCalendar ? buildCalendarEvents(filtered, calendarCfg) : []),
    [showCalendar, filtered, calendarCfg],
  );

  const numericCols = useMemo(() => guessNumericColumns(columns, rows), [columns, rows]);

  const displayColumns = useMemo(
    () =>
      columns
        .map((c) => {
          const f = formatMap.get(c.toLowerCase());
          return {
            key: c,
            label: f?.label || c,
            format: f?.format,
            pattern: f?.pattern,
            show: f?.show !== false,
          };
        })
        .filter((c) => c.show),
    [columns, formatMap],
  );

  const applySim = () => {
    onSimulationChange?.(localSim);
  };

  return (
    <div className="space-y-4">
      {allowSimulation && numericCols.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowSim((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-900"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            What-If Simülasyon
          </button>
          {showSim && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              {numericCols.slice(0, 6).map((col) => (
                <label key={col} className="text-[11px] text-slate-600">
                  {col} (±%)
                  <input
                    type="number"
                    className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1 text-[12px] bg-white"
                    value={localSim[col] ?? 0}
                    onChange={(e) =>
                      setLocalSim((prev) => ({ ...prev, [col]: Number(e.target.value) || 0 }))
                    }
                  />
                </label>
              ))}
              <div className="md:col-span-3 flex gap-2">
                <button
                  type="button"
                  onClick={applySim}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-700 text-white"
                >
                  Uygula (yeniden çalıştır)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocalSim({});
                    onSimulationChange?.({});
                  }}
                  className="px-2.5 py-1 text-[11px] rounded border border-slate-200 bg-white"
                >
                  Sıfırla
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {kpiValues.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {kpiValues.map(({ def, value }, i) => (
            <KpiCard key={i} def={def} value={value} />
          ))}
        </div>
      )}

      {charts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {charts.map((c, i) => (
            <ChartCard
              key={String(c.id ?? i)}
              chart={c}
              rows={filtered}
              onSliceClick={(label) => {
                const col = c.label_col || '';
                if (!col) return;
                setChartFilter((prev) =>
                  prev?.col === col && prev.value === label ? null : { col, value: label },
                );
              }}
            />
          ))}
        </div>
      )}

      {pivot && (
        <div className="rounded-md border border-slate-200 bg-white overflow-auto">
          <div className="px-3 py-2 border-b border-slate-100 text-[12px] font-semibold text-slate-700">
            Pivot Tablo
          </div>
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-1.5 text-left text-slate-500">{pivotCfg.row_field}</th>
                {pivot.colKeys.map((ck) => (
                  <th key={ck} className="px-2 py-1.5 text-right text-slate-500 whitespace-nowrap">
                    {ck}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right text-slate-700">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {pivot.rowKeys.map((rk) => (
                <tr key={rk} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-medium text-slate-700 whitespace-nowrap">{rk}</td>
                  {pivot.colKeys.map((ck) => (
                    <td key={ck} className="px-2 py-1 text-right tabular-nums">
                      {(pivot.cells.get(`${rk}\0${ck}`) || 0).toLocaleString('tr-TR', {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">
                    {(pivot.rowTotals.get(rk) || 0).toLocaleString('tr-TR', {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td className="px-2 py-1.5 font-semibold">Toplam</td>
                {pivot.colKeys.map((ck) => (
                  <td key={ck} className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {(pivot.colTotals.get(ck) || 0).toLocaleString('tr-TR', {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                  {pivot.grandTotal.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showCalendar && calendarCfg.date_column && (
        <CalendarPanel
          month={calMonth}
          onMonthChange={setCalMonth}
          events={calEvents}
          color={calendarCfg.color || '#3b82f6'}
        />
      )}

      {showDataTable !== false && (
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                className="border border-slate-200 rounded-md px-2 py-1.5 text-[12px] w-full max-w-xs"
                placeholder="Tabloda ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {chartFilter && (
                <button
                  type="button"
                  onClick={() => setChartFilter(null)}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1"
                >
                  <FilterX className="w-3 h-3" />
                  {chartFilter.col} = {chartFilter.value}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {filtered.length} / {rows.length} satır
              </span>
              <button
                type="button"
                disabled={!filtered.length}
                onClick={() =>
                  exportRowsCsv(
                    columns,
                    filtered,
                    `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                className="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>
          {columns.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-slate-500">Veri yok</div>
          ) : (
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {displayColumns.map((c) => (
                      <th
                        key={c.key}
                        className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 2000).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80">
                      {displayColumns.map((c) => {
                        const style = cellStyleForRules(row, c.key, condRules);
                        return (
                          <td
                            key={c.key}
                            className="px-2 py-1 whitespace-nowrap max-w-[240px] truncate"
                            style={style}
                          >
                            {formatCellValue(row[c.key], c.format, c.pattern)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!!auxDatasets?.length && (
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap gap-1 px-2 pt-2 border-b border-slate-100 bg-slate-50/80">
            {auxDatasets.map((ds, i) => (
              <button
                key={ds.key || i}
                type="button"
                onClick={() => setAuxTab(i)}
                className={`px-2.5 py-1.5 text-[11px] font-medium rounded-t-md border-b-2 ${
                  auxTab === i
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {ds.label || ds.key}
              </button>
            ))}
          </div>
          <div className="p-3">
            {(() => {
              const ds = auxDatasets[auxTab];
              if (!ds) return null;
              if (ds.error) {
                return <p className="text-[12px] text-rose-600">{ds.error}</p>;
              }
              return (
                <div className="overflow-auto max-h-[320px]">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {ds.columns.map((c) => (
                          <th key={c} className="px-2 py-1.5 text-left text-slate-500">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ds.rows.slice(0, 500).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {ds.columns.map((c) => (
                            <td key={c} className="px-2 py-1 whitespace-nowrap">
                              {row[c] == null ? '' : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-1">{ds.rowCount} satır</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

function CalendarPanel({
  month,
  onMonthChange,
  events,
  color,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  events: ReturnType<typeof buildCalendarEvents>;
  color: string;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const startPad = (firstDow + 6) % 7; // Pazartesi başlangıç
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const byDay = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const ev of events) {
      if (!map.has(ev.dateKey)) map.set(ev.dateKey, []);
      map.get(ev.dateKey)!.push(ev);
    }
    return map;
  }, [events]);

  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null, key: `p${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, key });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-slate-800">Takvim</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1 rounded border border-slate-200"
            onClick={() => onMonthChange(new Date(year, m - 1, 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[12px] font-medium px-2 min-w-[120px] text-center">
            {month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            className="p-1 rounded border border-slate-200"
            onClick={() => onMonthChange(new Date(year, m + 1, 1))}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-400 mb-1">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
          <div key={d} className="text-center font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const dayEvents = c.day ? byDay.get(c.key) || [] : [];
          return (
            <div
              key={c.key}
              className={`min-h-[64px] rounded border p-1 ${
                c.day ? 'border-slate-100 bg-slate-50/50' : 'border-transparent'
              }`}
            >
              {c.day != null && (
                <>
                  <div className="text-[10px] font-semibold text-slate-500">{c.day}</div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((ev, i) => (
                      <div
                        key={i}
                        className="truncate text-[9px] px-1 rounded text-white"
                        style={{ backgroundColor: ev.color || color }}
                        title={ev.description || ev.title}
                      >
                        {ev.title || '•'}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-slate-400">+{dayEvents.length - 3}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({ def, value }: { def: SqlReportKpiDef; value: number }) {
  const color = def.color || '#6366f1';
  return (
    <div
      className="rounded-md bg-white px-3 py-2.5 border border-slate-200"
      style={{ borderLeftWidth: 6, borderLeftColor: color }}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium truncate">
        {def.title}
      </div>
      <div className="text-[20px] font-semibold text-slate-800 mt-0.5 tabular-nums">
        {formatKpiValue(value, def.suffix)}
      </div>
    </div>
  );
}

function ChartCard({
  chart,
  rows,
  onSliceClick,
}: {
  chart: SqlReportChartDef;
  rows: Record<string, unknown>[];
  onSliceClick: (label: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<{ destroy: () => void } | null>(null);
  const series = useMemo(() => buildChartSeries(chart, rows), [chart, rows]);
  const clickRef = useRef(onSliceClick);
  clickRef.current = onSliceClick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const Chart = await loadChartJs();
        if (cancelled || !canvasRef.current) return;
        chartRef.current?.destroy();
        const type = ['bar', 'line', 'pie', 'doughnut'].includes(chart.type) ? chart.type : 'bar';
        const isPie = type === 'pie' || type === 'doughnut';
        chartRef.current = new Chart(canvasRef.current.getContext('2d')!, {
          type,
          data: {
            labels: series.labels,
            datasets: [
              {
                label: chart.value_col || chart.title,
                data: series.values,
                backgroundColor: series.labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
                borderColor: 'rgba(30, 136, 229, 1)',
                borderWidth: type === 'line' ? 2 : 1,
                tension: 0.25,
                fill: type !== 'line',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (_evt: unknown, elements: Array<{ index: number }>) => {
              if (!elements?.length) return;
              const label = series.labels[elements[0].index];
              if (label != null) clickRef.current(label);
            },
            plugins: {
              legend: { display: isPie, position: 'bottom' },
              tooltip: { mode: 'index', intersect: true },
            },
            scales: isPie
              ? {}
              : {
                  y: { beginAtZero: true, ticks: { precision: 0 } },
                  x: { ticks: { maxRotation: 45, minRotation: 0 } },
                },
          },
        });
      } catch {
        /* CDN yoksa sessiz */
      }
    })();
    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chart, series]);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-slate-800">{chart.title}</h3>
        <span className="text-[10px] text-slate-400 uppercase">{chart.type}</span>
      </div>
      {!chart.label_col ? (
        <p className="text-[12px] text-slate-500 py-8 text-center">
          Etiket kolonu (label_col) tanımlayın
        </p>
      ) : series.labels.length === 0 ? (
        <p className="text-[12px] text-slate-500 py-8 text-center">Grafik için veri yok</p>
      ) : (
        <div className="h-[260px] relative">
          <canvas ref={canvasRef} />
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-1">Dilim/çubuğa tıklayınca tablo filtrelenir</p>
    </div>
  );
}
