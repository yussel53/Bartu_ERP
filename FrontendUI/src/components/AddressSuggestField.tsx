import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldValues,
} from 'react-hook-form';
import {
  suggestCountries,
  suggestProvinces,
  suggestDistricts,
  suggestNeighborhoods,
} from '../data/addressRegistry';
import { attachNoMinusHandlers, stripMinusChars } from '../utils/noMinusInput';

export type AddressSuggestLevel = 'country' | 'province' | 'district' | 'neighborhood';

interface Props {
  label: string;
  registerName: string;
  level: AddressSuggestLevel;
  register: UseFormRegister<FieldValues>;
  setValue?: UseFormSetValue<FieldValues>;
  watch?: UseFormWatch<FieldValues>;
  /** İlçe için bağlı il alanı (örn. addresses.0.City) */
  provinceField?: string;
  /** Mahalle için bağlı ilçe alanı */
  districtField?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
  /** Seçimde ülke otomatik Türkiye */
  autoFillCountryField?: string;
}

function siblingPath(registerName: string, field: string): string {
  const i = registerName.lastIndexOf('.');
  if (i < 0) return field;
  return `${registerName.slice(0, i + 1)}${field}`;
}

/**
 * Cari adres İl / İlçe / Mahalle otomatik tamamlama (TurkiyeAPI JSON).
 */
export const AddressSuggestField: React.FC<Props> = ({
  label,
  registerName,
  level,
  register,
  setValue,
  watch,
  provinceField,
  districtField,
  required,
  disabled,
  placeholder,
  inputClassName = '',
  autoFillCountryField,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ label: string; value: string; meta?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const raw = watch ? watch(registerName) : '';
  const value = raw == null ? '' : String(raw);

  const provPath = provinceField || siblingPath(registerName, 'City');
  const distPath = districtField || siblingPath(registerName, 'Town');
  const countryPath = autoFillCountryField || siblingPath(registerName, 'Country');
  const cityVal = watch ? String(watch(provPath) || '') : '';
  const townVal = watch ? String(watch(distPath) || '') : '';

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open || disabled) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setBusy(true);
        try {
          let next: { label: string; value: string; meta?: string }[] = [];
          if (level === 'country') {
            const rows = await suggestCountries(value);
            next = rows.map((r) => ({ label: r.name, value: r.name, meta: r.code }));
          } else if (level === 'province') {
            const rows = await suggestProvinces(value);
            next = rows.map((r) => ({ label: r.name, value: r.name, meta: r.code }));
          } else if (level === 'district') {
            const rows = await suggestDistricts(cityVal || null, value);
            next = rows.map((r) => ({ label: r.name, value: r.name }));
          } else {
            const rows = await suggestNeighborhoods({
              provinceName: cityVal || null,
              districtName: townVal || null,
              query: value,
            });
            next = rows.map((r) => ({
              label: r.name,
              value: r.name,
              meta: r.postalCode || undefined,
            }));
          }
          if (!cancelled) setItems(next);
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, value, level, cityVal, townVal, disabled]);

  const pick = (opt: { label: string; value: string }) => {
    setValue?.(registerName, opt.value, { shouldDirty: true, shouldValidate: true });
    if (level === 'province') {
      // İl değişince ilçe/mahalle temizle
      setValue?.(distPath, '', { shouldDirty: true });
      setValue?.(siblingPath(registerName, 'Dictrict'), '', { shouldDirty: true });
      if (countryPath) {
        const cur = watch?.(countryPath);
        if (!String(cur || '').trim()) {
          setValue?.(countryPath, 'Türkiye', { shouldDirty: true });
        }
      }
    } else if (level === 'district') {
      setValue?.(siblingPath(registerName, 'Dictrict'), '', { shouldDirty: true });
    }
    setOpen(false);
  };

  const hint = useMemo(() => {
    if (level === 'district' && !cityVal.trim()) return 'Önce il seçin';
    if (level === 'neighborhood' && !townVal.trim() && !cityVal.trim()) return 'Önce il / ilçe seçin';
    return null;
  }, [level, cityVal, townVal]);

  return (
    <div ref={wrapRef} className="relative w-full min-w-0">
      <input type="hidden" {...register(registerName, { required: required && !disabled })} />
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? label}
        title={hint || label}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const cleaned = stripMinusChars(e.target.value);
          setValue?.(registerName, cleaned, { shouldDirty: true, shouldValidate: true });
          setOpen(true);
        }}
        onKeyDown={(e) => {
          attachNoMinusHandlers().onKeyDown(e);
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') setOpen(true);
          if (e.key === 'Enter' && open && items[0]) {
            e.preventDefault();
            pick(items[0]);
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[-–−﹣－]/.test(text)) {
            e.preventDefault();
            const cleaned = stripMinusChars(text);
            setValue?.(registerName, cleaned, { shouldDirty: true, shouldValidate: true });
            setOpen(true);
          }
        }}
        className={inputClassName}
      />
      {open && !disabled && (
        <div className="absolute z-[70] left-0 right-0 mt-0.5 max-h-52 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
          {hint && (
            <div className="px-2.5 py-1.5 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-100">
              {hint}
            </div>
          )}
          {busy && (
            <div className="px-2.5 py-2 text-[11px] text-slate-400">Aranıyor…</div>
          )}
          {!busy && items.length === 0 && (
            <div className="px-2.5 py-2 text-[11px] text-slate-400">
              Eşleşme yok — serbest metin olarak kalır
            </div>
          )}
          {items.map((opt) => (
            <button
              key={`${opt.value}-${opt.meta || ''}`}
              type="button"
              className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-2"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(opt)}
            >
              <span className="text-slate-800 dark:text-slate-100 truncate">{opt.label}</span>
              {opt.meta && (
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{opt.meta}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export function addressSuggestLevelForField(fieldName: string): AddressSuggestLevel | null {
  const n = fieldName.toLowerCase();
  if (n === 'country') return 'country';
  if (n === 'city') return 'province';
  if (n === 'town') return 'district';
  if (n === 'dictrict' || n === 'district' || n === 'neighborhood') return 'neighborhood';
  return null;
}
