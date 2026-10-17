import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Copy,
  BarChart3,
  Download,
  FolderPlus,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { ApiError } from '../config/api';
import { APP_MODULES } from '../data/modules';
import { getCurrentProfile, getCurrentUserId } from '../data/permissions';
import { listModuleMenuTargets } from '../data/injectSqlReportMenus';
import { useAppModules } from '../contexts/AppModulesContext';
import { SqlReportDashboard } from '../components/SqlReportDashboard';
import { SqlReportDesigner } from '../components/SqlReportDesigner';
import { parseCharts, parseKpis } from '../utils/sqlReportViz';
import {
  createSqlReport,
  createSqlReportMenu,
  defaultFilterValue,
  deleteSqlReport,
  deleteSqlReportMenu,
  exportSqlReports,
  getSqlReport,
  importSqlReports,
  listSqlReportMenus,
  listSqlReports,
  parseFiltersConfig,
  reportToSave,
  runSqlReport,
  updateSqlReport,
  updateSqlReportMenu,
  type SqlReport,
  type SqlReportFilterDef,
  type SqlReportMenu,
  type SqlReportMenuSave,
  type SqlReportRunResult,
  type SqlReportSave,
} from '../api/sqlReportsApi';
import { appConfirm } from '../utils/appConfirm';

type Mode = 'list' | 'edit' | 'run' | 'menus';
type ViewMode = 'designer' | 'runner';

interface Props {
  onBack: () => void;
  viewMode?: ViewMode;
  fixedReportId?: number;
}

const EMPTY_SAVE: SqlReportSave = {
  name: '',
  reportGroup: 'Genel',
  description: '',
  queryTemplate:
    'SELECT TOP 100\n  CustomerCardID AS Id,\n  Code AS Kod,\n  Title AS Unvan,\n  Active AS Aktif\nFROM dbo.CustomerCard\nWHERE 1 = 1',
  preQueryTemplate: '',
  filtersConfig:
    '[{"var_name":"start_date","label":"Başlangıç","type":"date","default_val":"-30 days"},{"var_name":"end_date","label":"Bitiş","type":"date","default_val":""},{"var_name":"search_query","label":"Ara","type":"text","default_val":""}]',
  chartConfig: '[]',
  kpiConfig: '[]',
  columnFormats: '[]',
  pivotConfig: '{}',
  calendarConfig: '{}',
  advancedFeaturesConfig: '{}',
  cachedColumns: '[]',
  auxQueriesConfig: '[]',
  calculatedColumns: '[]',
  conditionalFormattingConfig: '[]',
  reportColor: '#6366f1',
  allowExport: true,
  allowPdfExport: false,
  allowSimulation: true,
  showDataTable: true,
  showPivotTable: false,
  showCalendar: false,
  restrictUsers: false,
  isActive: true,
  menuId: null,
  menuDisplayName: '',
  menuSortOrder: 10,
  createdBy: 'UI',
};

const MENU_TARGETS = listModuleMenuTargets(APP_MODULES);

function toSave(r: SqlReport): SqlReportSave {
  return { ...reportToSave(r), createdBy: 'UI' };
}

