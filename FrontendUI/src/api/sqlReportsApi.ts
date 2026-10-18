import { apiJson } from '../config/api';

export interface SqlReport {
  id: number;
  name: string;
  reportGroup: string;
  description?: string | null;
  queryTemplate: string;
  preQueryTemplate?: string | null;
  filtersConfig?: string | null;
  chartConfig?: string | null;
  kpiConfig?: string | null;
  columnFormats?: string | null;
  pivotConfig?: string | null;
  calendarConfig?: string | null;
  advancedFeaturesConfig?: string | null;
  cachedColumns?: string | null;
  auxQueriesConfig?: string | null;
  calculatedColumns?: string | null;
  conditionalFormattingConfig?: string | null;
  reportColor?: string | null;
  allowExport: boolean;
  allowPdfExport?: boolean;
  allowSimulation?: boolean;
  showDataTable?: boolean;
  showPivotTable?: boolean;
  showCalendar?: boolean;
  restrictUsers?: boolean;
  isActive: boolean;
  menuId?: number | null;
  menuDisplayName?: string | null;
  menuSortOrder?: number | null;
  exportKey?: string | null;
  menuTitle?: string | null;
  menuModulePath?: string | null;
  menuGroupKey?: string | null;
  authorizedUserCount?: number;
  createdAt: string;
  updatedAt?: string | null;
  createdBy?: string | null;
}

export interface SqlReportSave {
  name: string;
  reportGroup: string;
  description?: string;
  queryTemplate: string;
  preQueryTemplate?: string;
  filtersConfig?: string;
  chartConfig?: string;
  kpiConfig?: string;
  columnFormats?: string;
  pivotConfig?: string;
  calendarConfig?: string;
  advancedFeaturesConfig?: string;
  cachedColumns?: string;
  auxQueriesConfig?: string;
  calculatedColumns?: string;
  conditionalFormattingConfig?: string;
  reportColor?: string;
  allowExport: boolean;
  allowPdfExport?: boolean;
  allowSimulation?: boolean;
  showDataTable?: boolean;
  showPivotTable?: boolean;
  showCalendar?: boolean;
  restrictUsers?: boolean;
  isActive: boolean;
  menuId?: number | null;
  menuDisplayName?: string | null;
  menuSortOrder?: number | null;
  exportKey?: string | null;
  createdBy?: string;
}

export interface SqlReportUser {
  systemUserId: number;
  nickName: string;
  name: string;
  surname: string;
  isActive: boolean;
  displayName: string;
}

export interface SqlReportAuthUser {
  systemUserId: number;
  nickName?: string | null;
  displayName?: string | null;
  canView: boolean;
  canRun: boolean;
}

export interface SqlReportAuthRole {
  roleId: number;
  code?: string | null;
  name?: string | null;
  canView: boolean;
  canRun: boolean;
}

export interface SqlReportAuthState {
  reportId: number;
  restrictUsers: boolean;
  users: SqlReportAuthUser[];
  roles?: SqlReportAuthRole[];
}

export interface SqlReportUserAuthItem {
  reportId: number;
  name: string;
  reportGroup: string;
  restrictUsers: boolean;
  assigned: boolean;
  canView: boolean;
  canRun: boolean;
}

export interface SqlReportUserAuthState {
  systemUserId: number;
  reports: SqlReportUserAuthItem[];
}

export interface SqlReportMenuItem {
  id: number;
  name: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  exportKey?: string | null;
}

export interface SqlReportMenu {
  id: number;
  exportKey: string;
  modulePath: string;
  groupKey: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
  reports: SqlReportMenuItem[];
}

export interface SqlReportMenuSave {
  modulePath: string;
  groupKey: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  exportKey?: string;
}

