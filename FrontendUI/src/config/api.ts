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
  // Bilinmeyen API adresine eski sunucu SPA sayfasını (HTML) 200 ile döndürebilir — sessizce {} kabul etme
  if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
    throw new ApiError(
      `Sunucu bu işlemi tanımıyor (${path.split('?')[0]}) — backend güncel değil olabilir.`,
      404,
      null,
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data, res.statusText), res.status, data);
  }
  return data as T;
}

/** Oturum süresi doldu: AuthGate bu olayla giriş penceresini açar */
export const AUTH_REQUIRED_EVENT = 'bartu:auth-required';

let refreshing: Promise<boolean> | null = null;

/**
 * Tüm /api isteklerinde (fetch, apiJson, indirme): 401 gelirse yenileme anahtarıyla bir kez oturum
 * yenilenir ve istek tekrarlanır; olmazsa giriş penceresi istenir. Erişim anahtarı HttpOnly çerezdedir.
 */
export function installAuthFetch(): void {
  const w = window as Window & { __bartuAuthFetch?: boolean };
  if (w.__bartuAuthFetch) return;
  w.__bartuAuthFetch = true;
  const orig = window.fetch.bind(window);

  const tryRefresh = () => {
    refreshing ??= orig(`${API_BASE}/api/auth/refresh`, { method: 'POST' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
    return refreshing;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input, init);
    if (res.status !== 401) return res;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/api/') || url.includes('/api/auth/')) return res;
    if (await tryRefresh()) return orig(input, init);
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    return res;
  };
}
