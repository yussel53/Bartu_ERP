import React from 'react';
import {
  RefreshCw,
  Users,
  Package,
  Landmark,
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  Settings2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  fetchDashboardSummary,
  listDashboardTabs,
  saveDashboardTab,
  deleteDashboardTab,
  saveDashboardTabItem,
  deleteDashboardTabItem,
  type DashboardSummary,
  type DashboardTab,
  type DashboardTabItem,
} from '../api/dashboardApi';
import {
  listSqlReports,
  runSqlReport,
  parseFiltersConfig,
  defaultFilterValue,
  type SqlReport,
  type SqlReportRunResult,
} from '../api/sqlReportsApi';
import { SqlReportDashboard } from '../components/SqlReportDashboard';
import { getCurrentProfile, getCurrentUserId } from '../data/permissions';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

function formatMoney(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function slugKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || `sekme-${Date.now()}`;
}

const BuiltInSummary: React.FC<{
  data: DashboardSummary | null;
  loading: boolean;
  onNavigate: (path: string) => void;
}> = ({ data, loading, onNavigate }) => {
  const c = data?.customer;
  const p = data?.product;
  const b = data?.bank;
  const s = data?.safe;

  return (
    <>
      {data?.warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 mb-3">
          {data.warning}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Cari</h2>
                <p className="text-[10px] text-slate-400">{c?.cardCount ?? '—'} kart</p>
              </div>
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold text-blue-600 hover:underline"
              onClick={() => onNavigate('finans/ana-kayitlar/cari-kartlar')}
            >
              Liste
            </button>
          </div>
          <dl className="space-y-1.5 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-rose-500" /> Borç
              </dt>
              <dd className="font-semibold tabular-nums text-rose-700">{formatMoney(c?.debitTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-emerald-500" /> Alacak
              </dt>
              <dd className="font-semibold tabular-nums text-emerald-700">{formatMoney(c?.creditTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <dt className="text-slate-600 font-medium flex items-center gap-1">
                <Scale className="w-3 h-3" /> Bakiye
              </dt>
              <dd
                className={`font-bold tabular-nums ${
                  (c?.balance ?? 0) >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-amber-700'
                }`}
              >
                {formatMoney(c?.balance)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-violet-50 text-violet-700 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Malzeme</h2>
                <p className="text-[10px] text-slate-400">{p?.cardCount ?? '—'} kart</p>
              </div>
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold text-blue-600 hover:underline"
              onClick={() => onNavigate('malzeme/ana-kayitlar/malzeme-kartlari')}
            >
              Liste
            </button>
          </div>
          <dl className="space-y-1.5 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Son satınalma toplamı</dt>
              <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {formatMoney(p?.lastPurchaseTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <dt className="text-slate-500">Son alım yapılan kalem</dt>
              <dd className="font-semibold tabular-nums">{p?.lastPurchaseLineCount ?? 0}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Banka</h2>
                <p className="text-[10px] text-slate-400">{b?.accountCount ?? '—'} hesap</p>
              </div>
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold text-blue-600 hover:underline"
              onClick={() => onNavigate('finans/ana-kayitlar/banka')}
            >
              Liste
            </button>
          </div>
          <dl className="space-y-1.5 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Giriş</dt>
              <dd className="font-semibold tabular-nums text-emerald-700">{formatMoney(b?.inTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Çıkış</dt>
              <dd className="font-semibold tabular-nums text-rose-700">{formatMoney(b?.outTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <dt className="text-slate-600 font-medium">Net</dt>
              <dd className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {formatMoney(b?.balance)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Kasa</h2>
                <p className="text-[10px] text-slate-400">{s?.cardCount ?? '—'} kart</p>
              </div>
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold text-blue-600 hover:underline"
              onClick={() => onNavigate('finans/ana-kayitlar/kasa-kartlari')}
            >
              Liste
            </button>
          </div>
          <dl className="space-y-1.5 text-[12px]">
            <div className="flex justify-between gap-2 pt-0.5">
              <dt className="text-slate-500">Ödeme hareketleri toplamı</dt>
              <dd className="font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {formatMoney(s?.amountTotal)}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {loading && !data && (
        <div className="py-10 text-center text-[12px] text-slate-400">Özet yükleniyor…</div>
      )}
    </>
  );
};

type WidgetState = {
  busy: boolean;
  error?: string;
  result?: SqlReportRunResult;
};

const DashboardWidget: React.FC<{
  item: DashboardTabItem;
  refreshKey: number;
}> = ({ item, refreshKey }) => {
  const [state, setState] = React.useState<WidgetState>({ busy: true });

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState({ busy: true });
      try {
        const profile = getCurrentProfile();
        const userId = Number(getCurrentUserId()) || 0;
        const filters = parseFiltersConfig(item.reportFiltersConfig);
        const parameters: Record<string, string> = {};
        for (const f of filters) parameters[f.var_name] = defaultFilterValue(f);

        const res = item.sqlReportId
          ? await runSqlReport({
              reportId: item.sqlReportId,
              parameters,
              userId: userId > 0 ? userId : undefined,
              isAdmin: !!profile.isAdmin,
              maxRows: 5000,
            })
          : await runSqlReport({
              queryTemplate: item.queryTemplate || '',
              parameters,
              userId: userId > 0 ? userId : undefined,
              isAdmin: !!profile.isAdmin,
              maxRows: 5000,
            });

        if (cancelled) return;
        if (!res.success) {
          setState({ busy: false, error: res.message || 'Rapor çalıştırılamadı' });
          return;
        }
        setState({ busy: false, result: res });
      } catch (e) {
        if (!cancelled) {
          setState({
            busy: false,
            error: e instanceof Error ? e.message : 'Rapor hatası',
          });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [item.id, item.sqlReportId, item.queryTemplate, item.reportFiltersConfig, refreshKey]);

  const title = item.displayName || item.reportName || 'Rapor';
  const kpi = item.kpiConfig || item.reportKpiConfig;
  const chart = item.chartConfig || item.reportChartConfig;
  /** Sekme widget’ında tablo: yalnızca bağdaki bayrak (rapor varsayılanını ezmez) */
  const showTable = !!item.showDataTable;
  const spanClass = item.colSpan === 6 ? 'md:col-span-1' : 'md:col-span-2';

  return (
    <section
      className={`${spanClass} rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm min-w-0`}
    >
      <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
      {state.busy && (
        <div className="py-8 text-center text-[12px] text-slate-400">Yükleniyor…</div>
      )}
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
          {state.error}
        </div>
      )}
      {state.result?.success && (
        <SqlReportDashboard
          columns={state.result.columns}
          rows={state.result.rows}
          kpiConfigJson={kpi}
          chartConfigJson={chart}
          pivotConfigJson={item.reportPivotConfig}
          calendarConfigJson={item.reportCalendarConfig}
          columnFormatsJson={item.reportColumnFormats}
          conditionalFormattingJson={item.reportConditionalFormatting}
          showDataTable={showTable}
          showPivotTable={!!item.reportShowPivotTable}
          showCalendar={!!item.reportShowCalendar}
          allowSimulation={!!item.reportAllowSimulation}
          auxDatasets={state.result.auxDatasets}
          reportName={title}
          busy={state.busy}
        />
      )}
    </section>
  );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const profile = getCurrentProfile();
  const canEdit = !!profile.isAdmin;

  const [tabs, setTabs] = React.useState<DashboardTab[]>([]);
  const [tabsLoaded, setTabsLoaded] = React.useState(false);
  const [activeTabId, setActiveTabId] = React.useState<number | null>(null);
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [reports, setReports] = React.useState<SqlReport[]>([]);
  const [cfgBusy, setCfgBusy] = React.useState(false);
  const [cfgMsg, setCfgMsg] = React.useState<string | null>(null);

  const [newTabTitle, setNewTabTitle] = React.useState('');
  const [newItemTabId, setNewItemTabId] = React.useState<number | ''>('');
  const [newItemReportId, setNewItemReportId] = React.useState<number | ''>('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemSql, setNewItemSql] = React.useState('');
  const [newItemShowTable, setNewItemShowTable] = React.useState(false);
  const [newItemSpan, setNewItemSpan] = React.useState<6 | 12>(12);

  const loadTabs = React.useCallback(async (includeInactive = false) => {
    try {
      const list = await listDashboardTabs(includeInactive);
      setTabs(list);
      setTabsLoaded(true);
      setActiveTabId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
      return list;
    } catch {
      setTabs([]);
      setTabsLoaded(true);
      return [];
    }
  }, []);

  const loadSummary = React.useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetchDashboardSummary();
      setSummary(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Özet yüklenemedi');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadTabs(false);
  }, [loadTabs]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const needSummary =
    !tabsLoaded || tabs.length === 0 || !!activeTab?.showBuiltInSummary;

  React.useEffect(() => {
    if (needSummary) void loadSummary();
  }, [needSummary, loadSummary, refreshKey]);

  const refreshAll = () => {
    setError(null);
    setRefreshKey((k) => k + 1);
    if (needSummary) void loadSummary();
  };

  const openConfig = async () => {
    setConfigOpen(true);
    setCfgMsg(null);
    setCfgBusy(true);
    try {
      const [t, r] = await Promise.all([loadTabs(true), listSqlReports()]);
      setReports(r.filter((x) => x.isActive !== false));
      if (!newItemTabId && t[0]) setNewItemTabId(t[0].id);
    } catch (e) {
      setCfgMsg(e instanceof Error ? e.message : 'Ayarlar yüklenemedi');
    } finally {
      setCfgBusy(false);
    }
  };

  const addTab = async () => {
    const title = newTabTitle.trim();
    if (!title) return;
    setCfgBusy(true);
    setCfgMsg(null);
    try {
      await saveDashboardTab({
        exportKey: slugKey(title),
        title,
        sortOrder: (tabs[tabs.length - 1]?.sortOrder ?? 0) + 10,
        isActive: true,
        showBuiltInSummary: false,
      });
      setNewTabTitle('');
      await loadTabs(true);
      setCfgMsg('Sekme eklendi');
    } catch (e) {
      setCfgMsg(e instanceof Error ? e.message : 'Sekme eklenemedi');
    } finally {
      setCfgBusy(false);
    }
  };

  const removeTab = async (id: number) => {
    if (!confirm('Sekme ve altındaki rapor bağları silinsin mi?')) return;
    setCfgBusy(true);
    try {
      await deleteDashboardTab(id);
      await loadTabs(true);
    } catch (e) {
      setCfgMsg(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setCfgBusy(false);
    }
  };

  const toggleBuiltIn = async (tab: DashboardTab) => {
    setCfgBusy(true);
    try {
      await saveDashboardTab(
        {
          exportKey: tab.exportKey,
          title: tab.title,
          sortOrder: tab.sortOrder,
          isActive: tab.isActive,
          showBuiltInSummary: !tab.showBuiltInSummary,
        },
        tab.id,
      );
      await loadTabs(true);
    } catch (e) {
      setCfgMsg(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setCfgBusy(false);
    }
  };

  const addItem = async () => {
    const tabId = Number(newItemTabId);
    if (!tabId) {
      setCfgMsg('Sekme seçin');
      return;
    }
    const reportId = newItemReportId ? Number(newItemReportId) : null;
    if (!reportId && !newItemSql.trim()) {
      setCfgMsg('SQL rapor seçin veya özel SQL girin');
      return;
    }
    setCfgBusy(true);
    setCfgMsg(null);
    try {
      await saveDashboardTabItem({
        tabId,
        sqlReportId: reportId,
        displayName: newItemName.trim() || null,
        queryTemplate: reportId ? null : newItemSql.trim(),
        kpiConfig: null,
        chartConfig: null,
        showDataTable: newItemShowTable,
        colSpan: newItemSpan,
        sortOrder: 10,
        isActive: true,
      });
      setNewItemName('');
      setNewItemSql('');
      setNewItemReportId('');
      await loadTabs(true);
      setCfgMsg('Rapor eklendi');
    } catch (e) {
      setCfgMsg(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setCfgBusy(false);
    }
  };

  const removeItem = async (id: number) => {
    setCfgBusy(true);
    try {
      await deleteDashboardTabItem(id);
      await loadTabs(true);
    } catch (e) {
      setCfgMsg(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setCfgBusy(false);
    }
  };

  const fallbackMode = tabsLoaded && tabs.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Genel Durum</h1>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            Sekmeler · SQL rapor KPI/grafik · yerleşik özet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('')}
            className="px-2.5 h-8 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            Ana Sayfa
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => void openConfig()}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md"
              title="Sekme ve rapor ayarları"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Ayarlar
            </button>
          )}
          <button
            type="button"
            onClick={refreshAll}
            disabled={summaryLoading}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {fallbackMode && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Sekme tablosu yok veya boş. Yerleşik özet gösteriliyor. Çoklu sekme için Sistem → Veritabanı
          Güncelleme içinde <strong>58_sys_dashboard_tabs</strong> uygulayın; ardından Ayarlar ile SQL
          rapor bağlayın.
        </div>
      )}

      {!fallbackMode && tabs.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 pb-px">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTabId(t.id)}
              className={`px-3 h-8 text-[12px] font-semibold rounded-t-md border border-b-0 transition-colors ${
                activeTabId === t.id
                  ? 'bg-white dark:bg-slate-900 text-blue-700 border-slate-200 dark:border-slate-600 -mb-px'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {(fallbackMode || activeTab?.showBuiltInSummary) && (
        <BuiltInSummary data={summary} loading={summaryLoading} onNavigate={onNavigate} />
      )}

      {activeTab && activeTab.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeTab.items.map((item) => (
            <DashboardWidget key={`${item.id}-${refreshKey}`} item={item} refreshKey={refreshKey} />
          ))}
        </div>
      )}

      {activeTab &&
        !activeTab.showBuiltInSummary &&
        activeTab.items.length === 0 &&
        !fallbackMode && (
          <div className="py-12 text-center text-[12px] text-slate-400">
            Bu sekmede rapor yok.
            {canEdit ? ' Ayarlar’dan SQL rapor veya özel SQL ekleyin.' : ''}
          </div>
        )}

      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div>
                <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white">
                  Genel Durum ayarları
                </h2>
                <p className="text-[11px] text-slate-500">
                  Sekme ekleyin; altına SQL Rapor veya özel SQL bağlayın
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfigOpen(false);
                  void loadTabs(false);
                }}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {cfgMsg && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700">
                  {cfgMsg}
                </div>
              )}

              <section className="space-y-2">
                <h3 className="text-[12px] font-semibold text-slate-700">Sekmeler</h3>
                <div className="flex gap-2">
                  <input
                    value={newTabTitle}
                    onChange={(e) => setNewTabTitle(e.target.value)}
                    placeholder="Yeni sekme adı"
                    className="flex-1 h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    disabled={cfgBusy || !newTabTitle.trim()}
                    onClick={() => void addTab()}
                    className="inline-flex items-center gap-1 px-2.5 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 rounded-md disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ekle
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {tabs.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-[12px]"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100 min-w-[80px]">
                        {t.title}
                      </span>
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={t.showBuiltInSummary}
                          onChange={() => void toggleBuiltIn(t)}
                        />
                        Yerleşik özet
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {t.items.length} rapor · sıra {t.sortOrder}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeTab(t.id)}
                        className="ml-auto text-rose-600 hover:bg-rose-50 rounded p-1"
                        title="Sekmeyi sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-[12px] font-semibold text-slate-700">Sekmeye rapor / SQL ekle</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-[11px] text-slate-500 space-y-0.5">
                    Sekme
                    <select
                      value={newItemTabId}
                      onChange={(e) =>
                        setNewItemTabId(e.target.value ? Number(e.target.value) : '')
                      }
                      className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950"
                    >
                      <option value="">Seçin</option>
                      {tabs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-500 space-y-0.5">
                    SQL Rapor
                    <select
                      value={newItemReportId}
                      onChange={(e) =>
                        setNewItemReportId(e.target.value ? Number(e.target.value) : '')
                      }
                      className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950"
                    >
                      <option value="">— Özel SQL kullan —</option>
                      {reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.reportGroup} / {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-slate-500 space-y-0.5 sm:col-span-2">
                    Görünen ad
                    <input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="Opsiyonel başlık"
                      className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950"
                    />
                  </label>
                  {!newItemReportId && (
                    <label className="text-[11px] text-slate-500 space-y-0.5 sm:col-span-2">
                      Özel SQL
                      <textarea
                        value={newItemSql}
                        onChange={(e) => setNewItemSql(e.target.value)}
                        rows={4}
                        placeholder="SELECT ... FROM ..."
                        className="w-full px-2 py-1.5 text-[12px] font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950"
                      />
                    </label>
                  )}
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={newItemShowTable}
                      onChange={(e) => setNewItemShowTable(e.target.checked)}
                    />
                    Veri tablosu göster
                  </label>
                  <label className="text-[11px] text-slate-500 space-y-0.5">
                    Genişlik
                    <select
                      value={newItemSpan}
                      onChange={(e) => setNewItemSpan(Number(e.target.value) as 6 | 12)}
                      className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950"
                    >
                      <option value={12}>Tam satır</option>
                      <option value={6}>Yarım (yan yana)</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={cfgBusy}
                  onClick={() => void addItem()}
                  className="inline-flex items-center gap-1 px-2.5 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 rounded-md disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> Raporu ekle
                </button>

                <ul className="space-y-1 mt-2">
                  {tabs.flatMap((t) =>
                    t.items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center gap-2 rounded border border-slate-100 dark:border-slate-800 px-2 py-1.5 text-[11px]"
                      >
                        <span className="text-slate-400">{t.title}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {it.displayName || it.reportName || 'Özel SQL'}
                        </span>
                        <span className="text-slate-400">
                          {it.sqlReportId ? `Rapor #${it.sqlReportId}` : 'SQL'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeItem(it.id)}
                          className="ml-auto text-rose-600 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    )),
                  )}
                </ul>
              </section>

              <p className="text-[10px] text-slate-400">
                KPI ve grafik tanımları SQL Rapor Tasarımcı’dan gelir. Özel SQL için rapor oluşturup
                bağlamak önerilir.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
