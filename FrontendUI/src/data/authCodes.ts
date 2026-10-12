/**
 * Yetki kodu (Logo tarzı):
 * - Kullanıcıda boş → tüm kayıtlar görünür
 * - Kayıtta boş → herkese görünür
 * - Kullanıcı: +A,+B → yalnızca A veya B kodlu (ve boş kodlu) kayıtlar
 * - Kullanıcı: -X → X hariç hepsi
 * - Kayıt türü bazlı satırlar (firma altında Yetki Kodları paneli)
 */

export interface AuthCodeLine {
  id: string;
  /** Tablo / kayıt türü kodu — ProductCard, CustomerCard, … */
  recordType: string;
  /** Örn: +SAT,+PER | -GIZLI | boş */
  authCode: string;
}

/** Logo “Kayıt Türü” listesi */
export const AUTH_RECORD_TYPES: { code: string; label: string }[] = [
  { code: 'ProductCard', label: 'Malzeme Kartları' },
  { code: 'VariantCard', label: 'Varyant Kartları' },
  { code: 'VariantTemplate', label: 'Varyant Şablonları' },
  { code: 'CustomerCard', label: 'Cari Kartlar' },
  { code: 'RiskGroup', label: 'Risk Grupları' },
  { code: 'BankCard', label: 'Banka Kartları' },
  { code: 'BankAccountCard', label: 'Banka Hesapları' },
  { code: 'SafeCard', label: 'Kasa Kartları' },
  { code: 'BoundCard', label: 'Çek / Senet Kartları' },
  { code: 'BoundTrans', label: 'Çek / Senet Fişleri' },
  { code: 'OrderVoucher', label: 'Siparişler' },
  { code: 'ProductVoucher', label: 'Malzeme Fişleri' },
  { code: 'Invoice', label: 'Faturalar' },
  { code: 'BankVoucher', label: 'Banka Fişleri' },
  { code: 'CustomerVoucher', label: 'Cari Fişler' },
  { code: 'PaymentTrans', label: 'Ödeme / Tahsilat' },
  { code: 'AccountCard', label: 'Hesap Kartları' },
  { code: 'AccountVoucher', label: 'Muhasebe Fişleri' },
  { code: 'PersonCard', label: 'Personel Kartları' },
  { code: 'TaxCard', label: 'Vergi Kartları' },
  { code: 'PaidPlanCard', label: 'Ödeme / Tahsilat Planları' },
  { code: 'BankCredit', label: 'Banka Kredileri' },
  { code: 'BankCreditInstallment', label: 'Kredi Taksitleri' },
  { code: 'UnitSet', label: 'Birim Setleri' },
  { code: 'EGovDocument', label: 'e-Fatura / e-Arşiv / e-İrsaliye' },
  { code: 'ELedger', label: 'e-Defter' },
];

export function recordTypeLabel(code: string): string {
  return AUTH_RECORD_TYPES.find((t) => t.code === code)?.label || code;
}

export function parseAuthCodeTokens(raw: string | null | undefined): {
  plus: string[];
  minus: string[];
} {
  const text = (raw || '').trim();
  if (!text) return { plus: [], minus: [] };

  const plus: string[] = [];
  const minus: string[] = [];
  for (const part of text.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean)) {
    if (part.startsWith('+')) {
      const v = part.slice(1).trim().toUpperCase();
      if (v) plus.push(v);
    } else if (part.startsWith('-')) {
      const v = part.slice(1).trim().toUpperCase();
      if (v) minus.push(v);
    } else {
      plus.push(part.toUpperCase());
    }
  }
  return { plus, minus };
}

function recordCodes(recordAuth: string | null | undefined): string[] {
  const text = (recordAuth || '').trim();
  if (!text) return [];
  return text
    .split(/[,;\s]+/)
    .map((p) => p.trim().replace(/^[+-]/, '').toUpperCase())
    .filter(Boolean);
}

/** Kullanıcı bu kaydı listede görebilir mi? */
export function canViewByAuthCode(
  userAuthCode: string | null | undefined,
  recordAuthCode: string | null | undefined,
): boolean {
  const user = (userAuthCode || '').trim();
  if (!user) return true;

  const codes = recordCodes(recordAuthCode);
  if (codes.length === 0) return true;

  const { plus, minus } = parseAuthCodeTokens(user);

  if (minus.some((m) => codes.includes(m))) return false;

  if (plus.length > 0) {
    return plus.some((p) => codes.includes(p));
  }

  return true;
}

/**
 * Firma altındaki satırlar + eski tek alan birleşimi.
 * recordType verilirse önce o tür; yoksa tüm satırlar + legacy.
 */
export function mergeAuthCodeExpression(
  lines: AuthCodeLine[] | null | undefined,
  legacyAuthCode?: string | null,
  recordType?: string | null,
): string {
  const scoped = (lines || []).filter((l) => {
    if (!(l.authCode || '').trim()) return false;
    if (!recordType) return true;
    return l.recordType === recordType;
  });
  const parts = scoped.map((l) => l.authCode.trim());
  const legacy = (legacyAuthCode || '').trim();
  if (!recordType && legacy) parts.push(legacy);
  if (recordType && parts.length === 0 && legacy) parts.push(legacy);
  return parts.join(',');
}

/**
 * Ekran (kart / hareket) bazlı yetki kodu: recordType = menü ekran id'si.
 * Ekran satırı yoksa tablo bazlı eski satır (recordType = tablo adı), o da yoksa genel kod.
 */
export function resolveScreenAuthExpression(
  lines: AuthCodeLine[] | null | undefined,
  legacyAuthCode: string | null | undefined,
  screenId: string,
  tableName?: string | null,
): string {
  const filled = (lines || []).filter((l) => (l.authCode || '').trim());
  const byScreen = filled.filter((l) => l.recordType === screenId);
  if (byScreen.length) return byScreen.map((l) => l.authCode.trim()).join(',');
  if (tableName) {
    const byTable = filled.filter((l) => l.recordType === tableName);
    if (byTable.length) return byTable.map((l) => l.authCode.trim()).join(',');
  }
  return (legacyAuthCode || '').trim();
}

export function filterRowsByAuthCode<T extends Record<string, unknown>>(
  rows: T[],
  userAuthCode: string | null | undefined,
  authFieldKeys: string[] = ['authCode', 'AuthCode', 'yetkiKodu'],
): T[] {
  if (!(userAuthCode || '').trim()) return rows;
  return rows.filter((row) => {
    let recordAuth: unknown;
    for (const k of authFieldKeys) {
      if (row[k] != null && String(row[k]).trim() !== '') {
        recordAuth = row[k];
        break;
      }
    }
    return canViewByAuthCode(userAuthCode, recordAuth == null ? '' : String(recordAuth));
  });
}

export function newAuthCodeLine(recordType = 'ProductCard'): AuthCodeLine {
  return {
    id: `ac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recordType,
    authCode: '',
  };
}

export const AUTH_CODE_HINT = 'Örn: +SAT,+PER veya -GIZLI (boş = tüm kayıtlar)';
