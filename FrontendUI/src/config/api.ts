/**
 * Backend API tabanı.
 * Dev'de boş = Vite proxy (`/api` → http://localhost:5205).
 * Üretim / özel adres: VITE_API_URL=http://localhost:5205
 */
export const API_BASE =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL?.replace(/\/$/, '') ??
  '';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const o = data as { message?: unknown };
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
    if (Array.isArray(data)) {
      const failed = data.find(
        (x) => x && typeof x === 'object' && (x as { success?: boolean }).success === false,
      ) as { message?: string; scriptName?: string } | undefined;
      if (failed?.message) {
        return failed.scriptName ? `${failed.scriptName}: ${failed.message}` : failed.message;
      }
    }
  }
  return fallback || 'İstek başarısız';
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data, res.statusText), res.status, data);
  }
  return data as T;
}
