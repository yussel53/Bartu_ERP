import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  ArrowLeft,
  RefreshCw,
  Database,
  AlertTriangle,
  Eye,
  Pencil,
  Copy,
  Trash2,
  FileText,
  List,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { AppModule, MenuScreen } from '../types/formTypes';
import { RowActions, RowActionExtraItem } from '../components/RowActions';
import { RowContextMenu, RowContextMenuItem } from '../components/RowContextMenu';
import { CardStatementModal } from '../components/CardStatementModal';
import { getCardStatementDef } from '../data/cardStatementKinds';
import { ActiveStatusBadge, isActiveValue } from '../components/ActiveToggle';
import { canScreen, getCurrentProfile, resolveScreenAuthCode } from '../data/permissions';
import { filterRowsByAuthCode } from '../data/authCodes';
import { filterRowsByOrgAuth, orgAuthSummary } from '../data/orgUnits';
import { FORM_SCHEMAS } from '../data/formSchemas';
import { DispatchTypeLabels } from '../data/documentTypes';
import { listRecords, deleteRecord } from '../api/recordsApi';
import { convertCustomerToCari } from '../api/cardStatementApi';
import { ModuleOverviewPage } from './ModuleOverviewPage';
import { FormTabs } from '../components/FormTabs';

/** CustomerCard.Type_ (Alıcı / Satıcı) */
const CUSTOMER_TYPE_LABELS: Record<string, string> = { '1': 'Alıcı', '2': 'Satıcı', '3': 'Alıcı / Satıcı' };

function isStatusColumn(key: string, label: string): boolean {
  const k = key.toLowerCase();
  return k === 'status' || k === 'isactive' || k === 'active' || /durum/i.test(label);
}

function cellLooksActivePassive(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  const s = String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  return ['aktif', 'pasif', 'active', 'passive', 'inactive'].includes(s);
}

interface ModuleListPageProps {
  screen: MenuScreen;
  module?: AppModule | null;
  groupKey?: string | null;
  breadcrumb?: string;
  onNew: () => void;
  onBack: () => void;
  onNavigate?: (path: string) => void;
  onView?: (rowId: string | number) => void;
  onEdit?: (rowId: string | number) => void;
  onDelete?: (rowId: string | number) => void;
  onCopy?: (rowId: string | number) => void;
  hideChrome?: boolean;
}

function inferRecordType(screen: MenuScreen): string | null {
  if (screen.formCode && FORM_SCHEMAS[screen.formCode]?.tableName) {
    return FORM_SCHEMAS[screen.formCode].tableName;
  }
  const sub = (screen.subtitle || '').trim();
  if (!sub) return null;
  const token = sub.split(/[·•|,/\s]/)[0]?.trim();
  if (token && /^[A-Za-z][A-Za-z0-9_]*$/.test(token)) return token;
  return null;
}

function resolveListFilter(
  screen: MenuScreen,
  schema: (typeof FORM_SCHEMAS)[string] | undefined,
): { column?: string; value?: string | number } {
  const skip = new Set(['AccountGroupID', 'AuthCode']);
  const fixed = schema?.fixedStandardFields;
  if (fixed) {
    const entries = Object.entries(fixed).filter(([k]) => !skip.has(k));
    // Tip alanlarını öne al
    const preferred = entries.find(([k]) =>
      /^(ProductType|Type_|VoucherType|InvoiceType|Type|Kind|ModuleID|ModuleKey|Module)$/i.test(k),
    );
    const pick = preferred || entries[0];
    if (pick) return { column: pick[0], value: pick[1] as string | number };
  }
  if (screen.productTypeFilter != null) {
    return { column: 'ProductType', value: screen.productTypeFilter };
  }
  if (screen.documentTypeFilter != null) {
    const col =
      schema?.fields.some((f) => f.fieldName === 'VoucherType') ||
      schema?.fixedStandardFields?.VoucherType != null
        ? 'VoucherType'
        : schema?.fields.some((f) => f.fieldName === 'InvoiceType') ||
            schema?.fixedStandardFields?.InvoiceType != null
          ? 'InvoiceType'
          : 'Type_';
    return { column: col, value: screen.documentTypeFilter };
  }
  return {};
}

