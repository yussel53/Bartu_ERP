import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  History,
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
  BookCheck,
} from 'lucide-react';
import { AppModule, MenuScreen } from '../types/formTypes';
import { RowActions, RowActionExtraItem } from '../components/RowActions';
import {
  FilterInput,
  FilterSummary,
  isNumericColumn,
  SortLabel,
  useGridSortFilter,
} from '../components/GridSortFilter';
import { RowContextMenu, RowContextMenuItem } from '../components/RowContextMenu';
import { AuditHistoryModal } from '../components/AuditHistoryModal';
import { CardStatementModal } from '../components/CardStatementModal';
import { CardQuickInfoButton } from '../components/CardQuickInfoButton';
import { getCardStatementDef } from '../data/cardStatementKinds';
import { ActiveStatusBadge, isActiveValue } from '../components/ActiveToggle';
import { canScreen, getCurrentProfile, resolveScreenAuthCode } from '../data/permissions';
import { filterRowsByAuthCode } from '../data/authCodes';
import { filterRowsByOrgAuth, orgAuthSummary } from '../data/orgUnits';
import { FORM_SCHEMAS } from '../data/formSchemas';
import { ACCOUNT_TYPE_LABELS } from '../data/accountParentLink';
import { DispatchTypeLabels } from '../data/documentTypes';
import { listRecords, deleteRecord } from '../api/recordsApi';
import { resolveLookupOption } from '../api/lookupApi';
import {
  AccountListSummary,
  convertCustomerToCari,
  CustomerListSummary,
  getAccountSummaries,
  getCustomerSummaries,
} from '../api/cardStatementApi';
import { ModuleOverviewPage } from './ModuleOverviewPage';
import { FormTabs } from '../components/FormTabs';
import { appConfirm } from '../utils/appConfirm';
import { apiJson } from '../config/api';
import { appToast } from '../utils/appToast';

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
  if (screen.tradeGroupFilter != null) {
    return { column: 'TradeGroup', value: screen.tradeGroupFilter };
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

const fmtMoney = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOC_PARTY_TABLES = new Set([
  'Invoice',
  'OrderVoucher',
  'ProductVoucher',
  'CustomerVoucher',
  'BankVoucher',
  'SafeVoucher',
]);

/** Fatura / irsaliye / sipariş listesinde CustomerID → «kod — ünvan» (API zenginleştirmesi yoksa yedek) */
async function withDocCustomerTitles(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;
  const need = new Map<string, true>();
  for (const row of rows) {
    const id = String(row.CustomerID ?? row.customerID ?? '').trim();
    if (!id || id === '0') continue;
    const have = String(row.CustomerTitle ?? row.customerTitle ?? row.customer ?? '').trim();
    // Zaten ünvan var ve yalnız ID değilse atla
    if (have && have !== id && !/^#?\d+$/.test(have)) continue;
    need.set(id, true);
  }
  if (need.size === 0) return rows;
  const labels = new Map<string, string>();
  await Promise.all(
    [...need.keys()].map(async (id) => {
      try {
        const opt = await resolveLookupOption('CustomerID', id);
        if (opt?.label && opt.label !== id && !/^#?\d+$/.test(opt.label.trim())) {
          labels.set(id, opt.label);
        }
      } catch {
        /* yok say */
      }
    }),
  );
  if (labels.size === 0) return rows;
  return rows.map((row) => {
    const id = String(row.CustomerID ?? row.customerID ?? '').trim();
    const label = labels.get(id);
    if (!label) return row;
    return { ...row, CustomerTitle: label, customerTitle: label, customer: label };
  });
}

/** Cari listesi: bakiye, son hareket, açık sipariş, il/ilçe, iletişim, risk grubu (özet okunamazsa liste yine açılır) */
async function withCustomerSummaries(rows: Record<string, unknown>[], pk: string): Promise<Record<string, unknown>[]> {
  let list: CustomerListSummary[] = [];
  try {
    list = await getCustomerSummaries();
  } catch {
    return rows;
  }
  const map = new Map(list.map((s) => [String(s.customerCardID), s]));
  return rows.map((row) => {
    const s = map.get(String(pickCell(row, pk) ?? ''));
    const bal = s?.balance ?? 0;
    return {
      ...row,
      borc: s?.debit ? fmtMoney(s.debit) : '',
      alacak: s?.credit ? fmtMoney(s.credit) : '',
      bakiye: s && (s.debit || s.credit) ? fmtMoney(Math.abs(bal)) : '',
      ba: !s || Math.abs(bal) < 0.005 ? '' : bal > 0 ? 'B' : 'A',
      sonHareket: s?.lastMoveDate ? String(s.lastMoveDate).slice(0, 10).split('-').reverse().join('.') : '',
      acikSiparis: s?.openOrders ? String(s.openOrders) : '',
      ilIlce: [s?.city, s?.town].filter(Boolean).join(' / '),
      telefon: s?.phone || '',
      eposta: s?.email || '',
      riskGrubu: s?.riskGroup || '',
      vadesiGecen: s?.overdue ? `${fmtMoney(s.overdue)} (${s.overdueDays} gün)` : '',
    };
  });
}

/** Hesap kodu: 100 → 100.01 → 100.01.00001 (segmentleri sayısal) */
function compareAccountCode(a: string, b: string): number {
  const pa = String(a || '')
    .trim()
    .split(/[.\-\s/]+/)
    .filter(Boolean);
  const pb = String(b || '')
    .trim()
    .split(/[.\-\s/]+/)
    .filter(Boolean);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const sa = pa[i] ?? '';
    const sb = pb[i] ?? '';
    if (!sa && sb) return -1;
    if (sa && !sb) return 1;
    if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
      const na = Number(sa);
      const nb = Number(sb);
      if (na !== nb) return na - nb;
      if (sa !== sb) return sa.localeCompare(sb, 'tr');
    } else {
      const c = sa.localeCompare(sb, 'tr', { numeric: true, sensitivity: 'base' });
      if (c !== 0) return c;
    }
  }
  return 0;
}

function sortAccountRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) =>
    compareAccountCode(String(pickCell(a, 'code') ?? ''), String(pickCell(b, 'code') ?? '')),
  );
}

/**
 * MainAccountID ağacı: üst hesap sayısı (derinlik) + DFS sıra
 * 1 → üst 0 · 10 → üst 1 · 100 → üst 2 · 100.01 → üst 3
 */
function enrichAccountHierarchy(rows: Record<string, unknown>[], pk: string): Record<string, unknown>[] {
  const byId = new Map<number, Record<string, unknown>>();
  for (const r of rows) {
    const id = Number(pickCell(r, pk) ?? pickCell(r, 'id') ?? 0);
    if (Number.isFinite(id) && id > 0) byId.set(id, r);
  }
  const children = new Map<number, number[]>();
  const roots: number[] = [];
  for (const id of byId.keys()) {
    const r = byId.get(id)!;
    const parentId = Number(r.MainAccountID ?? r.mainAccountID ?? 0);
    if (parentId > 0 && byId.has(parentId) && parentId !== id) {
      const list = children.get(parentId) ?? [];
      list.push(id);
      children.set(parentId, list);
    } else {
      roots.push(id);
    }
  }
  const sortIds = (ids: number[]) =>
    ids.sort((a, b) =>
      compareAccountCode(
        String(pickCell(byId.get(a)!, 'code') ?? ''),
        String(pickCell(byId.get(b)!, 'code') ?? ''),
      ),
    );
  sortIds(roots);
  for (const kids of children.values()) sortIds(kids);

  const out: Record<string, unknown>[] = [];
  const visit = (id: number, depth: number, isLast: boolean, ancestorContinues: boolean[]) => {
    const r = byId.get(id)!;
    const kids = children.get(id) ?? [];
    out.push({
      ...r,
      _accDepth: depth,
      _accIsLast: isLast,
      _accGuides: ancestorContinues,
      ust: depth,
    });
    kids.forEach((cid, i) => {
      const last = i === kids.length - 1;
      // Bu seviyedeki kardeşlerden sonra devam var mı → dikey çizgi
      visit(cid, depth + 1, last, depth === 0 ? [] : [...ancestorContinues, !isLast]);
    });
  };
  roots.forEach((id, i) => visit(id, 0, i === roots.length - 1, []));

  // Ağaca girmeyenler (döngü / kopuk) — sonda kod sırasıyla
  if (out.length < byId.size) {
    const seen = new Set(out.map((r) => Number(pickCell(r, pk) ?? 0)));
    const rest = [...byId.entries()]
      .filter(([id]) => !seen.has(id))
      .map(([, r]) => ({ ...r, _accDepth: 0, _accIsLast: true, _accGuides: [] as boolean[], ust: 0 }));
    out.push(...sortAccountRows(rest));
  }
  return out;
}

