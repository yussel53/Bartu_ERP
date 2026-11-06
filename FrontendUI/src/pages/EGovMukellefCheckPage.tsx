import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, CloudDownload, RefreshCw } from 'lucide-react';
import { applyCustomerMukellef, checkCustomerMukellef, MukellefCheckResult, MukellefCheckRow } from '../api/egovMukellefCheckApi';
import { syncEFaturaMukellefFromGib } from '../api/efaturaMukellefApi';
import { appConfirm } from '../utils/appConfirm';
import { isoToDisplay } from '../utils/dateFormat';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

const TYPE_LABEL: Record<number, string> = { 0: 'Yok', 1: 'e-Fatura', 2: 'e-Arşiv' };
const typeLabel = (v?: number | null) => (v == null ? '—' : TYPE_LABEL[v] ?? String(v));
const day = (v?: string | null) => (v ? isoToDisplay(String(v).slice(0, 10)) : '—');
const dt = (v?: string | null) => (v ? `${isoToDisplay(String(v).slice(0, 10))} ${String(v).slice(11, 16)}` : '—');
const rowKey = (r: MukellefCheckRow) => `${r.customerCardID}:${r.customerAdressID ?? 0}`;
/** «urn:mail:defaultpk@firma.com.tr» → «defaultpk@firma.com.tr» */
const label = (v?: string | null) => (v ? v.replace(/^urn:mail:/i, '') : '—');

/** Eski → yeni (değişmişse vurgulu) */
const Diff: React.FC<{ from: string; to: string }> = ({ from, to }) =>
  from === to ? (
    <span className="text-slate-600">{to}</span>
  ) : (
    <span>
      <span className="text-slate-400 line-through">{from}</span> <span className="text-blue-700 font-medium">→ {to}</span>
    </span>
  );

/**
 * E-Devlet → İşlemler → Cari Mükellef Kontrolü (E-06): carilerin VKN/TCKN'si yerel GİB listesiyle karşılaştırılır;
 * e-Fatura tipi / başlangıç tarihi ve adresteki PK / GB etiketleri için öneriler toplu uygulanır.
 */
