/** Nova Sierra / Raporlama uyumlu KPI + grafik hesapları */

export interface SqlReportKpiDef {
  title: string;
  /** sum | avg | count | count_distinct | min | max */
  type: string;
  col?: string;
  suffix?: string;
  color?: string;
  icon?: string;
  spanWidth?: number;
  filter_col?: string;
  filter_val?: string;
  filterCol?: string;
  filterVal?: string;
}

export interface SqlReportChartDef {
  id?: string | number;
  title: string;
  /** bar | line | pie | doughnut | none */
  type: string;
  label_col?: string;
  value_col?: string;
  labelCol?: string;
  valueCol?: string;
  agg?: string;
  width?: number | string;
}

export function parseJsonArray<T>(raw?: string | null): T[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === 'object') return Object.values(parsed as Record<string, T>);
    return [];
  } catch {
    return [];
  }
}

export function parseKpis(raw?: string | null): SqlReportKpiDef[] {
  return parseJsonArray<SqlReportKpiDef>(raw).map((k) => ({
    title: k.title || 'KPI',
    type: (k.type || 'count').toLowerCase(),
    col: k.col || '',
    suffix: k.suffix || '',
    color: k.color || '#6366f1',
    icon: k.icon || '',
    spanWidth: k.spanWidth ?? 3,
    filter_col: k.filter_col || k.filterCol || '',
    filter_val: k.filter_val ?? k.filterVal ?? '',
  }));
}

export function parseCharts(raw?: string | null): SqlReportChartDef[] {
  return parseJsonArray<SqlReportChartDef>(raw)
    .map((c, i) => ({
      id: c.id ?? i,
      title: c.title || `Grafik ${i + 1}`,
      type: (c.type || 'bar').toLowerCase(),
      label_col: c.label_col || c.labelCol || '',
      value_col: c.value_col || c.valueCol || '',
      agg: (c.agg || 'sum').toLowerCase(),
      width: c.width ?? 6,
    }))
    .filter((c) => c.type !== 'none');
}

export function stringifyKpis(kpis: SqlReportKpiDef[]): string {
  return JSON.stringify(
    kpis.map((k) => ({
      title: k.title,
      type: k.type,
      col: k.col || '',
      suffix: k.suffix || '',
      color: k.color || '#6366f1',
      icon: k.icon || 'bi-people',
      spanWidth: k.spanWidth ?? 3,
      filter_col: k.filter_col || '',
      filter_val: k.filter_val || '',
    })),
  );
}

export function stringifyCharts(charts: SqlReportChartDef[]): string {
  return JSON.stringify(
    charts.map((c, i) => ({
      id: c.id ?? i,
      title: c.title,
      type: c.type,
      label_col: c.label_col || '',
      value_col: c.value_col || '',
      agg: c.agg || 'sum',
      width: c.width ?? 6,
    })),
  );
}

function cell(row: Record<string, unknown>, col: string): unknown {
  if (!col) return undefined;
  if (row[col] !== undefined) return row[col];
  const key = Object.keys(row).find((k) => k.toLowerCase() === col.toLowerCase());
  return key ? row[key] : undefined;
}