function pickCell(row: Record<string, unknown>, key: string): unknown {
  if (row[key] != null && row[key] !== '') return row[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase() === lower && v != null && v !== '') return v;
  }
  // yaygın eşlemeler
  const aliases: Record<string, string[]> = {
    code: ['Code', 'CompanyCode', 'WhouseCode', 'NickName', 'DocumentNumber', 'OrderSlipNo'],
    title: ['Title', 'Name', 'Defintion', 'Description', 'Decription'],
    name: ['Name', 'Title', 'NickName'],
    nick: ['NickName', 'Code'],
    no: ['DocumentNumber', 'OrderSlipNo', 'Code', 'DocumentNr'],
    date: ['VoucherDate', 'OrderDate', 'InvoiceDate', 'TransDate', 'CreditDate'],
    status: ['status', 'IsActive', 'Active', 'Status_', 'Status'],
    taxNr: ['TaxNr', 'TaxNumber'],
    customer: ['CustomerID'],
    type: ['Type_', 'Type', 'InvoiceType', 'VoucherType', 'PlanType', 'Kind'],
    warehouse: ['WhouseID', 'Whouse', 'warehouse'],
    planType: ['PlanType', 'Type_', 'Type'],
    days: ['DayCount', 'DayOffset'],
    installments: ['InstallmentCnt', 'InstallmentNo'],
    total: ['Amount', 'CreditAmount', 'TotalPrice', 'CurrencyTotal', 'SumDebit'],
    rate: ['Rate', 'InterestRate', 'RatePercent', 'TaxRate'],
    authCode: ['AuthCode'],
    group: ['AccountGroup', 'ModuleKey'],
    start: ['Code', 'TargetTable'],
    target: ['TargetTable', 'Target'],
    lines: ['SortOrder'],
    stockQty: ['StockQty', 'stockQty'],
    mainUnit: ['MainUnitName', 'MainUnit', 'mainUnitName', 'mainUnit'],
    salesOrderQty: ['SalesOrderQty', 'salesOrderQty'],
    purchaseOrderQty: ['PurchaseOrderQty', 'purchaseOrderQty'],
  };
  for (const a of aliases[key] || []) {
    if (row[a] != null && row[a] !== '') return row[a];
  }
  return '';
}