export interface SqlReportPackage {
  format: string;
  version: number;
  exportedAt: string;
  menus: Array<{
    exportKey: string;
    modulePath: string;
    groupKey: string;
    title: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  reports: Array<Record<string, unknown>>;
}

export interface SqlReportImportResult {
  menusUpserted: number;
  reportsUpserted: number;
  messages: string[];
}

export interface SqlReportFilterDef {
  var_name: string;
  label: string;
  type: 'text' | 'date' | 'number' | string;
  default_val?: string;
}

export interface SqlReportAuxDataset {
  key: string;
  label?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  error?: string | null;
}

export interface SqlReportRunResult {
  success: boolean;
  message?: string | null;
  executedQuery?: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  elapsedMs: number;
  auxDatasets?: SqlReportAuxDataset[];
}

export async function listSqlReports(group?: string): Promise<SqlReport[]> {
  const qs = group ? `?group=${encodeURIComponent(group)}` : '';
  return apiJson<SqlReport[]>(`/api/sql-reports${qs}`);
}

export async function getSqlReport(id: number): Promise<SqlReport> {
  return apiJson<SqlReport>(`/api/sql-reports/${id}`);
}

export async function createSqlReport(dto: SqlReportSave): Promise<SqlReport> {
  return apiJson<SqlReport>('/api/sql-reports', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateSqlReport(id: number, dto: SqlReportSave): Promise<SqlReport> {
  return apiJson<SqlReport>(`/api/sql-reports/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteSqlReport(id: number): Promise<void> {
  await apiJson(`/api/sql-reports/${id}`, { method: 'DELETE' });
}

export async function listSqlReportMenus(opts?: {
  userId?: number;
  isAdmin?: boolean;
}): Promise<SqlReportMenu[]> {
  const qs = new URLSearchParams();
  if (opts?.userId != null) qs.set('userId', String(opts.userId));
  if (opts?.isAdmin) qs.set('isAdmin', 'true');
  const q = qs.toString();
  return apiJson<SqlReportMenu[]>(`/api/sql-reports/menus${q ? `?${q}` : ''}`);
}

export async function listSqlReportUsers(): Promise<SqlReportUser[]> {
  return apiJson<SqlReportUser[]>('/api/sql-reports/users');
}

export async function getSqlReportAuth(reportId: number): Promise<SqlReportAuthState> {
  return apiJson<SqlReportAuthState>(`/api/sql-reports/${reportId}/auth`);
}

export async function saveSqlReportAuth(
  reportId: number,
  dto: {
    restrictUsers: boolean;
    users: SqlReportAuthUser[];
    roles?: SqlReportAuthRole[];
  },
): Promise<SqlReportAuthState> {
  return apiJson<SqlReportAuthState>(`/api/sql-reports/${reportId}/auth`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function getSqlReportAuthByUser(userId: number): Promise<SqlReportUserAuthState> {
  return apiJson<SqlReportUserAuthState>(`/api/sql-reports/auth/by-user/${userId}`);
}

export async function saveSqlReportAuthByUser(
  userId: number,
  reportIds: number[],
): Promise<SqlReportUserAuthState> {
  return apiJson<SqlReportUserAuthState>(`/api/sql-reports/auth/by-user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ reportIds }),
  });
}

