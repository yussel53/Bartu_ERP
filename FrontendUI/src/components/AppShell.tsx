import React from 'react';
import {
  LayoutDashboard,
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
  ChevronDown,
  Menu,
  X,
  LogOut,
  PieChart,
  GitBranch,
  Handshake,
} from 'lucide-react';
import { AppModule, MenuScreen } from '../types/formTypes';
import { exitApp } from '../utils/exitApp';
import { useAppModules } from '../contexts/AppModulesContext';

const MODULE_ICONS = {
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

interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentPath, onNavigate, children }) => {
  const { modules: APP_MODULES } = useAppModules();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const rootModule = currentPath.split('/')[0] || '';

  const [openModules, setOpenModules] = React.useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setOpenModules((prev) => {
      const next = { ...prev };
      APP_MODULES.forEach((m) => {
        if (next[m.id] === undefined) next[m.id] = m.path === rootModule;
      });
      if (rootModule) next[rootModule] = true;
      return next;
    });
    setOpenGroups((prev) => {
      const next = { ...prev };
      APP_MODULES.forEach((m) => {
        m.groups.forEach((g) => {
          const key = `${m.id}:${g.key}`;
          if (next[key] === undefined) {
            next[key] = currentPath.startsWith(`${m.path}/${g.key}`);
          }
          if (currentPath.startsWith(`${m.path}/${g.key}`)) next[key] = true;
        });
      });
      return next;
    });
  }, [APP_MODULES, rootModule, currentPath]);

  const [openParents, setOpenParents] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!rootModule) return;
    setOpenModules((prev) => ({ ...prev, [rootModule]: true }));
    const parts = currentPath.split('/');
    if (parts.length >= 2) {
      setOpenGroups((prev) => ({ ...prev, [`${parts[0]}:${parts[1]}`]: true }));
    }
    if (currentPath.includes('/firmalar/')) {
      setOpenParents((prev) => ({ ...prev, 'sistem/tanimlar/firmalar': true }));
    }
    if (currentPath.includes('/adres/')) {
      setOpenParents((prev) => ({ ...prev, 'sistem/tanimlar/adres': true }));
    }
    if (currentPath.includes('/hareketler/fatura/')) {
      const root = currentPath.split('/')[0];
      setOpenParents((prev) => ({ ...prev, [`${root}/hareketler/fatura`]: true }));
    }
    if (currentPath.includes('/cari-kartlar/')) {
      setOpenParents((prev) => ({ ...prev, 'finans/ana-kayitlar/cari-kartlar': true }));
    }
  }, [currentPath, rootModule]);

  const go = (path: string) => {
    onNavigate(path);
    setMobileOpen(false);
  };

  const toggleModule = (mod: AppModule) => {
    const willOpen = !openModules[mod.id];
    setOpenModules((prev) => ({ ...prev, [mod.id]: willOpen }));
    // Modül başlığı → özet dashboard (grafik / KPI)
    go(mod.path);
  };

  const toggleGroup = (moduleId: string, groupKey: string, modulePath: string) => {
    const key = `${moduleId}:${groupKey}`;
    setOpenGroups((prev) => ({ ...prev, [key]: true }));
    // Grup başlığı → grup özeti
    go(`${modulePath}/${groupKey}`);
  };

  const renderScreen = (screen: MenuScreen, depth: number) => {
    const active = currentPath === screen.path || currentPath.startsWith(`${screen.path}/`);
    const hasChildren = Boolean(screen.children?.length);
    const parentOpen = openParents[screen.path] ?? active;
    const pad = 8 + depth * 12;

    return (
      <div key={screen.id} className="space-y-0.5">
        <div className="flex items-center gap-0.5" style={{ paddingLeft: pad }}>
          <button
            type="button"
            onClick={() => go(screen.path)}
            className={`flex-1 text-left px-1.5 h-6 rounded text-[11px] font-medium transition-colors truncate ${
              currentPath === screen.path || (active && !hasChildren)
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                : active
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
            }`}
          >
            {screen.title}
          </button>
          {hasChildren && (
            <button
              type="button"
              onClick={() =>
                setOpenParents((prev) => ({ ...prev, [screen.path]: !parentOpen }))
              }
              className="p-1 rounded hover:bg-slate-100 text-slate-400 shrink-0"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${parentOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        {hasChildren && parentOpen && (
          <div
            className="ml-2 border-l border-slate-200 dark:border-slate-700 space-y-0.5"
            style={{ marginLeft: pad + 4 }}
          >
            {screen.children!.map((child) => renderScreen(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-900">
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-48 p-1.5 flex flex-col
          bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800
          transform transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static
        `}
      >
        <div className="flex items-center justify-between mb-2 px-1.5 py-1 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">KaviSoft</div>
            <div className="text-[9px] text-slate-500 font-medium">Kurumsal Yönetim</div>
          </div>
          <button type="button" className="lg:hidden p-1" onClick={() => setMobileOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
          <button
            type="button"
            onClick={() => go('rapor')}
            className={`w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-semibold transition-colors ${
              rootModule === 'rapor' || rootModule === 'ozet'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 shrink-0" />
            Genel Durum
          </button>

          <button
            type="button"
            onClick={() => go('')}
            className={`w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-semibold transition-colors ${
              !currentPath
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
            Ana Sayfa
          </button>

          {APP_MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod.icon];
            const moduleOpen = openModules[mod.id];
            const moduleActive = rootModule === mod.path;

            return (
              <div key={mod.id} className="pt-0.5">
                <button
                  type="button"
                  onClick={() => toggleModule(mod)}
                  className={`w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                    moduleActive
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 text-left truncate">{mod.title}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${moduleOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {moduleOpen && (
                  <div className="mt-0.5 ml-3 pl-2 border-l-2 border-slate-200 dark:border-slate-700 space-y-0.5">
                    {mod.groups.map((group) => {
                      const gKey = `${mod.id}:${group.key}`;
                      const groupOpen = openGroups[gKey];
                      const hasScreens = group.screens.length > 0;

                      return (
                        <div key={group.key} className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => toggleGroup(mod.id, group.key, mod.path)}
                            className={`w-full flex items-center gap-1 px-2 h-7 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                              currentPath === `${mod.path}/${group.key}`
                                ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                                : 'text-slate-500'
                            }`}
                          >
                            <span className="flex-1 text-left truncate">{group.title}</span>
                            <ChevronDown
                              className={`w-3 h-3 shrink-0 transition-transform ${groupOpen ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {groupOpen && (
                            <div className="ml-2 pl-2 border-l border-slate-200 dark:border-slate-700 space-y-0.5 pb-0.5">
                              {hasScreens ? (
                                group.screens.map((screen) => renderScreen(screen, 0))
                              ) : (
                                <div className="px-2 py-1 text-[10px] text-slate-400 italic">Sonra eklenecek</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => exitApp()}
            className="w-full flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors"
            title="Programdan çık"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Çıkış
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-3 h-10 bg-white dark:bg-slate-950 border-b border-slate-200">
          <button type="button" onClick={() => setMobileOpen(true)} className="p-1.5 rounded hover:bg-slate-100">
            <Menu className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-white flex-1">KaviSoft</span>
          <button
            type="button"
            onClick={() => exitApp()}
            className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
            title="Çıkış"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>
        <main className="flex-1 p-2 sm:p-3 lg:p-4">{children}</main>
      </div>
    </div>
  );
};
