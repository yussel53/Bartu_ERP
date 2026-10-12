import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { ApiError } from '../config/api';
import type {
  SqlReportAuthRole,
  SqlReportAuthUser,
  SqlReportMenu,
  SqlReportRunResult,
  SqlReportSave,
  SqlReportUser,
} from '../api/sqlReportsApi';
import {
  getSqlReportAuth,
  listSqlReportUsers,
  parseFiltersConfig,
  runSqlReport,
  saveSqlReportAuth,
  type SqlReportFilterDef,
} from '../api/sqlReportsApi';
import { listRoles, type Role } from '../api/rolesApi';
import { extractColumnsFromSql, mergeColumnLists } from '../utils/sqlColumnDetect';
import {
  parseCharts,
  parseKpis,
  stringifyCharts,
  stringifyKpis,
  type SqlReportChartDef,
  type SqlReportKpiDef,
} from '../utils/sqlReportViz';
import { SqlReportDashboard } from './SqlReportDashboard';

type TabId =
  | 'genel'
  | 'sorgu'
  | 'grafik'
  | 'kpi'
  | 'filtre'
  | 'pivot'
  | 'takvim'
  | 'format'
  | 'aux'
  | 'calc'
  | 'kosullu'
  | 'yetki'
  | 'gelismis';

const TABS: { id: TabId; label: string }[] = [
  { id: 'genel', label: 'Genel' },
  { id: 'sorgu', label: 'Sorgu' },
  { id: 'grafik', label: 'Grafik Ayarları' },
  { id: 'kpi', label: 'KPI Ayarları' },
  { id: 'filtre', label: 'Dinamik Filtreler' },
  { id: 'pivot', label: 'Pivot Ayarları' },
  { id: 'takvim', label: 'Takvim' },
  { id: 'format', label: 'Kolon Formatları' },
  { id: 'aux', label: 'Aux Sorgular' },
  { id: 'calc', label: 'Hesaplanan' },
  { id: 'kosullu', label: 'Koşullu Format' },
  { id: 'yetki', label: 'Yetki' },
  { id: 'gelismis', label: 'Gelişmiş' },
];

interface AuxQueryDef {
  key: string;
  label?: string;
  query: string;
}

interface CalcColDef {
  name: string;
  expression: string;
}

interface CondRuleDef {
  col: string;
  op: string;
  value: string;
  bg?: string;
  fg?: string;
}

interface PivotCfg {
  row_field?: string;
  col_field?: string;
  val_field?: string;
  agg_type?: string;
}

interface CalendarCfg {
  enabled?: boolean;
  date_column?: string;
  time_column?: string;
  title_column?: string;
  end_column?: string;
  end_time_column?: string;
  description_column?: string;
  color?: string;
}

interface ColFormat {
  col: string;
  format: string;
  label?: string;
  /** false ise tabloda gizle */
  show?: boolean;
  /** Özel format örn. #.###0,## veya d.m.Y */
  pattern?: string;
}

interface AdvancedCfg {
  period_compare?: { date_column?: string; value_column?: string };
  anomaly?: { enabled?: boolean; column?: string; threshold?: number };
  map?: { enabled?: boolean; lat_col?: string; lng_col?: string; label_col?: string };
  rls?: { enabled?: boolean; data_column?: string; user_ref?: string };
}

function parseObj<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface Props {
  draft: SqlReportSave;
  menus: SqlReportMenu[];
  editId: number | null;
  busy: boolean;
  error: string | null;
  onChange: (next: SqlReportSave) => void;
  onSave: () => void;
  onBack: () => void;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
}

