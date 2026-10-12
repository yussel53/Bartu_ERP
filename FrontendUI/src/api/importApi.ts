import { API_BASE, ApiError, apiJson } from '../config/api';

export type ImportKind = 'product' | 'customer' | 'account';

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
  fileName?: string;
  importedBy?: string;
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

export const fetchImportTargets = () => apiJson<ImportTargetDef[]>('/api/import/targets');

export async function parseImportFile(file: File): Promise<ParsedSheet> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/import/parse`, { method: 'POST', body: form });
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

export const importTemplateUrl = (kind: ImportKind) => `${API_BASE}/api/import/${kind}/template`;

export const fetchImportHistory = (take = 30) => apiJson<ImportLogRow[]>(`/api/import/history?take=${take}`);