function buildFilterState(filters: SqlReportFilterDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of filters) out[f.var_name] = defaultFilterValue(f);
  if (!('start_date' in out)) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    out.start_date = d.toISOString().slice(0, 10);
  }
  if (!('end_date' in out)) out.end_date = new Date().toISOString().slice(0, 10);
  if (!('search_query' in out)) out.search_query = '';
  return out;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const SqlReportsPage: React.FC<Props> = ({
  onBack,
  viewMode = 'designer',
  fixedReportId,
}) => {
  const { reloadMenus } = useAppModules();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(fixedReportId ? 'run' : 'list');
  const [reports, setReports] = useState<SqlReport[]>([]);
  const [menus, setMenus] = useState<SqlReportMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SqlReportSave>(EMPTY_SAVE);
  const [runReport, setRunReport] = useState<SqlReport | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<SqlReportRunResult | null>(null);
  const [simulationPercents, setSimulationPercents] = useState<Record<string, number>>({});
  const [groupFilter, setGroupFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [menuDraft, setMenuDraft] = useState<SqlReportMenuSave>({
    modulePath: 'malzeme',
    groupKey: 'raporlar',
    title: '',
    sortOrder: 10,
    isActive: true,
  });
  const [editMenuId, setEditMenuId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, m] = await Promise.all([listSqlReports(), listSqlReportMenus()]);
      setReports(r);
      setMenus(m);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — 50/51 SqlUpdates uygulandı mı? Backend yeniden başlatıldı mı?`
          : 'Yüklenemedi',
      );
      setReports([]);
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!fixedReportId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getSqlReport(fixedReportId);
        if (cancelled) return;
        setRunReport(r);
        setFilterValues(buildFilterState(parseFiltersConfig(r.filtersConfig)));
        setMode('run');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Rapor yüklenemedi');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixedReportId]);

  const groups = useMemo(
    () => Array.from(new Set(reports.map((r) => r.reportGroup || 'Genel'))).sort(),
    [reports],
  );

  const visible = useMemo(() => {
    let list = reports;
    if (groupFilter) list = list.filter((r) => r.reportGroup === groupFilter);
    if (viewMode === 'runner') list = list.filter((r) => r.isActive);
    return list;
  }, [reports, groupFilter, viewMode]);

  const refreshAll = async () => {
    await load();
    await reloadMenus();
  };

  const openNew = () => {
    setEditId(null);
    setDraft({ ...EMPTY_SAVE });
    setMode('edit');
    setError(null);
    setInfo(null);
  };

  const openEdit = (r: SqlReport) => {
    setEditId(r.id);
    setDraft(toSave(r));
    setMode('edit');
    setError(null);
    setInfo(null);
  };

  const openRun = (r: SqlReport) => {
    setRunReport(r);
    setFilterValues(buildFilterState(parseFiltersConfig(r.filtersConfig)));
    setRunResult(null);
    setSimulationPercents({});
    setMode('run');
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      parseFiltersConfig(draft.filtersConfig);
      const payload: SqlReportSave = {
        ...draft,
        menuId: draft.menuId || null,
        menuDisplayName: draft.menuDisplayName?.trim() || draft.name,
      };
      if (editId) await updateSqlReport(editId, payload);
      else await createSqlReport(payload);
      await refreshAll();
      setMode('list');
      setInfo('Rapor kaydedildi; menü güncellendi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!await appConfirm('Bu raporu silmek istiyor musunuz?')) return;
    setBusy(true);
    try {
      await deleteSqlReport(id);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setBusy(false);
    }
  };

  const copyReport = async (r: SqlReport) => {
    setBusy(true);
    try {
      const payload = toSave(r);
      payload.name = `${r.name} (Kopya)`;
      payload.exportKey = '';
      await createSqlReport(payload);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kopyalanamadı');
    } finally {
      setBusy(false);
    }
  };

  const execute = async (sim?: Record<string, number>) => {
    if (!runReport) return;
    const percents = sim ?? simulationPercents;
    const profile = getCurrentProfile();
    const userId = Number(getCurrentUserId()) || 0;
    setBusy(true);
    setError(null);
    try {
      const result = await runSqlReport({
        reportId: runReport.id,
        parameters: filterValues,
        simulationPercents: percents,
        userId: userId > 0 ? userId : undefined,
        isAdmin: !!profile.isAdmin,
      });
      setRunResult(result);
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object') {
        setRunResult(e.body as SqlReportRunResult);
        setError((e.body as SqlReportRunResult).message || e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Çalıştırılamadı');
      }
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (ids?: number[]) => {
    setBusy(true);
    setError(null);
    try {
      const pkg = await exportSqlReports(ids);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`kavisoft-sql-reports-${stamp}.json`, pkg);
      setInfo(`${pkg.reports.length} rapor, ${pkg.menus.length} menü dışa aktarıldı.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dışa aktarılamadı');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const pkg = JSON.parse(text);
      const result = await importSqlReports(pkg);
      await refreshAll();
      setInfo(result.messages?.join(' ') || `${result.reportsUpserted} rapor aktarıldı.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İçe aktarılamadı');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveMenu = async () => {
    if (!menuDraft.title.trim()) {
      setError('Menü adı zorunlu');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editMenuId) await updateSqlReportMenu(editMenuId, { ...menuDraft, title: menuDraft.title.trim() });
      else await createSqlReportMenu({ ...menuDraft, title: menuDraft.title.trim() });
      setMenuDraft({
        modulePath: menuDraft.modulePath,
        groupKey: menuDraft.groupKey,
        title: '',
        sortOrder: 10,
        isActive: true,
      });
      setEditMenuId(null);
      await refreshAll();
      setInfo('Menü kaydedildi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Menü kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const removeMenu = async (id: number) => {
    if (!await appConfirm('Menü silinsin mi? Bağlı raporlar menüden çıkarılır (rapor silinmez).')) return;
    setBusy(true);
    try {
      await deleteSqlReportMenu(id);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Menü silinemedi');
    } finally {
      setBusy(false);
    }
  };

  // ——— Menü yönetimi
  if (mode === 'menus') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Header title="SQL Rapor Menüleri" subtitle="Modül → grup altına klasör ekleyin" onBack={() => setMode('list')} busy={busy} />
        {error && <ErrorBox text={error} />}
        {info && <InfoBox text={info} />}
        <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Menü adı">
              <input
                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px]"
                value={menuDraft.title}
                onChange={(e) => setMenuDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Malzeme Detay Bilgi Listesi Raporları"
              />
            </Field>
            <Field label="Konum (Modül → Grup)">
              <select
                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px] bg-white"
                value={`${menuDraft.modulePath}|${menuDraft.groupKey}`}
                onChange={(e) => {
                  const [modulePath, groupKey] = e.target.value.split('|');
                  setMenuDraft((d) => ({ ...d, modulePath, groupKey }));
                }}
              >
                {MENU_TARGETS.map((t) => (
                  <option key={`${t.modulePath}|${t.groupKey}`} value={`${t.modulePath}|${t.groupKey}`}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sıra">
              <input
                type="number"
                className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px]"
                value={menuDraft.sortOrder}
                onChange={(e) => setMenuDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))}
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveMenu()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {editMenuId ? 'Menüyü güncelle' : 'Menü ekle'}
          </button>
        </div>
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2">Menü</th>
                <th className="px-3 py-2">Konum</th>
                <th className="px-3 py-2">Rapor</th>
                <th className="px-3 py-2 w-28">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{m.title}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {m.modulePath} → {m.groupKey}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{m.reports?.length || 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <IconBtn
                        title="Düzenle"
                        onClick={() => {
                          setEditMenuId(m.id);
                          setMenuDraft({
                            modulePath: m.modulePath,
                            groupKey: m.groupKey,
                            title: m.title,
                            sortOrder: m.sortOrder,
                            isActive: m.isActive,
                            exportKey: m.exportKey,
                          });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn title="Sil" danger onClick={() => void removeMenu(m.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- Edit (Raporlama-benzeri sekmeli tasarimci)
  if (mode === 'edit' && viewMode !== 'runner') {
    return (
      <SqlReportDesigner
        draft={draft}
        menus={menus}
        editId={editId}
        busy={busy}
        error={error}
        onChange={setDraft}
        onSave={() => void save()}
        onBack={() => setMode('list')}
        onBusy={setBusy}
        onError={setError}
      />
    );
  }

  // ——— Run
  if (mode === 'run' && runReport) {
    const defs = parseFiltersConfig(runReport.filtersConfig);
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Header
          title={runReport.menuDisplayName || runReport.name}
          subtitle={runReport.menuTitle ? `${runReport.menuTitle}` : 'SQL rapor'}
          onBack={() => {
            if (fixedReportId) onBack();
            else {
              setMode('list');
              setRunReport(null);
              setRunResult(null);
            }
          }}
          busy={busy}
        />
        {error && <ErrorBox text={error} />}
        <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
          {runReport.description && (
            <p className="text-[12px] text-slate-500">{runReport.description}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(defs.length
              ? defs
              : [
                  { var_name: 'start_date', label: 'Başlangıç', type: 'date' },
                  { var_name: 'end_date', label: 'Bitiş', type: 'date' },
                  { var_name: 'search_query', label: 'Ara', type: 'text' },
                ]
            ).map((f) => (
              <Field key={f.var_name} label={f.label || f.var_name}>
                <input
                  type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                  className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-[13px]"
                  value={filterValues[f.var_name] ?? ''}
                  onChange={(e) =>
                    setFilterValues((prev) => ({ ...prev, [f.var_name]: e.target.value }))
                  }
                />
              </Field>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void execute()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Çalıştır
          </button>
        </div>
        {runResult?.success && (
          <SqlReportDashboard
            columns={runResult.columns}
            rows={runResult.rows}
            kpiConfigJson={runReport.kpiConfig}
            chartConfigJson={runReport.chartConfig}
            pivotConfigJson={runReport.pivotConfig}
            calendarConfigJson={runReport.calendarConfig}
            columnFormatsJson={runReport.columnFormats}
            conditionalFormattingJson={runReport.conditionalFormattingConfig}
            showDataTable={runReport.showDataTable !== false}
            showPivotTable={!!runReport.showPivotTable}
            showCalendar={!!runReport.showCalendar}
            allowSimulation={runReport.allowSimulation !== false}
            auxDatasets={runResult.auxDatasets}
            reportName={runReport.menuDisplayName || runReport.name}
            busy={busy}
            simulationPercents={simulationPercents}
            onSimulationChange={(p) => {
              setSimulationPercents(p);
              void execute(p);
            }}
          />
        )}
        {runResult && !runResult.success && <ResultPanel result={runResult} />}
        {runResult?.success &&
          !parseKpis(runReport.kpiConfig).length &&
          !parseCharts(runReport.chartConfig).length && (
            <p className="text-[11px] text-slate-400">
              İpucu: Raporu düzenleyerek KPI ve grafik ekleyebilirsiniz (Nova Sierra tarzı).
            </p>
          )}
      </div>
    );
  }

  // ——— List
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            {viewMode === 'runner' ? 'Rapor Çalıştır' : 'SQL Rapor Tasarımcı'}
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {viewMode === 'runner'
              ? 'Aktif raporları seçip çalıştırın'
              : 'Raporları düzenle · menü · yetki · içe/dışa aktar'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
          {viewMode !== 'runner' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('menus');
                  setInfo(null);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md bg-white"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Menüler
              </button>
              <button
                type="button"
                onClick={() => void doExport(selected.size ? [...selected] : undefined)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md bg-white"
              >
                <Download className="w-3.5 h-3.5" />
                Dışa aktar
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md bg-white"
              >
                <Upload className="w-3.5 h-3.5" />
                İçe aktar
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void doImport(f);
                }}
              />
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Yeni rapor
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBox text={error} />}
      {info && <InfoBox text={info} />}

      <div className="flex items-center gap-2">
        <label className="text-[12px] text-slate-500">Grup</label>
        <select
          className="border border-slate-200 rounded-md px-2 py-1 text-[12px] bg-white"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">Tümü</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400">{visible.length} rapor</span>
      </div>

      <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[13px] text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Yükleniyor…
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-slate-500">Kayıtlı SQL rapor yok.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                {viewMode !== 'runner' && <th className="px-2 py-2 w-8" />}
                <th className="px-3 py-2 font-medium">Ad</th>
                <th className="px-3 py-2 font-medium">Menü</th>
                <th className="px-3 py-2 font-medium">Grup</th>
                <th className="px-3 py-2 font-medium w-40">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  {viewMode !== 'runner' && (
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.menuTitle ? (
                      <span>
                        {r.menuTitle}
                        {r.menuDisplayName ? (
                          <span className="text-slate-400"> · {r.menuDisplayName}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.reportGroup}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <IconBtn title="Çalıştır" onClick={() => openRun(r)}>
                        <Play className="w-3.5 h-3.5" />
                      </IconBtn>
                      {viewMode !== 'runner' && (
                        <>
                          <IconBtn title="Düzenle" onClick={() => openEdit(r)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </IconBtn>
                          <IconBtn title="Kopyala" onClick={() => void copyReport(r)}>
                            <Copy className="w-3.5 h-3.5" />
                          </IconBtn>
                          <IconBtn title="Sil" onClick={() => void remove(r.id)} danger>
                            <Trash2 className="w-3.5 h-3.5" />
                          </IconBtn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

function Header({
  title,
  subtitle,
  onBack,
  busy,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1 disabled:opacity-50"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Geri
      </button>
      <h1 className="text-[16px] font-semibold text-slate-800">{title}</h1>
      <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
      {text}
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
      {text}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 ${
        danger ? 'text-rose-600' : 'text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function ResultPanel({ result }: { result: SqlReportRunResult }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex justify-between text-[12px]">
        <span className={result.success ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
          {result.message}
        </span>
        <span className="text-slate-400">{Math.round(result.elapsedMs)} ms · {result.rowCount} satır</span>
      </div>
      {result.columns.length > 0 && (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {result.columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {result.columns.map((c) => (
                    <td key={c} className="px-2 py-1 whitespace-nowrap max-w-[240px] truncate">
                      {row[c] == null ? '' : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
