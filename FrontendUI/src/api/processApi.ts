import { API_BASE, apiJson } from '../config/api';

export interface ProcessStep {
  processStepID: number;
  processDefID: number;
  stepNo: number;
  code: string;
  title: string;
  approverRoleId?: number | null;
  approverUserId?: number | null;
  actionType: string;
  nodeType?: string;
  configJson?: string | null;
  nextStepOnOk?: number | null;
  nextStepOnFail?: number | null;
  isActive: boolean;
  approverRoleName?: string | null;
}

export interface ProcessDef {
  processDefID: number;
  code: string;
  name: string;
  description?: string | null;
  triggerType: number;
  sourceTable?: string | null;
  targetTable?: string | null;
  isActive: boolean;
  sortOrder: number;
  category?: string | null;
  triggerConfigJson?: string | null;
  steps: ProcessStep[];
}

export interface ProcessInstance {
  processInstanceID: number;
  processDefID: number;
  processCode: string;
  processName: string;
  status: string;
  sourceTable: string;
  sourceId: number;
  targetTable?: string | null;
  targetId?: number | null;
  title?: string | null;
  currentStepNo: number;
  startedBy?: number | null;
  startedAt: string;
  completedAt?: string | null;
  lastComment?: string | null;
  /** belge, cari, adres, satir */
  dataJson?: string | null;
}

export interface ProcessTask {
  processTaskID: number;
  processInstanceID: number;
  processStepID: number;
  status: string;
  assignedRoleId?: number | null;
  assignedUserId?: number | null;
  claimedBy?: number | null;
  dueAt?: string | null;
  completedBy?: number | null;
  completedAt?: string | null;
  comment?: string | null;
  createdAt: string;
  stepTitle?: string | null;
  stepCode?: string | null;
  actionType?: string | null;
  processCode?: string | null;
  processName?: string | null;
  instanceTitle?: string | null;
  instanceStatus?: string | null;
  sourceTable?: string | null;
  sourceId?: number | null;
  targetTable?: string | null;
  targetId?: number | null;
  hasPdf?: boolean;
  documentNo?: string | null;
  customerTitle?: string | null;
  amount?: number | null;
}

export interface ProcessDocLink {
  processDocLinkID: number;
  processInstanceID?: number | null;
  linkType: string;
  fromTable: string;
  fromId: number;
  toTable: string;
  toId: number;
  note?: string | null;
  createdAt: string;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export async function listProcessDefs(includeInactive = true): Promise<ProcessDef[]> {
  const data = await apiJson<unknown>(`/api/process/defs?includeInactive=${includeInactive ? 'true' : 'false'}`);
  return unwrapList<ProcessDef>(data);
}

export interface ProcessSourceTest {
  ok: boolean;
  message: string;
  databases?: string[];
}

export async function testProcessSource(cfg: Record<string, unknown>): Promise<ProcessSourceTest> {
  return apiJson<ProcessSourceTest>('/api/process/source/test', {
    method: 'POST',
    body: JSON.stringify(cfg),
  });
}

export async function previewProcessSource(cfg: Record<string, unknown>): Promise<string[]> {
  const data = await apiJson<{ columns?: string[] }>('/api/process/source/columns', {
    method: 'POST',
    body: JSON.stringify(cfg),
  });
  return data.columns ?? [];
}

export async function describeProcessSelect(sql: string): Promise<string[]> {
  const data = await apiJson<{ columns?: string[] }>('/api/process/columns', {
    method: 'POST',
    body: JSON.stringify({ sql }),
  });
  return data.columns ?? [];
}

export async function runProcessScans(defId?: number): Promise<{ started: number; skipped: number; messages: string[] }> {
  const q = defId ? `?defId=${defId}` : '';
  return apiJson(`/api/process/scan${q}`, { method: 'POST' });
}

export async function deleteProcessDef(id: number): Promise<void> {
  await apiJson(`/api/process/defs/${id}`, { method: 'DELETE' });
}

export async function saveProcessDef(def: ProcessDef): Promise<ProcessDef> {
  return apiJson<ProcessDef>('/api/process/defs', {
    method: 'POST',
    body: JSON.stringify(def),
  });
}

export async function listProcessInstances(status?: string): Promise<ProcessInstance[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const data = await apiJson<unknown>(`/api/process/instances${q}`);
  return unwrapList<ProcessInstance>(data);
}

export async function listProcessInbox(userId: number): Promise<ProcessTask[]> {
  const data = await apiJson<unknown>(`/api/process/inbox?userId=${userId}`);
  return unwrapList<ProcessTask>(data);
}

export async function approveProcessTask(taskId: number, userId: number, comment?: string): Promise<ProcessTask> {
  return apiJson<ProcessTask>(`/api/process/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ userId, comment }),
  });
}

export async function rejectProcessTask(taskId: number, userId: number, comment?: string): Promise<ProcessTask> {
  return apiJson<ProcessTask>(`/api/process/tasks/${taskId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ userId, comment }),
  });
}

export async function startProcess(body: {
  processCode: string;
  sourceTable: string;
  sourceId: number;
  targetTable?: string;
  targetId?: number;
  title?: string;
  startedBy?: number;
}): Promise<ProcessInstance> {
  return apiJson<ProcessInstance>('/api/process/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function startProcessByTrigger(body: {
  triggerType: number;
  sourceTable: string;
  sourceId: number;
  targetTable?: string;
  targetId?: number;
  title?: string;
  startedBy?: number;
  context?: Record<string, string | null | undefined>;
}): Promise<{ ok: boolean; count: number; items: ProcessInstance[] }> {
  return apiJson('/api/process/start-by-trigger', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function transferTalep(body: {
  talepOrderVoucherId: number;
  startedBy?: number;
  comment?: string;
  requireApproval?: boolean;
}): Promise<{ ok: boolean; orderVoucherId: number; processInstance?: ProcessInstance }> {
  return apiJson('/api/process/transfer-talep', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function linkEgov(body: {
  eGovDocumentId: number;
  orderVoucherId: number;
  startedBy?: number;
  comment?: string;
  startProcess?: boolean;
}): Promise<{ ok: boolean; processInstance?: ProcessInstance }> {
  return apiJson('/api/process/link-egov', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function uploadEgovPdf(egovId: number, file: File): Promise<{ ok: boolean; fileName: string; size: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/process/egov/${egovId}/pdf`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || 'PDF yüklenemedi');
  }
  return data as { ok: boolean; fileName: string; size: number };
}

export function egovPdfUrl(egovId: number): string {
  return `${API_BASE}/api/process/egov/${egovId}/pdf`;
}

export async function listProcessLinks(table?: string, id?: number): Promise<ProcessDocLink[]> {
  const params = new URLSearchParams();
  if (table) params.set('table', table);
  if (id != null) params.set('id', String(id));
  const q = params.toString() ? `?${params}` : '';
  const data = await apiJson<unknown>(`/api/process/links${q}`);
  return unwrapList<ProcessDocLink>(data);
}
