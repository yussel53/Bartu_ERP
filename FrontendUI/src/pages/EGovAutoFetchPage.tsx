import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Download, RefreshCw, Save } from 'lucide-react';
import {
  EGovAutoFetchLog,
  EGovAutoFetchSetting,
  listEGovAutoFetchLogs,
  listEGovAutoFetchSettings,
  runEGovAutoFetch,
  saveEGovAutoFetchSetting,
} from '../api/egovAutoFetchApi';
import { ApprovalGroup, listApprovalGroups } from '../api/approvalGroupsApi';
import { useAuth } from '../components/AuthGate';
import { isoToDisplay } from '../utils/dateFormat';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

const DOC_KINDS: Record<number, string> = { 1: 'e-Fatura', 2: 'e-Arşiv', 3: 'e-İrsaliye' };

/** «17.10.2026 14:05» */
const dt = (v?: string | null) => {
  if (!v) return '—';
  const s = String(v);
  return `${isoToDisplay(s.slice(0, 10))} ${s.slice(11, 16)}`;
};

const inp = 'h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';

/** Firma kartı: ayarlar + durum + «Şimdi çek» */
const CompanyCard: React.FC<{
  value: EGovAutoFetchSetting;
  groups: ApprovalGroup[];
  canEdit: boolean;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}> = ({ value, groups, canEdit, onSaved, onError }) => {
  const [s, setS] = useState(value);
  const [busy, setBusy] = useState<'save' | 'run' | null>(null);
  useEffect(() => setS(value), [value]);
  const dirty = JSON.stringify(s) !== JSON.stringify(value);
  const set = <K extends keyof EGovAutoFetchSetting>(k: K, v: EGovAutoFetchSetting[K]) => setS((x) => ({ ...x, [k]: v }));
  const isELogo = ['ELOGO', 'LOGO', 'E-LOGO'].includes((s.integratorName ?? '').trim().toUpperCase());
  const usable = isELogo && s.hasCredentials;

  const save = async () => {
    setBusy('save');
    try {
      onSaved((await saveEGovAutoFetchSetting(s)).message);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    setBusy('run');
    try {
      const r = await runEGovAutoFetch(s.companyId);
      (r.ok ? onSaved : onError)(`${s.companyTitle}: ${r.message}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Çekme başarısız');
    } finally {
      setBusy(null);
    }
  };

  const check = (k: keyof EGovAutoFetchSetting, label: string) => (
    <label className="inline-flex items-center gap-1.5">
      <input type="checkbox" disabled={!canEdit} checked={!!s[k]} onChange={(e) => set(k, e.target.checked as never)} />
      {label}
    </label>
  );

  return (
    <section className={`rounded-sm border bg-white dark:bg-slate-900 ${s.isEnabled ? 'border-blue-300' : 'border-slate-300'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-800 truncate">{s.companyTitle}</div>
          <div className="text-[10px] text-slate-500">
            Entegratör: {s.integratorName || '—'}
            {!usable && (
              <span className="ml-1 text-amber-700">
                · {isELogo ? 'e-Logo kullanıcı / şifre eksik (firma kartı → Entegratör)' : 'Otomatik çekme yalnız e-Logo için'}
              </span>
            )}
          </div>
        </div>
        <label className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${s.isEnabled ? 'text-blue-700' : 'text-slate-500'}`}>
          <input type="checkbox" disabled={!canEdit || !usable} checked={s.isEnabled} onChange={(e) => set('isEnabled', e.target.checked)} />
          Otomatik çekme {s.isEnabled ? 'açık' : 'kapalı'}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 text-[12px]">
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500">Zamanlama</div>
          <label className="flex items-center gap-2">
            <span className="w-24 text-slate-500">Aralık</span>
            <input type="number" min={5} max={1440} disabled={!canEdit} value={s.intervalMinutes} onChange={(e) => set('intervalMinutes', Number(e.target.value))} className={`${inp} w-20`} />
            <span className="text-slate-500">dk</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-24 text-slate-500">Geriye dönük</span>
            <input type="number" min={1} max={30} disabled={!canEdit} value={s.daysBack} onChange={(e) => set('daysBack', Number(e.target.value))} className={`${inp} w-20`} />
            <span className="text-slate-500">gün</span>
          </label>
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500">Belgeler (gelen)</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {check('fetchEInvoice', 'e-Fatura')}
            {check('fetchEArchive', 'e-Arşiv')}
            {check('fetchEDespatch', 'e-İrsaliye')}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {check('downloadXml', 'UBL/XML indir')}
            {check('downloadPdf', 'PDF indir')}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500">Onay</div>
          {check('autoSendToApproval', 'Yeni faturaları onaya gönder')}
          <label className="flex items-center gap-2">
            <span className="w-16 text-slate-500">Grup</span>
            <select
              disabled={!canEdit || !s.autoSendToApproval}
              value={s.approvalGroupId ?? ''}
              onChange={(e) => set('approvalGroupId', e.target.value ? Number(e.target.value) : null)}
              className={`${inp} flex-1`}
            >
              <option value="">Varsayılan grup{groups.find((g) => g.isDefault) ? ` (${groups.find((g) => g.isDefault)!.name})` : ''}</option>
              {groups.map((g) => (
                <option key={g.approvalGroupID} value={g.approvalGroupID}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-slate-200 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500">
          <span title="Son çalışma">
            <Clock className="inline w-3 h-3 mr-0.5" /> Son: {dt(s.lastRunAt)}
          </span>
          <span className="text-emerald-700" title="Son başarılı çekme">
            <CheckCircle2 className="inline w-3 h-3 mr-0.5" /> Başarılı: {dt(s.lastSuccessAt)}
          </span>
          {s.isEnabled && <span title="Sıradaki çalışma">Sıradaki: {s.nextRunAt ? dt(s.nextRunAt) : 'bir dakika içinde'}</span>}
          {s.lastError && (
            <span className="text-red-700" title={s.lastError}>
              <AlertTriangle className="inline w-3 h-3 mr-0.5" /> {s.lastError.length > 90 ? `${s.lastError.slice(0, 90)}…` : s.lastError}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!usable || !!busy}
            onClick={() => void run()}
            title="Ayarlardaki belge türlerini şimdi çek (otomatik çekme kapalı olsa da)"
            className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className={`w-3.5 h-3.5 ${busy === 'run' ? 'animate-pulse' : ''}`} /> {busy === 'run' ? 'Çekiliyor…' : 'Şimdi çek'}
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={!dirty || !!busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" /> Kaydet
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

/**
 * E-Devlet → Tanımlar → Otomatik Belge Çekme (E-02): firma bazında zamanlanmış e-Logo çekme ayarı,
 * «Şimdi çek» ve çekme günlüğü. Ayarı yalnız yönetici değiştirir.
 */
export const EGovAutoFetchPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const auth = useAuth();
  const canEdit = auth?.user.isAdmin ?? true;
  const [settings, setSettings] = useState<EGovAutoFetchSetting[]>([]);
  const [groups, setGroups] = useState<ApprovalGroup[]>([]);
  const [logs, setLogs] = useState<EGovAutoFetchLog[]>([]);
  const [logCompany, setLogCompany] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g, l] = await Promise.all([
        listEGovAutoFetchSettings(),
        listApprovalGroups(true).catch(() => ({ ready: false, rows: [] as ApprovalGroup[] })),
        listEGovAutoFetchLogs(logCompany),
      ]);
      setSettings(s);
      setGroups(g.rows);
      setLogs(l);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Ayarlar okunamadı' });
    } finally {
      setLoading(false);
    }
  }, [logCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 align-top whitespace-nowrap';
  const tdN = `${td} text-right tabular-nums`;

  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Otomatik Belge Çekme</h2>
          <p className="text-[11px] text-slate-500">
            Gelen e-belgeler e-Logo'dan belirli aralıkla çekilir; yeni faturalar onay grubuna «Sistem» adına gönderilir
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yenile
        </button>
      </div>

      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      {!canEdit && <div className="text-[11px] text-slate-500">Ayarları yalnız yönetici değiştirebilir; «Şimdi çek» herkese açık.</div>}

      <div className="space-y-3">
        {settings.length === 0 && !loading && <div className="text-[12px] text-slate-400">Aktif firma yok.</div>}
        {settings.map((s) => (
          <CompanyCard
            key={s.companyId}
            value={s}
            groups={groups}
            canEdit={canEdit}
            onSaved={(text) => {
              setMsg({ kind: 'ok', text });
              void load();
            }}
            onError={(text) => {
              setMsg({ kind: 'err', text });
              void load();
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h3 className="text-[13px] font-semibold text-slate-800">Çekme Günlüğü</h3>
        {settings.length > 1 && (
          <select value={logCompany ?? ''} onChange={(e) => setLogCompany(e.target.value ? Number(e.target.value) : null)} className={inp}>
            <option value="">Tüm firmalar</option>
            {settings.map((s) => (
              <option key={s.companyId} value={s.companyId}>
                {s.companyTitle}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="rounded-sm border border-slate-300 overflow-x-auto bg-white">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className={th}>Başlangıç</th>
              <th className={th}>Firma</th>
              <th className={th}>Belge</th>
              <th className={th}>Çalıştıran</th>
              <th className={th}>Durum</th>
              <th className={`${th} text-right`}>Gelen</th>
              <th className={`${th} text-right`}>Yeni</th>
              <th className={`${th} text-right`}>Güncellenen</th>
              <th className={`${th} text-right`}>Onaya</th>
              <th className={th}>Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={10} className="px-2 py-3 text-center text-slate-400">
                  Henüz çekme yapılmadı.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.eGovAutoFetchLogID} className={l.ok ? '' : 'bg-red-50/50'}>
                <td className={td}>{dt(l.startedAt)}</td>
                <td className={td}>{l.companyTitle}</td>
                <td className={td}>{DOC_KINDS[l.docKind] ?? l.docKind}</td>
                <td className={td}>{l.triggerKind === 'auto' ? 'Sistem (otomatik)' : l.startedByName || 'Elle'}</td>
                <td className={td}>
                  {!l.finishedAt ? (
                    <span className="text-slate-500">Çalışıyor…</span>
                  ) : l.ok ? (
                    <span className="text-emerald-700">Başarılı</span>
                  ) : (
                    <span className="text-red-700">Hata</span>
                  )}
                </td>
                <td className={tdN}>{l.fetched}</td>
                <td className={tdN}>{l.inserted}</td>
                <td className={tdN}>{l.updated}</td>
                <td className={tdN}>{l.queuedForApproval}</td>
                <td className={`${td} whitespace-normal min-w-[240px] ${l.ok ? 'text-slate-600' : 'text-red-700'}`}>{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