export function parseNumber(val: unknown): number {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  let s = String(val).trim().replace(/\s/g, '');
  if (!s || s === '-' || s === '—') return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function rowMatchesFilter(row: Record<string, unknown>, filterCol?: string, filterVal?: string): boolean {
  if (!filterCol || filterVal === undefined || filterVal === '') return true;
  const a = String(cell(row, filterCol) ?? '')
    .trim()
    .toLowerCase();
  const b = String(filterVal).trim().toLowerCase();
  return a === b;
}

export function computeKpi(kpi: SqlReportKpiDef, rows: Record<string, unknown>[]): number {
  const filtered = rows.filter((r) => rowMatchesFilter(r, kpi.filter_col, kpi.filter_val));
  const type = kpi.type || 'count';

  if (type === 'count') return filtered.length;

  if (type === 'count_distinct') {
    if (!kpi.col) return filtered.length;
    const set = new Set<string>();
    for (const r of filtered) {
      const v = String(cell(r, kpi.col) ?? '')
        .trim()
        .toLowerCase();
      if (v) set.add(v);
    }
    return set.size;
  }

  const nums: number[] = [];
  for (const r of filtered) {
    const n = parseNumber(cell(r, kpi.col || ''));
    if (!Number.isNaN(n)) nums.push(n);
  }
  if (!nums.length) return 0;
  if (type === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (type === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (type === 'min') return Math.min(...nums);
  if (type === 'max') return Math.max(...nums);
  return nums.length;
}

export function formatKpiValue(n: number, suffix?: string): string {
  const abs = Math.abs(n);
  let text: string;
  if (abs >= 1_000_000) text = (n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' M';
  else if (Number.isInteger(n)) text = n.toLocaleString('tr-TR');
  else text = n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  return suffix ? `${text} ${suffix}` : text;
}

export interface ChartSeries {
  labels: string[];
  values: number[];
}

/** Nova Sierra: label'a göre grupla, value sum (veya count) */
export function buildChartSeries(
  chart: SqlReportChartDef,
  rows: Record<string, unknown>[],
  take = 25,
): ChartSeries {
  const labelCol = chart.label_col || '';
  const valueCol = chart.value_col || '';
  if (!labelCol) return { labels: [], values: [] };

  const map = new Map<string, number>();
  for (const row of rows) {
    const label = String(cell(row, labelCol) ?? '').trim();
    if (!label) continue;
    let add = 1;
    if (valueCol) {
      const n = parseNumber(cell(row, valueCol));
      add = Number.isNaN(n) ? 1 : n;
    }
    const agg = chart.agg || 'sum';
    if (agg === 'count') add = 1;
    map.set(label, (map.get(label) || 0) + add);
  }

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, take);
  return {
    labels: sorted.map(([l]) => l),
    values: sorted.map(([, v]) => v),
  };
}

export function filterRowsByColumn(
  rows: Record<string, unknown>[],
  column: string | null | undefined,
  value: string | null | undefined,
): Record<string, unknown>[] {
  if (!column || value == null || value === '') return rows;
  const want = String(value).trim().toLowerCase();
  return rows.filter((r) => String(cell(r, column) ?? '').trim().toLowerCase() === want);
}

export function filterRowsByText(
  rows: Record<string, unknown>[],
  columns: string[],
  q: string,
): Record<string, unknown>[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) =>
    columns.some((c) =>
      String(cell(r, c) ?? '')
        .toLowerCase()
        .includes(needle),
    ),
  );
}

export function exportRowsCsv(columns: string[], rows: Record<string, unknown>[], filename: string) {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [columns.map(esc).join(';')];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(cell(row, c))).join(';'));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface SqlReportPivotCfg {
  row_field?: string;
  col_field?: string;
  val_field?: string;
  agg_type?: string;
}

export interface SqlReportCalendarCfg {
  enabled?: boolean;
  date_column?: string;
  time_column?: string;
  title_column?: string;
  end_column?: string;
  end_time_column?: string;
  description_column?: string;
  color?: string;
}

export interface SqlReportCalcCol {
  name: string;
  expression: string;
}

export interface SqlReportCondRule {
  col: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | string;
  value: string;
  bg?: string;
  fg?: string;
}

export interface SqlReportAuxQueryDef {
  key: string;
  label?: string;
  query: string;
}

export function parsePivot(raw?: string | null): SqlReportPivotCfg {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as SqlReportPivotCfg;
  } catch {
    return {};
  }
}

export function parseCalendar(raw?: string | null): SqlReportCalendarCfg {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as SqlReportCalendarCfg;
  } catch {
    return {};
  }
}

export function parseCalcColumns(raw?: string | null): SqlReportCalcCol[] {
  return parseJsonArray<SqlReportCalcCol>(raw)
    .map((c) => ({ name: (c.name || '').trim(), expression: (c.expression || '').trim() }))
    .filter((c) => c.name && c.expression);
}

