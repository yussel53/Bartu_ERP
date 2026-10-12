/** Raporlama PHP projesine bağlantı — .env ile override edilebilir */
export const RAPORLAMA_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_RAPORLAMA_URL ||
  'http://localhost/Raporlama';

export function raporlamaUrl(path = ''): string {
  const base = RAPORLAMA_BASE_URL.replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return p ? `${base}/${p}` : base;
}
