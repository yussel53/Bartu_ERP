import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Database, FileCode2, Loader2, Play, RefreshCw } from 'lucide-react';
import { apiJson, ApiError } from '../config/api';

interface DbUpdateScript {
  scriptName: string;
  title: string;
  sequence: number;
  applied: boolean;
  appliedAt?: string | null;
  message?: string | null;
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiJson<T>(path, init);
}

interface Props {
  onBack: () => void;
}

export const DatabaseUpdatesPage: React.FC<Props> = ({ onBack }) => {
  const [status, setStatus] = useState<DbUpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const [lastResults, setLastResults] = useState<DbUpdateApplyResult[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<DbUpdateStatus>('/api/db-updates');
      setStatus(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — BackendAPI http://localhost:5205 çalışıyor mu? Vite proxy /api → 5205`
          : 'Yüklenemedi',
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyOne = async (scriptName: string) => {
    setBusy(scriptName);
    setError(null);
    try {
      const result = await api<DbUpdateApplyResult>(
        `/api/db-updates/${encodeURIComponent(scriptName)}/apply?appliedBy=UI`,
        { method: 'POST' },
      );
      setLastResults([result]);
      await load();
    } catch (e) {
      const fromBody =
        e instanceof ApiError &&
        e.body &&
        typeof e.body === 'object' &&
        !Array.isArray(e.body) &&
        typeof (e.body as DbUpdateApplyResult).message === 'string'
          ? (e.body as DbUpdateApplyResult)
          : null;
      const failed: DbUpdateApplyResult = fromBody ?? {
        scriptName,
        success: false,
        message: e instanceof Error ? e.message : 'Uygulanamadı',
      };
      setLastResults([failed]);
      setError(null);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const applyPending = async () => {
    setBusy('__all__');
    setError(null);
    try {
      const results = await api<DbUpdateApplyResult[]>('/api/db-updates/apply-pending?appliedBy=UI', {
        method: 'POST',
      });
      setLastResults(results);
      await load();
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.body)) {
        setLastResults(e.body as DbUpdateApplyResult[]);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Toplu uygulama başarısız');
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const showPreview = async (scriptName: string) => {
    setBusy(`preview:${scriptName}`);
    try {
      const data = await api<{ scriptName: string; content: string }>(
        `/api/db-updates/${encodeURIComponent(scriptName)}`,
      );
      setPreview({ name: data.scriptName, content: data.content });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Önizleme alınamadı');
    } finally {
      setBusy(null);
    }
  };

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
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            Veritabanı Güncelleme
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Numaralı scriptler: <code className="text-[11px] bg-slate-100 px-1 rounded">01_xxx.sql</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !!busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => void applyPending()}
            disabled={loading || !!busy || !status?.pendingCount}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-md bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === '__all__' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Bekleyenleri uygula
          </button>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Toplam</div>
            <div className="text-[18px] font-semibold text-slate-800">{status.total}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Uygulanan</div>
            <div className="text-[18px] font-semibold text-emerald-700">{status.appliedCount}</div>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Bekleyen</div>
            <div className="text-[18px] font-semibold text-amber-700">{status.pendingCount}</div>
          </div>
        </div>
      )}

      {status?.folderPath && (
        <p className="text-[11px] text-slate-400 truncate" title={status.folderPath}>
          Klasör: {status.folderPath}
        </p>
      )}

      {status?.connectionWarning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          SQL bağlantısı / takip tablosu: {status.connectionWarning}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {lastResults.length > 0 && lastResults.every((r) => r.success) && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] space-y-1">
          {lastResults.map((r) => (
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
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Yükleniyor…
                </td>
              </tr>
            )}
            {!loading && status?.scripts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-[12px] text-slate-400">
                  SqlUpdates klasöründe script yok
                </td>
              </tr>
            )}
            {status?.scripts.map((s) => {
              const applyResult = lastResults.find((r) => r.scriptName === s.scriptName);
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
                      onClick={() => void showPreview(s.scriptName)}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-50"
                    >
                      <FileCode2 className="w-3 h-3" />
                      SQL
                    </button>
                    {!s.applied && (
                      <button
                        type="button"
                        onClick={() => void applyOne(s.scriptName)}
                        disabled={!!busy}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {busy === s.scriptName ? (
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

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
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
