import React, { useEffect, useState } from 'react';
import { ArrowLeft, Database, RefreshCw } from 'lucide-react';
import { apiJson } from '../config/api';
import { DbSettingsFormPanel, DbSettingsForm } from '../components/DbSettingsFormPanel';

interface Props {
  onBack: () => void;
}

interface StatusDto {
  needsSetup: boolean;
  configured: boolean;
  canConnect: boolean;
  message?: string | null;
  server?: string | null;
  database?: string | null;
}

export const DbSettingsPage: React.FC<Props> = ({ onBack }) => {
  const [status, setStatus] = useState<StatusDto | null>(null);
  const [initial, setInitial] = useState<Partial<DbSettingsForm> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
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
        if (cancelled) return;
        setStatus(st);
        setInitial({
          server: settings.server || 'localhost',
          database: settings.database || 'Bartu_ERP',
          trustedConnection: settings.trustedConnection,
          userId: settings.userId || '',
          password: '',
          trustServerCertificate: settings.trustServerCertificate,
          passwordSet: settings.passwordSet,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Yüklenemedi');
          setInitial({
            server: 'localhost',
            database: 'Bartu_ERP',
            trustedConnection: true,
            userId: '',
            password: '',
            trustServerCertificate: true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            DB Ayarları
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            SQL Server bağlantısı — kayıt: BackendAPI/Data/dbsettings.json
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          className="inline-flex items-center gap-1 h-8 px-2 text-[11px] font-semibold border border-slate-300 rounded-md hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Yenile
        </button>
      </div>

      {status && (
        <div
          className={`rounded-md border px-3 py-2 text-[12px] ${
            status.canConnect
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {status.canConnect
            ? `Bağlı: ${status.server} / ${status.database}`
            : `Bağlantı yok: ${status.message || '—'}`}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error} — API çalışıyor mu? ({' '}
          <span className="font-mono">VITE_API_URL</span> )
        </div>
      )}

      {loading || !initial ? (
        <div className="py-10 text-center text-[12px] text-slate-500">Yükleniyor…</div>
      ) : (
        <DbSettingsFormPanel
          key={tick}
          initial={initial}
          onSaved={() => setTick((t) => t + 1)}
        />
      )}
    </div>
  );
};
