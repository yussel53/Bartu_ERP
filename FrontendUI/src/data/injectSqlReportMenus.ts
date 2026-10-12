import type { AppModule, MenuGroup, MenuGroupKey, MenuScreen } from '../types/formTypes';
import type { SqlReportMenu } from '../api/sqlReportsApi';

function cloneModules(modules: AppModule[]): AppModule[] {
  return modules.map((m) => ({
    ...m,
    groups: m.groups.map((g) => ({
      ...g,
      screens: g.screens.map(cloneScreen),
    })),
  }));
}

function cloneScreen(s: MenuScreen): MenuScreen {
  return {
    ...s,
    children: s.children?.map(cloneScreen),
    listColumns: s.listColumns ? [...s.listColumns] : undefined,
    sampleRows: s.sampleRows ? s.sampleRows.map((r) => ({ ...r })) : undefined,
  };
}

/** SYS_SqlReportMenu kayıtlarını modül → grup altına klasör + rapor çocukları olarak ekler */
export function injectSqlReportMenus(base: AppModule[], menus: SqlReportMenu[]): AppModule[] {
  const modules = cloneModules(base);
  const activeMenus = menus
    .filter((m) => m.isActive)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'tr'));

  for (const menu of activeMenus) {
    const mod = modules.find((m) => m.path === menu.modulePath || m.id === menu.modulePath);
    if (!mod) continue;

    let group = mod.groups.find((g) => g.key === menu.groupKey);
    if (!group) {
      group = {
        key: menu.groupKey as MenuGroupKey,
        title: titleForGroup(menu.groupKey),
        screens: [],
      };
      mod.groups.push(group);
    }

    const folderPath = `${mod.path}/${group.key}/sql-menu-${menu.id}`;
    const children: MenuScreen[] = (menu.reports || [])
      .filter((r) => r.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName, 'tr'))
      .map((r) => ({
        id: `sql-rapor-${r.id}`,
        path: `${folderPath}/rapor-${r.id}`,
        title: r.displayName || r.name,
        subtitle: `SYS_SqlReport #${r.id}`,
        sqlReportId: r.id,
        isSqlReportRunner: true,
      }));

    const folder: MenuScreen = {
      id: `sql-menu-${menu.id}`,
      path: folderPath,
      title: menu.title,
      subtitle: `SQL rapor menüsü · ${menu.exportKey}`,
      isSqlReportFolder: true,
      children,
    };

    // Aynı menü id varsa değiştir
    const idx = group.screens.findIndex((s) => s.id === folder.id);
    if (idx >= 0) group.screens[idx] = folder;
    else group.screens.push(folder);
  }

  return modules;
}

function titleForGroup(key: string): string {
  const map: Record<string, string> = {
    'ana-kayitlar': 'Ana Kayıtlar',
    hareketler: 'Hareketler',
    islemler: 'İşlemler',
    raporlar: 'Raporlar',
    tanimlar: 'Tanımlar',
    ondegerler: 'Öndeğerler',
    parametreler: 'Parametreler',
  };
  return map[key] || key;
}

export function listModuleMenuTargets(modules: AppModule[]): Array<{
  modulePath: string;
  moduleTitle: string;
  groupKey: string;
  groupTitle: string;
  label: string;
}> {
  const out: Array<{
    modulePath: string;
    moduleTitle: string;
    groupKey: string;
    groupTitle: string;
    label: string;
  }> = [];
  for (const m of modules) {
    for (const g of m.groups as MenuGroup[]) {
      out.push({
        modulePath: m.path,
        moduleTitle: m.title,
        groupKey: g.key,
        groupTitle: g.title,
        label: `${m.title} → ${g.title}`,
      });
    }
  }
  return out;
}
