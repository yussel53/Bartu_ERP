import React, { useCallback, useEffect, useState } from 'react';
import { HardDriveDownload, Loader2, RefreshCw, Server } from 'lucide-react';
import { apiJson } from '../config/api';
import { AppVersionInfo, DbBackupFile, listDbBackups, runDbBackup } from '../api/systemApi';

interface UpdateStatus {
  current: AppVersionInfo;
  staging?: AppVersionInfo | null;
  updateAvailable: boolean;
  canApply: boolean;
  message?: string | null;
  stagingPath: string;
  lastLog?: string | null;
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—');
const ver = (v?: AppVersionInfo | null) => (v ? `${v.version}${v.commit ? ` · ${v.commit}` : ''} · ${fmt(v.buildTime)}` : '—');
const size = (b: number) => (b > 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GB` : `${(b / (1 << 20)).toFixed(1)} MB`);

/** Sistem bakımı (yönetici): uygulama sürümü / güncelleme günlüğü + veritabanı yedekleri */
export const SystemMaintenancePanel: React.FC = () => {
  const [upd, setUpd] = useState<UpdateStatus | null>(null);
  const [backups, setBackups] = useState<{ folder: string; files: DbBackupFile[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setUpd(await apiJson<UpdateStatus>('/api/system/update'));
    } catch {
      setUpd(null);
    }
    try {
      setBackups(await listDbBackups());
    } catch {
      setBackups(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const backup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await runDbBackup();
      setMsg({ text: r.message });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!upd && !backups) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Server className="w-4 h-4 text-slate-500" /> Uygulama Sürümü
          </div>
          <button type="button" onClick={() => void load()} className="p-1 rounded hover:bg-slate-100" title="Yenile">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
        <div className="flex gap-2">
          <span className="w-20 text-slate-500">Çalışan</span>
          <span className="min-w-0 truncate">{ver(upd?.current)}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-20 text-slate-500">Hazır</span>
          <span className="min-w-0 truncate">{ver(upd?.staging)}</span>
        </div>
        <div className={upd?.updateAvailable ? 'text-blue-700' : 'text-slate-500'}>{upd?.message}</div>
        {upd?.lastLog && (
          <details>
            <summary className="cursor-pointer text-slate-500">Son güncelleme günlüğü</summary>
            <pre className="mt-1 max-h-40 overflow-auto bg-slate-50 border border-slate-100 rounded p-2 text-[10px] whitespace-pre-wrap">{upd.lastLog}</pre>
          </details>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-3 space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <HardDriveDownload className="w-4 h-4 text-slate-500" /> Veritabanı Yedeği
          </div>
          <button
            type="button"
            onClick={() => void backup()}
            disabled={busy}
            className="h-7 px-2.5 rounded-md bg-slate-800 text-white font-semibold hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Şimdi yedek al
          </button>
        </div>
        <div className="text-slate-500 truncate" title={backups?.folder}>
          Klasör: {backups?.folder || '—'} · her gece 02:00 ve SQL güncellemesi öncesi otomatik
        </div>
        {msg && <div className={msg.error ? 'text-red-700' : 'text-emerald-700'}>{msg.text}</div>}
        <ul className="max-h-32 overflow-auto divide-y divide-slate-100">
          {(backups?.files ?? []).slice(0, 8).map((f) => (
            <li key={f.fileName} className="flex justify-between gap-2 py-0.5">
              <span className="truncate" title={f.fileName}>{f.fileName}</span>
              <span className="shrink-0 text-slate-500">{size(f.sizeBytes)}</span>
            </li>
          ))}
          {backups && backups.files.length === 0 && <li className="text-slate-400 py-0.5">Henüz yedek yok (ya da klasör bu makinede değil).</li>}
        </ul>
      </div>
    </div>
  );
};
