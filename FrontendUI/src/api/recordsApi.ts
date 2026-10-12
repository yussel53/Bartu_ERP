import { apiJson } from '../config/api';
import type { DynamicFormDataDto } from '../types/formTypes';

export interface RecordListResult {
  tableName: string;
  primaryKeyColumn: string;
  total: number;
  rows: Record<string, unknown>[];
  warning?: string | null;
}

export interface RecordGetResult {
  tableName: string;
  primaryKeyColumn: string;
  recordId: number;
  standardFields: Record<string, unknown>;
  additionalFields: Record<string, unknown>;
  addresses?: Record<string, unknown>[];
  contacts?: Record<string, unknown>[];
  accounts?: Record<string, unknown>[];
  barcodes?: Record<string, unknown>[];
  unitConvs?: Record<string, unknown>[];
  productSubs?: Record<string, unknown>[];
  customerAliases?: Record<string, unknown>[];
  variants?: Record<string, unknown>[];
  accountLinks?: Record<string, unknown>[];
  lines?: Record<string, unknown>[];
  workplaces?: Record<string, unknown>[];
  whouses?: Record<string, unknown>[];
  paymentPlans?: Record<string, unknown>[];
  distributions?: Record<string, unknown>[];
  auxilCodes?: Record<string, unknown>[];
  auxilValues?: Record<string, unknown>[];
}

export async function listRecords(
  tableName: string,
  opts?: {
    pk?: string;
    filterColumn?: string;
    filterValue?: string | number;
    take?: number;
  },
): Promise<RecordListResult> {
  const q = new URLSearchParams();
  if (opts?.pk) q.set('pk', opts.pk);
  if (opts?.filterColumn) q.set('filterColumn', opts.filterColumn);
  if (opts?.filterValue != null) q.set('filterValue', String(opts.filterValue));
  if (opts?.take) q.set('take', String(opts.take));
  const qs = q.toString();
  return apiJson<RecordListResult>(`/api/records/${encodeURIComponent(tableName)}${qs ? `?${qs}` : ''}`);
}

export async function getRecord(
  tableName: string,
  id: number,
  pk?: string,
): Promise<RecordGetResult> {
  const qs = pk ? `?pk=${encodeURIComponent(pk)}` : '';
  return apiJson<RecordGetResult>(`/api/records/${encodeURIComponent(tableName)}/${id}${qs}`);
}

export async function saveRecord(
  tableName: string,
  data: DynamicFormDataDto,
  opts?: {
    pk?: string;
    formCode?: string;
    postSave?: { type: 'sql' | 'api'; command: string; title?: string }[];
  },
): Promise<{
  success: boolean;
  recordId: number;
  message: string;
  postSave?: { type: string; title: string; success: boolean; message: string }[];
  postSaveOk?: boolean;
}> {
  const qs = opts?.pk ? `?pk=${encodeURIComponent(opts.pk)}` : '';
  return apiJson(`/api/records/${encodeURIComponent(tableName)}${qs}`, {
    method: 'POST',
    body: JSON.stringify({
      recordId: data.recordId ?? 0,
      standardFields: data.standardFields || {},
      additionalFields: data.additionalFields || {},
      addresses: data.addresses,
      contacts: data.contacts,
      accounts: data.accounts,
      barcodes: data.barcodes,
      unitConvs: data.unitConvs,
      productSubs: data.productSubs,
      customerAliases: data.customerAliases,
      variants: data.variants,
      accountLinks: data.accountLinks,
      lines: data.lines,
      workplaces: data.workplaces,
      whouses: data.whouses,
      paymentPlans: data.paymentPlans,
      distributions: data.distributions,
      auxilCodes: data.auxilCodes,
      auxilValues: data.auxilValues,
      formCode: opts?.formCode,
      postSave: opts?.postSave,
    }),
  });
}

export async function deleteRecord(
  tableName: string,
  id: number,
  pk?: string,
): Promise<{ success: boolean; message: string }> {
  const qs = pk ? `?pk=${encodeURIComponent(pk)}` : '';
  return apiJson(`/api/records/${encodeURIComponent(tableName)}/${id}${qs}`, {
    method: 'DELETE',
  });
}