export const SqlReportDesigner: React.FC<Props> = ({
  draft,
  menus,
  editId,
  busy,
  error,
  onChange,
  onSave,
  onBack,
  onBusy,
  onError,
}) => {
  const [tab, setTab] = useState<TabId>('sorgu');
  const [columns, setColumns] = useState<string[]>(() => {
    const cached = parseObj<string[]>(draft.cachedColumns, []);
    const fromSql = extractColumnsFromSql(draft.queryTemplate);
    return mergeColumnLists(cached, fromSql);
  });
  const [testResult, setTestResult] = useState<SqlReportRunResult | null>(null);
  const [fastTest, setFastTest] = useState(true);

  /** Rapor açılınca / test sonrası cachedColumns güncellenince kolon listesini senkronla */
  useEffect(() => {
    const cached = parseObj<string[]>(draft.cachedColumns, []);
    const fromSql = extractColumnsFromSql(draft.queryTemplate);
    setColumns(mergeColumnLists(cached, fromSql));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca rapor değişimi / cache
  }, [editId, draft.cachedColumns]);

  const kpis = useMemo(() => parseKpis(draft.kpiConfig), [draft.kpiConfig]);
  const charts = useMemo(() => parseCharts(draft.chartConfig), [draft.chartConfig]);
  const filters = useMemo(() => parseFiltersConfig(draft.filtersConfig), [draft.filtersConfig]);
  const pivot = useMemo(() => parseObj<PivotCfg>(draft.pivotConfig, {}), [draft.pivotConfig]);
  const calendar = useMemo(() => parseObj<CalendarCfg>(draft.calendarConfig, {}), [draft.calendarConfig]);
  const formats = useMemo(() => parseObj<ColFormat[]>(draft.columnFormats, []), [draft.columnFormats]);
  const auxQueries = useMemo(
    () => parseObj<AuxQueryDef[]>(draft.auxQueriesConfig, []),
    [draft.auxQueriesConfig],
  );
  const calcCols = useMemo(
    () => parseObj<CalcColDef[]>(draft.calculatedColumns, []),
    [draft.calculatedColumns],
  );
  const condRules = useMemo(
    () => parseObj<CondRuleDef[]>(draft.conditionalFormattingConfig, []),
    [draft.conditionalFormattingConfig],
  );
  const advanced = useMemo(
    () => parseObj<AdvancedCfg>(draft.advancedFeaturesConfig, {}),
    [draft.advancedFeaturesConfig],
  );

  const patch = (partial: Partial<SqlReportSave>) => onChange({ ...draft, ...partial });
  const setKpis = (next: SqlReportKpiDef[]) => patch({ kpiConfig: stringifyKpis(next) });
  const setCharts = (next: SqlReportChartDef[]) => patch({ chartConfig: stringifyCharts(next) });
  const setFilters = (next: SqlReportFilterDef[]) => patch({ filtersConfig: JSON.stringify(next) });
  const setPivot = (next: PivotCfg) => patch({ pivotConfig: JSON.stringify(next) });
  const setCalendar = (next: CalendarCfg) => patch({ calendarConfig: JSON.stringify(next) });
  const setFormats = (next: ColFormat[]) => patch({ columnFormats: JSON.stringify(next) });
  const setAuxQueries = (next: AuxQueryDef[]) => patch({ auxQueriesConfig: JSON.stringify(next) });
  const setCalcCols = (next: CalcColDef[]) => patch({ calculatedColumns: JSON.stringify(next) });
  const setCondRules = (next: CondRuleDef[]) =>
    patch({ conditionalFormattingConfig: JSON.stringify(next) });
  const setAdvanced = (next: AdvancedCfg) => patch({ advancedFeaturesConfig: JSON.stringify(next) });

  const applyDetectedColumns = (fromApi?: string[] | null) => {
    const merged = mergeColumnLists(
      fromApi || [],
      extractColumnsFromSql(draft.queryTemplate),
      parseObj<string[]>(draft.cachedColumns, []),
    );
    if (merged.length) {
      setColumns(merged);
      patch({ cachedColumns: JSON.stringify(merged) });
    }
    return merged;
  };

  const runTest = async () => {
    onBusy(true);
    onError(null);
    try {
      const filterDefs = parseFiltersConfig(draft.filtersConfig);
      const parameters: Record<string, string> = {};
      for (const f of filterDefs) {
        const raw = (f.default_val ?? '').trim();
        if (f.type === 'date') {
          if (!raw) parameters[f.var_name] = new Date().toISOString().slice(0, 10);
          else if (/^-?\d+\s*days?$/i.test(raw)) {
            const d = new Date();
            d.setDate(d.getDate() + Number(raw.match(/-?\d+/)![0]));
            parameters[f.var_name] = d.toISOString().slice(0, 10);
          } else parameters[f.var_name] = raw;
        } else {
          parameters[f.var_name] = raw;
        }
      }

      const result = await runSqlReport({
        queryTemplate: draft.queryTemplate,
        preQueryTemplate: draft.preQueryTemplate,
        auxQueriesConfig: draft.auxQueriesConfig,
        calculatedColumns: draft.calculatedColumns,
        fastTest,
        skipAuxQueries: fastTest,
        parameters,
      });
      setTestResult(result);
      const merged = applyDetectedColumns(result.columns);
      if (!result.success) {
        onError(result.message || 'Test başarısız');
      } else if (!merged.length) {
        onError(
          'Sorgu çalıştı ancak kolon listesi alınamadı. SELECT listesinde AS ile kolon adı verin veya * kullanmayın.',
        );
      }
    } catch (e) {
      // Hata olsa bile SQL'den kolon çıkarmayı dene (format / grafik sekmeleri için)
      applyDetectedColumns(
        e instanceof ApiError && e.body && typeof e.body === 'object'
          ? (e.body as SqlReportRunResult).columns
          : null,
      );
      if (e instanceof ApiError && e.body && typeof e.body === 'object') {
        const d = e.body as SqlReportRunResult;
        setTestResult(d);
        onError(d.message || e.message);
      } else {
        onError(e instanceof Error ? e.message : 'Test başarısız');
      }
    } finally {
      onBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Listeye dön
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800">
            {editId ? 'Raporu Düzenle' : 'Yeni SQL Rapor'}
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Sorguyu test edin → kolonlar otomatik gelir → grafik / KPI / filtre / pivot
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !draft.name.trim() || !draft.queryTemplate.trim()}
          onClick={onSave}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Değişiklikleri Kaydet
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {error}
        </div>
      )}

      {/* Kolon rozetleri */}
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
          Mevcut Kolonlar (Query Results)
        </div>
        {columns.length === 0 ? (
          <p className="text-[12px] text-slate-400">
            Henüz kolon yok — Sorgu sekmesinde &quot;Sorguyu Test Et&quot; çalıştırın.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {columns.map((c) => (
              <span
                key={c}
                className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100 font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap gap-0.5 px-2 pt-2 border-b border-slate-100 bg-slate-50/80">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-t-md border-b-2 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {tab === 'genel' && (
            <GenelTab draft={draft} menus={menus} patch={patch} />
          )}

          {tab === 'sorgu' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Değişkenler:{' '}
                <code className="bg-slate-100 px-1 rounded">{'{user_id}'}</code>{' '}
                <code className="bg-slate-100 px-1 rounded">{'{start_date}'}</code>{' '}
                <code className="bg-slate-100 px-1 rounded">{'{end_date}'}</code>{' '}
                <code className="bg-slate-100 px-1 rounded">{'{search_query}'}</code>
              </p>
              <Field label="Sorgu / SQL">
                <textarea
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[12px] font-mono min-h-[220px]"
                  value={draft.queryTemplate}
                  onChange={(e) => {
                    patch({ queryTemplate: e.target.value });
                    const fromSql = extractColumnsFromSql(e.target.value);
                    if (fromSql.length) setColumns((prev) => mergeColumnLists(prev, fromSql));
                  }}
                  spellCheck={false}
                />
              </Field>
              <Field label="Rapor Öncesi Query (opsiyonel)">
                <textarea
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[12px] font-mono min-h-[70px]"
                  value={draft.preQueryTemplate || ''}
                  onChange={(e) => patch({ preQueryTemplate: e.target.value })}
                  spellCheck={false}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={fastTest}
                    onChange={(e) => setFastTest(e.target.checked)}
                  />
                  Hızlı Test (Limit 10)
                </label>
                <button
                  type="button"
                  disabled={busy || !draft.queryTemplate.trim()}
                  onClick={() => void runTest()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-blue-600 text-white disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Sorguyu Test Et
                </button>
              </div>
              {testResult?.success && (
                <SqlReportDashboard
                  columns={testResult.columns}
                  rows={testResult.rows}
                  kpiConfigJson={draft.kpiConfig}
                  chartConfigJson={draft.chartConfig}
                  pivotConfigJson={draft.pivotConfig}
                  calendarConfigJson={draft.calendarConfig}
                  columnFormatsJson={draft.columnFormats}
                  conditionalFormattingJson={draft.conditionalFormattingConfig}
                  showDataTable={draft.showDataTable !== false}
                  showPivotTable={!!draft.showPivotTable}
                  showCalendar={!!draft.showCalendar}
                  allowSimulation={false}
                  auxDatasets={testResult.auxDatasets}
                  reportName={draft.name || 'test'}
                />
              )}
            </div>
          )}

          {tab === 'grafik' && (
            <ChartsTab columns={columns} charts={charts} setCharts={setCharts} />
          )}
          {tab === 'kpi' && <KpiTab columns={columns} kpis={kpis} setKpis={setKpis} />}
          {tab === 'filtre' && (
            <FiltersTab columns={columns} filters={filters} setFilters={setFilters} />
          )}
          {tab === 'pivot' && (
            <PivotTab
              columns={columns}
              pivot={pivot}
              setPivot={setPivot}
              show={!!draft.showPivotTable}
              onShow={(v) => patch({ showPivotTable: v })}
            />
          )}
          {tab === 'takvim' && (
            <CalendarTab
              columns={columns}
              calendar={calendar}
              setCalendar={setCalendar}
              show={!!draft.showCalendar}
              onShow={(v) => patch({ showCalendar: v })}
            />
          )}
          {tab === 'format' && (
            <FormatTab
              columns={columns}
              formats={formats}
              setFormats={setFormats}
              calcCols={calcCols}
              setCalcCols={setCalcCols}
            />
          )}
          {tab === 'aux' && (
            <AuxTab auxQueries={auxQueries} setAuxQueries={setAuxQueries} />
          )}
          {tab === 'calc' && (
            <CalcTab columns={columns} calcCols={calcCols} setCalcCols={setCalcCols} />
          )}
          {tab === 'kosullu' && (
            <CondTab columns={columns} rules={condRules} setRules={setCondRules} />
          )}
          {tab === 'yetki' && (
            <AuthTab
              editId={editId}
              restrictUsers={!!draft.restrictUsers}
              onRestrict={(v) => patch({ restrictUsers: v })}
              busy={busy}
              onBusy={onBusy}
              onError={onError}
            />
          )}
          {tab === 'gelismis' && (
            <AdvancedTab columns={columns} advanced={advanced} setAdvanced={setAdvanced} />
          )}
        </div>
      </div>
    </div>
  );
};

function GenelTab({
  draft,
  menus,
  patch,
}: {
  draft: SqlReportSave;
  menus: SqlReportMenu[];
  patch: (p: Partial<SqlReportSave>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Rapor Adı">
          <input
            className="inp"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="Rapor Grubu">
          <input
            className="inp"
            value={draft.reportGroup}
            onChange={(e) => patch({ reportGroup: e.target.value })}
          />
        </Field>
        <Field label="Rapor Rengi">
          <input
            type="color"
            className="w-full h-[34px] border border-slate-200 rounded"
            value={draft.reportColor || '#6366f1'}
            onChange={(e) => patch({ reportColor: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Açıklama">
        <textarea
          className="inp min-h-[60px]"
          value={draft.description || ''}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[12px]">
        <Toggle
          label="Excel indirme"
          on={draft.allowExport}
          onChange={(v) => patch({ allowExport: v })}
        />
        <Toggle
          label="PDF indirme"
          on={!!draft.allowPdfExport}
          onChange={(v) => patch({ allowPdfExport: v })}
        />
        <Toggle
          label="Veri listesi"
          on={draft.showDataTable !== false}
          onChange={(v) => patch({ showDataTable: v })}
        />
        <Toggle
          label="Pivot tablo"
          on={!!draft.showPivotTable}
          onChange={(v) => patch({ showPivotTable: v })}
        />
        <Toggle
          label="Rapor takvimi"
          on={!!draft.showCalendar}
          onChange={(v) => patch({ showCalendar: v })}
        />
        <Toggle
          label="What-If simülasyon"
          on={draft.allowSimulation !== false}
          onChange={(v) => patch({ allowSimulation: v })}
        />
        <Toggle
          label="Kullanıcı kısıtı"
          on={!!draft.restrictUsers}
          onChange={(v) => patch({ restrictUsers: v })}
        />
        <Toggle label="Aktif" on={draft.isActive} onChange={(v) => patch({ isActive: v })} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
        <Field label="Menü klasörü">
          <select
            className="inp"
            value={draft.menuId ?? ''}
            onChange={(e) => patch({ menuId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— Menüye ekleme —</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.modulePath}/{m.groupKey})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Menüde görünecek ad">
          <input
            className="inp"
            value={draft.menuDisplayName || ''}
            onChange={(e) => patch({ menuDisplayName: e.target.value })}
          />
        </Field>
        <Field label="Menü sırası">
          <input
            type="number"
            className="inp"
            value={draft.menuSortOrder ?? 10}
            onChange={(e) => patch({ menuSortOrder: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>
    </div>
  );
}

function ChartsTab({
  columns,
  charts,
  setCharts,
}: {
  columns: string[];
  charts: SqlReportChartDef[];
  setCharts: (c: SqlReportChartDef[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-[13px] font-semibold text-slate-800">Grafikler</h3>
        <button
          type="button"
          className="btn-link"
          onClick={() =>
            setCharts([
              ...charts,
              {
                title: 'Yeni Grafik',
                type: 'bar',
                label_col: columns[0] || '',
                value_col: columns[1] || columns[0] || '',
                agg: 'sum',
              },
            ])
          }
        >
          <Plus className="w-3 h-3" /> Yeni Grafik
        </button>
      </div>
      {charts.map((c, i) => (
        <div key={i} className="rounded border border-slate-200 p-2.5 grid grid-cols-2 md:grid-cols-5 gap-2">
          <Field label="Başlık">
            <input
              className="inp"
              value={c.title}
              onChange={(e) =>
                setCharts(charts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
              }
            />
          </Field>
          <Field label="Tip">
            <select
              className="inp"
              value={c.type}
              onChange={(e) =>
                setCharts(charts.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))
              }
            >
              <option value="bar">bar</option>
              <option value="line">line</option>
              <option value="pie">pie</option>
              <option value="doughnut">doughnut</option>
            </select>
          </Field>
          <Field label="Etiket Sütunu (X)">
            <ColSelect
              columns={columns}
              value={c.label_col || ''}
              onChange={(v) =>
                setCharts(charts.map((x, j) => (j === i ? { ...x, label_col: v } : x)))
              }
            />
          </Field>
          <Field label="Değer Sütunu (Y)">
            <ColSelect
              columns={columns}
              value={c.value_col || ''}
              onChange={(v) =>
                setCharts(charts.map((x, j) => (j === i ? { ...x, value_col: v } : x)))
              }
            />
          </Field>
          <div className="flex items-end gap-2">
            <Field label="Agg">
              <select
                className="inp"
                value={c.agg || 'sum'}
                onChange={(e) =>
                  setCharts(charts.map((x, j) => (j === i ? { ...x, agg: e.target.value } : x)))
                }
              >
                <option value="sum">sum</option>
                <option value="count">count</option>
              </select>
            </Field>
            <button type="button" className="text-rose-600 p-1.5" onClick={() => setCharts(charts.filter((_, j) => j !== i))}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiTab({
  columns,
  kpis,
  setKpis,
}: {
  columns: string[];
  kpis: SqlReportKpiDef[];
  setKpis: (k: SqlReportKpiDef[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-[13px] font-semibold text-slate-800">KPI&apos;lar (Üst Kutucuklar)</h3>
        <button
          type="button"
          className="btn-link"
          onClick={() =>
            setKpis([
              ...kpis,
              {
                title: 'Yeni KPI',
                type: 'count',
                col: columns[0] || '',
                color: '#6366f1',
                suffix: '',
                filter_col: '',
                filter_val: '',
                spanWidth: 3,
              },
            ])
          }
        >
          <Plus className="w-3 h-3" /> Yeni KPI
        </button>
      </div>
      {kpis.map((k, i) => (
        <div key={i} className="rounded border border-slate-200 p-2.5 space-y-2">
          <div className="flex justify-between text-[12px] font-medium text-slate-700">
            <span>
              KPI #{i + 1} — {k.title}{' '}
              <span className="text-slate-400 font-normal">
                ({k.type}, {k.col || '—'})
              </span>
            </span>
            <button type="button" className="text-rose-600" onClick={() => setKpis(kpis.filter((_, j) => j !== i))}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Field label="Başlık">
              <input
                className="inp"
                value={k.title}
                onChange={(e) => setKpis(kpis.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
            </Field>
            <Field label="Hesaplama Tipi">
              <select
                className="inp"
                value={k.type}
                onChange={(e) => setKpis(kpis.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
              >
                <option value="count">Adet (count)</option>
                <option value="count_distinct">Tekil Adet</option>
                <option value="sum">Toplam (sum)</option>
                <option value="avg">Ortalama</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
              </select>
            </Field>
            <Field label="Hedef Sütun (SQL)">
              <ColSelect
                columns={columns}
                value={k.col || ''}
                allowEmpty
                onChange={(v) => setKpis(kpis.map((x, j) => (j === i ? { ...x, col: v } : x)))}
              />
            </Field>
            <Field label="Birim (Suffix)">
              <input
                className="inp"
                value={k.suffix || ''}
                onChange={(e) => setKpis(kpis.map((x, j) => (j === i ? { ...x, suffix: e.target.value } : x)))}
              />
            </Field>
            <Field label="Renk">
              <input
                type="color"
                className="w-full h-[34px] border border-slate-200 rounded"
                value={k.color || '#6366f1'}
                onChange={(e) => setKpis(kpis.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}
              />
            </Field>
            <Field label="Özel Filtre Kolonu">
              <ColSelect
                columns={columns}
                value={k.filter_col || ''}
                allowEmpty
                onChange={(v) => setKpis(kpis.map((x, j) => (j === i ? { ...x, filter_col: v } : x)))}
              />
            </Field>
            <Field label="Özel Filtre Değeri">
              <input
                className="inp"
                value={k.filter_val || ''}
                onChange={(e) =>
                  setKpis(kpis.map((x, j) => (j === i ? { ...x, filter_val: e.target.value } : x)))
                }
              />
            </Field>
          </div>
        </div>
      ))}
    </div>
  );
}

function FiltersTab({
  columns,
  filters,
  setFilters,
}: {
  columns: string[];
  filters: SqlReportFilterDef[];
  setFilters: (f: SqlReportFilterDef[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <h3 className="text-[13px] font-semibold">Dinamik Filtreler</h3>
        <button
          type="button"
          className="btn-link"
          onClick={() =>
            setFilters([
              ...filters,
              {
                var_name: columns[0] ? columns[0].toLowerCase() : 'filtre1',
                label: columns[0] || 'Filtre',
                type: 'text',
                default_val: '',
              },
            ])
          }
        >
          + Filtre
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        SQL içinde <code>{'{var_name}'}</code> olarak kullanılır. Varsayılanlar: start_date, end_date,
        search_query.
      </p>
      {filters.map((f, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 border border-slate-200 rounded p-2">
          <Field label="Değişken">
            <input
              className="inp"
              value={f.var_name}
              onChange={(e) =>
                setFilters(filters.map((x, j) => (j === i ? { ...x, var_name: e.target.value } : x)))
              }
            />
          </Field>
          <Field label="Etiket">
            <input
              className="inp"
              value={f.label}
              onChange={(e) =>
                setFilters(filters.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
          </Field>
          <Field label="Tip">
            <select
              className="inp"
              value={f.type}
              onChange={(e) =>
                setFilters(filters.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))
              }
            >
              <option value="text">text</option>
              <option value="date">date</option>
              <option value="number">number</option>
            </select>
          </Field>
          <Field label="Varsayılan / Kolon ipucu">
            <ColSelect
              columns={columns}
              value={f.default_val || ''}
              allowEmpty
              freeText
              onChange={(v) =>
                setFilters(filters.map((x, j) => (j === i ? { ...x, default_val: v } : x)))
              }
            />
          </Field>
          <button
            type="button"
            className="text-rose-600 self-end mb-1"
            onClick={() => setFilters(filters.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function PivotTab({
  columns,
  pivot,
  setPivot,
  show,
  onShow,
}: {
  columns: string[];
  pivot: PivotCfg;
  setPivot: (p: PivotCfg) => void;
  show: boolean;
  onShow: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <Toggle label="Pivot tablo" on={show} onChange={onShow} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Satır alanı">
          <ColSelect
            columns={columns}
            value={pivot.row_field || ''}
            allowEmpty
            onChange={(v) => setPivot({ ...pivot, row_field: v })}
          />
        </Field>
        <Field label="Sütun alanı">
          <ColSelect
            columns={columns}
            value={pivot.col_field || ''}
            allowEmpty
            onChange={(v) => setPivot({ ...pivot, col_field: v })}
          />
        </Field>
        <Field label="Değer alanı">
          <ColSelect
            columns={columns}
            value={pivot.val_field || ''}
            allowEmpty
            onChange={(v) => setPivot({ ...pivot, val_field: v })}
          />
        </Field>
        <Field label="Toplama">
          <select
            className="inp"
            value={pivot.agg_type || 'sum'}
            onChange={(e) => setPivot({ ...pivot, agg_type: e.target.value })}
          >
            <option value="sum">sum</option>
            <option value="count">count</option>
            <option value="avg">avg</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function CalendarTab({
  columns,
  calendar,
  setCalendar,
  show,
  onShow,
}: {
  columns: string[];
  calendar: CalendarCfg;
  setCalendar: (c: CalendarCfg) => void;
  show: boolean;
  onShow: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <Toggle
        label="Query Takvim Kaynağı"
        on={show}
        onChange={(v) => {
          onShow(v);
          setCalendar({ ...calendar, enabled: v });
        }}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Field label="Tarih kolonu">
          <ColSelect
            columns={columns}
            value={calendar.date_column || ''}
            allowEmpty
            onChange={(v) => setCalendar({ ...calendar, date_column: v })}
          />
        </Field>
        <Field label="Saat kolonu">
          <ColSelect
            columns={columns}
            value={calendar.time_column || ''}
            allowEmpty
            onChange={(v) => setCalendar({ ...calendar, time_column: v })}
          />
        </Field>
        <Field label="Başlık kolonu">
          <ColSelect
            columns={columns}
            value={calendar.title_column || ''}
            allowEmpty
            onChange={(v) => setCalendar({ ...calendar, title_column: v })}
          />
        </Field>
        <Field label="Bitiş tarih kolonu">
          <ColSelect
            columns={columns}
            value={calendar.end_column || ''}
            allowEmpty
            onChange={(v) => setCalendar({ ...calendar, end_column: v })}
          />
        </Field>
        <Field label="Açıklama kolonu">
          <ColSelect
            columns={columns}
            value={calendar.description_column || ''}
            allowEmpty
            onChange={(v) => setCalendar({ ...calendar, description_column: v })}
          />
        </Field>
        <Field label="Renk">
          <input
            type="color"
            className="w-full h-[34px] border border-slate-200 rounded"
            value={calendar.color || '#3b82f6'}
            onChange={(e) => setCalendar({ ...calendar, color: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function humanizeColName(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessColFormat(col: string): string {
  const n = col.toLowerCase();
  if (/(tarih|date|time|_at$|_dt$)/i.test(n)) return 'date';
  if (/(tutar|price|amount|bakiye|total|net|kdv|fiyat|maliyet)/i.test(n)) return 'currency';
  if (/(oran|percent|pct|yuzde|yüzde)/i.test(n)) return 'percent';
  if (/(id|adet|miktar|qty|sayi|sayı|yil|yıl|ay|no|nr|count)/i.test(n)) return 'number';
  return 'text';
}

function defaultPattern(format: string): string {
  if (format === 'number' || format === 'currency') return '#.###0,##';
  if (format === 'date') return 'd.m.Y';
  if (format === 'percent') return '0,##';
  return '';
}

function ensureColumnFormats(columns: string[], formats: ColFormat[]): ColFormat[] {
  const by = new Map(formats.filter((f) => f.col).map((f) => [f.col.toLowerCase(), f]));
  return columns.map((c) => {
    const prev = by.get(c.toLowerCase());
    if (prev) return { ...prev, col: c, show: prev.show !== false };
    const format = guessColFormat(c);
    return {
      col: c,
      format,
      label: humanizeColName(c),
      show: true,
      pattern: defaultPattern(format),
    };
  });
}

function FormatTab({
  columns,
  formats,
  setFormats,
  calcCols,
  setCalcCols,
}: {
  columns: string[];
  formats: ColFormat[];
  setFormats: (f: ColFormat[]) => void;
  calcCols: CalcColDef[];
  setCalcCols: (c: CalcColDef[]) => void;
}) {
  const allCols = useMemo(
    () => mergeColumnLists(columns, calcCols.map((c) => c.name).filter(Boolean)),
    [columns, calcCols],
  );
  const rows = useMemo(() => ensureColumnFormats(allCols, formats), [allCols, formats]);
  const [bulkShow, setBulkShow] = useState(true);
  const [bulkFormat, setBulkFormat] = useState('number');
  const [bulkPattern, setBulkPattern] = useState('#.###0,##');
  const [newCalcName, setNewCalcName] = useState('');
  const [newCalcExpr, setNewCalcExpr] = useState('');
  const [newCalcFormat, setNewCalcFormat] = useState('number');
  const [newCalcPattern, setNewCalcPattern] = useState('#.###0,##');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Kolonlar geldiğinde eksik format satırlarını tamamla
  useEffect(() => {
    if (!allCols.length) return;
    const next = ensureColumnFormats(allCols, formats);
    const by = new Map(formats.map((f) => [f.col.toLowerCase(), f]));
    const missing = allCols.some((c) => !by.has(c.toLowerCase()));
    if (missing || formats.length === 0) setFormats(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCols.join('|')]);

  const patchRow = (col: string, partial: Partial<ColFormat>) => {
    const next = ensureColumnFormats(allCols, formats).map((r) =>
      r.col === col ? { ...r, ...partial } : r,
    );
    setFormats(next);
  };

  const toggleSelect = (col: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(col)) n.delete(col);
      else n.add(col);
      return n;
    });
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.col));

  const applyBulk = () => {
    const targets = selected.size ? selected : new Set(rows.map((r) => r.col));
    setFormats(
      ensureColumnFormats(allCols, formats).map((r) =>
        targets.has(r.col)
          ? {
              ...r,
              show: bulkShow,
              format: bulkFormat,
              pattern: bulkPattern,
            }
          : r,
      ),
    );
  };

  const addCalc = () => {
    const name = newCalcName.trim();
    const expr = newCalcExpr.trim();
    if (!name || !expr) return;
    setCalcCols([...calcCols, { name, expression: expr }]);
    setFormats(
      ensureColumnFormats(
        [...allCols, name],
        [
          ...formats,
          {
            col: name,
            format: newCalcFormat,
            label: humanizeColName(name),
            show: true,
            pattern: newCalcPattern || defaultPattern(newCalcFormat),
          },
        ],
      ),
    );
    setNewCalcName('');
    setNewCalcExpr('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-slate-800">Kolon Formatları ve Ek Kolonlar</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Sorgu testinden gelen kolonlar otomatik listelenir. Başlık, görünürlük ve formatı buradan
          ayarlayın.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 space-y-2">
        <div className="text-[12px] font-semibold text-slate-700">
          Yeni Ek Kolon (Hesaplanmış Kolon) Ekle
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <label className="md:col-span-2 text-[11px] text-slate-500 space-y-0.5">
            Kolon Adı
            <input
              className="inp"
              value={newCalcName}
              onChange={(e) => setNewCalcName(e.target.value)}
              placeholder="Orn: Net_Tutar"
            />
          </label>
          <label className="md:col-span-4 text-[11px] text-slate-500 space-y-0.5">
            Formül
            <input
              className="inp font-mono"
              value={newCalcExpr}
              onChange={(e) => setNewCalcExpr(e.target.value)}
              placeholder="Tutar - Iskonto"
            />
          </label>
          <label className="md:col-span-2 text-[11px] text-slate-500 space-y-0.5">
            Format Tipi
            <select
              className="inp"
              value={newCalcFormat}
              onChange={(e) => {
                setNewCalcFormat(e.target.value);
                setNewCalcPattern(defaultPattern(e.target.value));
              }}
            >
              <option value="text">Metin</option>
              <option value="number">Sayı</option>
              <option value="currency">Para</option>
              <option value="percent">Yüzde</option>
              <option value="date">Tarih</option>
            </select>
          </label>
          <label className="md:col-span-2 text-[11px] text-slate-500 space-y-0.5">
            Özel Format
            <input
              className="inp font-mono"
              value={newCalcPattern}
              onChange={(e) => setNewCalcPattern(e.target.value)}
              placeholder="#.###0,##"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={addCalc}
              disabled={!newCalcName.trim() || !newCalcExpr.trim()}
              className="w-full h-[34px] inline-flex items-center justify-center gap-1 text-[12px] font-semibold rounded-md bg-blue-600 text-white disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Ekle
            </button>
          </div>
        </div>
      </div>

      {allCols.length === 0 ? (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
          Kolon listesi boş. <strong>Sorgu</strong> sekmesinde &quot;Sorguyu Test Et&quot; çalıştırın.
        </p>
      ) : (
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-slate-100 border-b border-slate-200 text-[11px]">
            <span className="font-bold uppercase tracking-wide text-slate-600">Toplu İşlemler</span>
            <label className="inline-flex items-center gap-1 font-medium text-slate-700">
              <input
                type="checkbox"
                checked={bulkShow}
                onChange={(e) => setBulkShow(e.target.checked)}
              />
              Göster
            </label>
            <select
              className="inp !h-7 !text-[11px] w-[110px]"
              value={bulkFormat}
              onChange={(e) => {
                setBulkFormat(e.target.value);
                setBulkPattern(defaultPattern(e.target.value));
              }}
            >
              <option value="text">Metin</option>
              <option value="number">Sayı</option>
              <option value="currency">Para</option>
              <option value="percent">Yüzde</option>
              <option value="date">Tarih</option>
            </select>
            <input
              className="inp !h-7 !text-[11px] font-mono w-[120px]"
              value={bulkPattern}
              onChange={(e) => setBulkPattern(e.target.value)}
              placeholder="Format"
            />
            <button
              type="button"
              onClick={applyBulk}
              className="h-7 px-2.5 rounded-md bg-slate-800 text-white text-[11px] font-semibold"
            >
              Tümüne Uygula
            </button>
            <span className="text-slate-400 ml-auto">{rows.length} kolon</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-[11px] text-slate-500">
                  <th className="w-8 px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(new Set(rows.map((r) => r.col)));
                        else setSelected(new Set());
                      }}
                    />
                  </th>
                  <th className="px-2 py-1.5 text-left font-semibold">Kolon</th>
                  <th className="px-2 py-1.5 text-left font-semibold min-w-[140px]">Başlık</th>
                  <th className="w-16 px-2 py-1.5 text-center font-semibold">Göster</th>
                  <th className="px-2 py-1.5 text-left font-semibold w-[120px]">Format Tipi</th>
                  <th className="px-2 py-1.5 text-left font-semibold min-w-[120px]">Format</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.col}
                    className="border-b border-slate-100 hover:bg-slate-50/80 last:border-b-0"
                  >
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(r.col)}
                        onChange={() => toggleSelect(r.col)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        {r.col}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="inp !h-8"
                        value={r.label || ''}
                        onChange={(e) => patchRow(r.col, { label: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={r.show !== false}
                        onChange={(e) => patchRow(r.col, { show: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        className="inp !h-8"
                        value={r.format || 'text'}
                        onChange={(e) =>
                          patchRow(r.col, {
                            format: e.target.value,
                            pattern: r.pattern || defaultPattern(e.target.value),
                          })
                        }
                      >
                        <option value="text">Metin</option>
                        <option value="number">Sayı</option>
                        <option value="currency">Para</option>
                        <option value="percent">Yüzde</option>
                        <option value="date">Tarih</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="inp !h-8 font-mono"
                        value={r.pattern || ''}
                        onChange={(e) => patchRow(r.col, { pattern: e.target.value })}
                        placeholder={defaultPattern(r.format || 'text') || '—'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AuxTab({
  auxQueries,
  setAuxQueries,
}: {
  auxQueries: AuxQueryDef[];
  setAuxQueries: (a: AuxQueryDef[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[13px] font-semibold">Aux / Yardımcı Sorgular</h3>
          <p className="text-[11px] text-slate-500">
            Ana sorgu sonrası ek datasetler (aynı filtre değişkenleri).
          </p>
        </div>
        <button
          type="button"
          className="btn-link"
          onClick={() =>
            setAuxQueries([
              ...auxQueries,
              {
                key: `aux_${auxQueries.length + 1}`,
                label: `Yardımcı ${auxQueries.length + 1}`,
                query: 'SELECT TOP 50 * FROM dbo.CustomerCard',
              },
            ])
          }
        >
          <Plus className="w-3 h-3" /> Aux ekle
        </button>
      </div>
      {auxQueries.length === 0 && (
        <p className="text-[12px] text-slate-400">Henüz aux sorgu yok.</p>
      )}
      {auxQueries.map((a, i) => (
        <div key={i} className="rounded border border-slate-200 p-2.5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Key">
              <input
                className="inp"
                value={a.key}
                onChange={(e) =>
                  setAuxQueries(auxQueries.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                }
              />
            </Field>
            <Field label="Etiket">
              <input
                className="inp"
                value={a.label || ''}
                onChange={(e) =>
                  setAuxQueries(
                    auxQueries.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
            </Field>
          </div>
          <Field label="SQL">
            <textarea
              className="inp font-mono min-h-[90px]"
              value={a.query}
              onChange={(e) =>
                setAuxQueries(
                  auxQueries.map((x, j) => (j === i ? { ...x, query: e.target.value } : x)),
                )
              }
              spellCheck={false}
            />
          </Field>
          <button
            type="button"
            className="text-rose-600 text-[11px] inline-flex items-center gap-1"
            onClick={() => setAuxQueries(auxQueries.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3 h-3" /> Sil
          </button>
        </div>
      ))}
    </div>
  );
}

function CalcTab({
  columns,
  calcCols,
  setCalcCols,
}: {
  columns: string[];
  calcCols: CalcColDef[];
  setCalcCols: (c: CalcColDef[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[13px] font-semibold">Hesaplanan Kolonlar</h3>
          <p className="text-[11px] text-slate-500">
            Örn: <code className="bg-slate-100 px-1 rounded">Kar / Ciro * 100</code> — kolon adları +
            aritmetik.
          </p>
        </div>
        <button
          type="button"
          className="btn-link"
          onClick={() =>
            setCalcCols([
              ...calcCols,
              {
                name: 'Hesaplanan1',
                expression: columns.length >= 2 ? `${columns[0]} + ${columns[1]}` : '0',
              },
            ])
          }
        >
          <Plus className="w-3 h-3" /> Kolon ekle
        </button>
      </div>
      {calcCols.map((c, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 border border-slate-200 rounded p-2">
          <Field label="Kolon adı">
            <input
              className="inp"
              value={c.name}
              onChange={(e) =>
                setCalcCols(calcCols.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
          </Field>
          <Field label="İfade">
            <input
              className="inp font-mono"
              value={c.expression}
              onChange={(e) =>
                setCalcCols(
                  calcCols.map((x, j) => (j === i ? { ...x, expression: e.target.value } : x)),
                )
              }
              list="calc-col-hints"
            />
            <datalist id="calc-col-hints">
              {columns.map((col) => (
                <option key={col} value={col} />
              ))}
            </datalist>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className="text-rose-600"
              onClick={() => setCalcCols(calcCols.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuthTab({
  editId,
  restrictUsers,
  onRestrict,
  busy,
  onBusy,
  onError,
}: {
  editId: number | null;
  restrictUsers: boolean;
  onRestrict: (v: boolean) => void;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onError: (msg: string | null) => void;
}) {
  const [allUsers, setAllUsers] = useState<SqlReportUser[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<Map<number, SqlReportAuthUser>>(new Map());
  const [selectedRoles, setSelectedRoles] = useState<Map<number, SqlReportAuthRole>>(new Map());
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      onError(null);
      try {
        const [users, roles, auth] = await Promise.all([
          listSqlReportUsers(),
          listRoles(),
          getSqlReportAuth(editId),
        ]);
        if (cancelled) return;
        setAllUsers(users);
        setAllRoles(roles.filter((r) => r.isActive));
        onRestrict(auth.restrictUsers);
        const map = new Map<number, SqlReportAuthUser>();
        for (const u of auth.users) {
          map.set(u.systemUserId, {
            systemUserId: u.systemUserId,
            nickName: u.nickName,
            displayName: u.displayName,
            canView: u.canView !== false,
            canRun: u.canRun !== false,
          });
        }
        setSelected(map);
        const rmap = new Map<number, SqlReportAuthRole>();
        for (const r of auth.roles || []) {
          rmap.set(r.roleId, {
            roleId: r.roleId,
            code: r.code,
            name: r.name,
            canView: r.canView !== false,
            canRun: r.canRun !== false,
          });
        }
        setSelectedRoles(rmap);
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : 'Yetki yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return allUsers;
    return allUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(needle) ||
        u.nickName.toLowerCase().includes(needle) ||
        String(u.systemUserId).includes(needle),
    );
  }, [allUsers, q]);

  const toggleUser = (u: SqlReportUser) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(u.systemUserId)) next.delete(u.systemUserId);
      else
        next.set(u.systemUserId, {
          systemUserId: u.systemUserId,
          nickName: u.nickName,
          displayName: u.displayName,
          canView: true,
          canRun: true,
        });
      return next;
    });
  };

  const toggleRole = (r: Role) => {
    setSelectedRoles((prev) => {
      const next = new Map(prev);
      if (next.has(r.id)) next.delete(r.id);
      else
        next.set(r.id, {
          roleId: r.id,
          code: r.code,
          name: r.name,
          canView: true,
          canRun: true,
        });
      return next;
    });
  };

  const saveAuth = async () => {
    if (!editId) return;
    onBusy(true);
    onError(null);
    setInfo(null);
    try {
      await saveSqlReportAuth(editId, {
        restrictUsers,
        users: [...selected.values()],
        roles: [...selectedRoles.values()],
      });
      setInfo(
        restrictUsers
          ? `${selectedRoles.size} rol + ${selected.size} kullanıcı yetkili.`
          : 'Kısıt kapalı — tüm kullanıcılar görebilir.',
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Yetki kaydedilemedi');
    } finally {
      onBusy(false);
    }
  };

  if (!editId) {
    return (
      <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Kullanıcı yetkisi atamak için önce raporu kaydedin, sonra bu sekmeye dönün.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">Rapor Yetkisi</h3>
          <p className="text-[11px] text-slate-500">
            Kısıt açıkken yalnızca seçili kullanıcılar menüde görür ve çalıştırır. Admin her zaman
            erişir.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void saveAuth()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Yetkiyi Kaydet
        </button>
      </div>

      <Toggle label="Erişim kısıtı (rol / kullanıcı)" on={restrictUsers} onChange={onRestrict} />

      {info && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          {info}
        </div>
      )}

      {!restrictUsers ? (
        <p className="text-[12px] text-slate-500">
          Kısıt kapalı — rapor tüm kullanıcılara açık. Rol veya kullanıcı seçip kısıtı açın.
        </p>
      ) : null}

      <div>
        <h4 className="text-[12px] font-semibold text-slate-700 mb-1">Roller (grup)</h4>
        <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-[180px] overflow-auto">
          {allRoles.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-slate-400">Rol yok — Sistem → Kullanıcı Yetkileri.</p>
          ) : (
            allRoles.map((r) => {
              const sel = selectedRoles.get(r.id);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-[12px]">
                  <label className="inline-flex items-center gap-2 min-w-[200px] cursor-pointer">
                    <input type="checkbox" checked={!!sel} onChange={() => toggleRole(r)} />
                    <span>
                      {r.name}{' '}
                      <span className="text-[10px] text-slate-400">({r.code})</span>
                    </span>
                  </label>
                  {sel && (
                    <>
                      <label className="inline-flex items-center gap-1 text-slate-600">
                        <input
                          type="checkbox"
                          checked={sel.canView}
                          onChange={(e) =>
                            setSelectedRoles((prev) => {
                              const next = new Map(prev);
                              next.set(r.id, { ...sel, canView: e.target.checked });
                              return next;
                            })
                          }
                        />
                        Görüntüle
                      </label>
                      <label className="inline-flex items-center gap-1 text-slate-600">
                        <input
                          type="checkbox"
                          checked={sel.canRun}
                          onChange={(e) =>
                            setSelectedRoles((prev) => {
                              const next = new Map(prev);
                              next.set(r.id, { ...sel, canRun: e.target.checked });
                              return next;
                            })
                          }
                        />
                        Çalıştır
                      </label>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <h4 className="text-[12px] font-semibold text-slate-700">Kullanıcılar (istisna)</h4>
      <input
        className="inp"
        placeholder="Kullanıcı ara…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Kullanıcılar yükleniyor…
        </div>
      ) : allUsers.length === 0 ? (
        <p className="text-[12px] text-rose-600">
          SystemUser tablosunda kullanıcı bulunamadı. Önce Sistem → Kullanıcılar kaydı oluşturun.
        </p>
      ) : (
        <div className="max-h-[360px] overflow-auto border border-slate-200 rounded-md divide-y divide-slate-100">
          {filtered.map((u) => {
            const sel = selected.get(u.systemUserId);
            return (
              <div
                key={u.systemUserId}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-[12px] hover:bg-slate-50"
              >
                <label className="inline-flex items-center gap-2 min-w-[220px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!sel}
                    onChange={() => toggleUser(u)}
                    disabled={!u.isActive && !sel}
                  />
                  <span className={!u.isActive ? 'text-slate-400' : 'text-slate-800'}>
                    {u.displayName}
                    {!u.isActive ? ' (pasif)' : ''}
                  </span>
                </label>
                {sel && (
                  <>
                    <label className="inline-flex items-center gap-1 text-slate-600">
                      <input
                        type="checkbox"
                        checked={sel.canView}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Map(prev);
                            next.set(u.systemUserId, { ...sel, canView: e.target.checked });
                            return next;
                          })
                        }
                      />
                      Görüntüle
                    </label>
                    <label className="inline-flex items-center gap-1 text-slate-600">
                      <input
                        type="checkbox"
                        checked={sel.canRun}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Map(prev);
                            next.set(u.systemUserId, { ...sel, canRun: e.target.checked });
                            return next;
                          })
                        }
                      />
                      Çalıştır
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        Seçili: {selectedRoles.size} rol · {selected.size} kullanıcı
        {restrictUsers && selectedRoles.size === 0 && selected.size === 0
          ? ' — kısıt açık ama kimse seçili değil; yalnızca admin görür.'
          : ''}
      </p>
    </div>
  );
}

function CondTab({
  columns,
  rules,
  setRules,
}: {
  columns: string[];
  rules: CondRuleDef[];
  setRules: (r: CondRuleDef[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[13px] font-semibold">Koşullu Biçimlendirme</h3>
          <p className="text-[11px] text-slate-500">Hücre eşleşince arka plan / yazı rengi.</p>
        </div>
        <button
          type="button"
          className="btn-link"
          onClick={() =>
            setRules([
              ...rules,
              {
                col: columns[0] || '',
                op: 'eq',
                value: '',
                bg: '#fef3c7',
                fg: '#92400e',
              },
            ])
          }
        >
          <Plus className="w-3 h-3" /> Kural ekle
        </button>
      </div>
      {rules.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-2 md:grid-cols-6 gap-2 border border-slate-200 rounded p-2 items-end"
        >
          <Field label="Kolon">
            <ColSelect
              columns={columns}
              value={r.col}
              onChange={(v) => setRules(rules.map((x, j) => (j === i ? { ...x, col: v } : x)))}
            />
          </Field>
          <Field label="Operatör">
            <select
              className="inp"
              value={r.op}
              onChange={(e) =>
                setRules(rules.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))
              }
            >
              <option value="eq">=</option>
              <option value="neq">≠</option>
              <option value="gt">&gt;</option>
              <option value="gte">≥</option>
              <option value="lt">&lt;</option>
              <option value="lte">≤</option>
              <option value="contains">içerir</option>
            </select>
          </Field>
          <Field label="Değer">
            <input
              className="inp"
              value={r.value}
              onChange={(e) =>
                setRules(rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
              }
            />
          </Field>
          <Field label="Arka plan">
            <input
              type="color"
              className="w-full h-[34px] border border-slate-200 rounded"
              value={r.bg || '#fef3c7'}
              onChange={(e) =>
                setRules(rules.map((x, j) => (j === i ? { ...x, bg: e.target.value } : x)))
              }
            />
          </Field>
          <Field label="Yazı">
            <input
              type="color"
              className="w-full h-[34px] border border-slate-200 rounded"
              value={r.fg || '#92400e'}
              onChange={(e) =>
                setRules(rules.map((x, j) => (j === i ? { ...x, fg: e.target.value } : x)))
              }
            />
          </Field>
          <button
            type="button"
            className="text-rose-600 mb-1"
            onClick={() => setRules(rules.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AdvancedTab({
  columns,
  advanced,
  setAdvanced,
}: {
  columns: string[];
  advanced: AdvancedCfg;
  setAdvanced: (a: AdvancedCfg) => void;
}) {
  const pc = advanced.period_compare || {};
  const an = advanced.anomaly || {};
  const map = advanced.map || {};
  const rls = advanced.rls || {};
  return (
    <div className="space-y-4">
      <section className="rounded border border-slate-200 p-3 space-y-2">
        <h4 className="text-[12px] font-semibold">Dönem Karşılaştırma</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tarih kolonu">
            <ColSelect
              columns={columns}
              value={pc.date_column || ''}
              allowEmpty
              onChange={(v) =>
                setAdvanced({ ...advanced, period_compare: { ...pc, date_column: v } })
              }
            />
          </Field>
          <Field label="Değer kolonu">
            <ColSelect
              columns={columns}
              value={pc.value_column || ''}
              allowEmpty
              onChange={(v) =>
                setAdvanced({ ...advanced, period_compare: { ...pc, value_column: v } })
              }
            />
          </Field>
        </div>
      </section>
      <section className="rounded border border-slate-200 p-3 space-y-2">
        <Toggle
          label="Anomali tespiti"
          on={!!an.enabled}
          onChange={(v) => setAdvanced({ ...advanced, anomaly: { ...an, enabled: v } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kolon">
            <ColSelect
              columns={columns}
              value={an.column || ''}
              allowEmpty
              onChange={(v) => setAdvanced({ ...advanced, anomaly: { ...an, column: v } })}
            />
          </Field>
          <Field label="Eşik">
            <input
              type="number"
              step="0.1"
              className="inp"
              value={an.threshold ?? 2.5}
              onChange={(e) =>
                setAdvanced({
                  ...advanced,
                  anomaly: { ...an, threshold: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>
        </div>
      </section>
      <section className="rounded border border-slate-200 p-3 space-y-2">
        <Toggle
          label="Harita göster"
          on={!!map.enabled}
          onChange={(v) => setAdvanced({ ...advanced, map: { ...map, enabled: v } })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field label="Enlem">
            <ColSelect
              columns={columns}
              value={map.lat_col || ''}
              allowEmpty
              onChange={(v) => setAdvanced({ ...advanced, map: { ...map, lat_col: v } })}
            />
          </Field>
          <Field label="Boylam">
            <ColSelect
              columns={columns}
              value={map.lng_col || ''}
              allowEmpty
              onChange={(v) => setAdvanced({ ...advanced, map: { ...map, lng_col: v } })}
            />
          </Field>
          <Field label="Etiket">
            <ColSelect
              columns={columns}
              value={map.label_col || ''}
              allowEmpty
              onChange={(v) => setAdvanced({ ...advanced, map: { ...map, label_col: v } })}
            />
          </Field>
        </div>
      </section>
      <section className="rounded border border-slate-200 p-3 space-y-2">
        <Toggle
          label="RLS aktif"
          on={!!rls.enabled}
          onChange={(v) => setAdvanced({ ...advanced, rls: { ...rls, enabled: v } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Veri kolonu">
            <ColSelect
              columns={columns}
              value={rls.data_column || ''}
              allowEmpty
              onChange={(v) => setAdvanced({ ...advanced, rls: { ...rls, data_column: v } })}
            />
          </Field>
          <Field label="User Ref">
            <select
              className="inp"
              value={rls.user_ref || 'user_id_ref'}
              onChange={(e) => setAdvanced({ ...advanced, rls: { ...rls, user_ref: e.target.value } })}
            >
              <option value="user_id">user_id</option>
              <option value="user_id_ref">user_id_ref</option>
              <option value="username">username</option>
            </select>
          </Field>
        </div>
      </section>
      <details>
        <summary className="text-[11px] text-slate-500 cursor-pointer">Gelişmiş: ham JSON önizleme</summary>
        <pre className="mt-1 text-[10px] font-mono bg-slate-50 p-2 rounded max-h-40 overflow-auto">
          {JSON.stringify(advanced, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ColSelect({
  columns,
  value,
  onChange,
  allowEmpty,
  freeText,
}: {
  columns: string[];
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
  freeText?: boolean;
}) {
  if (freeText) {
    return (
      <>
        <input
          className="inp"
          list="sql-designer-cols"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="değer veya kolon"
        />
        <datalist id="sql-designer-cols">
          {columns.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </>
    );
  }
  return (
    <select className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">—</option>}
      {!allowEmpty && columns.length === 0 && <option value="">(kolon yok — sorguyu test edin)</option>}
      {columns.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      {value && !columns.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center justify-between gap-2 rounded border border-slate-200 px-2.5 py-1.5 bg-white">
      <span className="text-[12px] text-slate-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative w-9 h-5 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            on ? 'translate-x-4' : ''
          }`}
        />
      </button>
      <span className={`text-[10px] font-semibold ${on ? 'text-emerald-700' : 'text-slate-400'}`}>
        {on ? 'AÇIK' : 'KAPALI'}
      </span>
    </label>
  );
}

/* utility classes via style tag injection alternative: use Tailwind-like via className strings */
const styleOnce =
  typeof document !== 'undefined' &&
  (() => {
    if (document.getElementById('sql-designer-styles')) return true;
    const s = document.createElement('style');
    s.id = 'sql-designer-styles';
    s.textContent = `
      .inp { width:100%; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px; font-size:12px; background:#fff; }
      .btn-link { display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#1d4ed8; font-weight:600; }
    `;
    document.head.appendChild(s);
    return true;
  })();
void styleOnce;
