import { apiJson } from '../config/api';

export interface FormLayoutAssign {
  /** 1 kullanıcı · 2 rol */
  scopeType: 1 | 2;
  scopeKey: string;
}

export interface FormLayoutRow {
  layoutID: number;
  formCode: string;
  name: string;
  layoutJson: string;
  isDefault: boolean;
  isActive?: boolean;
  createdBy?: string | null;
  updatedAt?: string | null;
  assigns: FormLayoutAssign[];
}

export interface FormLayoutResolve {
  ready: boolean;
  layouts: FormLayoutRow[];
  preferredId?: number | null;
}

export async function resolveFormLayouts(
  formCode: string,
  user: { userId: string; roleIds?: number[]; isAdmin?: boolean },
): Promise<FormLayoutResolve> {
  const q = new URLSearchParams({ formCode, userId: user.userId });
  if (user.roleIds?.length) q.set('roleIds', user.roleIds.join(','));
  if (user.isAdmin) q.set('isAdmin', 'true');
  return apiJson<FormLayoutResolve>(`/api/form-layouts/resolve?${q.toString()}`);
}

export async function saveFormLayout(row: Omit<FormLayoutRow, 'layoutID'> & { layoutID?: number }): Promise<number> {
  const r = await apiJson<{ id: number }>('/api/form-layouts', {
    method: 'POST',
    body: JSON.stringify({ ...row, layoutID: row.layoutID ?? 0 }),
  });
  return r.id;
}

export async function deleteFormLayout(id: number): Promise<void> {
  await apiJson(`/api/form-layouts/${id}`, { method: 'DELETE' });
}