export async function createSqlReportMenu(dto: SqlReportMenuSave): Promise<SqlReportMenu> {
  return apiJson<SqlReportMenu>('/api/sql-reports/menus', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateSqlReportMenu(id: number, dto: SqlReportMenuSave): Promise<SqlReportMenu> {
  return apiJson<SqlReportMenu>(`/api/sql-reports/menus/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function deleteSqlReportMenu(id: number): Promise<void> {
  await apiJson(`/api/sql-reports/menus/${id}`, { method: 'DELETE' });
}

export async function exportSqlReports(ids?: number[]): Promise<SqlReportPackage> {
  const qs = ids?.length ? `?ids=${ids.join(',')}` : '';
  return apiJson<SqlReportPackage>(`/api/sql-reports/export${qs}`);
}

export async function importSqlReports(pkg: SqlReportPackage): Promise<SqlReportImportResult> {
  return apiJson<SqlReportImportResult>('/api/sql-reports/import', {
    method: 'POST',
    body: JSON.stringify(pkg),
  });
}

export async function runSqlReport(opts: {
  reportId?: number;
  queryTemplate?: string;
  preQueryTemplate?: string;
  auxQueriesConfig?: string;
  calculatedColumns?: string;
  parameters?: Record<string, string>;
  simulationPercents?: Record<string, number>;
  maxRows?: number;
  fastTest?: boolean;
  skipAuxQueries?: boolean;
  userId?: number;
  isAdmin?: boolean;
}): Promise<SqlReportRunResult> {
  const body = {
    parameters: opts.parameters ?? {},
    simulationPercents: opts.simulationPercents ?? {},
    maxRows: opts.maxRows ?? 5000,
    fastTest: opts.fastTest ?? false,
    skipAuxQueries: opts.skipAuxQueries ?? false,
    auxQueriesConfig: opts.auxQueriesConfig,
    calculatedColumns: opts.calculatedColumns,
    userId: opts.userId,
    isAdmin: opts.isAdmin ?? false,
  };
  if (opts.reportId) {
    return apiJson<SqlReportRunResult>(`/api/sql-reports/${opts.reportId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
  return apiJson<SqlReportRunResult>('/api/sql-reports/run', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      queryTemplate: opts.queryTemplate,
      preQueryTemplate: opts.preQueryTemplate,
    }),
  });
}

export function parseFiltersConfig(raw?: string | null): SqlReportFilterDef[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is SqlReportFilterDef =>
          !!x && typeof x === 'object' && typeof (x as SqlReportFilterDef).var_name === 'string',
      )
      .map((x) => ({
        var_name: x.var_name,
        label: x.label || x.var_name,
        type: x.type || 'text',
        default_val: x.default_val ?? '',
      }));
  } catch {
    return [];
  }
}

export function defaultFilterValue(f: SqlReportFilterDef): string {
  const raw = (f.default_val ?? '').trim();
  if (f.type === 'date') {
    if (!raw) return new Date().toISOString().slice(0, 10);
    // Y-13: yıl / ay başı ve önceki ay (zamanlanmış raporlarla aynı anahtarlar)
    const now = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const key = raw.toLowerCase();
    if (key === 'year_start') return iso(new Date(now.getFullYear(), 0, 1));
    if (key === 'month_start') return iso(new Date(now.getFullYear(), now.getMonth(), 1));
    if (key === 'prev_month_start') return iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    if (key === 'prev_month_end') return iso(new Date(now.getFullYear(), now.getMonth(), 0));
    const m = raw.match(/^(-?\d+)\s*days?$/i);
    if (m) {
      const d = new Date();
      d.setDate(d.getDate() + Number(m[1]));
      return d.toISOString().slice(0, 10);
    }
    return raw;
  }
  return raw;
}

export function reportToSave(r: SqlReport): SqlReportSave {
  return {
    name: r.name,
    reportGroup: r.reportGroup || 'Genel',
    description: r.description || '',
    queryTemplate: r.queryTemplate,
    preQueryTemplate: r.preQueryTemplate || '',
    filtersConfig: r.filtersConfig || '[]',
    chartConfig: r.chartConfig || '[]',
    kpiConfig: r.kpiConfig || '[]',
    columnFormats: r.columnFormats || '[]',
    pivotConfig: r.pivotConfig || '{}',
    calendarConfig: r.calendarConfig || '{}',
    advancedFeaturesConfig: r.advancedFeaturesConfig || '{}',
    cachedColumns: r.cachedColumns || '[]',
    auxQueriesConfig: r.auxQueriesConfig || '[]',
    calculatedColumns: r.calculatedColumns || '[]',
    conditionalFormattingConfig: r.conditionalFormattingConfig || '[]',
    reportColor: r.reportColor || '#6366f1',
    allowExport: r.allowExport !== false,
    allowPdfExport: !!r.allowPdfExport,
    allowSimulation: r.allowSimulation !== false,
    showDataTable: r.showDataTable !== false,
    showPivotTable: !!r.showPivotTable,
    showCalendar: !!r.showCalendar,
    restrictUsers: !!r.restrictUsers,
    isActive: r.isActive !== false,
    menuId: r.menuId ?? null,
    menuDisplayName: r.menuDisplayName || '',
    menuSortOrder: r.menuSortOrder ?? 10,
    exportKey: r.exportKey || '',
  };
}
