import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, FilterX } from 'lucide-react';

/**
 * Liste tablolarında başlığa tıklayarak sıralama + başlık altında kolon filtresi.
 * Filtre: metin «içerir» (büyük/küçük harf ve Türkçe karakter duyarsız);
 * sayısal kolonda «>1000», «<50», «>=10», «=0», «10..20» desteklenir.
 */

export type SortDir = 'asc' | 'desc';

const TR = 'tr-TR';

/** «1.234,56» · «1,234.56» · «12,5» · «%18» → sayı */
export function toNumber(s: string): number | null {
  let t = s.replace(/[\s%₺$€]/g, '').replace(/TL$/i, '');
  if (!t || !/^[-+]?[\d.,]+$/.test(t)) return null;
  const c = t.lastIndexOf(',');
  const d = t.lastIndexOf('.');
  if (c > -1 && d > -1) t = c > d ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (c > -1) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** gg.aa.yyyy / yyyy-aa-gg → sıralanabilir anahtar */
function toDateKey(s: string): number | null {
  let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  return null;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return 1; // boşlar sona
  if (!b) return -1;
  // Tarih önce: «16.10.2026» sayıya da benzer
  const da = toDateKey(a);
  const db = toDateKey(b);
  if (da != null && db != null) return da - db;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na != null && nb != null) return na - nb;
  return a.localeCompare(b, TR, { sensitivity: 'base', numeric: true });
}

/** Kolon çoğunlukla sayı mı? (filtre kutusu sağa yaslı, «>0» ipucu) */
export function isNumericColumn(texts: string[]): boolean {
  const vals = texts.filter((t) => t.trim() !== '').slice(0, 50);
  if (!vals.length) return false;
  const nums = vals.filter((t) => toDateKey(t) == null && toNumber(t) != null).length;
  return nums / vals.length >= 0.8;
}

/** Tek hücre filtresi */
export function matchFilter(cell: string, filter: string): boolean {
  const f = filter.trim();
  if (!f) return true;
  // Sayısal: >, <, >=, <=, =, a..b
  const range = /^([-\d.,]+)\s*\.\.\s*([-\d.,]+)$/.exec(f);
  const op = /^(>=|<=|>|<|=)\s*(.+)$/.exec(f);
  if (range || op) {
    const n = toNumber(cell);
    if (n == null) return false;
    if (range) {
      const lo = toNumber(range[1]);
      const hi = toNumber(range[2]);
      return lo != null && hi != null && n >= lo && n <= hi;
    }
    const v = toNumber(op![2]);
    if (v == null) return cell.toLocaleLowerCase(TR).includes(f.toLocaleLowerCase(TR));
    switch (op![1]) {
      case '>':
        return n > v;
      case '<':
        return n < v;
      case '>=':
        return n >= v;
      case '<=':
        return n <= v;
      default:
        return n === v;
    }
  }
  return cell.toLocaleLowerCase(TR).includes(f.toLocaleLowerCase(TR));
}

/**
 * rows + kolon anahtarları + hücre metni → sıralanmış / süzülmüş satırlar ve başlık durumu.
 * getText ekranda görünen metni döndürmeli (filtre / sıralama görünen değere göre çalışır).
 */
export function useGridSortFilter<T>(rows: T[], getText: (row: T, key: string) => string) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const view = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    let out = active.length ? rows.filter((r) => active.every(([k, v]) => matchFilter(getText(r, k), v))) : rows;
    if (sort) {
      const mul = sort.dir === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => mul * compareText(getText(a, sort.key), getText(b, sort.key)));
    }
    return out;
    // getText her render'da yeni olabilir; satır / filtre / sıra değişiminde yeniden hesapla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, sort]);

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
  const setFilter = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const clear = () => {
    setFilters({});
    setSort(null);
  };
  const hasFilter = Object.values(filters).some((v) => v.trim() !== '');

  return { view, sort, toggleSort, filters, setFilter, clear, hasFilter };
}

/** Sıralanabilir başlık hücresinin içeriği */
export const SortLabel: React.FC<{
  label: React.ReactNode;
  colKey: string;
  sort: { key: string; dir: SortDir } | null;
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}> = ({ label, colKey, sort, onSort, align = 'left' }) => {
  const active = sort?.key === colKey;
  return (
    <button
      type="button"
      onClick={() => onSort(colKey)}
      title="Sırala (artan → azalan → kaldır)"
      className={`inline-flex items-center gap-1 w-full select-none hover:text-slate-900 dark:hover:text-white ${
        align === 'right' ? 'justify-end' : ''
      } ${active ? 'text-blue-700 dark:text-blue-300' : ''}`}
    >
      <span className="truncate">{label}</span>
      {active ? (
        sort!.dir === 'asc' ? (
          <ArrowUp className="w-3 h-3 shrink-0" />
        ) : (
          <ArrowDown className="w-3 h-3 shrink-0" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 shrink-0 opacity-30" />
      )}
    </button>
  );
};

/** Başlık altındaki filtre kutusu */
export const FilterInput: React.FC<{
  colKey: string;
  value: string;
  onChange: (key: string, value: string) => void;
  numeric?: boolean;
}> = ({ colKey, value, onChange, numeric }) => (
  <input
    value={value}
    onChange={(e) => onChange(colKey, e.target.value)}
    placeholder={numeric ? '>0' : 'Ara…'}
    title={numeric ? 'Örn: >1000, <50, =0, 10..20 veya metin' : 'İçeren satırlar'}
    className={`w-full min-w-[60px] h-6 px-1.5 text-[11px] font-normal rounded-sm border bg-white dark:bg-slate-900 outline-none focus:border-blue-500 ${
      value.trim() ? 'border-blue-400 bg-blue-50/50' : 'border-slate-300 dark:border-slate-600'
    } ${numeric ? 'text-right' : ''}`}
  />
);

/** «x / y kayıt · Filtreyi temizle» */
export const FilterSummary: React.FC<{ shown: number; total: number; active: boolean; onClear: () => void }> = ({
  shown,
  total,
  active,
  onClear,
}) =>
  active ? (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-700">
      {shown} / {total} kayıt
      <button type="button" onClick={onClear} className="inline-flex items-center gap-0.5 hover:underline">
        <FilterX className="w-3 h-3" /> temizle
      </button>
    </span>
  ) : null;
