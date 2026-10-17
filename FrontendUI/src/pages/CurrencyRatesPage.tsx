import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CloudDownload, RefreshCw, Save, XCircle } from 'lucide-react';
import {
  CurrencyRatesDay,
  downloadTcmbRates,
  getCurrencyRates,
  getTcmbCurrencies,
  setAutoCurrencies,
  TcmbCurrency,
} from '../api/currencyRatesApi';
import { displayToIso, getSystemDatePlaceholder, isoToDisplay } from '../utils/dateFormat';

const fmtRate = (v?: number | null) =>
  v == null ? '' : v.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
const fmtDate = (v?: string | null) => (v ? isoToDisplay(String(v).slice(0, 10)) : '');
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('tr-TR') : '');

/** Sistem → Tanımlar → Döviz Kurları: TCMB günlük kurlar, otomatik indirilecek dövizler, indirme günlüğü */
export const CurrencyRatesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<CurrencyRatesDay | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [dateText, setDateText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [tcmb, setTcmb] = useState<TcmbCurrency[] | null>(null);
  const [tcmbInfo, setTcmbInfo] = useState('');
  const [auto, setAuto] = useState<Set<string>>(new Set());
  const [autoDirty, setAutoDirty] = useState(false);

  const load = useCallback(async (d?: string | null) => {
    try {
      const r = await getCurrencyRates(d);
      setData(r);
      setDay(r.date ? String(r.date).slice(0, 10) : null);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Kurlar okunamadı' });
    }
  }, []);

  const loadTcmb = useCallback(async () => {
    try {
      const r = await getTcmbCurrencies();
      setTcmb(r.currencies);
      setAuto(new Set(r.currencies.filter((c) => c.autoRate).map((c) => c.code)));
      setAutoDirty(false);
      setTcmbInfo(r.bulletinDate ? `Son TCMB bülteni: ${fmtDate(r.bulletinDate)} (${r.bulletinNo ?? ''})` : '');
    } catch (e) {
      setTcmb([]);
      setTcmbInfo(e instanceof Error ? e.message : 'TCMB listesi alınamadı');
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTcmb();
  }, [load, loadTcmb]);

  const download = async () => {
    const iso = dateText.trim() ? displayToIso(dateText.trim()) : null;
    if (dateText.trim() && !iso) {
      setMsg({ kind: 'err', text: `Tarih biçimi: ${getSystemDatePlaceholder()}` });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await downloadTcmbRates(iso);
      setMsg({ kind: r.success ? 'ok' : 'err', text: r.message });
      await load(r.rateDate ? String(r.rateDate).slice(0, 10) : iso);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'İndirilemedi' });
      await load(day);
    } finally {
      setBusy(false);
    }
  };

  const saveAuto = async () => {
    setBusy(true);
    try {
      await setAutoCurrencies([...auto]);
      setMsg({ kind: 'ok', text: `Otomatik indirilecek dövizler kaydedildi: ${[...auto].join(', ') || 'yok'}` });
      setAutoDirty(false);
      await loadTcmb();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Kaydedilemedi' });
    } finally {
      setBusy(false);
    }
  };

  const tcmbSorted = useMemo(
    () =>
      [...(tcmb || [])].sort((a, b) => {
        const rank = (c: TcmbCurrency) => (['USD', 'EUR', 'GBP'].indexOf(c.code) + 1 || 9);
        return rank(a) - rank(b) || a.code.localeCompare(b.code);
      }),
    [tcmb],
  );

  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const thR = 'px-2 py-1 text-right font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 whitespace-nowrap';
  const tdR = `${td} text-right tabular-nums`;

  return (
    <div className="max-w-6xl mx-auto space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Döviz Kurları</h2>
          <p className="text-[11px] text-slate-500">
            TCMB gösterge kurları · her gün otomatik indirilir (hafta içi 15:45 sonrası) · SYS_CurrencyRate
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
            placeholder={`Tarih (boş = son bülten) ${getSystemDatePlaceholder()}`}
            className="w-56 h-7 px-2 text-[11px] rounded-sm border border-slate-300 bg-white"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void download()}
            className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-50"
          >
            <CloudDownload className={`w-3.5 h-3.5 ${busy ? 'animate-pulse' : ''}`} />
            TCMB'den indir
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}
      {data && !data.ready && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
          Kur tabloları hazır değil — Sistem → Veritabanı Güncelleme ekranından <b>74_tcmb_currency_rates.sql</b> uygulayın.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-3">
        {/* Günün kurları */}
        <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="font-semibold text-slate-700">Bülten tarihi</span>
              <select
                value={day ?? ''}
                onChange={(e) => void load(e.target.value || null)}
                className="h-7 px-1.5 text-[12px] rounded-sm border border-slate-300 bg-white"
              >
                {(data?.days || []).length === 0 && <option value="">—</option>}
                {(data?.days || []).map((d) => (
                  <option key={String(d)} value={String(d).slice(0, 10)}>
                    {fmtDate(String(d))}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => void load(day)} className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900">
              <RefreshCw className="w-3 h-3" /> Yenile
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className={th}>Kod</th>
                  <th className={th}>Döviz</th>
                  <th className={thR}>Döviz Alış</th>
                  <th className={thR}>Döviz Satış</th>
                  <th className={thR}>Efektif Alış</th>
                  <th className={thR}>Efektif Satış</th>
                  <th className={th}>Bülten</th>
                  <th className={th}>İndirme</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rates || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                      Kayıtlı kur yok — «TCMB'den indir» ile indirin.
                    </td>
                  </tr>
                ) : (
                  (data?.rates || []).map((r) => (
                    <tr key={r.currencyID} className="hover:bg-blue-50/40">
                      <td className={`${td} font-semibold`}>{r.code}</td>
                      <td className={td}>
                        {r.title}
                        {r.unit && r.unit > 1 ? <span className="ml-1 text-[10px] text-slate-400">(TCMB {r.unit} birim)</span> : null}
                      </td>
                      <td className={tdR}>{fmtRate(r.buyRate)}</td>
                      <td className={tdR}>{fmtRate(r.sellRate)}</td>
                      <td className={tdR}>{fmtRate(r.banknoteBuyRate)}</td>
                      <td className={tdR}>{fmtRate(r.banknoteSellRate)}</td>
                      <td className={td}>{r.bulletinNo}</td>
                      <td className={`${td} text-[11px] text-slate-500`}>{fmtDateTime(r.downloadedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Otomatik indirilecek dövizler */}
        <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 flex flex-col max-h-[520px]">
          <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-300">
            <h3 className="text-[12px] font-semibold text-slate-700">İndirilecek kurlar</h3>
            <p className="text-[10px] text-slate-500">{tcmbInfo || 'TCMB listesi yükleniyor…'}</p>
          </div>
          <ul className="flex-1 overflow-y-auto px-2.5 py-1">
            {tcmbSorted.map((c) => (
              <li key={c.code}>
                <label className={`flex items-center gap-2 py-0.5 text-[12px] ${c.inSystem && c.hasRate ? 'text-slate-700' : 'text-slate-400'}`}>
                  <input
                    type="checkbox"
                    disabled={!c.inSystem || !c.hasRate}
                    checked={auto.has(c.code)}
                    onChange={(e) => {
                      setAuto((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) n.add(c.code);
                        else n.delete(c.code);
                        return n;
                      });
                      setAutoDirty(true);
                    }}
                  />
                  <span className="w-9 font-semibold">{c.code}</span>
                  <span className="truncate" title={c.name}>
                    {c.name}
                    {!c.inSystem ? ' · döviz kartı yok' : !c.hasRate ? ' · kur yayımlanmıyor' : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="px-2.5 py-2 border-t border-slate-200">
            <button
              type="button"
              disabled={busy || !autoDirty}
              onClick={() => void saveAuto()}
              className="w-full inline-flex items-center justify-center gap-1 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" /> Seçimi kaydet
            </button>
          </div>
        </section>
      </div>

      {/* İndirme günlüğü */}
      <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-300 text-[12px] font-semibold text-slate-700">İndirme günlüğü</div>
        <table className="w-full text-[11px] border-collapse">
          <tbody>
            {(data?.logs || []).length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-center text-slate-400">Henüz indirme yok.</td>
              </tr>
            ) : (
              (data?.logs || []).map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1 w-6">
                    {l.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-slate-500">{fmtDateTime(l.runAt)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{l.triggerName}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{fmtDate(l.rateDate)}</td>
                  <td className="px-2 py-1 text-slate-600">{l.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};
