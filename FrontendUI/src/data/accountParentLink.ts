/** Hesap kodundan üst hesap kodu: son '.' öncesi (100.01 → 100, 100.01.02 → 100.01). */
export function parentAccountCode(code: string | null | undefined): string | null {
  const c = String(code ?? '').trim();
  if (!c) return null;
  const i = c.lastIndexOf('.');
  if (i <= 0) return null;
  const parent = c.slice(0, i).trim();
  return parent || null;
}

export function accountCodeHasParentDot(code: string | null | undefined): boolean {
  return parentAccountCode(code) != null;
}

/**
 * AccountCard.Type_ — koda göre seviye:
 * 1 Bilanço (1, 10) · 2 Ana (100) · 3 Alt (100.01) · 4 Detay (100.01.001)
 */
export const ACCOUNT_TYPE = {
  Bilanco: '1',
  Ana: '2',
  Alt: '3',
  Detay: '4',
} as const;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  '1': 'Bilanço Hesabı',
  '2': 'Ana Hesap',
  '3': 'Alt Hesap',
  '4': 'Detay Hesap',
};

export function inferAccountType(code: string | null | undefined): string {
  const c = String(code ?? '').trim();
  if (!c) return ACCOUNT_TYPE.Ana;
  const parts = c.split('.').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return ACCOUNT_TYPE.Detay;
  if (parts.length === 2) return ACCOUNT_TYPE.Alt;
  const head = parts[0] ?? c;
  if (/^\d{1,2}$/.test(head)) return ACCOUNT_TYPE.Bilanco;
  return ACCOUNT_TYPE.Ana;
}

/** Bilanço / Ana → MainAccount bayrağı */
export function isMainAccountType(type: string | number | null | undefined): boolean {
  const t = String(type ?? '').trim();
  return t === ACCOUNT_TYPE.Bilanco || t === ACCOUNT_TYPE.Ana;
}
