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
