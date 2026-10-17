import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';

/**
 * Uygulama içi onay penceresi — window.confirm yerine.
 * Gömülü tarayıcılar / WebView ve bazı ortamlar window.confirm'ü göstermeden false döndürür;
 * bu yüzden iptal / sil / kapat düğmeleri «çalışmıyor» görünür. Promise<boolean> döner.
 */
export function appConfirm(
  message: string,
  opts?: { title?: string; okLabel?: string; cancelLabel?: string; danger?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: boolean) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<ConfirmDialog message={message} opts={opts} onDone={done} />);
  });
}

const ConfirmDialog: React.FC<{
  message: string;
  opts?: { title?: string; okLabel?: string; cancelLabel?: string; danger?: boolean };
  onDone: (v: boolean) => void;
}> = ({ message, opts, onDone }) => {
  const okRef = useRef<HTMLButtonElement>(null);
  const danger = opts?.danger ?? /sil|iptal|kapat|kaybol|çıkar/i.test(message);

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40"
      onMouseDown={() => onDone(false)}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5 px-4 pt-4">
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${danger ? 'text-red-500' : 'text-amber-500'}`} />
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {opts?.title ?? 'Onay'}
            </h3>
            <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300 whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 mt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onDone(false)}
            className="px-3 h-7 text-[12px] font-medium rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            {opts?.cancelLabel ?? 'Vazgeç'}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => onDone(true)}
            className={`px-3 h-7 text-[12px] font-semibold rounded-sm text-white ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-700 hover:bg-blue-600'
            }`}
          >
            {opts?.okLabel ?? 'Evet'}
          </button>
        </div>
      </div>
    </div>
  );
};