export const EGovMukellefCheckPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<MukellefCheckResult | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'sync' | 'apply' | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await checkCustomerMukellef(onlyChanges);
      setData(r);
      setSelected(new Set(r.rows.filter((x) => x.hasChanges).map(rowKey)));
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Kontrol yapılamadı' });
    } finally {
      setLoading(false);
    }
  }, [onlyChanges]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRows = useMemo(() => (data?.rows ?? []).filter((r) => r.hasChanges), [data]);
  const allSelected = changeRows.length > 0 && changeRows.every((r) => selected.has(rowKey(r)));

  const sync = async () => {
    if (!(await appConfirm('GİB e-Fatura kullanıcı listesi (yaklaşık 280 MB) indirilip yerel tabloya aktarılsın mı? Birkaç dakika sürebilir.', { okLabel: 'Güncelle' })))
      return;
    setBusy('sync');
    setMsg(null);
    try {
      const r = await syncEFaturaMukellefFromGib();
      setMsg({ kind: 'ok', text: r.message });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'GİB listesi güncellenemedi' });
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    const items = changeRows.filter((r) => selected.has(rowKey(r)));
    if (items.length === 0) return;
    if (!(await appConfirm(`${items.length} satırdaki öneriler cari kartlara ve adreslere yazılsın mı?`, { okLabel: 'Uygula' }))) return;
    setBusy('apply');
    setMsg(null);
    try {
      const r = await applyCustomerMukellef(items.map((x) => ({ customerCardID: x.customerCardID, customerAdressID: x.customerAdressID })));
      setMsg({ kind: 'ok', text: r.message });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Uygulanamadı' });
    } finally {
      setBusy(null);
    }
  };

  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 align-top';

  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-3 h-3" /> Geri
      </button>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Cari Mükellef Kontrolü</h2>
          <p className="text-[11px] text-slate-500">
            Carilerin VKN/TCKN'si GİB e-Fatura kullanıcı listesiyle karşılaştırılır; e-Fatura tipi, başlangıç tarihi ve PK / GB
            etiketleri güncellenir
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void sync()}
            title="GİB listesini şimdi indir (gece 03:00'te otomatik)"
            className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <CloudDownload className={`w-3.5 h-3.5 ${busy === 'sync' ? 'animate-pulse' : ''}`} />
            {busy === 'sync' ? 'GİB listesi indiriliyor…' : "Listeyi GİB'den güncelle"}
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yenile
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-sm border px-2.5 py-1.5 text-[12px] ${msg.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {data && (
        <>
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border px-3 py-1.5 text-[12px] ${
              data.authoritative ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {data.authoritative ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>
              Carilerin GİB etiketleri: <b>{data.localListCount.toLocaleString('tr-TR')}</b> · son gece senkronu {dt(data.lastSyncAt)}
              {data.onlineChecked > 0 && <> · e-Logo'dan sorgulanan: <b>{data.onlineChecked}</b> VKN</>}
            </span>
            {data.onlineError && <span>{data.onlineError}</span>}
            {!data.authoritative && (
              <span>Kontrol edilemeyen VKN'ler için «mükellef değil» sonucu kullanılmaz; yalnız mükellef bulunanlara öneri yapılır.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="text-slate-600">
              {data.totalCustomers} cari · {data.mukellefCount} e-Fatura mükellefi · <b>{data.changeCount}</b> satırda değişiklik önerisi
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
                Yalnız değişiklik olanlar
              </label>
              <button
                type="button"
                disabled={!!busy || selected.size === 0}
                onClick={() => void apply()}
                className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" /> Seçilenleri uygula ({changeRows.filter((r) => selected.has(rowKey(r))).length})
              </button>
            </div>
          </div>

          <div className="rounded-sm border border-slate-300 overflow-x-auto bg-white">
            <table className="w-full text-[12px] border-collapse">
              <thead className="bg-slate-100">
                <tr>
                  <th className={`${th} text-center`}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={changeRows.length === 0}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(changeRows.map(rowKey)))}
                      title="Tümünü seç"
                    />
                  </th>
                  <th className={th}>Cari</th>
                  <th className={th}>VKN / TCKN</th>
                  <th className={th}>GİB</th>
                  <th className={th}>e-Fatura tipi</th>
                  <th className={th}>Başlangıç</th>
                  <th className={th}>PK etiketi (alıcı)</th>
                  <th className={th}>GB etiketi (gönderici)</th>
                  <th className={th}>Son kontrol</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-2 py-3 text-center text-slate-400">
                      {onlyChanges ? 'Değişiklik gereken cari yok.' : 'VKN/TCKN girili cari yok.'}
                    </td>
                  </tr>
                )}
                {data.rows.map((r) => {
                  const k = rowKey(r);
                  return (
                    <tr key={k} className={r.hasChanges ? '' : 'text-slate-500'}>
                      <td className={`${td} text-center`}>
                        <input type="checkbox" disabled={!r.hasChanges} checked={selected.has(k)} onChange={() => toggle(k)} />
                      </td>
                      <td className={td}>
                        <div className="font-medium">{r.code}</div>
                        <div className="text-[11px] text-slate-500 max-w-[220px] truncate" title={r.title ?? undefined}>
                          {r.title}
                          {r.addressTitle ? ` · ${r.addressTitle}` : ''}
                        </div>
                      </td>
                      <td className={`${td} font-mono text-[11px]`}>{r.taxNr}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {r.isMukellef ? (
                          <span className="text-emerald-700" title={r.gibTitle ?? undefined}>
                            Mükellef
                          </span>
                        ) : r.checked ? (
                          <span className="text-slate-600">Mükellef değil</span>
                        ) : (
                          <span className="text-slate-400">Kontrol edilemedi</span>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <Diff from={typeLabel(r.einvoiceType)} to={typeLabel(r.suggestedEinvoiceType)} />
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <Diff from={day(r.einvoiceEntryDate)} to={day(r.suggestedEntryDate)} />
                      </td>
                      <td className={`${td} text-[11px]`}>
                        {r.customerAdressID ? <Diff from={label(r.postLabel)} to={label(r.suggestedPostLabel)} /> : <span className="text-slate-400">adres yok</span>}
                      </td>
                      <td className={`${td} text-[11px]`}>
                        {r.customerAdressID ? <Diff from={label(r.senderLabel)} to={label(r.suggestedSenderLabel)} /> : ''}
                      </td>
                      <td className={`${td} whitespace-nowrap text-[11px] text-slate-500`}>{dt(r.lastCheckAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">
            GİB listesi her gece 03:00'te otomatik güncellenir (GİB adresine erişilemezse e-Logo hesabından alınır). Öneriler uygulanırken
            sunucuda yeniden hesaplanır.
          </p>
        </>
      )}
    </div>
  );
};
