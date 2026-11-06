import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { DbConnectionGate } from './components/DbConnectionGate';
import { AuthGate } from './components/AuthGate';
import { OpenDocumentsTray } from './components/OpenDocumentsTray';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { EntityFormPage } from './pages/EntityFormPage';
import { ModuleWorkspace, findScreenInModule } from './components/ModuleWorkspace';
import { ModuleOverviewPage } from './pages/ModuleOverviewPage';
import { canScreen } from './data/permissions';
import { loadExtraFields } from './data/extraFields';
import { HelpPage } from './pages/HelpPage';
import {
  OpenDocumentsProvider,
  createOpenDocId,
  buildOpenDocHref,
} from './contexts/OpenDocumentsContext';
import { AppModulesProvider, findModuleByPath, useAppModules } from './contexts/AppModulesContext';

function readHash(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

type FormMode = 'create' | 'view' | 'edit';

function parseFormSuffix(path: string): {
  basePath: string;
  mode: FormMode | null;
  recordId?: string;
  draftId?: string;
} {
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const prev = segments[segments.length - 2];

  // .../yeni/{draftId}
  if (prev === 'yeni' && last) {
    return {
      basePath: segments.slice(0, -2).join('/'),
      mode: 'create',
      draftId: last,
    };
  }
  if (last === 'yeni') {
    return { basePath: segments.slice(0, -1).join('/'), mode: 'create' };
  }
  if (prev === 'incele' && last) {
    return { basePath: segments.slice(0, -2).join('/'), mode: 'view', recordId: last };
  }
  if (prev === 'degistir' && last) {
    return { basePath: segments.slice(0, -2).join('/'), mode: 'edit', recordId: last };
  }
  return { basePath: path, mode: null };
}

function AppRoutes() {
  const { modules } = useAppModules();
  const [path, setPath] = useState(readHash);

  useEffect(() => {
    void loadExtraFields();
  }, []);

  useEffect(() => {
    const onHash = () => setPath(readHash());
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) {
      window.location.hash = '#/';
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (next: string) => {
    window.location.hash = `#/${next}`;
  };

  const segments = path.split('/').filter(Boolean);
  const { basePath, mode, recordId, draftId } = parseFormSuffix(path);

  // Yeni fiş: draftId yoksa üret ve URL'ye yaz (tray'de kalıcı oturum)
  useEffect(() => {
    if (mode !== 'create' || draftId) return;
    const moduleMeta = findModuleByPath(modules, segments[0]);
    const resolved = moduleMeta ? findScreenInModule(moduleMeta, basePath || moduleMeta.path) : null;
    if (!resolved?.screen.formCode) return;
    const id = createOpenDocId('create');
    navigate(buildOpenDocHref(resolved.screen.path, 'create', { draftId: id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when bare /yeni
  }, [mode, draftId, basePath, segments[0], modules]);

  let content: ReactNode;

  if (!segments.length) {
    content = <HomePage onNavigate={navigate} />;
  } else if (segments[0] === 'rapor' || segments[0] === 'ozet') {
    content = <DashboardPage onNavigate={navigate} />;
  } else if (segments[0] === 'yardim') {
    content = <HelpPage slug={segments.slice(1).join('/') || undefined} onNavigate={navigate} />;
  } else {
    const moduleMeta = findModuleByPath(modules, segments[0]);

    // Modül kökü (#/satis) veya grup kökü (#/satis/hareketler) → özet dashboard; açılış ekranı tanımlı modülde o ekran
    const isModuleRoot = Boolean(moduleMeta && segments.length === 1 && !mode && !moduleMeta.landingScreen);
    const groupForOverview =
      moduleMeta && segments.length === 2 && !mode
        ? moduleMeta.groups.find((g) => g.key === segments[1])
        : undefined;
    const isGroupRoot = Boolean(moduleMeta && groupForOverview && !mode);

    if (isModuleRoot && moduleMeta) {
      content = (
        <ModuleOverviewPage module={moduleMeta} onNavigate={navigate} />
      );
    } else if (isGroupRoot && moduleMeta && groupForOverview) {
      content = (
        <ModuleOverviewPage
          module={moduleMeta}
          group={groupForOverview}
          onNavigate={navigate}
          listPath={groupForOverview.screens[0]?.path}
        />
      );
    } else {
    const resolved = moduleMeta ? findScreenInModule(moduleMeta, basePath || moduleMeta.path) : null;

    if (moduleMeta && resolved) {
      const { group, screen, parent } = resolved;
      const formOverlay =
        mode && screen.formCode && (mode !== 'create' || draftId)
          ? (() => {
              const actionOk =
                mode === 'create'
                  ? canScreen(screen.id, 'create')
                  : mode === 'view'
                    ? canScreen(screen.id, 'view')
                    : canScreen(screen.id, 'update');
              if (!actionOk) {
                return (
                  <div className="text-center py-8">
                    <p className="text-[13px] text-slate-600 font-medium">Bu işlem için yetkiniz yok</p>
                    <button
                      type="button"
                      className="mt-2 text-[12px] text-blue-600 font-semibold"
                      onClick={() => navigate(screen.path)}
                    >
                      Listeye dön
                    </button>
                  </div>
                );
              }
              const resolvedDraftId =
                mode === 'create'
                  ? draftId!
                  : createOpenDocId(mode, recordId);
              return (
                <EntityFormPage
                  key={resolvedDraftId}
                  formCode={screen.formCode}
                  mode={mode}
                  recordId={recordId}
                  draftId={resolvedDraftId}
                  screenPath={screen.path}
                  screenTitle={screen.title}
                  onBack={() => navigate(screen.path)}
                />
              );
            })()
          : undefined;

      content = (
        <ModuleWorkspace
          module={moduleMeta}
          activeGroup={group}
          activeScreen={screen}
          parentScreen={parent}
          onNavigate={navigate}
          overlay={formOverlay}
          listHandlers={{
            onNew: () => {
              const id = createOpenDocId('create');
              navigate(buildOpenDocHref(screen.path, 'create', { draftId: id }));
            },
            onView: (id) => navigate(`${screen.path}/incele/${id}`),
            onEdit: (id) => navigate(`${screen.path}/degistir/${id}`),
            onDelete: (id) => {
              console.log(`[${screen.id}] delete`, id);
              alert(`Kayıt çıkarıldı (demo): #${id}`);
            },
            onCopy: (id) => {
              console.log(`[${screen.id}] copy`, id);
              const draft = createOpenDocId('create');
              navigate(buildOpenDocHref(screen.path, 'create', { draftId: draft }));
            },
          }}
        />
      );
    } else {
      content = (
        <div className="text-center py-12">
          <p className="text-[13px] text-slate-600 font-medium">Sayfa bulunamadı</p>
          <p className="text-[11px] text-slate-400 mt-1">{path || '/'}</p>
          <button
            type="button"
            className="mt-2 text-[12px] text-blue-600 font-semibold"
            onClick={() => navigate('')}
          >
            Ana sayfaya dön
          </button>
        </div>
      );
    }
    } // end !isModuleRoot && !isGroupRoot
  }

  return (
    <DbConnectionGate>
      <AuthGate>
        <OpenDocumentsProvider>
          <AppShell currentPath={path} onNavigate={navigate}>
            {content}
          </AppShell>
          <OpenDocumentsTray onNavigate={navigate} />
        </OpenDocumentsProvider>
      </AuthGate>
    </DbConnectionGate>
  );
}

function App() {
  return (
    <AppModulesProvider>
      <AppRoutes />
    </AppModulesProvider>
  );
}

export default App;
