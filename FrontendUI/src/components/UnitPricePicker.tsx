import React from 'react';
import { ChevronDown, Tags } from 'lucide-react';
import {
  fetchPriceSuggestions,
  type PriceSuggestion,
  type ProductPriceSuggestions,
} from '../api/productPricesApi';

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR');
}

export type UnitPricePickerProps = {
  productCardId: number | null;
  customerId?: number | null;
  direction?: 'sales' | 'purchase';
  disabled?: boolean;
  onApply: (price: number, suggestion: PriceSuggestion) => void;
  /** Dışarıya önerileri bildir (özet satırı / otomatik doldurma) */
  onLoaded?: (data: ProductPriceSuggestions) => void;
  compact?: boolean;
  /** Birim fiyat inputunun sağında (altında değil) */
  inline?: boolean;
};

export const UnitPricePicker: React.FC<UnitPricePickerProps> = ({
  productCardId,
  customerId,
  direction = 'sales',
  disabled,
  onApply,
  onLoaded,
  compact,
  inline,
}) => {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProductPriceSuggestions | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    if (!productCardId || productCardId <= 0) {
      setData(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchPriceSuggestions({
        productCardId,
        customerId,
        direction,
      });
      setData(res);
      onLoaded?.(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fiyatlar alınamadı');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [productCardId, customerId, direction, onLoaded]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const suggestions = (data?.suggestions || []).filter((s) => s.price != null);
  const preferred = suggestions.find((s) => s.isPreferred);
  const lastSale = suggestions.find((s) => s.key === 'last_sale_customer' || s.key === 'last_sale');
  const lastPurchase = suggestions.find(
    (s) => s.key === 'last_purchase_customer' || s.key === 'last_purchase',
  );

  const hintParts: string[] = [];
  if (lastPurchase?.price != null) hintParts.push(`Alım ${fmtPrice(lastPurchase.price)}`);
  if (lastSale?.price != null) hintParts.push(`Satış ${fmtPrice(lastSale.price)}`);
  if (preferred?.price != null && preferred !== lastSale && preferred !== lastPurchase) {
    hintParts.unshift(`${preferred.label.split('(')[0].trim()} ${fmtPrice(preferred.price)}`);
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, PriceSuggestion[]>();
    for (const s of suggestions) {
      const g = s.group || 'Diğer';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return [...map.entries()];
  }, [suggestions]);

  if (!productCardId) {
    return null;
  }

  const tip =
    hintParts.length > 0
      ? `Fiyat kaynakları · ${hintParts.join(' · ')}`
      : 'Fiyat kaynakları';

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${inline ? '' : compact ? '' : 'mt-0.5'}`}
    >
      <div className={`flex items-center gap-0.5 min-w-0 ${inline ? '' : ''}`}>
        <button
          type="button"
          disabled={disabled || busy}
          title={tip}
          onClick={() => {
            setOpen((v) => !v);
            if (!data && !busy) void load();
          }}
          className="inline-flex items-center gap-0.5 h-8 px-1.5 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 disabled:opacity-40 shrink-0"
        >
          <Tags className="w-3.5 h-3.5" />
          <ChevronDown className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {!inline && hintParts.length > 0 && (
          <span
            className="text-[9px] leading-tight text-slate-500 dark:text-slate-400 truncate"
            title={hintParts.join(' · ')}
          >
            {hintParts.join(' · ')}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-0.5 z-30 w-[260px] max-h-[280px] overflow-auto rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg py-1">
          <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 border-b border-slate-100 dark:border-slate-700">
            Birim fiyat kaynakları
          </div>
          {busy && (
            <div className="px-2 py-2 text-[11px] text-slate-400">Yükleniyor…</div>
          )}
          {err && <div className="px-2 py-2 text-[11px] text-red-600">{err}</div>}
          {!busy && !err && suggestions.length === 0 && (
            <div className="px-2 py-2 text-[11px] text-slate-400">Kayıtlı fiyat yok</div>
          )}
          {groups.map(([group, items]) => (
            <div key={group} className="py-0.5">
              <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                {group}
              </div>
              {items.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`w-full text-left px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-800 ${
                    s.isPreferred ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                  }`}
                  onClick={() => {
                    if (s.price == null) return;
                    onApply(s.price, s);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                      {s.label}
                      {s.isPreferred ? (
                        <span className="ml-1 text-[9px] text-blue-600 font-semibold">önerilen</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
                      {fmtPrice(s.price)}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {[fmtDate(s.docDate), s.source, s.vatIncluded ? 'KDV dahil' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
