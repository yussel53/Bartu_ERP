import React from 'react';
import { Loader2, X } from 'lucide-react';

/* Küçük ortak UI parçaları — CRM ekranları */

export const inputCls =
  'w-full h-8 px-2 text-[12px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500';
export const textareaCls =
  'w-full px-2 py-1.5 text-[12px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500';

export function Field({
  label,
  children,
  className = '',
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'outline';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600',
  outline:
    'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600',
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent',
};

export function Btn({
  variant = 'outline',
  busy,
  icon,
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  busy?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Badge({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-[1px] rounded border text-[10px] font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-3 sm:p-6 overflow-y-auto" onMouseDown={onClose}>
      <div
        className={`w-full ${width} rounded-lg bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 my-auto`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700">{error}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-[12px] text-slate-400">{children}</div>;
}

export function Spinner() {
  return (
    <div className="py-8 flex justify-center text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

/** Basit kebab menü (Nova'daki üç nokta menüsü) */
export function MenuButton({
  items,
}: {
  items: ({ label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean } | 'sep')[];
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="w-6 h-6 inline-flex items-center justify-center rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menü"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-40 min-w-[190px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={`s${i}`} className="my-1 border-t border-slate-100 dark:border-slate-700" />
            ) : it.hidden ? null : (
              <button
                key={it.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-slate-50 dark:hover:bg-slate-700 ${
                  it.danger ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="w-3.5 h-3.5 inline-flex">{it.icon}</span>
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
