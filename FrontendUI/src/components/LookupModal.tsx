import React from 'react';
import { Plus, Search, X } from 'lucide-react';

export interface LookupOptionMeta {
  stockQty?: number | string;
  mainUnit?: string;
  salesOrderQty?: number | string;
  purchaseOrderQty?: number | string;
}

export interface LookupOption {
  label: string;
  value: string;
  meta?: LookupOptionMeta;
}

interface LookupModalProps {
  title: string;
  options: LookupOption[];
  value?: string;
  onSelect: (opt: LookupOption) => void;
  onClose: () => void;
  /** Varsa «Yeni ekle» butonu gösterilir */
  onCreateNew?: () => void;
  createLabel?: string;
  /** Liste boşken gösterilecek metin (örn. «Önce cari seçin») */
  emptyText?: string;
}

function fmtQty(v: unknown): string {
  if (v == null || v === '') return '0';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(n);
}

/** Liste seçim diyaloğu — filtre + satır tıklama + isteğe bağlı yeni kart */
export const LookupModal: React.FC<LookupModalProps> = ({
  title,
  options,
  value,
  onSelect,
  onClose,
  onCreateNew,
  createLabel = 'Yeni ekle',
  emptyText = 'Kayıt bulunamadı',
}) => {
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const showProductStats = options.some((o) => o.meta != null);

  React.useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.label.toLocaleLowerCase('tr').includes(needle) ||
        o.value.toLocaleLowerCase('tr').includes(needle) ||
        (o.meta?.mainUnit || '').toLocaleLowerCase('tr').includes(needle),
    );
  }, [options, q]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${
          showProductStats ? 'max-w-3xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <div className="flex items-center gap-1.5">
            {onCreateNew && (
              <button
                type="button"
                onClick={onCreateNew}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="w-3.5 h-3.5" />
                {createLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kod veya ad ile ara…"
              className="w-full h-8 pl-7 pr-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="text-[12px] text-slate-400">{emptyText}</div>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {createLabel}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 font-semibold w-28">Kod</th>
                  <th className="px-3 py-1.5 font-semibold">Ad</th>
                  {showProductStats && (
                    <>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">Stok</th>
                      <th className="px-2 py-1.5 font-semibold whitespace-nowrap">Birim</th>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">Satış Sip.</th>
                      <th className="px-2 py-1.5 font-semibold text-right whitespace-nowrap">Alım Sip.</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((opt) => {
                  const selected = String(value ?? '') === opt.value;
                  const dash = opt.label.indexOf('—');
                  const code = dash > 0 ? opt.label.slice(0, dash).trim() : opt.value;
                  const name = dash > 0 ? opt.label.slice(dash + 1).trim() : opt.label;
                  return (
                    <tr
                      key={opt.value}
                      onClick={() => onSelect(opt)}
                      className={`cursor-pointer text-[12px] border-t border-slate-100 dark:border-slate-800 ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {code}
                      </td>
                      <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{name}</td>
                      {showProductStats && (
                        <>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtQty(opt.meta?.stockQty)}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {opt.meta?.mainUnit || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtQty(opt.meta?.salesOrderQty)}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {fmtQty(opt.meta?.purchaseOrderQty)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={() => onSelect({ label: '', value: '' })}
            className="text-[11px] text-slate-500 hover:text-red-600"
          >
            Temizle
          </button>
          <span className="text-[10px] text-slate-400">{filtered.length} kayıt</span>
        </div>
      </div>
    </div>
  );
};
