import { apiJson } from '../config/api';

/** Oturumdaki kullanıcı — api/auth/me */
export interface AuthUser {
  userId: number;
  userName: string;
  displayName: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
}

export function getAuthStatus(): Promise<{ dbReady: boolean; needsSetup: boolean; message?: string }> {
  return apiJson('/api/auth/status');
}

export function getMe(): Promise<AuthUser> {
  return apiJson<AuthUser>('/api/auth/me');
}

export function login(userName: string, password: string, remember: boolean): Promise<{ user: AuthUser }> {
  return apiJson('/api/auth/login', { method: 'POST', body: JSON.stringify({ userName, password, remember }) });
}

/** İlk kurulum: Admin kullanıcıya şifre ver */
export function setupAdmin(userName: string, password: string): Promise<{ user: AuthUser }> {
  return apiJson('/api/auth/setup', { method: 'POST', body: JSON.stringify({ userName, password, remember: false }) });
}

export function logout(): Promise<unknown> {
  return apiJson('/api/auth/logout', { method: 'POST' });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiJson('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
