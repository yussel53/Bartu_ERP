import { apiJson } from '../config/api';

export interface DashboardSummary {
  customer: {
    cardCount: number;
    debitTotal: number;
    creditTotal: number;
    balance: number;
  };
  product: {
    cardCount: number;
    lastPurchaseTotal: number;
    lastPurchaseLineCount: number;
  };
  bank: {
    accountCount: number;
    inTotal: number;
    outTotal: number;
    balance: number;
  };
  safe: {
    cardCount: number;
    amountTotal: number;
  };
  warning?: string | null;
  generatedAt?: string;
}

export interface DashboardTabItem {
  id: number;
  tabId: number;
  sqlReportId?: number | null;
  displayName?: string | null;
  queryTemplate?: string | null;
  kpiConfig?: string | null;
  chartConfig?: string | null;
  showDataTable: boolean;
  colSpan: number;
  sortOrder: number;
  isActive: boolean;
  reportName?: string | null;
  reportFiltersConfig?: string | null;
  reportKpiConfig?: string | null;
  reportChartConfig?: string | null;
  reportColumnFormats?: string | null;
  reportShowDataTable?: boolean | null;
  reportShowPivotTable?: boolean | null;
  reportShowCalendar?: boolean | null;
  reportPivotConfig?: string | null;
  reportCalendarConfig?: string | null;
  reportAllowSimulation?: boolean | null;
  reportConditionalFormatting?: string | null;
}

export interface DashboardTab {
  id: number;
  exportKey: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  showBuiltInSummary: boolean;
  createdAt?: string;
  updatedAt?: string | null;
  items: DashboardTabItem[];
}

export type DashboardTabSave = {
  exportKey: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  showBuiltInSummary: boolean;
};

export type DashboardTabItemSave = {
  tabId: number;
  sqlReportId?: number | null;
  displayName?: string | null;
  queryTemplate?: string | null;
  kpiConfig?: string | null;
  chartConfig?: string | null;
  showDataTable: boolean;
  colSpan: number;
  sortOrder: number;
  isActive: boolean;
};

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiJson<DashboardSummary>('/api/dashboard/summary');
}

export async function listDashboardTabs(includeInactive = false): Promise<DashboardTab[]> {
  const q = includeInactive ? '?includeInactive=true' : '';
  return apiJson<DashboardTab[]>(`/api/dashboard/tabs${q}`);
}

export async function saveDashboardTab(dto: DashboardTabSave, id?: number): Promise<DashboardTab> {
  if (id) {
    return apiJson<DashboardTab>(`/api/dashboard/tabs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  }
  return apiJson<DashboardTab>('/api/dashboard/tabs', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function deleteDashboardTab(id: number): Promise<void> {
  await apiJson(`/api/dashboard/tabs/${id}`, { method: 'DELETE' });
}

export async function saveDashboardTabItem(
  dto: DashboardTabItemSave,
  id?: number,
): Promise<DashboardTabItem> {
  if (id) {
    return apiJson<DashboardTabItem>(`/api/dashboard/tabs/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  }
  return apiJson<DashboardTabItem>('/api/dashboard/tabs/items', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function deleteDashboardTabItem(id: number): Promise<void> {
  await apiJson(`/api/dashboard/tabs/items/${id}`, { method: 'DELETE' });
}
