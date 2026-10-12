import { apiJson, API_BASE } from '../config/api';

export interface EFaturaMukellefRow {
  eFaturaMukellefID: number;
  taxNr: string;
  title?: string | null;
  alias: string;
  aliasType?: string | null;
  unitType?: string | null;
  firstCreateDate?: string | null;
  isActive: boolean;
}

export interface EFaturaMukellefQueryResult {
  taxNr: string;
  found: boolean;
  message: string;
  title?: string | null;
  rows: EFaturaMukellefRow[];
  suggestedPostLabel?: string | null;
  suggestedSenderLabel?: string | null;
  suggestedUnitType?: string | null;
  localListCount?: number;
  source?: string;
  checkedExternal?: boolean;
  externalMessage?: string | null;
  lastSyncAt?: string | null;
}

export interface EFaturaMukellefImportResult {
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
  skipped: number;
  totalLines: number;
}

export interface GibSyncOutcome {
  success: boolean;
  message: string;
  pkImported: number;
  gbImported: number;
  totalLocal: number;
}

export interface EFaturaMukellefSyncStatus {
  localCount: number;
  lastSyncAt?: string | null;
  lastSyncTotal?: number | null;
  lastSyncMessage?: string | null;
  authoritative: boolean;
  cacheDirectory?: string;
}

export async function queryEFaturaMukellef(
  taxNr: string,
  checkExternal = true,
): Promise<EFaturaMukellefQueryResult> {
  const q = new URLSearchParams({
    taxNr: taxNr.trim(),
    checkExternal: String(checkExternal),
  });
  return apiJson<EFaturaMukellefQueryResult>(`/api/efatura-mukellef?${q}`);
}

export interface IntegratorMukellefCheckBody {
  taxNr: string;
  integratorName?: string;
  integratorWsUrl?: string;
  integratorUser?: string;
  integratorPassword?: string;
  integratorVkN?: string;
}

/** Firma entegrasyon bilgileri ile mükellef kontrolü (e-Logo CheckGibUser) */
export async function checkEFaturaMukellefViaIntegrator(
  body: IntegratorMukellefCheckBody,
): Promise<EFaturaMukellefQueryResult> {
  return apiJson<EFaturaMukellefQueryResult>(`/api/efatura-mukellef/check-integrator`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function syncEFaturaMukellefFromGib(): Promise<GibSyncOutcome> {
  return apiJson<GibSyncOutcome>(`/api/efatura-mukellef/sync`, { method: 'POST' });
}

export async function getEFaturaMukellefSyncStatus(): Promise<EFaturaMukellefSyncStatus> {
  return apiJson<EFaturaMukellefSyncStatus>(`/api/efatura-mukellef/sync-status`);
}

export async function upsertEFaturaMukellef(body: {
  taxNr: string;
  title?: string;
  alias: string;
  aliasType?: string;
  unitType?: string;
  isActive?: boolean;
}): Promise<{ success: boolean; message: string; id: number }> {
  return apiJson(`/api/efatura-mukellef`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taxNr: body.taxNr,
      title: body.title ?? null,
      alias: body.alias,
      aliasType: body.aliasType ?? null,
      unitType: body.unitType ?? 'e-Fatura',
      isActive: body.isActive ?? true,
    }),
  });
}

export async function importEFaturaMukellefCsv(file: File): Promise<EFaturaMukellefImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/efatura-mukellef/import-csv`, {
    method: 'POST',
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as EFaturaMukellefImportResult & {
    message?: string;
  };
  if (!res.ok) {
    throw new Error(data.message || `CSV içe aktarma başarısız (${res.status})`);
  }
  return data;
}