export function parseCondRules(raw?: string | null): SqlReportCondRule[] {
  return parseJsonArray<SqlReportCondRule>(raw)
    .map((r) => ({
      col: r.col || '',
      op: (r.op || 'eq').toLowerCase(),
      value: r.value ?? '',
      bg: r.bg || '#fef3c7',
      fg: r.fg || '#92400e',
    }))
    .filter((r) => r.col);
}

export function parseAuxQueries(raw?: string | null): SqlReportAuxQueryDef[] {
  return parseJsonArray<SqlReportAuxQueryDef>(raw)
    .map((a, i) => ({
      key: (a.key || `aux_${i + 1}`).trim(),
      label: a.label || a.key || `Aux ${i + 1}`,
      query: a.query || '',
    }))
    .filter((a) => a.query.trim());
}

function aggValues(vals: number[], type: string): number {
  if (!vals.length) return 0;
  if (type === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (type === 'min') return Math.min(...vals);
  if (type === 'max') return Math.max(...vals);
  if (type === 'count') return vals.length;
  return vals.reduce((a, b) => a + b, 0);
}

export interface PivotTable {
  rowKeys: string[];
  colKeys: string[];
  cells: Map<string, number>;
  rowTotals: Map<string, number>;
  colTotals: Map<string, number>;
  grandTotal: number;
}

export function buildPivot(rows: Record<string, unknown>[], cfg: SqlReportPivotCfg): PivotTable | null {
  const rf = cfg.row_field || '';
  const cf = cfg.col_field || '';
  const vf = cfg.val_field || '';
  if (!rf || !cf) return null;

  const agg = (cfg.agg_type || 'sum').toLowerCase();
  const buckets = new Map<string, number[]>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const row of rows) {
    const rk = String(cell(row, rf) ?? '').trim() || '(boş)';
    const ck = String(cell(row, cf) ?? '').trim() || '(boş)';
    rowSet.add(rk);
    colSet.add(ck);
    const key = `${rk}\0${ck}`;
    let n = 1;
    if (vf) {
      const parsed = parseNumber(cell(row, vf));
      n = Number.isNaN(parsed) ? 0 : parsed;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(agg === 'count' ? 1 : n);
  }

  const rowKeys = [...rowSet].sort((a, b) => a.localeCompare(b, 'tr'));
  const colKeys = [...colSet].sort((a, b) => a.localeCompare(b, 'tr'));
  const cells = new Map<string, number>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grandTotal = 0;

  for (const rk of rowKeys) {
    let rt = 0;
    for (const ck of colKeys) {
      const vals = buckets.get(`${rk}\0${ck}`) || [];
      const v = aggValues(vals, agg);
      cells.set(`${rk}\0${ck}`, v);
      rt += v;
      colTotals.set(ck, (colTotals.get(ck) || 0) + v);
    }
    rowTotals.set(rk, rt);
    grandTotal += rt;
  }

  return { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal };
}

export interface CalendarEvent {
  dateKey: string;
  title: string;
  description: string;
  color: string;
  row: Record<string, unknown>;
}

export function buildCalendarEvents(
  rows: Record<string, unknown>[],
  cfg: SqlReportCalendarCfg,
): CalendarEvent[] {
  const dateCol = cfg.date_column || '';
  if (!dateCol) return [];
  const titleCol = cfg.title_column || '';
  const descCol = cfg.description_column || '';
  const color = cfg.color || '#3b82f6';
  const out: CalendarEvent[] = [];

  for (const row of rows) {
    const raw = cell(row, dateCol);
    if (raw == null || raw === '') continue;
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) continue;
    const dateKey = d.toISOString().slice(0, 10);
    out.push({
      dateKey,
      title: titleCol ? String(cell(row, titleCol) ?? '') : dateKey,
      description: descCol ? String(cell(row, descCol) ?? '') : '',
      color,
      row,
    });
  }
  return out;
}

