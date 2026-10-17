import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppModule } from '../types/formTypes';
import { APP_MODULES } from '../data/modules';
import { injectSqlReportMenus } from '../data/injectSqlReportMenus';
import { listSqlReportMenus } from '../api/sqlReportsApi';
import { getCurrentUserId, refreshEffectiveAuth } from '../data/permissions';

interface AppModulesContextValue {
  modules: AppModule[];
  reloadMenus: () => Promise<void>;
  menusLoading: boolean;
}

const AppModulesContext = createContext<AppModulesContextValue>({
  modules: APP_MODULES,
  reloadMenus: async () => undefined,
  menusLoading: false,
});

export function AppModulesProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<AppModule[]>(APP_MODULES);
  const [menusLoading, setMenusLoading] = useState(false);

  const reloadMenus = useCallback(async () => {
    setMenusLoading(true);
    try {
      const profile = await refreshEffectiveAuth();
      const userId = Number(getCurrentUserId()) || 0;
      const menus = await listSqlReportMenus({
        userId: userId > 0 ? userId : undefined,
        isAdmin: !!profile.isAdmin,
      });
      setModules(injectSqlReportMenus(APP_MODULES, menus));
    } catch {
      setModules(APP_MODULES);
    } finally {
      setMenusLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadMenus();
  }, [reloadMenus]);

  const value = useMemo(
    () => ({ modules, reloadMenus, menusLoading }),
    [modules, reloadMenus, menusLoading],
  );

  return <AppModulesContext.Provider value={value}>{children}</AppModulesContext.Provider>;
}

export function useAppModules(): AppModulesContextValue {
  return useContext(AppModulesContext);
}

export function findModuleByPath(modules: AppModule[], path: string): AppModule | undefined {
  return modules.find((m) => m.path === path);
}
