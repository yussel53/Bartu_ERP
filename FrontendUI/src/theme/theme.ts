/** Görünüm ve vurgu rengi — localStorage + html class / CSS değişkenleri */

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeAccent =
  | 'blue'
  | 'teal'
  | 'emerald'
  | 'violet'
  | 'rose'
  | 'amber'
  | 'cyan'
  | 'slate';

export type ThemePrefs = {
  mode: ThemeMode;
  accent: ThemeAccent;
};

const MODE_KEY = 'kavi-theme-mode';
const ACCENT_KEY = 'kavi-theme-accent';

/** Tailwind varsayılan paletleri (R G B kanal) — blue-* sınıfları bu değişkenlere bağlanır */
export const ACCENT_PALETTES: Record<ThemeAccent, Record<string, string>> = {
  blue: {
    50: '239 246 255',
    100: '219 234 254',
    200: '191 219 254',
    300: '147 197 253',
    400: '96 165 250',
    500: '59 130 246',
    600: '37 99 235',
    700: '29 78 216',
    800: '30 64 175',
    900: '30 58 138',
    950: '23 37 84',
  },
  teal: {
    50: '240 253 250',
    100: '204 251 241',
    200: '153 246 228',
    300: '94 234 212',
    400: '45 212 191',
    500: '20 184 166',
    600: '13 148 136',
    700: '15 118 110',
    800: '17 94 89',
    900: '19 78 74',
    950: '4 47 46',
  },
  emerald: {
    50: '236 253 245',
    100: '209 250 229',
    200: '167 243 208',
    300: '110 231 183',
    400: '52 211 153',
    500: '16 185 129',
    600: '5 150 105',
    700: '4 120 87',
    800: '6 95 70',
    900: '6 78 59',
    950: '2 44 34',
  },
  violet: {
    50: '245 243 255',
    100: '237 233 254',
    200: '221 214 254',
    300: '196 181 253',
    400: '167 139 250',
    500: '139 92 246',
    600: '124 58 237',
    700: '109 40 217',
    800: '91 33 182',
    900: '76 29 149',
    950: '46 16 101',
  },
  rose: {
    50: '255 241 242',
    100: '255 228 230',
    200: '254 205 211',
    300: '253 164 175',
    400: '251 113 133',
    500: '244 63 94',
    600: '225 29 72',
    700: '190 18 60',
    800: '159 18 57',
    900: '136 19 55',
    950: '76 5 25',
  },
  amber: {
    50: '255 251 235',
    100: '254 243 199',
    200: '253 230 138',
    300: '252 211 77',
    400: '251 191 36',
    500: '245 158 11',
    600: '217 119 6',
    700: '180 83 9',
    800: '146 64 14',
    900: '120 53 15',
    950: '69 26 3',
  },
  cyan: {
    50: '236 254 255',
    100: '207 250 254',
    200: '165 243 252',
    300: '103 232 249',
    400: '34 211 238',
    500: '6 182 212',
    600: '8 145 178',
    700: '14 116 144',
    800: '21 94 117',
    900: '22 78 99',
    950: '8 51 68',
  },
  slate: {
    50: '248 250 252',
    100: '241 245 249',
    200: '226 232 240',
    300: '203 213 225',
    400: '148 163 184',
    500: '100 116 139',
    600: '71 85 105',
    700: '51 65 85',
    800: '30 41 59',
    900: '15 23 42',
    950: '2 6 23',
  },
};

export const ACCENT_OPTIONS: { id: ThemeAccent; label: string; swatch: string }[] = [
  { id: 'blue', label: 'Mavi', swatch: '#2563eb' },
  { id: 'teal', label: 'Turkuaz', swatch: '#0d9488' },
  { id: 'emerald', label: 'Yeşil', swatch: '#059669' },
  { id: 'violet', label: 'Mor', swatch: '#7c3aed' },
  { id: 'rose', label: 'Gül', swatch: '#e11d48' },
  { id: 'amber', label: 'Amber', swatch: '#d97706' },
  { id: 'cyan', label: 'Camgöbeği', swatch: '#0891b2' },
  { id: 'slate', label: 'Gri', swatch: '#475569' },
];

export const MODE_OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Açık' },
  { id: 'dark', label: 'Koyu' },
  { id: 'system', label: 'Sistem' },
];

export function readThemePrefs(): ThemePrefs {
  let mode: ThemeMode = 'light';
  let accent: ThemeAccent = 'blue';
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'light' || m === 'dark' || m === 'system') mode = m;
    const a = localStorage.getItem(ACCENT_KEY);
    if (a && a in ACCENT_PALETTES) accent = a as ThemeAccent;
  } catch {
    /* private mode */
  }
  return { mode, accent };
}

export function writeThemePrefs(prefs: ThemePrefs): void {
  try {
    localStorage.setItem(MODE_KEY, prefs.mode);
    localStorage.setItem(ACCENT_KEY, prefs.accent);
  } catch {
    /* ignore */
  }
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** html üzerinde dark class + vurgu CSS değişkenleri */
export function applyTheme(prefs: ThemePrefs): void {
  const root = document.documentElement;
  const dark = resolveDark(prefs.mode);
  root.classList.toggle('dark', dark);
  root.dataset.theme = prefs.mode;
  root.dataset.accent = prefs.accent;
  root.style.colorScheme = dark ? 'dark' : 'light';
  const palette = ACCENT_PALETTES[prefs.accent] ?? ACCENT_PALETTES.blue;
  for (const [shade, rgb] of Object.entries(palette)) {
    root.style.setProperty(`--c-${shade}`, rgb);
  }
}
