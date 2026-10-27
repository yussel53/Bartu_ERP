import React from 'react';
import { Moon, Palette, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const modeIcon = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

/** Kenar çubuğu: görünüm (açık/koyu) + vurgu rengi */
export const ThemePicker: React.FC = () => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ModeIcon = modeIcon[theme.mode];

  return (
    <div ref={rootRef} className="relative mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-semibold transition-colors ${
          open
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
        title="Tema ve renk"
        aria-expanded={open}
      >
        <Palette className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">Tema</span>
        <ModeIcon className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span
          className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10 shrink-0"
          style={{ background: theme.accents.find((a) => a.id === theme.accent)?.swatch }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 bottom-full mb-1 z-40 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2 space-y-2"
          role="dialog"
          aria-label="Tema ayarları"
        >
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 px-0.5">
              Görünüm
            </div>
            <div className="grid grid-cols-3 gap-1">
              {theme.modes.map((m) => {
                const Icon = modeIcon[m.id];
                const on = theme.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => theme.setMode(m.id)}
                    className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] font-semibold transition-colors ${
                      on
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1 px-0.5">
              Renk
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {theme.accents.map((a) => {
                const on = theme.accent === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={a.label}
                    onClick={() => theme.setAccent(a.id)}
                    className={`h-7 rounded-md ring-offset-1 dark:ring-offset-slate-900 transition ${
                      on ? 'ring-2 ring-blue-600 ring-offset-2' : 'ring-1 ring-black/10 hover:ring-black/25'
                    }`}
                    style={{ background: a.swatch }}
                    aria-label={a.label}
                    aria-pressed={on}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
