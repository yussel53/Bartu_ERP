import { apiJson } from '../config/api';

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isAdmin: boolean;
  isActive: boolean;
  authConfigJson?: string | null;
  sortOrder: number;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface RoleSave {
  code: string;
  name: string;
  description?: string;
  isAdmin: boolean;
  isActive: boolean;
  authConfigJson?: string;
  sortOrder: number;
}

export interface UserRoleAssignment {
  systemUserId: number;
  nickName?: string | null;
  displayName?: string | null;
  roleIds: number[];
  roles: Role[];
}

export interface EffectiveAuth {
  systemUserId: number;
  isAdmin: boolean;
  roles: Role[];
  authConfigJson: string;
}

export async function listRoles(): Promise<Role[]> {
  return apiJson<Role[]>('/api/roles');
}

export async function getRole(id: number): Promise<Role> {
  return apiJson<Role>(`/api/roles/${id}`);
}

export async function createRole(dto: RoleSave): Promise<Role> {
  return apiJson<Role>('/api/roles', { method: 'POST', body: JSON.stringify(dto) });
}

export async function updateRole(id: number, dto: RoleSave): Promise<Role> {
  return apiJson<Role>(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(dto) });
}

export async function deleteRole(id: number): Promise<void> {
  await apiJson(`/api/roles/${id}`, { method: 'DELETE' });
}

export async function getUserRoles(userId: number): Promise<UserRoleAssignment> {
  return apiJson<UserRoleAssignment>(`/api/roles/by-user/${userId}`);
}

export async function saveUserRoles(userId: number, roleIds: number[]): Promise<UserRoleAssignment> {
  return apiJson<UserRoleAssignment>(`/api/roles/by-user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  });
}

export async function getEffectiveAuth(userId: number): Promise<EffectiveAuth> {
  return apiJson<EffectiveAuth>(`/api/roles/effective/${userId}`);
}