export const ModuleListPage: React.FC<ModuleListPageProps> = ({
  screen,
  module,
  groupKey,
  breadcrumb,
  onNew,
  onBack,
  onNavigate,
  onView,
  onEdit,
  onDelete,
  onCopy,
  hideChrome = false,
}) => {
  const profile = getCurrentProfile();
  const schema = screen.formCode ? FORM_SCHEMAS[screen.formCode] : undefined;
  const tableName = schema?.tableName || inferRecordType(screen);
  const pk = schema?.primaryKeyColumn;
  const useDb = Boolean(screen.formCode && tableName);

  const [dbRows, setDbRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(useDb);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'db' | 'demo'>(useDb ? 'db' : 'demo');
  const [tick, setTick] = useState(0);
  const [viewTab, setViewTab] = useState<'list' | 'report'>('list');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; rowId: string | number; label: string } | null>(
    null,
  );
  const [statement, setStatement] = useState<{ cardId: number; tab: string } | null>(null);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
  const stmtDef = getCardStatementDef(tableName);

  const typeFilterNum = useMemo(() => {
    if (screen.documentTypeFilter != null) {
      const n = Number(screen.documentTypeFilter);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, [screen.documentTypeFilter]);

  const showReportTab = Boolean(module && onNavigate);

  const loadDb = useCallback(async () => {
    if (!useDb || !tableName) {
      setSource('demo');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { column: filterColumn, value: filterValue } = resolveListFilter(screen, schema);

      const res = await listRecords(tableName, {
        pk,
        filterColumn,
        filterValue,
        take: 500,
      });
      setDbRows(res.rows as Record<string, unknown>[]);
      setSource('db');
      if (res.warning) setError(res.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DB okunamadı');
      setDbRows([]);
      setSource('db');
    } finally {
      setLoading(false);
    }
  }, [useDb, tableName, pk, screen, schema]);

  useEffect(() => {
    void loadDb();
  }, [loadDb, tick]);

  const rawRows = useMemo(() => {
    if (useDb) return dbRows;
    return (screen.sampleRows ?? []) as Record<string, unknown>[];
  }, [useDb, dbRows, screen.sampleRows]);

  const typeFilteredRows = useMemo(() => {
    const allowed = screen.documentTypeFilters;
    if (!allowed?.length) return rawRows;
    const set = new Set(allowed.map(String));
    return rawRows.filter((row) => {
      const vt = String(
        row.VoucherType ?? row.voucherType ?? row.Type_ ?? row.type ?? '',
      ).trim();
      return set.has(vt);
    });
  }, [rawRows, screen.documentTypeFilters]);

  const recordType = inferRecordType(screen);
  const authExpr = resolveScreenAuthCode(profile, screen.id, recordType);
  const afterAuth = filterRowsByAuthCode(typeFilteredRows, authExpr);
  const rows = filterRowsByOrgAuth(afterAuth, profile.orgAuth);

  const baseCols = screen.listColumns ?? [];
  const columns = baseCols;

  const allowed = {
    view: canScreen(screen.id, 'view'),
    create: canScreen(screen.id, 'create'),
    update: canScreen(screen.id, 'update'),
    delete: canScreen(screen.id, 'delete'),
  };

  const showActions = Boolean(screen.formCode) || allowed.view || allowed.update || allowed.delete;
  const authNote = authExpr.trim()
    ? `Yetki kodu «${authExpr}»${recordType ? ` (${recordType})` : ''}`
    : null;
  const orgNote =
    profile.orgAuth &&
    (profile.orgAuth.companyIds.length > 0 ||
      profile.orgAuth.workplaceIds.length > 0 ||
      profile.orgAuth.whouseIds.length > 0)
      ? orgAuthSummary(profile.orgAuth)
      : null;
  const filterNote = [authNote, orgNote].filter(Boolean).join(' · ') || null;

  const handleDelete = async (rowId: string | number) => {
    if (!window.confirm('Bu kaydı çıkarmak istiyor musunuz?')) return;
    if (useDb && tableName && source === 'db') {
      try {
        await deleteRecord(tableName, Number(rowId), pk);
        setTick((t) => t + 1);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Silinemedi');
      }
      return;
    }
    onDelete?.(rowId);
  };

  /** Müşteri (CardKind=1) listesi — sağ tık «Cariye Dönüştür» */
  const isMusteriList = screen.formCode === 'MusteriCardForm';
  const handleToCari = async (rowId: string | number) => {
    if (!window.confirm('Bu müşteri cariye dönüştürülsün mü? Kart Cari Kartlar listesine taşınır.')) return;
    try {
      const r = await convertCustomerToCari(Number(rowId));
      if (!r.success) alert(r.message);
      setTick((t) => t + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Dönüştürülemedi');
    }
  };

  /** Kart listelerinde Ekstre / Hareketler / ek bölümler (Cari, Malzeme, Banka, Kasa, Hesap Planı…) */
  const statementItemsFor = (rowId: string | number): RowActionExtraItem[] => {
    const id = Number(rowId);
    if (!stmtDef || !allowed.view || source !== 'db' || !Number.isInteger(id) || id <= 0) return [];
    return stmtDef.items.map((it, i) => ({
      key: `stmt-${it.key}`,
      label: it.label,
      icon:
        i === 0 ? (
          <FileText className="w-3.5 h-3.5" />
        ) : it.key === 'hareketler' ? (
          <List className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        ),
      onClick: () => setStatement({ cardId: id, tab: it.key }),
    }));
  };

  const contextItemsFor = (rowId: string | number): RowContextMenuItem[] => {
    const items: RowContextMenuItem[] = [];
    if (allowed.view)
      items.push({ key: 'view', label: 'İncele', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => onView?.(rowId) });
    if (allowed.update)
      items.push({ key: 'edit', label: 'Değiştir', icon: <Pencil className="w-3.5 h-3.5" />, onClick: () => onEdit?.(rowId) });
    if (allowed.create)
      items.push({ key: 'copy', label: 'Kopyala', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => onCopy?.(rowId) });
    if (allowed.delete)
      items.push({
        key: 'delete',
        label: 'Çıkar',
        icon: <Trash2 className="w-3.5 h-3.5" />,
        danger: true,
        onClick: () => void handleDelete(rowId),
      });
    const stmt = statementItemsFor(rowId);
    stmt.forEach((s, i) => items.push({ ...s, separatorBefore: i === 0 && items.length > 0 }));
    if (isMusteriList && allowed.update && source === 'db' && Number(rowId) > 0)
      items.push({
        key: 'to-cari',
        label: 'Cariye Dönüştür',
        icon: <UserCheck className="w-3.5 h-3.5" />,
        separatorBefore: true,
        onClick: () => void handleToCari(rowId),
      });
    return items;
  };

  if (showReportTab && viewTab === 'report' && module && onNavigate) {
    const grp = module.groups.find((g) => g.key === groupKey) || null;
    return (
      <div className={`${hideChrome ? '' : 'max-w-6xl mx-auto'} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FormTabs
            variant="segment"
            size="sm"
            active={viewTab}
            onChange={(id) => setViewTab(id as 'list' | 'report')}
            tabs={[
              { id: 'list', label: 'Liste' },
              { id: 'report', label: 'Detay Rapor' },
            ]}
          />
          <button
            type="button"
            onClick={() => setViewTab('list')}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
          >
            Listeye dön
          </button>
        </div>
        <ModuleOverviewPage
          module={module}
          group={grp}
          typeFilter={typeFilterNum}
          titleOverride={`${screen.title} · Detay Rapor`}
          breadcrumb={breadcrumb || `${module.title}${grp ? ` / ${grp.title}` : ''} / ${screen.title}`}
          onNavigate={onNavigate}
          listPath={screen.path}
          compact
        />
      </div>
    );
  }

  return (
    <div className={`${hideChrome ? '' : 'max-w-6xl mx-auto'} space-y-2`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <div className="min-w-0">
          {!hideChrome && (
            <>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 mb-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Ana Sayfa
              </button>
              {breadcrumb && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                  {breadcrumb}
                </p>
              )}
              <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                {screen.title}
              </h2>
            </>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
            {hideChrome && screen.subtitle && (
              <span className="font-medium text-slate-600">{screen.subtitle}</span>
            )}
            {!hideChrome && screen.subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 w-full">{screen.subtitle}</p>
            )}
            <span className="inline-flex items-center gap-1">
              <Database className="w-3 h-3" />
              {loading
                ? 'DB…'
                : useDb
                  ? `${tableName}${(() => {
                      const f = resolveListFilter(screen, schema);
                      return f.column ? `.${f.column}=${f.value}` : '';
                    })()} · ${rows.length}`
                  : 'demo'}
            </span>
            {filterNote && (
              <span className="text-amber-700 dark:text-amber-400 font-medium truncate max-w-full">
                {filterNote}
              </span>
            )}
            {error && (
              <span className="text-red-600 font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {error}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {showReportTab && (
            <FormTabs
              variant="segment"
              size="sm"
              active={viewTab}
              onChange={(id) => setViewTab(id as 'list' | 'report')}
              tabs={[
                { id: 'list', label: 'Liste' },
                { id: 'report', label: 'Detay Rapor' },
              ]}
            />
          )}
          {useDb && (
            <button
              type="button"
              onClick={() => setTick((t) => t + 1)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1 px-2 h-7 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          )}
          {screen.formCode && allowed.create && (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex items-center justify-center gap-1 px-2.5 h-7 rounded-md bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Yeni
            </button>
          )}
        </div>
      </div>

      <div className={`overflow-hidden ${hideChrome ? '' : 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                {showActions && (
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 w-16 sticky left-0 bg-slate-50 dark:bg-slate-800/60 z-10">
                    İşlem
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1) + (showActions ? 1 : 0)}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1) + (showActions ? 1 : 0)}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    {rawRows.length > 0 && filterNote
                      ? 'Yetki koduna uygun kayıt yok'
                      : 'Kayıt yok — Yeni ile ekleyin'}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const rowId = (row.id ?? row.Id ?? pickCell(row, pk || 'id') ?? idx) as
                    | string
                    | number;
                  return (
                    <tr
                      key={String(rowId)}
                      onContextMenu={(e) => {
                        if (!showActions) return;
                        e.preventDefault();
                        const label = [pickCell(row, 'code'), pickCell(row, 'title')]
                          .map((v) => String(v ?? '').trim())
                          .filter(Boolean)
                          .join(' · ');
                        setCtxMenu({ x: e.clientX, y: e.clientY, rowId, label });
                      }}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors h-9 group ${
                        ctxMenu?.rowId === rowId ? 'bg-blue-50/70 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {showActions && (
                        <td className="px-2 py-1.5 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 z-10">
                          <RowActions
                            allowed={allowed}
                            handlers={{
                              onView: () => onView?.(rowId),
                              onEdit: () => onEdit?.(rowId),
                              onDelete: () => void handleDelete(rowId),
                              onCopy: () => onCopy?.(rowId),
                            }}
                            extraItems={statementItemsFor(rowId)}
                          />
                        </td>
                      )}
                      {columns.map((col) => {
                        let raw = pickCell(row, col.key);
                        if (
                          (col.key === 'type' || col.key === 'VoucherType') &&
                          raw != null &&
                          raw !== ''
                        ) {
                          const label =
                            tableName === 'CustomerCard'
                              ? CUSTOMER_TYPE_LABELS[String(raw)]
                              : DispatchTypeLabels[String(raw)];
                          if (label) raw = label;
                        }
                        const showToggle =
                          isStatusColumn(col.key, col.label) && cellLooksActivePassive(raw);
                        const current = isActiveValue(raw);
                        return (
                          <td
                            key={col.key}
                            className="px-3 py-1.5 text-slate-700 dark:text-slate-200 whitespace-nowrap"
                          >
                            {showToggle ? (
                              <ActiveStatusBadge value={current} disabled />
                            ) : (
                              String(raw ?? '')
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {ctxMenu && (
        <RowContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.label || undefined}
          items={contextItemsFor(ctxMenu.rowId)}
          onClose={closeCtxMenu}
        />
      )}
      {statement && stmtDef && (
        <CardStatementModal
          kind={stmtDef.kind}
          cardId={statement.cardId}
          kindTitle={isMusteriList ? 'Müşteri' : stmtDef.title}
          reportTitle={stmtDef.items.find((i) => i.key === 'ekstre')?.label ?? `${stmtDef.title} Ekstresi`}
          initialTab={statement.tab}
          onClose={() => setStatement(null)}
        />
      )}
    </div>
  );
};
