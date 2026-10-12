/** Sistem kısa tarih formatı — uygulama açılışında /api/system/info ile yüklenir */

export type DatePartOrder = 'dmy' | 'mdy' | 'ymd';

export interface DateFormatSpec {
  /** Örn. dd.MM.yyyy */
  pattern: string;
  order: DatePartOrder;
  sep: string;
  placeholder: string;
}

const DEFAULT_PATTERN = 'dd.MM.yyyy';

let current: DateFormatSpec = parseDateFormat(DEFAULT_PATTERN);

/** Geriye uyumluluk */
export let SYSTEM_DATE_DISPLAY = current.pattern;
export let SYSTEM_DATE_PLACEHOLDER = current.placeholder;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseDateFormat(pattern: string): DateFormatSpec {
  const raw = (pattern || '').trim() || DEFAULT_PATTERN;
  const sepMatch = raw.match(/[^dMy]/i);
  const sep = sepMatch && ['.', '/', '-'].includes(sepMatch[0]) ? sepMatch[0] : '.';
  const tokens = raw
    .split(/[^dMy]+/i)
    .filter(Boolean)
    .map((t) => {
      const c = t[0].toLowerCase();
      if (c === 'd') return 'd';
      if (c === 'm') return 'm';
      if (c === 'y') return 'y';
      return '';
    })
    .filter(Boolean);

  let order: DatePartOrder = 'dmy';
  if (tokens[0] === 'm' && tokens[1] === 'd') order = 'mdy';
  else if (tokens[0] === 'y') order = 'ymd';
  else if (tokens[0] === 'd') order = 'dmy';
  else order = 'dmy';

  const parts =
    order === 'mdy'
      ? ['MM', 'dd', 'yyyy']
      : order === 'ymd'
        ? ['yyyy', 'MM', 'dd']
        : ['dd', 'MM', 'yyyy'];

  const normalized = parts.join(sep);
  const placeholder =
    order === 'mdy'
      ? `aa${sep}gg${sep}yyyy`
      : order === 'ymd'
        ? `yyyy${sep}aa${sep}gg`
        : `gg${sep}aa${sep}yyyy`;

  return { pattern: normalized, order, sep, placeholder };
}

/** Açılışta API'den gelen formatı uygula */
export function applySystemDateFormat(pattern: string): DateFormatSpec {
  current = parseDateFormat(pattern);
  SYSTEM_DATE_DISPLAY = current.pattern;
  SYSTEM_DATE_PLACEHOLDER = current.placeholder;
  notifyListeners();
  return current;
}

export function getDateFormatSpec(): DateFormatSpec {
  return current;
}

export function getSystemDateFormat(): string {
  return current.pattern;
}

export function getSystemDatePlaceholder(): string {
  return current.placeholder;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeDateFormat(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  listeners.forEach((l) => l());
}

/** API / form ISO (yyyy-MM-dd) → ekran formatı */
export function isoToDisplay(iso: unknown): string {
  if (iso == null || iso === '') return '';
  const s = String(iso).trim();
  if (!s || s.startsWith('1900-01-01')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const y = m[1];
  const mo = m[2];
  const d = m[3];
  const { order, sep } = current;
  if (order === 'mdy') return `${mo}${sep}${d}${sep}${y}`;
  if (order === 'ymd') return `${y}${sep}${mo}${sep}${d}`;
  return `${d}${sep}${mo}${sep}${y}`;
}

/** Ekran değeri → ISO yyyy-MM-dd; geçersizse null; boşsa '' */
export function displayToIso(display: string): string | null {
  const s = String(display ?? '').trim();
  if (!s) return '';
  const iso = s.match(ISO_RE);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    return isValidYmd(y, m, d) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }

  const parts = s.split(/[./\-\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;

  const { order } = current;
  let d: number;
  let m: number;
  let y: number;
  if (order === 'mdy') {
    m = Number(parts[0]);
    d = Number(parts[1]);
    y = Number(parts[2]);
  } else if (order === 'ymd') {
    y = Number(parts[0]);
    m = Number(parts[1]);
    d = Number(parts[2]);
  } else {
    d = Number(parts[0]);
    m = Number(parts[1]);
    y = Number(parts[2]);
  }

  if (!isValidYmd(y, m, d)) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