export function matchCondRule(row: Record<string, unknown>, rule: SqlReportCondRule): boolean {
  const raw = cell(row, rule.col);
  const a = String(raw ?? '').trim();
  const b = String(rule.value ?? '').trim();
  const an = parseNumber(raw);
  const bn = parseNumber(b);
  const bothNum = !Number.isNaN(an) && !Number.isNaN(bn);

  switch (rule.op) {
    case 'neq':
      return bothNum ? an !== bn : a.toLowerCase() !== b.toLowerCase();
    case 'gt':
      return bothNum && an > bn;
    case 'gte':
      return bothNum && an >= bn;
    case 'lt':
      return bothNum && an < bn;
    case 'lte':
      return bothNum && an <= bn;
    case 'contains':
      return a.toLowerCase().includes(b.toLowerCase());
    case 'eq':
    default:
      return bothNum ? an === bn : a.toLowerCase() === b.toLowerCase();
  }
}

export function cellStyleForRules(
  row: Record<string, unknown>,
  col: string,
  rules: SqlReportCondRule[],
): { backgroundColor?: string; color?: string } | undefined {
  for (const rule of rules) {
    if (rule.col.toLowerCase() !== col.toLowerCase()) continue;
    if (!matchCondRule(row, rule)) continue;
    return { backgroundColor: rule.bg, color: rule.fg };
  }
  return undefined;
}

/** Basit pattern: d.m.Y / Y-m-d · sayı için #.###0,## (TR) */
function applyPattern(val: unknown, format: string, pattern?: string): string | null {
  const p = (pattern || '').trim();
  if (!p) return null;
  const f = format.toLowerCase();
  if (f === 'date') {
    const d = new Date(String(val));
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate());
    const mm = String(d.getMonth() + 1);
    const yyyy = String(d.getFullYear());
    return p
      .replace(/Y/g, yyyy)
      .replace(/m/g, mm.padStart(2, '0'))
      .replace(/d/g, dd.padStart(2, '0'));
  }
  if (f === 'number' || f === 'currency' || f === 'percent' || f === 'decimal' || f === 'money') {
    const n = parseNumber(val);
    if (Number.isNaN(n)) return null;
    const abs = Math.abs(n);
    // #.###0,## → binlik . ondalık ,
    if (p.includes(',') || p.includes('#')) {
      const decPart = p.split(',')[1] || '';
      const decimals = (decPart.match(/0|#/g) || []).length;
      let s = abs.toLocaleString('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      if (f === 'currency') s = `${s} ₺`;
      if (f === 'percent') s = `%${s}`;
      return n < 0 ? `-${s}` : s;
    }
  }
  return null;
}

export function formatCellValue(val: unknown, format?: string, pattern?: string): string {
  if (val == null) return '';
  const f = (format || 'text').toLowerCase();
  const patterned = applyPattern(val, f, pattern);
  if (patterned != null) return patterned;
  if (f === 'number' || f === 'decimal') {
    const n = parseNumber(val);
    if (Number.isNaN(n)) return String(val);
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  }
  if (f === 'currency' || f === 'money') {
    const n = parseNumber(val);
    if (Number.isNaN(n)) return String(val);
    return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
  }
  if (f === 'percent' || f === 'pct') {
    const n = parseNumber(val);
    if (Number.isNaN(n)) return String(val);
    return `%${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  }
  if (f === 'date') {
    const d = new Date(String(val));
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('tr-TR');
  }
  return String(val);
}

export function guessNumericColumns(columns: string[], rows: Record<string, unknown>[]): string[] {
  return columns.filter((c) => {
    let hits = 0;
    let checked = 0;
    for (const row of rows.slice(0, 40)) {
      const v = cell(row, c);
      if (v == null || v === '') continue;
      checked++;
      if (!Number.isNaN(parseNumber(v))) hits++;
    }
    return checked > 0 && hits / checked >= 0.7;
  });
}
