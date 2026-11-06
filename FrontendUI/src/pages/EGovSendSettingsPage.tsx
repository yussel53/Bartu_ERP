import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock, RefreshCw, Save } from 'lucide-react';
import { SendCounter, SendSetting, getSendSettings, saveSendSettings, setSendCounter } from '../api/egovOutgoingApi';
import { LookupOption, loadLookupOptions } from '../api/lookupApi';
import { useAuth } from '../components/AuthGate';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

const inp = 'h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';

/**
 * E-Devlet → Tanımlar → Gönderim Ayarları (E-03): firma bazında GİB seri önekleri, varsayılan senaryo
 * ve önek + yıl bazında numara sayacı. Canlı gönderim izni bu ekrandan açılmaz.
 */
export const EGovSendSettingsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const auth = useAuth();
  const canEdit = auth?.user.isAdmin ?? true;
  const [companies, setCompanies] = useState<LookupOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [s, setS] = useState<SendSetting | null>(null);
  const [counters, setCounters] = useState<SendCounter[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    void loadLookupOptions('CompanyID').then((c) => {
      setCompanies(c ?? []);
      if (c?.length) setCompanyId((cur) => cur || c[0].value);
    });
  }, []);

  const load = useCallback(async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const r = await getSendSettings(Number(companyId));
      setS(r.setting);
      setCounters(r.counters);
      setEdit({});
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Ayarlar okunamadı' });
    } finally {
      setBusy(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!s) return;
    setBusy(true);
    try {
      setMsg({ kind: 'ok', text: (await saveSendSettings(Number(companyId), s)).message });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const saveCounter = async (c: SendCounter) => {
    const v = Number(edit[c.prefix]);
    if (!Number.isInteger(v) || v < 0) return setMsg({ kind: 'err', text: 'Sıra tam sayı olmalı.' });
    if (!window.confirm(`${c.prefix} ${c.year} sayacı ${v} yapılsın mı? Sıradaki numara ${c.prefix}${c.year}${String(v + 1).padStart(9, '0')} olur.`)) return;
    setBusy(true);
    try {
      setMsg({ kind: 'ok', text: (await setSendCounter(Number(companyId), { prefix: c.prefix, year: c.year, lastValue: v })).message });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Sayaç kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof SendSetting>(k: K, v: SendSetting[K]) => setS((x) => (x ? { ...x, [k]: v } : x));
  const prefixInput = (k: 'eInvoicePrefix' | 'eArchivePrefix' | 'eDespatchPrefix', label: string) => (
    <label className="flex flex-col gap-0.5 text-[12px]">
      <span className="text-slate-500">{label}</span>
      <input
        className={`${inp} w-20 uppercase`}
        maxLength={3}
        disabled={!canEdit}
        value={s?.[k] ?? ''}
        onChange={(e) => set(k, e.target.value.toUpperCase())}
      />
    </label>
  );
  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 whitespace-nowrap';

  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Gönderim Ayarları</h2>
        <p className="text-[11px] text-slate-500">
          Giden e-Fatura / e-Arşiv numarası «önek + yıl + 9 hane» biçiminde gönderim anında verilir. Önek GİB / entegratörde tanımlı seriyle aynı olmalı.
        </p>
      </div>
      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <section className="rounded-sm border border-slate-300 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-0.5 text-[12px]">
            <span className="text-slate-500">Firma</span>
            <select className={`${inp} min-w-[220px]`} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {prefixInput('eInvoicePrefix', 'e-Fatura öneki')}
          {prefixInput('eArchivePrefix', 'e-Arşiv öneki')}
          {prefixInput('eDespatchPrefix', 'e-İrsaliye öneki')}
          <label className="flex flex-col gap-0.5 text-[12px]">
            <span className="text-slate-500">Varsayılan senaryo</span>
            <select className={inp} disabled={!canEdit} value={s?.defaultProfile ?? 'TICARIFATURA'} onChange={(e) => set('defaultProfile', e.target.value)}>
              <option value="TICARIFATURA">TICARIFATURA</option>
              <option value="TEMELFATURA">TEMELFATURA</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canEdit || busy || !s}
            className="inline-flex items-center gap-1.5 h-7 rounded-sm bg-slate-900 px-3 text-[12px] font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            <Save className="w-3.5 h-3.5" /> Kaydet
          </button>
          <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-1 h-7 px-2 text-[12px] text-slate-600 hover:text-slate-900">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Yenile
          </button>
        </div>
        <div className="text-[12px] text-slate-600 inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          Canlı entegratör hesabında gönderim: <b>{s?.allowLiveSend ? 'açık' : 'kapalı'}</b> — bu ekrandan değiştirilmez.
        </div>
      </section>

      <section className="rounded-sm border border-slate-300 bg-white">
        <div className="px-3 py-2 border-b border-slate-200 text-[13px] font-semibold text-slate-800">Numara sayaçları ({new Date().getFullYear()})</div>
        {counters.length === 0 ? (
          <div className="p-3 text-[12px] text-slate-500">Önek tanımlanınca sayaç burada görünür.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Önek</th>
                <th className={th}>Son verilen sıra</th>
                <th className={th}>Sıradaki numara</th>
                <th className={th}>Entegratörde görülen en büyük sıra</th>
                <th className={th}>Sayacı ayarla</th>
              </tr>
            </thead>
            <tbody>
              {counters.map((c) => (
                <tr key={c.prefix}>
                  <td className={`${td} font-medium`}>{c.prefix}</td>
                  <td className={`${td} tabular-nums`}>{c.lastValue}</td>
                  <td className={`${td} font-mono`}>{`${c.prefix}${c.year}${String(c.lastValue + 1).padStart(9, '0')}`}</td>
                  <td className={`${td} tabular-nums`}>
                    {c.seenMax ?? '—'}
                    {c.seenMax != null && c.seenMax > c.lastValue && (
                      <span className="ml-2 text-amber-700">sayaç geride — çakışma olur</span>
                    )}
                  </td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-1">
                      <input
                        className={`${inp} w-28`}
                        disabled={!canEdit}
                        placeholder={String(Math.max(c.lastValue, c.seenMax ?? 0))}
                        value={edit[c.prefix] ?? ''}
                        onChange={(e) => setEdit((x) => ({ ...x, [c.prefix]: e.target.value.replace(/\D/g, '') }))}
                      />
                      <button
                        type="button"
                        disabled={!canEdit || busy || !edit[c.prefix]}
                        onClick={() => void saveCounter(c)}
                        className="h-7 rounded-sm border border-slate-300 px-2 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Uygula
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
