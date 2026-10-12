import React, { useMemo, useState } from 'react';
import {
  Package,
  Wallet,
  TrendingUp,
  ShoppingCart,
  BookOpen,
  BarChart3,
  Settings,
  SlidersHorizontal,
  Users,
  Landmark,
  GitBranch,
  Handshake,
  ArrowRight,
  Search,
} from 'lucide-react';
import type { AppModule, MenuScreen } from '../types/formTypes';
import { ExitAppButton } from '../components/ExitAppButton';
import { useAppModules } from '../contexts/AppModulesContext';

const ICONS = {
  package: Package,
  wallet: Wallet,
  trendingUp: TrendingUp,
  shoppingCart: ShoppingCart,
  bookOpen: BookOpen,
  barChart: BarChart3,
  settings: Settings,
  sliders: SlidersHorizontal,
  users: Users,
  landmark: Landmark,
  gitBranch: GitBranch,
  handshake: Handshake,
} as const;

interface HomePageProps {
  onNavigate: (path: string) => void;
}

function flattenScreens(screens: MenuScreen[]): MenuScreen[] {
  return screens.flatMap((s) => [s, ...(s.children ? flattenScreens(s.children) : [])]);
}

function moduleMatches(m: AppModule, needle: string): boolean {
  if (!needle) return true;
  const hay = [
    m.title,
    m.subtitle,
    ...m.groups.flatMap((g) => [
      g.title,
      ...flattenScreens(g.screens).flatMap((s) => [s.title, s.subtitle || '']),
    ]),
  ]
    .join(' ')
    .toLocaleLowerCase('tr-TR');
  return hay.includes(needle);
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { modules: allModules } = useAppModules();
  const [q, setQ] = useState('');
  const needle = q.trim().toLocaleLowerCase('tr-TR');

  const modules = useMemo(
    () => allModules.filter((m) => moduleMatches(m, needle)),
    [allModules, needle],
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">KaviSoft</h1>
          <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            Malzeme, finans, satış, satınalma, muhasebe, e-devlet, personel, raporlama ve sistem
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Modül veya ekran ara…"
              autoFocus
              className="w-full h-9 pl-8 pr-3 text-[12px] border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          <ExitAppButton />
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-4 py-10 text-center text-[12px] text-slate-400">
          «{q.trim()}» ile eşleşen modül yok
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((m) => {
            const Icon = ICONS[m.icon];
            const screenCount = m.groups.reduce(
              (n, g) => n + g.screens.reduce((c, s) => c + 1 + (s.children?.length ?? 0), 0),
              0,
            );
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate(m.path)}
                className="group text-left p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <h2 className="mt-2.5 text-[13px] font-semibold text-slate-900 dark:text-white">
                  {m.title}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{m.subtitle}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {m.groups.map((g) => (
                    <span
                      key={g.key}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {g.title}
                      {g.screens.length > 0 ? ` (${g.screens.length})` : ''}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-medium text-slate-400">{screenCount} aktif ekran</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
