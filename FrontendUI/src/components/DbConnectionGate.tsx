import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiJson } from '../config/api';
import { DbSettingsFormPanel } from './DbSettingsFormPanel';
import { DatabaseAdminPage } from '../pages/DatabaseAdminPage';
import { loadSystemInfo } from '../api/systemApi';
import { ExitAppButton } from './ExitAppButton';

interface StatusDto {
  needsSetup: boolean;
  configured: boolean;
  canConnect: boolean;
  message?: string | null;
  database?: string | null;
}

interface Props {
  children: React.ReactNode;
}

/**
 * SQL bağlantısı / DB yoksa kurulum (bağlantı + sıfırdan oluştur) gösterir.
 * Bağlantı hazır olunca sistem bilgisi (tarih formatı vb.) bir kez yüklenir.
 */
export const DbConnectionGate: React.FC<Props> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showFullAdmin, setShowFullAdmin] = useState(false);
  const [systemReady, setSystemReady] = useState(false);

  const check = async () => {
    setChecking(true);
    setApiError(null);
    setSystemReady(false);
    try {
      const st = await apiJson<StatusDto>('/api/db-settings/status');
      setNeedsSetup(Boolean(st.needsSetup));
      setConfigured(Boolean(st.configured));
      if (!st.needsSetup) {
        setShowFullAdmin(false);
        await loadSystemInfo();
        setSystemReady(true);
      }
    } catch (e) {
      setNeedsSetup(true);
      setConfigured(false);
      setApiError(
        e instanceof Error
          ? e.message
          : 'API yanıt vermiyor. BackendAPI çalıştırıldığından emin olun.',
      );
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
  }, []);

  if (checking || (!needsSetup && !systemReady)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-4">
        <div className="flex items-center gap-2 text-[13px] text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          {checking ? 'Bağlantı kontrol ediliyor…' : 'Sistem bilgileri alınıyor…'}
        </div>
        <ExitAppButton />
      </div>
    );
  }

  if (needsSetup) {
    if (showFullAdmin || configured) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-8">
          <div className="max-w-4xl mx-auto mb-3 flex justify-end">
            <ExitAppButton />
          </div>
          {apiError && (
            <div className="max-w-4xl mx-auto mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {apiError}
            </div>
          )}
          <DatabaseAdminPage
            initialTab={configured ? 'create' : 'connection'}
            onBack={() => {
              void check();
            }}
          />
          <div className="max-w-4xl mx-auto mt-3 text-center">
            <button
              type="button"
              className="text-[12px] text-slate-500 hover:text-slate-800 underline"
              onClick={() => void check()}
            >
              Kurulumu yeniden kontrol et
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-10">
        <div className="w-full max-w-lg space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold text-slate-800">KaviSoft</div>
              <div className="text-[11px] text-slate-500">Veritabanı bağlantısı</div>
            </div>
            <ExitAppButton />
          </div>
          {apiError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {apiError}
            </div>
          )}
          <DbSettingsFormPanel
            setupMode
            onSaved={() => {
              setShowFullAdmin(true);
              void check();
            }}
          />
          <button
            type="button"
            className="w-full text-[12px] text-slate-500 hover:text-slate-800"
            onClick={() => setShowFullAdmin(true)}
          >
            Gelişmiş: Sıfırdan oluştur / SqlUpdates →
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