/** Hesap kodu hücresi: sola yaslı, üst hesap kadar girinti + ağaç çizgisi */
function AccountCodeCell({ row }: { row: Record<string, unknown> }) {
  const code = String(pickCell(row, 'code') ?? '');
  const depth = Number(row._accDepth ?? row.ust ?? 0) || 0;
  const isLast = Boolean(row._accIsLast);
  const guides = Array.isArray(row._accGuides) ? (row._accGuides as boolean[]) : [];
  if (depth <= 0) {
    return (
      <span className="block text-left font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{code}</span>
    );
  }
  return (
    <span className="flex items-center justify-start font-mono text-[12px] tabular-nums leading-none text-left">
      {guides.map((cont, i) => (
        <span
          key={i}
          className="inline-flex w-3.5 shrink-0 justify-center text-slate-300 dark:text-slate-600 select-none"
          aria-hidden
        >
          {cont ? '│' : '\u00A0'}
        </span>
      ))}
      <span className="inline-flex w-3.5 shrink-0 justify-center text-slate-400 dark:text-slate-500 select-none" aria-hidden>
        {isLast ? '└' : '├'}
      </span>
      <span className="text-slate-700 dark:text-slate-200">{code}</span>
    </span>
  );
}

/** Hesap kartı listesi: yıl bakiyesi + üst hesap derinliği + ağaç sırası */
async function withAccountSummaries(
  rows: Record<string, unknown>[],
  pk: string,
  year: number,
): Promise<Record<string, unknown>[]> {
  let list: AccountListSummary[] = [];
  try {
    list = await getAccountSummaries(year);
  } catch {
    return enrichAccountHierarchy(rows, pk);
  }
  const map = new Map(list.map((s) => [String(s.accountCardID), s]));
  const enriched = rows.map((row) => {
    const s = map.get(String(pickCell(row, pk) ?? ''));
    const bal = s?.balance ?? 0;
    return {
      ...row,
      borc: s?.debit ? fmtMoney(s.debit) : '',
      alacak: s?.credit ? fmtMoney(s.credit) : '',
      bakiye: s && (s.debit || s.credit) ? fmtMoney(Math.abs(bal)) : '',
      ba: !s || Math.abs(bal) < 0.005 ? '' : bal > 0 ? 'B' : 'A',
    };
  });
  return enrichAccountHierarchy(enriched, pk);
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
    customer: ['CustomerTitle', 'customerTitle', 'CustomerName', 'CustomerID'],
    type: ['Type_', 'Type', 'InvoiceType', 'VoucherType', 'PlanType', 'Kind'],
    warehouse: ['WhouseTitle', 'WhouseName', 'Whouse', 'WhouseID', 'warehouse'],
    workplace: ['WorkplaceTitle', 'WorkplaceName', 'DepartmentTitle', 'DepartmentID', 'workplace'],
    description: ['Description', 'Decription', 'description'],
    currencyTotal: ['CurrencyTotal', 'CustomerCurrencyTotal', 'currencyTotal'],
    planType: ['PlanType', 'Type_', 'Type'],
    days: ['DayCount', 'DayOffset'],
    installments: ['InstallmentCnt', 'InstallmentNo'],
    total: ['NetTotal', 'netTotal', 'Amount', 'CreditAmount', 'TotalPrice', 'CurrencyTotal', 'SumDebit'],
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
  // Y-15: sunucu tarafı sayfalama / arama ve değişiklik geçmişi
  // Hesap planı: tüm hesaplar kod sırasıyla gelsin (500 kesilince 100 gibi düşük ID’ler kayboluyordu)
  const PAGE = tableName === 'AccountCard' ? 2000 : 500;
  const [serverTotal, setServerTotal] = useState(0);
  const [serverSearch, setServerSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [audit, setAudit] = useState<{ id: number; label: string } | null>(null);
  /** Hesap kartları: bakiye yılı (öndeğer muhasebe parametrelerinden) */
  const [accountYear, setAccountYear] = useState<number>(() => new Date().getFullYear());
  const [accountYearReady, setAccountYearReady] = useState(tableName !== 'AccountCard');
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
  const stmtDef = getCardStatementDef(tableName);

  useEffect(() => {
    if (tableName !== 'AccountCard') {
      setAccountYearReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const c = await apiJson<{ balanceYear?: number; BalanceYear?: number }>('/api/accounting/config');
        const y = Number(c.balanceYear ?? c.BalanceYear);
        if (!cancelled && Number.isFinite(y) && y >= 1900 && y <= 2100) setAccountYear(Math.trunc(y));
      } catch {
        /* öndeğer: sistem yılı */
      } finally {
        if (!cancelled) setAccountYearReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableName]);

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
    if (tableName === 'AccountCard' && !accountYearReady) return;
    setLoading(true);
    setError(null);
    try {
      const { column: filterColumn, value: filterValue } = resolveListFilter(screen, schema);

      const res = await listRecords(tableName, {
        pk,
        filterColumn,
        filterValue,
        take: PAGE,
        search: serverSearch,
      });
      let rows = res.rows as Record<string, unknown>[];
      if (tableName === 'CustomerCard') rows = await withCustomerSummaries(rows, pk || 'CustomerCardID');
      if (tableName === 'AccountCard') rows = await withAccountSummaries(rows, pk || 'AccountCardID', accountYear);
      if (tableName && DOC_PARTY_TABLES.has(tableName)) rows = await withDocCustomerTitles(rows);
      setDbRows(rows);
      setServerTotal(res.total ?? rows.length);
      setSource('db');
      if (res.warning) setError(res.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DB okunamadı');
      setDbRows([]);
      setSource('db');
    } finally {
      setLoading(false);
    }
  }, [useDb, tableName, pk, screen, schema, serverSearch, accountYear, accountYearReady]);

  useEffect(() => {
    void loadDb();
  }, [loadDb, tick]);

  /** Y-15: sonraki sayfa (sunucuda) — mevcut satırların sonuna eklenir */
  const loadMore = async () => {
    if (!tableName || loadingMore) return;
    setLoadingMore(true);
    try {
      const { column: filterColumn, value: filterValue } = resolveListFilter(screen, schema);
      const res = await listRecords(tableName, { pk, filterColumn, filterValue, take: PAGE, skip: dbRows.length, search: serverSearch });
      let more = res.rows as Record<string, unknown>[];
      if (tableName === 'CustomerCard') more = await withCustomerSummaries(more, pk || 'CustomerCardID');
      if (tableName && DOC_PARTY_TABLES.has(tableName)) more = await withDocCustomerTitles(more);
      if (tableName === 'AccountCard') {
        // Ağaç tüm satırlar üzerinden kurulmalı — kısmi sayfada yeniden zenginleştir
        const mergedRaw = [...dbRows, ...more].map((r) => {
          const { _accDepth: _d, _accIsLast: _l, _accGuides: _g, ust: _u, ...rest } = r as Record<
            string,
            unknown
          > & { _accDepth?: unknown; _accIsLast?: unknown; _accGuides?: unknown; ust?: unknown };
          return rest;
        });
        setDbRows(await withAccountSummaries(mergedRaw, pk || 'AccountCardID', accountYear));
      } else {
        setDbRows((prev) => [...prev, ...more]);
      }
      setServerTotal(res.total ?? serverTotal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sonraki sayfa okunamadı');
    } finally {
      setLoadingMore(false);
    }
  };

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

  /** Hücrede gösterilen değer (tip etiketi çevrilmiş) — sıralama / filtre de bunu kullanır */
  const cellRaw = (row: Record<string, unknown>, col: { key: string }): unknown => {
    let raw = pickCell(row, col.key);
    if ((col.key === 'type' || col.key === 'VoucherType') && raw != null && raw !== '') {
      const label =
        tableName === 'CustomerCard'
          ? CUSTOMER_TYPE_LABELS[String(raw)]
          : tableName === 'AccountCard'
            ? ACCOUNT_TYPE_LABELS[String(raw)]
            : DispatchTypeLabels[String(raw)];
      if (label) raw = label;
    }
    return raw;
  };
  const cellText = (row: Record<string, unknown>, key: string): string => {
    const col = columns.find((c) => c.key === key) ?? { key, label: key };
    const raw = cellRaw(row, col);
    if (isStatusColumn(col.key, col.label) && cellLooksActivePassive(raw)) return isActiveValue(raw) ? 'Aktif' : 'Pasif';
    return String(raw ?? '');
  };
  const grid = useGridSortFilter(rows, cellText);
  const numericCols = useMemo(
    () => new Set(columns.filter((c) => isNumericColumn(rows.map((r) => cellText(r, c.key)))).map((c) => c.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, columns],
  );

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
    if (!await appConfirm('Bu kaydı çıkarmak istiyor musunuz?')) return;
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
    if (!await appConfirm('Bu müşteri cariye dönüştürülsün mü? Kart Cari Kartlar listesine taşınır.')) return;
    try {
      const r = await convertCustomerToCari(Number(rowId));
      if (!r.success) alert(r.message);
      setTick((t) => t + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Dönüştürülemedi');
    }
  };

  const accountingSourceForList = (): 'invoice' | 'safevoucher' | null => {
    const t = (tableName || '').toLowerCase();
    if (t === 'invoice') return 'invoice';
    if (t === 'safevoucher') return 'safevoucher';
    return null;
  };

  const handlePostAccounting = async (rowId: string | number) => {
    const source = accountingSourceForList();
    const id = Number(rowId);
    if (!source || !(id > 0)) return;
    try {
      const res = await apiJson<{ message?: string; Message?: string }>(
        `/api/accounting/post/${source}/${id}`,
        { method: 'POST' },
      );
      appToast(res.message || res.Message || 'Muhasebeleştirildi');
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Muhasebeleştirilemedi', {
        kind: 'error',
        durationMs: 5000,
      });
    }
  };

  /** Kart listelerinde Ekstre / Hareketler / ek bölümler (Cari, Malzeme, Banka, Kasa, Hesap Planı…) */
  const statementItemsFor = (rowId: string | number): RowActionExtraItem[] => {
    const id = Number(rowId);
    const items: RowActionExtraItem[] = [];
    if (stmtDef && allowed.view && source === 'db' && Number.isInteger(id) && id > 0) {
      for (const [i, it] of stmtDef.items.entries()) {
        items.push({
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
        });
      }
    }
    if (accountingSourceForList() && source === 'db' && Number.isInteger(id) && id > 0) {
      items.push({
        key: 'acc-post',
        label: 'Muhasebeleştir',
        icon: <BookCheck className="w-3.5 h-3.5" />,
        onClick: () => void handlePostAccounting(rowId),
      });
    }
    return items;
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
    if (allowed.view && source === 'db' && tableName && Number(rowId) > 0)
      items.push({
        key: 'audit',
        label: 'Değişiklik Geçmişi',
        icon: <History className="w-3.5 h-3.5" />,
        separatorBefore: true,
        onClick: () => setAudit({ id: Number(rowId), label: ctxMenu?.label ?? '' }),
      });
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
                    })()} · ${rows.length}${serverTotal > dbRows.length ? ` / ${serverTotal}` : ''}`
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
          {tableName === 'AccountCard' && (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 mr-1">
              <span className="font-medium whitespace-nowrap">Bakiye yılı</span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={accountYear}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1900 && n <= 2100) setAccountYear(Math.trunc(n));
                }}
                className="w-[4.5rem] h-7 px-1.5 rounded-md border border-slate-200 bg-white text-[12px] tabular-nums text-slate-800 outline-none focus:border-blue-500"
                title="Bakiyenin hesaplandığı yıl (öndeğer: Muhasebe Parametreleri)"
              />
            </label>
          )}
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

      <div
        className={`flex flex-col min-h-0 ${
          hideChrome ? '' : 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm'
        }`}
      >
        {/* Yatay çubuk panel altında sabit; dikey kaydırınca kaybolmaz */}
        <div
          className={`overflow-auto min-h-[12rem] ${
            hideChrome ? 'max-h-[calc(100vh-11.5rem)]' : 'max-h-[calc(100vh-14rem)]'
          }`}
        >
          <table className="min-w-max w-full text-[12px]">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shadow-sm">
                {showActions && (
                  <th className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 w-16 sticky left-0 top-0 bg-slate-50 dark:bg-slate-800 z-30">
                    İşlem
                  </th>
                )}
                {columns.map((col) => {
                  const stickCode = tableName === 'AccountCard' && col.key === 'code';
                  return (
                    <th
                      key={col.key}
                      className={`px-3 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap bg-slate-50 dark:bg-slate-800 ${
                        stickCode
                          ? `sticky z-[29] ${showActions ? 'left-16' : 'left-0'} pl-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
                          : ''
                      }`}
                    >
                      <SortLabel
                        label={col.label}
                        colKey={col.key}
                        sort={grid.sort}
                        onSort={grid.toggleSort}
                        align={numericCols.has(col.key) ? 'right' : 'left'}
                      />
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-800/95">
                {showActions && (
                  <th className="px-2 py-1 sticky left-0 bg-slate-50 dark:bg-slate-800 z-30 text-left">
                    <FilterSummary
                      shown={grid.view.length}
                      total={rows.length}
                      active={grid.hasFilter}
                      onClear={grid.clear}
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const stickCode = tableName === 'AccountCard' && col.key === 'code';
                  return (
                    <th
                      key={col.key}
                      className={`px-2 py-1 font-normal bg-slate-50/95 dark:bg-slate-800/95 ${
                        stickCode
                          ? `sticky z-[29] ${showActions ? 'left-16' : 'left-0'} pl-1.5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`
                          : ''
                      }`}
                    >
                      <FilterInput
                        colKey={col.key}
                        value={grid.filters[col.key] ?? ''}
                        onChange={grid.setFilter}
                        numeric={numericCols.has(col.key)}
                      />
                    </th>
                  );
                })}
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
              ) : rows.length > 0 && grid.view.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1) + (showActions ? 1 : 0)}
                    className="px-3 py-6 text-center text-slate-400"
                  >
                    Filtreye uyan kayıt yok —{' '}
                    <button type="button" onClick={grid.clear} className="text-blue-600 hover:underline">
                      filtreyi temizle
                    </button>
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
                grid.view.map((row, idx) => {
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
                        const raw = cellRaw(row, col);
                        const showToggle =
                          isStatusColumn(col.key, col.label) && cellLooksActivePassive(raw);
                        const current = isActiveValue(raw);
                        const isAccCode = tableName === 'AccountCard' && col.key === 'code';
                        const isAccUst = tableName === 'AccountCard' && col.key === 'ust';
                        return (
                          <td
                            key={col.key}
                            className={`px-3 py-1.5 text-left text-slate-700 dark:text-slate-200 whitespace-nowrap ${
                              numericCols.has(col.key) || isAccUst ? 'text-right tabular-nums' : ''
                            } ${
                              (col.key === 'bakiye' || col.key === 'ba') && raw
                                ? pickCell(row, 'ba') === 'B'
                                  ? 'font-semibold !text-red-700'
                                  : 'font-semibold !text-emerald-700'
                                : ''
                            } ${isAccUst ? 'text-slate-400 w-12' : ''} ${
                              isAccCode
                                ? `sticky z-[9] pl-1.5 pr-2 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 ${
                                    showActions ? 'left-16' : 'left-0'
                                  } shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${
                                    ctxMenu?.rowId === rowId ? '!bg-blue-50/70 dark:!bg-blue-900/20' : ''
                                  }`
                                : ''
                            }`}
                          >
                            {isAccCode ? (
                              <span className="inline-flex items-center gap-1 min-w-0">
                                <AccountCodeCell row={row} />
                                {stmtDef && Number(rowId) > 0 && (
                                  <CardQuickInfoButton
                                    kind={stmtDef.kind}
                                    cardId={Number(rowId)}
                                    label={[pickCell(row, 'code'), pickCell(row, 'title')]
                                      .map((v) => String(v ?? '').trim())
                                      .filter(Boolean)
                                      .join(' · ')}
                                    hint={{
                                      borc: String(pickCell(row, 'borc') ?? ''),
                                      alacak: String(pickCell(row, 'alacak') ?? ''),
                                      bakiye: String(pickCell(row, 'bakiye') ?? ''),
                                      ba: String(pickCell(row, 'ba') ?? ''),
                                    }}
                                    onOpenStatement={() => setStatement({ cardId: Number(rowId), tab: 'ekstre' })}
                                  />
                                )}
                              </span>
                            ) : showToggle ? (
                              <ActiveStatusBadge value={current} disabled />
                            ) : col.key === 'code' && stmtDef && Number(rowId) > 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span>{String(raw ?? '')}</span>
                                <CardQuickInfoButton
                                  kind={stmtDef.kind}
                                  cardId={Number(rowId)}
                                  label={[pickCell(row, 'code'), pickCell(row, 'title')]
                                    .map((v) => String(v ?? '').trim())
                                    .filter(Boolean)
                                    .join(' · ')}
                                  hint={{
                                    borc: String(pickCell(row, 'borc') ?? ''),
                                    alacak: String(pickCell(row, 'alacak') ?? ''),
                                    bakiye: String(pickCell(row, 'bakiye') ?? ''),
                                    ba: String(pickCell(row, 'ba') ?? ''),
                                    sonHareket: String(pickCell(row, 'sonHareket') ?? ''),
                                    vadesiGecen: String(pickCell(row, 'vadesiGecen') ?? ''),
                                    acikSiparis: String(pickCell(row, 'acikSiparis') ?? ''),
                                    riskGrubu: String(pickCell(row, 'riskGrubu') ?? ''),
                                    telefon: String(pickCell(row, 'telefon') ?? ''),
                                    ilIlce: String(pickCell(row, 'ilIlce') ?? ''),
                                  }}
                                  onOpenStatement={() => setStatement({ cardId: Number(rowId), tab: 'ekstre' })}
                                />
                              </span>
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
        {source === 'db' && (serverTotal > dbRows.length || serverSearch || dbRows.length >= PAGE) && (
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
            <span>
              {dbRows.length} / {serverTotal} kayıt yüklendi{serverSearch ? ` · sunucu araması «${serverSearch}»` : ''}
            </span>
            {serverTotal > dbRows.length && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="h-6 px-2 rounded-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {loadingMore ? 'Yükleniyor…' : `Sonraki ${Math.min(PAGE, serverTotal - dbRows.length)} kaydı yükle`}
              </button>
            )}
            <form
              className="inline-flex items-center gap-1 ml-auto"
              onSubmit={(e) => {
                e.preventDefault();
                setServerSearch(searchInput.trim());
              }}
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tüm kayıtlarda ara (sunucu)"
                className="h-6 px-2 w-52 border border-slate-300 dark:border-slate-600 rounded-sm bg-white dark:bg-slate-900"
              />
              <button type="submit" className="h-6 px-2 rounded-sm bg-slate-800 text-white hover:bg-slate-700">
                Ara
              </button>
              {serverSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setServerSearch('');
                  }}
                  className="h-6 px-2 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Temizle
                </button>
              )}
            </form>
          </div>
        )}
      </div>

      {audit && tableName && (
        <AuditHistoryModal tableName={tableName} recordId={audit.id} pk={pk} title={audit.label} onClose={() => setAudit(null)} />
      )}
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
