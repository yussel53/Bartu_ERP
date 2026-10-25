import { API_BASE, ApiError, apiJson } from '../config/api';

export type ImportKind =
  | 'product'
  | 'customer'
  | 'account'
  | 'invoice'
  | 'customer-voucher'
  | 'bank-voucher'
  | 'account-voucher';

export type ImportFieldDef = {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'bool' | 'int' | 'decimal' | 'enum';
  options?: Record<string, string> | null;
  aliases: string[];
  hint?: string | null;
  sample?: string | null;
  additional: boolean;
  special: boolean;
  /** false ise şablon seçicisinde baştan kapalı */
  defaultOn?: boolean;
};

export type ImportTargetDef = {
  kind: ImportKind;
  title: string;
  tableName: string;
  primaryKey: string;
  notes: string[];
  fields: ImportFieldDef[];
};

export type ParsedSheet = {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  truncated: boolean;
};

export type ImportMode = 'upsert' | 'insert' | 'update';

export type ImportApplyRequest = {
  rows: Record<string, string>[];
  mode: ImportMode;
  dryRun: boolean;
  productType?: number;
  accountPrefixParent?: boolean;
  createMissingCards?: boolean;
  fileName?: string;
  importedBy?: string;
  afterSql?: string;
  source?: ImportSourceRequest;
  sourceRows?: Record<string, string>[];
};

export type ImportRowResult = {
  rowNo: number;
  code: string;
  action: 'insert' | 'update' | 'skip' | 'error';
  message?: string | null;
  recordId?: number | null;
};

export type ImportApplyResult = {
  dryRun: boolean;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  rowsTruncated?: boolean;
  afterUpdated?: number;
  afterFailed?: number;
  afterError?: string | null;
  rows: ImportRowResult[];
};

/** Dapper dynamic satır — alan adları SQL kolonlarıyla aynı (PascalCase) */
export type ImportLogRow = {
  ImportLogID: number;
  Kind: ImportKind;
  TableName: string;
  FileName?: string | null;
  Mode?: string | null;
  TotalRows: number;
  Inserted: number;
  Updated: number;
  Skipped: number;
  Failed: number;
  ImportedBy?: string | null;
  ImportedAt: string;
};

export type ImportSourceDef = {
  id: string;
  title: string;
  note: string;
  headers: Record<string, Record<string, string>>;
};

export const fetchImportTargets = () => apiJson<ImportTargetDef[]>('/api/import/targets');

export const fetchImportSources = () => apiJson<ImportSourceDef[]>('/api/import/sources');

export const sourceHeader = (source: ImportSourceDef | null, kind: string, field: ImportFieldDef) =>
  source?.headers?.[kind]?.[field.key] || field.label;

export async function parseImportFile(file: File, kind?: ImportKind): Promise<ParsedSheet> {
  const form = new FormData();
  form.append('file', file);
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const res = await fetch(`${API_BASE}/api/import/parse${q}`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message || res.statusText || 'Dosya okunamadı';
    throw new ApiError(msg, res.status, data);
  }
  return data as ParsedSheet;
}

export const applyImport = (kind: ImportKind, req: ImportApplyRequest) =>
  apiJson<ImportApplyResult>(`/api/import/${kind}/apply`, {
    method: 'POST',
    body: JSON.stringify(req),
  });

export const importTemplateUrl = (kind: ImportKind, source = 'bartu', fields?: string[]) => {
  const q = new URLSearchParams({ source });
  if (fields && fields.length) q.set('fields', fields.join(','));
  return `${API_BASE}/api/import/${kind}/template?${q.toString()}`;
};

export const fetchImportHistory = (take = 30, profileId?: number) =>
  apiJson<ImportLogRow[]>(`/api/import/history?take=${take}${profileId ? `&profileId=${profileId}` : ''}`);

export const setImportProfileLog = (id: number, keepLog: boolean) =>
  apiJson<{ ok: boolean }>(`/api/import/profiles/${id}/log`, {
    method: 'POST',
    body: JSON.stringify({ keepLog }),
  });

export const fetchImportFields = (kind: ImportKind) => apiJson<ImportFieldDef[]>(`/api/import/${kind}/fields`);

export type ImportMapItem = { header: string; field: string };

export type ImportSourceRequest = {
  sourceType: number;
  sql?: string;
  server?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
  windowsAuth?: boolean;
  trustCertificate?: boolean;
  apiUrl?: string;
  apiMethod?: string;
  apiHeaders?: string;
  jsonPath?: string;
  body?: string;
};

export type ImportProfile = {
  importProfileID: number;
  title: string;
  kind: ImportKind;
  sourceKind: number;
  source: ImportSourceRequest;
  map: ImportMapItem[];
  mode: ImportMode;
  createMissingCards: boolean;
  productType?: number | null;
  intervalMinutes?: number | null;
  isActive: boolean;
  processDefID?: number | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: string | null;
  afterSql?: string | null;
  keepLog?: boolean;
  hasPassword?: boolean;
};

export const fetchImportProfiles = () => apiJson<ImportProfile[]>('/api/import/profiles');

export const saveImportProfile = (body: Partial<ImportProfile> & { title: string; kind: ImportKind; sourceKind: number }) =>
  apiJson<ImportProfile>('/api/import/profiles', { method: 'POST', body: JSON.stringify(body) });

export const deleteImportProfile = (id: number) =>
  apiJson<{ ok: boolean }>(`/api/import/profiles/${id}`, { method: 'DELETE' });

export const runImportProfile = (id: number, dryRun: boolean) =>
  apiJson<ImportApplyResult>(`/api/import/profiles/${id}/run?dryRun=${dryRun}`, { method: 'POST', body: '{}' });

export const testImportSource = (body: ImportSourceRequest) =>
  apiJson<{ ok: boolean; message: string; databases?: string[] }>('/api/import/source/test', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchImportSourceColumns = (body: ImportSourceRequest) =>
  apiJson<string[]>('/api/import/source/columns', { method: 'POST', body: JSON.stringify(body) });

export const fetchImportSourceRows = (body: ImportSourceRequest) =>
  apiJson<{ headers: string[]; rows: string[][] }>('/api/import/source/rows', { method: 'POST', body: JSON.stringify(body) });
