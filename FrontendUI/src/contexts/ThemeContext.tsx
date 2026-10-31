import React from 'react';
import {
  ACCENT_OPTIONS,
  MODE_OPTIONS,
  ThemeAccent,
  ThemeMode,
  ThemePrefs,
  applyTheme,
  readThemePrefs,
  writeThemePrefs,
} from '../theme/theme';

type ThemeContextValue = ThemePrefs & {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
  accents: typeof ACCENT_OPTIONS;
  modes: typeof MODE_OPTIONS;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = React.useState<ThemePrefs>(() => readThemePrefs());

  React.useEffect(() => {
    applyTheme(prefs);
    writeThemePrefs(prefs);
  }, [prefs]);

  React.useEffect(() => {
    if (prefs.mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(readThemePrefs());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs.mode]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      ...prefs,
      setMode: (mode) => setPrefs((p) => ({ ...p, mode })),
      setAccent: (accent) => setPrefs((p) => ({ ...p, accent })),
      accents: ACCENT_OPTIONS,
      modes: MODE_OPTIONS,
    }),
    [prefs],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme: ThemeProvider yok');
  return ctx;
}
