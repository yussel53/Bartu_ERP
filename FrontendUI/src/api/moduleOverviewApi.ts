import { apiJson } from '../config/api';

export interface OverviewKpi {
  key: string;
  title: string;
  value: string;
  subtitle?: string | null;
  tone?: string;
}

export interface OverviewSlice {
  label: string;
  count: number;
  amount: number;
  color?: string | null;
}

export interface OverviewBar {
  label: string;
  value: number;
  count?: number | null;
}

export interface OverviewPanel {
  title: string;
  bars: OverviewBar[];
}

export interface ModuleOverview {
  modulePath: string;
  groupKey?: string | null;
  title: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  kpis: OverviewKpi[];
  statusSlices: OverviewSlice[];
  monthlyBars: OverviewBar[];
  rankPanels: OverviewPanel[];
  warning?: string | null;
  generatedAt?: string;
}

export async function fetchModuleOverview(opts: {
  modulePath: string;
  group?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  typeFilter?: number | null;
}): Promise<ModuleOverview> {
  const q = new URLSearchParams();
  if (opts.group) q.set('group', opts.group);
  if (opts.dateFrom) q.set('dateFrom', opts.dateFrom);
  if (opts.dateTo) q.set('dateTo', opts.dateTo);
  if (opts.typeFilter != null && opts.typeFilter > 0) q.set('typeFilter', String(opts.typeFilter));
  const qs = q.toString() ? `?${q}` : '';
  return apiJson<ModuleOverview>(`/api/module-overview/${encodeURIComponent(opts.modulePath)}${qs}`);
}
