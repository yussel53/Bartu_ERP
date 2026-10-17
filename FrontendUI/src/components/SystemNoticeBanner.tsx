import React, { useCallback, useEffect, useState } from 'react';
import { Database, Download, Loader2, X } from 'lucide-react';
import { applyAppUpdate, fetchSystemInfo, getLoadedSystemInfo, getSystemNotices, SystemNotices } from '../api/systemApi';
import { apiJson } from '../config/api';
import { appConfirm } from '../utils/appConfirm';
import { useAuth } from './AuthGate';

const POLL_MS = 5 * 60 * 1000;

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Yönetici bandı: yeni sürüm hazırsa «Yeni sürümü yükle» (yönetici hakkı gerekmez — servis kendini günceller),
 * bekleyen SQL scripti varsa «Şimdi uygula» (öncesinde otomatik veritabanı yedeği).
 */
export const SystemNoticeBanner: React.FC = () => {
  const auth = useAuth();
  const [n, setN] = useState<SystemNotices | null>(null);
  const [busy, setBusy] = useState<'update' | 'sql' | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      setN(await getSystemNotices());
    } catch {
      setN(null);
    }
  }, []);

  useEffect(() => {
    if (!auth?.user.isAdmin) return;
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [auth?.user.isAdmin, load]);

  const update = async () => {
    if (!(await appConfirm('Yeni sürüm yüklensin mi? Servis birkaç saniye duracak; kaydedilmemiş fişleri önce kaydedin.', { title: 'Güncelleme', okLabel: 'Yükle' })))
      return;
    setBusy('update');
    setMsg(null);
    const before = getLoadedSystemInfo()?.version?.buildTime ?? null;
    try {
      const r = await applyAppUpdate();
      setMsg({ text: r.message });
      // Servis yeniden başlayınca derleme zamanı değişir → sayfayı yenile (en fazla 3 dk bekle)
      const started = Date.now();
      const tick = async () => {
        try {
          const info = await fetchSystemInfo();
          if (info.version?.buildTime && info.version.buildTime !== before) {
            window.location.reload();
            return;
          }
        } catch {
          // servis kapalıyken hata beklenir
        }
        if (Date.now() - started < 180_000) window.setTimeout(() => void tick(), 3000);
        else {
          setBusy(null);
          setMsg({ text: 'Servis 3 dakikada yeni sürümle açılmadı — Veritabanı Güncelleme ekranındaki güncelleme günlüğüne bakın.', error: true });
        }
      };
      window.setTimeout(() => void tick(), 4000);
    } catch (e) {
      setBusy(null);
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  };

  const applySql = async () => {
    if (!(await appConfirm(`${n?.pendingSql} veritabanı scripti uygulansın mı? Öncesinde otomatik yedek alınır.`, { title: 'Veritabanı güncelleme', okLabel: 'Uygula' })))
      return;
    setBusy('sql');
    setMsg(null);
    try {
      await apiJson('/api/db-updates/apply-pending', { method: 'POST' });
      setMsg({ text: 'Veritabanı scriptleri uygulandı.' });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  if (!auth?.user.isAdmin || hidden) return null;
  const showUpdate = !!n?.updateAvailable;
  const showSql = (n?.pendingSql ?? 0) > 0;
  if (!showUpdate && !showSql && !msg) return null;

  return (
    <div
      className={`mb-2 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-md border text-[12px] ${
        msg?.error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900'
      }`}
    >
      {showUpdate && (
        <span className="inline-flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          Yeni sürüm hazır{n?.stagingBuildTime ? ` (${fmt(n.stagingBuildTime)})` : ''}
          {n?.canApply ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void update()}
              className="ml-1 h-6 px-2 rounded-sm bg-blue-700 text-white font-semibold hover:bg-blue-600 disabled:opacity-60 inline-flex items-center gap-1"
            >
              {busy === 'update' && <Loader2 className="w-3 h-3 animate-spin" />} Yeni sürümü yükle
            </button>
          ) : (
            <span className="text-blue-700"> — {n?.updateMessage}</span>
          )}
        </span>
      )}
      {showSql && (
        <span className="inline-flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" />
          {n?.pendingSql} bekleyen veritabanı scripti
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void applySql()}
            className="ml-1 h-6 px-2 rounded-sm bg-slate-800 text-white font-semibold hover:bg-slate-700 disabled:opacity-60 inline-flex items-center gap-1"
          >
            {busy === 'sql' && <Loader2 className="w-3 h-3 animate-spin" />} Şimdi uygula
          </button>
        </span>
      )}
      {msg && <span className="min-w-0 flex-1 truncate" title={msg.text}>{msg.text}</span>}
      <button type="button" onClick={() => setHidden(true)} className="ml-auto p-0.5 rounded hover:bg-white/60" title="Gizle">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
