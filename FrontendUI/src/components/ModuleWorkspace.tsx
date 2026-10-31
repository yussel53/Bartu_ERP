import React from 'react';
import { AppModule, MenuGroup, MenuScreen } from '../types/formTypes';
import { FormTabs } from './FormTabs';
import { ModuleListPage } from '../pages/ModuleListPage';
import { CurrencyRatesPage } from '../pages/CurrencyRatesPage';
import { EGovDesignTemplatesPage } from '../pages/EGovDesignTemplatesPage';
import { EGovRulesPage } from '../pages/EGovRulesPage';
import { StockCostingPage } from '../pages/StockCostingPage';
import { AccountingPostPage } from '../pages/AccountingPostPage';
import { AccountingPoolPage } from '../pages/AccountingPoolPage';
import { AccountingParamsPage } from '../pages/AccountingParamsPage';
import { ModuleParamsPage } from '../pages/ModuleParamsPage';
import type { ModuleParamKey } from '../data/paramDefs';
import { CustomerAgingPage } from '../pages/CustomerAgingPage';
import { BoundPortfolioPage } from '../pages/BoundPortfolioPage';
import { ReportSchedulesPage } from '../pages/ReportSchedulesPage';
import { BudgetReportPage } from '../pages/BudgetReportPage';
import { ApprovalGroupsPage } from '../pages/ApprovalGroupsPage';
import { EGovAutoFetchPage } from '../pages/EGovAutoFetchPage';
import { EGovMukellefCheckPage } from '../pages/EGovMukellefCheckPage';
import { EGovConsolePage } from '../pages/EGovConsolePage';
import { EGovTaxReportPage } from '../pages/EGovTaxReportPage';
import { ExtraFieldsAdminPage } from '../pages/ExtraFieldsAdminPage';
import { UserPermissionsPage } from '../pages/UserPermissionsPage';
import { ExternalEmbedPage } from '../pages/ExternalEmbedPage';
import { AddressAdminPage } from '../pages/AddressAdminPage';
import { DatabaseAdminPage } from '../pages/DatabaseAdminPage';
import { CardDefaultsPage } from '../pages/CardDefaultsPage';
import { SqlReportsPage } from '../pages/SqlReportsPage';
import { JournalNumberingPage } from '../pages/JournalNumberingPage';
import { DataImportPage } from '../pages/DataImportPage';
import { ProcessManagementPage } from '../pages/ProcessManagementPage';
import { ProcessDesignerPage } from '../pages/ProcessDesignerPage';
import { ELogoSyncPage } from '../pages/ELogoSyncPage';
import { EGovDocumentListPage } from '../pages/EGovDocumentListPage';
import { CrmWorkspacePage } from '../pages/crm/CrmWorkspacePage';
import { CrmActionsPage } from '../pages/crm/CrmActionsPage';
import { CrmSettingsPage } from '../pages/crm/CrmSettingsPage';

interface ModuleWorkspaceProps {
  module: AppModule;
  activeGroup: MenuGroup;
  activeScreen: MenuScreen;
  parentScreen?: MenuScreen | null;
  onNavigate: (path: string) => void;
  listHandlers: {
    onNew: () => void;
    onView: (id: string | number) => void;
    onEdit: (id: string | number) => void;
    onDelete: (id: string | number) => void;
    onCopy: (id: string | number) => void;
  };
  overlay?: React.ReactNode;
}

export function findScreenInModule(
  module: AppModule,
  path: string,
): { group: MenuGroup; screen: MenuScreen; parent: MenuScreen | null } | null {
  for (const group of module.groups) {
    for (const screen of group.screens) {
      if (path === screen.path || path.startsWith(`${screen.path}/`)) {
        if (screen.children) {
          for (const child of screen.children) {
            if (path === child.path || path.startsWith(`${child.path}/`)) {
              return { group, screen: child, parent: screen };
            }
          }
        }
        if (path === screen.path || path.startsWith(`${screen.path}/`)) {
          const isOnlyPrefixOfChild = screen.children?.some(
            (c) => path === c.path || path.startsWith(`${c.path}/`),
          );
          if (!isOnlyPrefixOfChild) {
            return { group, screen, parent: null };
          }
        }
      }
    }
  }

  // Modül kökü: açılış ekranı (grup sekmesi seçili görünmez)
  if (module.landingScreen && (path === module.path || path === module.landingScreen.path)) {
    return { group: { key: '' as MenuGroup['key'], title: module.landingScreen.title, screens: [] }, screen: module.landingScreen, parent: null };
  }

  const groupKey = path.split('/')[1];
  const group =
    module.groups.find((g) => g.key === groupKey && g.screens.length > 0) ||
    module.groups.find((g) => g.screens.length > 0);
  if (!group?.screens[0]) return null;
  return { group, screen: group.screens[0], parent: null };
}

