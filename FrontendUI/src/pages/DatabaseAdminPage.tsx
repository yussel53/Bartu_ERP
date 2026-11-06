import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  FileCode2,
  FlaskConical,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiJson, ApiError, restartAfterDbChange } from '../config/api';
import { DbSettingsFormPanel, DbSettingsForm } from '../components/DbSettingsFormPanel';
import { appConfirm } from '../utils/appConfirm';
import { SystemMaintenancePanel } from '../components/SystemMaintenancePanel';

export type DbAdminTab = 'connection' | 'create' | 'updates' | 'lab';

interface Props {
  onBack: () => void;
  initialTab?: DbAdminTab;
}

interface StatusDto {
  needsSetup: boolean;
  configured: boolean;
  canConnect: boolean;
  message?: string | null;
  server?: string | null;
  database?: string | null;
}

interface BootstrapStatus {
  scriptsRoot: string;
  server: string;
  database: string;
  configured: boolean;
  serverOk: boolean;
  databaseExists: boolean;
  tableCount: number;
  hasSysDbUpdates: boolean;
  message?: string | null;
  bootstrapScripts: {
    fileName: string;
    title: string;
    fullPath: string;
    exists: boolean;
    sizeBytes: number;
  }[];
}

interface BootstrapResult {
  success: boolean;
  message: string;
  steps: { step: string; success: boolean; message: string }[];
  sqlUpdates?: { scriptName: string; success: boolean; message: string }[];
}

interface DbUpdateScript {
  scriptName: string;
  title: string;
  sequence: number;
  applied: boolean;
  appliedAt?: string | null;
  sizeBytes: number;
}

interface DbUpdateStatus {
  folderPath: string;
  total: number;
  appliedCount: number;
  pendingCount: number;
  connectionWarning?: string | null;
  scripts: DbUpdateScript[];
}

interface DbUpdateApplyResult {
  scriptName: string;
  success: boolean;
  message: string;
  appliedAt?: string | null;
}

const PUBLIC_TABS: { id: Exclude<DbAdminTab, 'lab'>; label: string; icon: React.ReactNode }[] = [
  { id: 'connection', label: 'Bağlantı', icon: <Settings2 className="w-3.5 h-3.5" /> },
  { id: 'create', label: 'Sıfırdan Oluştur', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'updates', label: 'Güncelleme', icon: <Database className="w-3.5 h-3.5" /> },
];

const WIPE_PHRASE = 'TUM VERIYI SIL';

function todayTr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

type WipeStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DatabaseAdminPage: React.FC<Props> = ({ onBack, initialTab = 'connection' }) => {
  const [tab, setTab] = useState<DbAdminTab>(initialTab === 'lab' ? 'connection' : initialTab);
  const [labUnlocked, setLabUnlocked] = useState(false);
  const [connStatus, setConnStatus] = useState<StatusDto | null>(null);
  const [connInitial, setConnInitial] = useState<Partial<DbSettingsForm> | null>(null);
  const [connTick, setConnTick] = useState(0);
  const [connLoading, setConnLoading] = useState(true);
  const [connError, setConnError] = useState<string | null>(null);

  const [boot, setBoot] = useState<BootstrapStatus | null>(null);
  const [bootBusy, setBootBusy] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootResult, setBootResult] = useState<BootstrapResult | null>(null);
  const [opts, setOpts] = useState({
    createDatabaseIfMissing: true,
    runCreateDb: true,
    runSysTables: true,
    applySqlUpdates: true,
    forceSchemaScripts: false,
  });
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);

  const [upd, setUpd] = useState<DbUpdateStatus | null>(null);
  const [updLoading, setUpdLoading] = useState(false);
  const [updBusy, setUpdBusy] = useState<string | null>(null);
  const [updError, setUpdError] = useState<string | null>(null);
  const [updResults, setUpdResults] = useState<DbUpdateApplyResult[]>([]);

  const [wipeStep, setWipeStep] = useState<WipeStep>(0);
  const [wipeServer, setWipeServer] = useState('');
  const [wipeDatabase, setWipeDatabase] = useState('');
  const [wipePhrase, setWipePhrase] = useState('');
  const [wipeDate, setWipeDate] = useState('');
  const [wipeSecret, setWipeSecret] = useState('');
  const [wipeBusy, setWipeBusy] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeResult, setWipeResult] = useState<BootstrapResult | null>(null);

  useEffect(() => {
    if (initialTab !== 'lab') setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        setLabUnlocked(true);
        setTab('lab');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const unlockLab = (e: React.MouseEvent) => {
    if (e.shiftKey && e.altKey) {
      e.preventDefault();
      setLabUnlocked(true);
      setTab('lab');
    }
  };

  const loadConnection = useCallback(async () => {
    setConnLoading(true);
    setConnError(null);
    try {
      const [st, settings] = await Promise.all([
        apiJson<StatusDto>('/api/db-settings/status'),
        apiJson<{
          server: string;
          database: string;
          trustedConnection: boolean;
          userId?: string | null;
          trustServerCertificate: boolean;
          passwordSet: boolean;
        }>('/api/db-settings'),
      ]);
      setConnStatus(st);
      setConnInitial({
        server: settings.server || 'localhost',
        database: settings.database || 'Bartu_ERP',
        trustedConnection: settings.trustedConnection,
        userId: settings.userId || '',
        password: '',
        trustServerCertificate: settings.trustServerCertificate,
        passwordSet: settings.passwordSet,
      });
    } catch (e) {
      setConnError(e instanceof Error ? e.message : 'Yüklenemedi');
      setConnInitial({
        server: 'localhost',
        database: 'Bartu_ERP',
        trustedConnection: true,
        userId: '',
        password: '',
        trustServerCertificate: true,
      });
    } finally {
      setConnLoading(false);
    }
  }, []);

  const loadBootstrap = useCallback(async () => {
    setBootError(null);
    try {
      setBoot(await apiJson<BootstrapStatus>('/api/db-bootstrap/status'));
    } catch (e) {
      setBootError(e instanceof Error ? e.message : 'Durum alınamadı');
      setBoot(null);
    }
  }, []);

  const loadUpdates = useCallback(async () => {
    setUpdLoading(true);
    setUpdError(null);
    try {
      setUpd(await apiJson<DbUpdateStatus>('/api/db-updates'));
    } catch (e) {
      setUpdError(e instanceof Error ? e.message : 'Yüklenemedi');
      setUpd(null);
    } finally {
      setUpdLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection, connTick]);

  useEffect(() => {
    if (tab === 'create' || tab === 'lab') void loadBootstrap();
    if (tab === 'updates') void loadUpdates();
  }, [tab, loadBootstrap, loadUpdates]);

  const runBootstrap = async () => {
    if (
      !await appConfirm(
        opts.forceSchemaScripts
          ? 'Create_DB mevcut tablolarda hata verebilir. Devam?'
          : 'Veritabanı oluşturulacak / şema scriptleri çalışacak. Devam?',
      )
    ) {
      return;
    }
    setBootBusy(true);
    setBootError(null);
    setBootResult(null);
    try {
      const result = await apiJson<BootstrapResult>('/api/db-bootstrap/create', {
        method: 'POST',
        body: JSON.stringify(opts),
      });
      setBootResult(result);
      if (!result.success) {
        setBootError(result.message);
        await loadBootstrap();
        return;
      }
      // Yeni / hazırlanan DB ile oturumu temiz başlat
      await restartAfterDbChange(boot?.database || connStatus?.database);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Oluşturma başarısız';
      setBootError(msg);
      await loadBootstrap();
    } finally {
      setBootBusy(false);
    }
  };

  const showBootstrapPreview = async (fileName: string) => {
    try {
      const data = await apiJson<{ fileName: string; content: string }>(
        `/api/db-bootstrap/scripts/${encodeURIComponent(fileName)}`,
      );
      setPreview({ name: data.fileName, content: data.content });
    } catch (e) {
      setBootError(e instanceof Error ? e.message : 'Önizleme alınamadı');
    }
  };

  const applyOne = async (scriptName: string) => {
    setUpdBusy(scriptName);
    setUpdError(null);
    try {
      const result = await apiJson<DbUpdateApplyResult>(
        `/api/db-updates/${encodeURIComponent(scriptName)}/apply?appliedBy=UI`,
        { method: 'POST' },
      );
      setUpdResults([result]);
      await loadUpdates();
    } catch (e) {
      const fromBody =
        e instanceof ApiError &&
        e.body &&
        typeof e.body === 'object' &&
        !Array.isArray(e.body) &&
        typeof (e.body as DbUpdateApplyResult).message === 'string'
          ? (e.body as DbUpdateApplyResult)
          : null;
      setUpdResults([
        fromBody ?? {
          scriptName,
          success: false,
          message: e instanceof Error ? e.message : 'Uygulanamadı',
        },
      ]);
      setUpdError(null);
      await loadUpdates();
    } finally {
      setUpdBusy(null);
    }
  };

  const applyPending = async () => {
    setUpdBusy('__all__');
    setUpdError(null);
    try {
      const results = await apiJson<DbUpdateApplyResult[]>('/api/db-updates/apply-pending?appliedBy=UI', {
        method: 'POST',
      });
      setUpdResults(results);
      await loadUpdates();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body)) {
        setUpdResults(e.body as DbUpdateApplyResult[]);
        setUpdError(null);
      } else {
        setUpdError(e instanceof Error ? e.message : 'Toplu uygulama başarısız');
      }
      await loadUpdates();
    } finally {
      setUpdBusy(null);
    }
  };

  const showUpdatePreview = async (scriptName: string) => {
    setUpdBusy(`preview:${scriptName}`);
    try {
      const data = await apiJson<{ scriptName: string; content: string }>(
        `/api/db-updates/${encodeURIComponent(scriptName)}`,
      );
      setPreview({ name: data.scriptName, content: data.content });
    } catch (e) {
      setUpdError(e instanceof Error ? e.message : 'Önizleme alınamadı');
    } finally {
      setUpdBusy(null);
    }
  };

  const resetWipeWizard = () => {
    setWipeStep(0);
    setWipeServer('');
    setWipeDatabase('');
    setWipePhrase('');
    setWipeDate('');
    setWipeSecret('');
    setWipeError(null);
    setWipeResult(null);
  };

  const wipeStepValid = (): boolean => {
    const srv = (boot?.server || connStatus?.server || '').trim();
    const db = (boot?.database || connStatus?.database || '').trim();
    switch (wipeStep) {
      case 0:
        return true;
      case 1:
        return wipeServer.trim().localeCompare(srv, undefined, { sensitivity: 'accent' }) === 0;
      case 2:
        return wipeDatabase.trim().localeCompare(db, undefined, { sensitivity: 'accent' }) === 0;
      case 3:
        return wipePhrase.trim() === WIPE_PHRASE;
      case 4:
        return wipeDate.trim() === todayTr();
      case 5:
        return wipeSecret.trim().length > 0;
      case 6:
        return true;
      default:
        return false;
    }
  };

  const runWipe = async () => {
    if (
      !await appConfirm(
        'SON UYARI: Bağlı veritabanı tamamen silinip yeniden kurulacak. Tüm veri kaybolur. Emin misiniz?',
      )
    ) {
      return;
    }
    setWipeBusy(true);
    setWipeError(null);
    setWipeResult(null);
    try {
      const result = await apiJson<BootstrapResult>('/api/db-bootstrap/wipe', {
        method: 'POST',
        body: JSON.stringify({
          confirmServer: wipeServer.trim(),
          confirmDatabase: wipeDatabase.trim(),
          confirmPhrase: wipePhrase.trim(),
          confirmDate: wipeDate.trim(),
          wipeSecret: wipeSecret.trim(),
          recreateAfterDrop: true,
        }),
      });
      setWipeResult(result);
      if (!result.success) {
        setWipeError(result.message);
        return;
      }
      await restartAfterDbChange(wipeDatabase || boot?.database || connStatus?.database);
      return;
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object' && !Array.isArray(e.body)) {
        const body = e.body as BootstrapResult;
        if (typeof body.message === 'string') {
          setWipeResult(body);
          setWipeError(body.message);
          return;
        }
      }
      setWipeError(e instanceof Error ? e.message : 'Sıfırlama başarısız');
    } finally {
      setWipeBusy(false);
    }
  };

  const tabs = labUnlocked
    ? [
        ...PUBLIC_TABS,
        {
          id: 'lab' as const,
          label: 'Laboratuvar',
          icon: <FlaskConical className="w-3.5 h-3.5" />,
        },
      ]
    : PUBLIC_TABS;

  const targetServer = boot?.server || connStatus?.server || '—';
  const targetDatabase = boot?.database || connStatus?.database || '—';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1
            className="text-[16px] font-semibold text-slate-800 flex items-center gap-2 select-none"
            onClick={unlockLab}
            title={labUnlocked ? undefined : undefined}
          >
            <Database className="w-4 h-4 text-slate-500" />
            Veritabanı Yönetimi
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Bağlantı bilgileri · sıfırdan oluşturma (Create_DB) · SqlUpdates
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-semibold transition-colors ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'connection' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConnTick((t) => t + 1)}
              className="inline-flex items-center gap-1 h-8 px-2 text-[11px] font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Yenile
            </button>
          </div>

          {connStatus && (
            <div
              className={`rounded-md border px-3 py-2 text-[12px] ${
                connStatus.canConnect
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {connStatus.canConnect
                ? `Bağlı: ${connStatus.server} / ${connStatus.database}`
                : connStatus.message || 'Bağlantı yok'}
              {!connStatus.canConnect && connStatus.configured && (
                <button
                  type="button"
                  className="ml-2 underline font-semibold"
                  onClick={() => setTab('create')}
                >
                  Sıfırdan Oluştur →
                </button>
              )}
            </div>
          )}

          {connError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {connError}
            </div>
          )}

          {connLoading || !connInitial ? (
            <div className="py-10 text-center text-[12px] text-slate-500">Yükleniyor…</div>
          ) : (
            <DbSettingsFormPanel
              key={connTick}
              initial={connInitial}
              onSaved={() => {
                setConnTick((t) => t + 1);
                void loadBootstrap();
              }}
            />
          )}
        </div>
      )}

      {tab === 'create' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold text-slate-800">Sıfırdan veritabanı</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  master üzerinden CREATE DATABASE → Create_DB.sql → SYS_Tables_And_UDF.sql → SqlUpdates
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadBootstrap()}
                className="inline-flex items-center gap-1 h-8 px-2 text-[11px] font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Yenile
              </button>
            </div>

            {boot && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] uppercase text-slate-400">Sunucu</div>
                  <div className="font-medium text-slate-800 truncate">{boot.server || '—'}</div>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] uppercase text-slate-400">Veritabanı</div>
                  <div className="font-medium text-slate-800 truncate">{boot.database || '—'}</div>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] uppercase text-slate-400">DB durumu</div>
                  <div className="font-medium text-slate-800">
                    {boot.databaseExists ? `Var · ${boot.tableCount} tablo` : 'Yok'}
                  </div>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <div className="text-[10px] uppercase text-slate-400">Sunucu erişimi</div>
                  <div className={`font-medium ${boot.serverOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {boot.serverOk ? 'OK' : 'Yok'}
                  </div>
                </div>
              </div>
            )}

            {boot?.message && (
              <p className="text-[11px] text-slate-500">{boot.message}</p>
            )}

            <div className="space-y-2 border-t border-slate-100 pt-3">
              {(
                [
                  ['createDatabaseIfMissing', 'Veritabanı yoksa CREATE DATABASE'],
                  ['runCreateDb', 'Create_DB.sql çalıştır'],
                  ['runSysTables', 'SYS_Tables_And_UDF.sql çalıştır'],
                  ['applySqlUpdates', 'Bekleyen SqlUpdates uygula'],
                  ['forceSchemaScripts', 'Zorla Create_DB (mevcut tablolar olsa da)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[12px] text-slate-700">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={opts[key]}
                    onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="rounded-md border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] uppercase text-slate-500">
                    <th className="px-3 py-2 font-medium">Bootstrap script</th>
                    <th className="px-3 py-2 font-medium">Durum</th>
                    <th className="px-3 py-2 font-medium text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {(boot?.bootstrapScripts || []).map((s) => (
                    <tr key={s.fileName} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="text-[12px] font-medium text-slate-800">{s.fileName}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-md" title={s.fullPath}>
                          {s.exists ? `${Math.round(s.sizeBytes / 1024)} KB` : 'Dosya yok'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {s.exists ? (
                          <span className="text-emerald-700 font-medium">Hazır</span>
                        ) : (
                          <span className="text-red-600 font-medium">Eksik</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={!s.exists}
                          onClick={() => void showBootstrapPreview(s.fileName)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
                        >
                          <FileCode2 className="w-3 h-3" /> SQL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bootError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {bootError}
              </div>
            )}

            {bootResult && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] space-y-1">
                <div className={bootResult.success ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                  {bootResult.message}
                </div>
                {bootResult.steps.map((s, i) => (
                  <div key={`${s.step}-${i}`} className={s.success ? 'text-emerald-700' : 'text-red-700'}>
                    <span className="font-medium">{s.step}</span>: {s.message}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={bootBusy || !boot?.configured}
              onClick={() => void runBootstrap()}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {bootBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Veritabanını Oluştur / Hazırla
            </button>
          </div>
        </div>
      )}

      {tab === 'updates' && (
        <div className="space-y-4">
          <SystemMaintenancePanel />
          <div className="flex items-start justify-between gap-3">
            <p className="text-[12px] text-slate-500">
              Scriptler:{' '}
              <code className="text-[11px] bg-slate-100 px-1 rounded">
                SqlUpdates/yyyyMMdd_HHmmss_xxx.sql
              </code>
              <span className="text-slate-400"> (eski NN_xxx korunur)</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadUpdates()}
                disabled={updLoading || !!updBusy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${updLoading ? 'animate-spin' : ''}`} />
                Yenile
              </button>
              <button
                type="button"
                onClick={() => void applyPending()}
                disabled={updLoading || !!updBusy || !upd?.pendingCount}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {updBusy === '__all__' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Bekleyenleri uygula
              </button>
            </div>
          </div>

          {upd && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Toplam</div>
                <div className="text-[18px] font-semibold text-slate-800">{upd.total}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Uygulanan</div>
                <div className="text-[18px] font-semibold text-emerald-700">{upd.appliedCount}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Bekleyen</div>
                <div className="text-[18px] font-semibold text-amber-700">{upd.pendingCount}</div>
              </div>
            </div>
          )}

          {upd?.folderPath && (
            <p className="text-[11px] text-slate-400 truncate" title={upd.folderPath}>
              Klasör: {upd.folderPath}
            </p>
          )}

          {upd?.connectionWarning && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {upd.connectionWarning}
            </div>
          )}

          {updError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
              {updError}
            </div>
          )}

          {updResults.length > 0 && updResults.every((r) => r.success) && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] space-y-1">
              {updResults.map((r) => (
                <div key={r.scriptName} className="text-emerald-700">
                  <span className="font-medium">{r.scriptName}</span>: {r.message}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium w-10">#</th>
                  <th className="px-3 py-2 font-medium">Script</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {updLoading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Yükleniyor…
                    </td>
                  </tr>
                )}
                {!updLoading && upd?.scripts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-slate-400">
                      SqlUpdates klasöründe script yok
                    </td>
                  </tr>
                )}
                {upd?.scripts.map((s) => {
                  const applyResult = updResults.find((r) => r.scriptName === s.scriptName);
                  return (
                  <tr key={s.scriptName} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-[12px] text-slate-400 tabular-nums align-top">{s.sequence}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-[12px] font-medium text-slate-800">{s.scriptName}</div>
                      <div className="text-[11px] text-slate-500">{s.title}</div>
                    </td>
                    <td className="px-3 py-2 align-top min-w-[12rem] max-w-md">
                      {s.applied ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Uygulandı
                          {s.appliedAt && (
                            <span className="text-slate-400 font-normal ml-1">
                              {new Date(s.appliedAt).toLocaleString('tr-TR')}
                            </span>
                          )}
                        </span>
                      ) : applyResult && !applyResult.success ? (
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-semibold text-red-700">Hata</span>
                          <div
                            className="text-[11px] leading-snug text-red-600 break-words"
                            title={applyResult.message}
                          >
                            {applyResult.message}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700">Bekliyor</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void showUpdatePreview(s.scriptName)}
                          disabled={!!updBusy}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                          <FileCode2 className="w-3 h-3" />
                          SQL
                        </button>
                        {!s.applied && (
                          <button
                            type="button"
                            onClick={() => void applyOne(s.scriptName)}
                            disabled={!!updBusy}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            {updBusy === s.scriptName ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                            Uygula
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lab' && labUnlocked && (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-300 bg-red-50/60 p-4 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold text-red-900 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4" />
                  Laboratuvar — tüm veritabanını sıfırla
                </h2>
                <p className="text-[11px] text-red-800/80 mt-1">
                  Hedef: <span className="font-semibold">{targetServer}</span>
                  {' / '}
                  <span className="font-semibold">{targetDatabase}</span>
                  {boot?.databaseExists ? ` · ${boot.tableCount} tablo` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={resetWipeWizard}
                className="text-[11px] font-semibold text-red-800 underline"
              >
                Baştan
              </button>
            </div>

            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${
                    s <= wipeStep ? 'bg-red-600' : 'bg-red-200'
                  }`}
                />
              ))}
            </div>

            {wipeStep === 0 && (
              <div className="space-y-3 text-[12px] text-red-950">
                <p className="font-semibold">Bu işlem geri alınamaz.</p>
                <ul className="list-disc pl-4 space-y-1 text-red-900/90">
                  <li>Bağlı SQL veritabanı DROP edilir</li>
                  <li>Create_DB + SYS + SqlUpdates ile yeniden kurulur</li>
                  <li>Tüm kartlar, fişler ve kullanıcı verisi silinir</li>
                </ul>
                <p className="text-[11px] text-red-800/70">
                  Yalnızca geliştirme / laboratuvar ortamında kullanın.
                </p>
              </div>
            )}

            {wipeStep === 1 && (
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-red-950">
                  1. Sunucu adını birebir yazın
                </label>
                <p className="text-[11px] text-red-800/70">Beklenen: {targetServer}</p>
                <input
                  className="w-full h-9 px-3 text-[13px] border border-red-300 rounded-md bg-white"
                  value={wipeServer}
                  onChange={(e) => setWipeServer(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            {wipeStep === 2 && (
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-red-950">
                  2. Veritabanı adını birebir yazın
                </label>
                <p className="text-[11px] text-red-800/70">Beklenen: {targetDatabase}</p>
                <input
                  className="w-full h-9 px-3 text-[13px] border border-red-300 rounded-md bg-white"
                  value={wipeDatabase}
                  onChange={(e) => setWipeDatabase(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            {wipeStep === 3 && (
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-red-950">
                  3. Onay cümlesini yazın
                </label>
                <p className="text-[11px] text-red-800/70">
                  Büyük harfle: <code className="bg-white/80 px-1 rounded">{WIPE_PHRASE}</code>
                </p>
                <input
                  className="w-full h-9 px-3 text-[13px] border border-red-300 rounded-md bg-white font-mono"
                  value={wipePhrase}
                  onChange={(e) => setWipePhrase(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            {wipeStep === 4 && (
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-red-950">
                  4. Bugünün tarihini yazın (gg.aa.yyyy)
                </label>
                <input
                  className="w-full h-9 px-3 text-[13px] border border-red-300 rounded-md bg-white font-mono"
                  value={wipeDate}
                  onChange={(e) => setWipeDate(e.target.value)}
                  placeholder="örn. 01.11.2026"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}

            {wipeStep === 5 && (
              <div className="space-y-2">
                <label className="block text-[12px] font-semibold text-red-950">
                  5. Sıfırlama anahtarını girin
                </label>
                <p className="text-[11px] text-red-800/70">
                  appsettings Development: <code className="bg-white/80 px-1 rounded">DbBootstrap:WipeSecret</code>
                </p>
                <input
                  type="password"
                  className="w-full h-9 px-3 text-[13px] border border-red-300 rounded-md bg-white"
                  value={wipeSecret}
                  onChange={(e) => setWipeSecret(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            {wipeStep === 6 && (
              <div className="space-y-2 text-[12px] text-red-950">
                <p className="font-semibold">Son adım — özet</p>
                <ul className="space-y-1 text-[11px] font-mono bg-white/70 border border-red-200 rounded-md px-3 py-2">
                  <li>Sunucu: {wipeServer}</li>
                  <li>Veritabanı: {wipeDatabase}</li>
                  <li>Cümle: {wipePhrase}</li>
                  <li>Tarih: {wipeDate}</li>
                  <li>Anahtar: {'•'.repeat(Math.min(wipeSecret.length, 12))}</li>
                </ul>
              </div>
            )}

            {wipeError && (
              <div className="rounded-md border border-red-400 bg-white px-3 py-2 text-[12px] text-red-700">
                {wipeError}
              </div>
            )}

            {wipeResult && (
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] space-y-1">
                <div className={wipeResult.success ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                  {wipeResult.message}
                </div>
                {wipeResult.steps.map((s, i) => (
                  <div key={`${s.step}-${i}`} className={s.success ? 'text-emerald-700' : 'text-red-700'}>
                    <span className="font-medium">{s.step}</span>: {s.message}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={wipeStep === 0 || wipeBusy}
                onClick={() => setWipeStep((s) => (s > 0 ? ((s - 1) as WipeStep) : s))}
                className="h-9 px-3 text-[12px] font-semibold border border-red-300 rounded-md text-red-900 hover:bg-white disabled:opacity-40"
              >
                Geri
              </button>
              {wipeStep < 6 ? (
                <button
                  type="button"
                  disabled={!wipeStepValid() || wipeBusy}
                  onClick={() => setWipeStep((s) => ((s + 1) as WipeStep))}
                  className="h-9 px-4 text-[12px] font-semibold rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-40"
                >
                  Devam
                </button>
              ) : (
                <button
                  type="button"
                  disabled={wipeBusy || !boot?.configured}
                  onClick={() => void runWipe()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold rounded-md bg-red-800 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {wipeBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Veritabanını sıfırla
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="text-[13px] font-semibold text-slate-800">{preview.name}</div>
              <button
                type="button"
                className="text-[12px] text-slate-500 hover:text-slate-800"
                onClick={() => setPreview(null)}
              >
                Kapat
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-slate-700 bg-slate-50 font-mono whitespace-pre-wrap">
              {preview.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
