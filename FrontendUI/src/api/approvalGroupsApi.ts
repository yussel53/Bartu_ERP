import { apiJson } from '../config/api';

/** Onay grupları — api/approval-groups (SqlUpdates/78_approval_groups.sql) */

export interface ApprovalGroupMember {
  systemUserID: number;
  nickName?: string | null;
  fullName?: string | null;
}

export interface ApprovalGroup {
  approvalGroupID: number;
  code: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  openTaskCount: number;
  members: ApprovalGroupMember[];
}

export interface ApprovalGroupInput {
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  memberUserIds: number[];
}

export interface SystemUserOption {
  systemUserID: number;
  nickName?: string | null;
  fullName?: string | null;
  isActive: boolean;
}

type Result = { success: boolean; message: string; id?: number };

export function listApprovalGroups(activeOnly = false): Promise<{ ready: boolean; message?: string; rows: ApprovalGroup[] }> {
  return apiJson(`/api/approval-groups${activeOnly ? '?activeOnly=true' : ''}`);
}

export function listApprovalUsers(): Promise<SystemUserOption[]> {
  return apiJson('/api/approval-groups/users');
}

export function saveApprovalGroup(id: number | null, body: ApprovalGroupInput): Promise<Result> {
  return id
    ? apiJson(`/api/approval-groups/${id}`, { method: 'PUT', body: JSON.stringify(body) })
    : apiJson('/api/approval-groups', { method: 'POST', body: JSON.stringify(body) });
}

export function setDefaultApprovalGroup(id: number): Promise<Result> {
  return apiJson(`/api/approval-groups/${id}/default`, { method: 'POST' });
}

export function deleteApprovalGroup(id: number): Promise<Result> {
  return apiJson(`/api/approval-groups/${id}`, { method: 'DELETE' });
}

export const memberLabel = (m: { fullName?: string | null; nickName?: string | null; systemUserID: number }) =>
  m.fullName?.trim() || m.nickName || `Kullanıcı #${m.systemUserID}`;