export const ModuleWorkspace: React.FC<ModuleWorkspaceProps> = ({
  module,
  activeGroup,
  activeScreen,
  parentScreen,
  onNavigate,
  listHandlers,
  overlay,
}) => {
  const [listTick, setListTick] = React.useState(0);
  const groupsWithScreens = module.groups.filter((g) => g.screens.length > 0);
  const screenTabs = activeGroup.screens;

  const primaryTabId = parentScreen?.id || activeScreen.id;
  const parent = parentScreen || (activeScreen.children?.length ? activeScreen : null);
  const childStrip = parent?.children?.length ? parent.children : null;

  const selectGroup = (groupKey: string) => {
    const g = module.groups.find((x) => x.key === groupKey);
    if (!g) return;
    // Grup sekmesi → grup özet dashboard
    onNavigate(`${module.path}/${g.key}`);
  };

  const renderBody = () => {
    if (overlay) return overlay;

    if (activeScreen.isCustomFieldsAdmin) {
      return (
        <ExtraFieldsAdminPage
          tableFilter={activeScreen.customFieldsTable}
          onBack={() => onNavigate(module.path)}
        />
      );
    }
    if (activeScreen.isDbUpdatesAdmin) {
      return (
        <DatabaseAdminPage
          key="db-updates"
          initialTab="updates"
          onBack={() => onNavigate(module.path)}
        />
      );
    }
    if (activeScreen.isDbSettingsAdmin) {
      return (
        <DatabaseAdminPage
          key="db-settings"
          initialTab="connection"
          onBack={() => onNavigate(module.path)}
        />
      );
    }
    if (activeScreen.isCurrencyRates) {
      return <CurrencyRatesPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isEGovDesignTemplates) {
      return <EGovDesignTemplatesPage mode="rules" onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isEGovDesignTool) {
      return <EGovDesignTemplatesPage mode="designs" onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isStockCosting) {
      return <StockCostingPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isAccountingPool) {
      return (
        <AccountingPoolPage
          onBack={() => onNavigate(module.path)}
          onOpenParams={() => onNavigate('muhasebe/islemler/muhasebe-parametreleri')}
        />
      );
    }
    if (activeScreen.isAccountingParams) {
      return <AccountingParamsPage onBack={() => onNavigate(module.path)} />;
    }
    {
      const paramKey = (activeScreen.moduleParamKey ||
        (activeScreen.isKasaParams ? 'kasa' : null)) as ModuleParamKey | null;
      if (paramKey) {
        return (
          <ModuleParamsPage moduleKey={paramKey} onBack={() => onNavigate(module.path)} />
        );
      }
    }
    if (activeScreen.isAccountingPost) {
      return <AccountingPostPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isCustomerAging) {
      return <CustomerAgingPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isBoundPortfolio) {
      return <BoundPortfolioPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isReportSchedules) {
      return <ReportSchedulesPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isBudgetReport) {
      return <BudgetReportPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isEGovRules) {
      return <EGovRulesPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isApprovalGroups) {
      return <ApprovalGroupsPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isEGovAutoFetch) {
      return <EGovAutoFetchPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isEGovMukellefCheck) {
      return <EGovMukellefCheckPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isEGovConsole) {
      return <EGovConsolePage onBack={() => onNavigate(module.path)} onNavigate={onNavigate} />;
    }
    if (activeScreen.isEGovTaxReport) {
      return <EGovTaxReportPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isJournalNumbering) {
      return <JournalNumberingPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isDataImport) {
      return <DataImportPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isUserPermissionsAdmin) {
      return <UserPermissionsPage onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.isAddressAdmin) {
      return (
        <AddressAdminPage
          key={activeScreen.addressLevel || 'province'}
          onBack={() => onNavigate(module.path)}
          initialLevel={activeScreen.addressLevel || 'province'}
        />
      );
    }
    if (activeScreen.isCardDefaultsAdmin) {
      return (
        <CardDefaultsPage
          onBack={() => onNavigate(module.path)}
          kindId={activeScreen.cardDefaultKind}
        />
      );
    }
    if (activeScreen.isProcessDesigner) {
      return (
        <ProcessDesignerPage key={activeScreen.id} onBack={() => onNavigate(module.path)} />
      );
    }
    if (activeScreen.isProcessAdmin) {
      return (
        <ProcessManagementPage
          key={activeScreen.id}
          onBack={() => onNavigate(module.path)}
          initialTab={activeScreen.processAdminTab || 'inbox'}
        />
      );
    }
    if (activeScreen.isCrmWorkspace) {
      return <CrmWorkspacePage key={activeScreen.id} basePath={activeScreen.path} />;
    }
    if (activeScreen.isCrmActionsList) {
      return <CrmActionsPage key={activeScreen.id} />;
    }
    if (activeScreen.isCrmSettings) {
      return <CrmSettingsPage key={activeScreen.id} />;
    }
    if (activeScreen.isELogoSync) {
      return <ELogoSyncPage key={activeScreen.id} onBack={() => onNavigate(module.path)} />;
    }
    if (activeScreen.egovList) {
      return (
        <EGovDocumentListPage
          key={`${activeScreen.id}-${listTick}`}
          screen={activeScreen}
          onNew={listHandlers.onNew}
          onView={listHandlers.onView}
          onEdit={listHandlers.onEdit}
        />
      );
    }
    if (activeScreen.isSqlReportsAdmin) {
      return (
        <SqlReportsPage
          key={activeScreen.id}
          onBack={() => onNavigate(module.path)}
          viewMode={activeScreen.sqlReportsView || 'designer'}
        />
      );
    }
    if (activeScreen.isSqlReportRunner && activeScreen.sqlReportId) {
      return (
        <SqlReportsPage
          key={`run-${activeScreen.sqlReportId}`}
          onBack={() => onNavigate(parentScreen?.path || module.path)}
          viewMode="runner"
          fixedReportId={activeScreen.sqlReportId}
        />
      );
    }
    if (activeScreen.isSqlReportFolder) {
      const kids = activeScreen.children || [];
      return (
        <div className="p-4 space-y-3">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">{activeScreen.title}</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Bu menü altındaki SQL raporları</p>
          </div>
          {kids.length === 0 ? (
            <p className="text-[12px] text-slate-500">Henüz rapor bağlanmamış.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {kids.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onNavigate(c.path)}
                  className="text-left rounded-md border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50"
                >
                  <div className="text-[13px] font-medium text-slate-800">{c.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{c.subtitle}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (activeScreen.externalUrl) {
      return (
        <ExternalEmbedPage
          screen={activeScreen}
          breadcrumb={`${module.title} / ${activeGroup.title}`}
          onBack={() => onNavigate(module.path)}
        />
      );
    }

    return (
      <ModuleListPage
        key={`${activeScreen.id}-${listTick}`}
        screen={activeScreen}
        module={module}
        groupKey={activeGroup.key}
        breadcrumb={`${module.title} / ${activeGroup.title}`}
        hideChrome
        onNew={listHandlers.onNew}
        onBack={() => onNavigate(module.path)}
        onNavigate={onNavigate}
        onView={listHandlers.onView}
        onEdit={listHandlers.onEdit}
        onDelete={listHandlers.onDelete}
        onCopy={listHandlers.onCopy}
      />
    );
  };

  // Formdan listeye dönüşte listeyi yenile
  React.useEffect(() => {
    if (!overlay) setListTick((t) => t + 1);
  }, [overlay]);

  const listTitle = activeScreen.title;

  return (
    <div className={activeScreen.isCrmWorkspace ? 'max-w-[1600px] mx-auto' : 'max-w-6xl mx-auto'}>
      {/* Tek satır: modül + grup sekmeleri */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
        <h1 className="text-[15px] font-semibold text-slate-900 dark:text-white leading-none shrink-0">
          {module.title}
        </h1>
        {groupsWithScreens.length > 1 && (
          <FormTabs
            variant="segment"
            size="sm"
            active={activeGroup.key}
            onChange={selectGroup}
            tabs={groupsWithScreens.map((g) => ({
              id: g.key,
              label: g.title,
            }))}
          />
        )}
        <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[240px]">
          {activeGroup.title}
          {listTitle ? ` · ${listTitle}` : ''}
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Ekran sekmeleri + alt sekmeler aynı bantta */}
        {(screenTabs.length > 0 || childStrip) && (
        <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-1">
          <FormTabs
            variant="pill"
            size="sm"
            flush
            active={primaryTabId}
            onChange={(id) => {
              const s = screenTabs.find((x) => x.id === id);
              if (s) onNavigate(s.path);
            }}
            tabs={screenTabs.map((s) => ({ id: s.id, label: s.title }))}
          />
          {childStrip && childStrip.length > 0 && parent && (
            <FormTabs
              variant="underline"
              size="sm"
              flush
              active={parentScreen ? activeScreen.id : parent.id}
              onChange={(id) => {
                if (id === parent.id) {
                  onNavigate(parent.path);
                  return;
                }
                const child = childStrip.find((c) => c.id === id);
                if (child) onNavigate(child.path);
              }}
              tabs={[
                { id: parent.id, label: 'Genel' },
                ...childStrip.map((c) => ({ id: c.id, label: c.title })),
              ]}
              className="pt-0.5 border-t border-slate-100 dark:border-slate-800"
            />
          )}
        </div>
        )}

        <div className="p-2.5 sm:p-3">{renderBody()}</div>
      </div>
    </div>
  );
};
