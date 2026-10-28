import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export type ToastKind = 'ok' | 'error' | 'info';

type ToastOpts = {
  kind?: ToastKind;
  /** ms — varsayılan: ok 1.6s · error 3.5s · info 2.2s */
  durationMs?: number;
};

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let seq = 0;

type ToastItem = { id: number; message: string; kind: ToastKind; durationMs: number };

const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function emit() {
  const snap = items.slice();
  listeners.forEach((fn) => fn(snap));
}

function ensureHost() {
  if (host && root) return;
  host = document.createElement('div');
  host.id = 'kavi-toast-host';
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(<ToastStack />);
}

/** Kısa bildirim — Tamam beklemez, kendiliğinden kaybolur. */
export function appToast(message: string, opts?: ToastOpts): void {
  const kind = opts?.kind ?? 'ok';
  const durationMs =
    opts?.durationMs ??
    (kind === 'error' ? 3500 : kind === 'info' ? 2200 : 1600);
  ensureHost();
  const id = ++seq;
  items = [...items, { id, message, kind, durationMs }].slice(-4);
  emit();
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, durationMs);
}

const ToastStack: React.FC = () => {
  const [list, setList] = React.useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.add(setList);
    setList(items.slice());
    return () => {
      listeners.delete(setList);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div
      className="fixed z-[10050] bottom-4 right-4 left-4 sm:left-auto flex flex-col items-end gap-2 pointer-events-none"
      aria-live="polite"
    >
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ item: ToastItem }> = ({ item }) => {
  const Icon = item.kind === 'error' ? XCircle : item.kind === 'info' ? Info : CheckCircle2;
  const tone =
    item.kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/90 dark:text-red-100'
      : item.kind === 'info'
        ? 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100';

  return (
    <div
      role="status"
      className={`pointer-events-auto max-w-sm w-full sm:w-auto shadow-lg rounded-md border px-3 py-2 flex items-start gap-2 animate-[toast-in_0.18s_ease-out] ${tone}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="text-[12px] font-medium leading-snug whitespace-pre-line">{item.message}</p>
    </div>
  );
};
