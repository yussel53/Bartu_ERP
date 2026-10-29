import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Lock, Scale, Undo2, X } from 'lucide-react';
import {
  EGovResponseState,
  OBJECTION_METHODS,
  addObjection,
  cancelObjection,
  getResponseState,
  methodLabel,
  respondInvoice,
} from '../api/egovResponseApi';
import { appConfirm } from '../utils/appConfirm';
import { isoToDisplay } from '../utils/dateFormat';

const day = (v?: string | null) => (v ? isoToDisplay(String(v).slice(0, 10)) : '');
const inp = 'rounded-sm border border-slate-300 px-2 py-1 text-[12px]';

/**
 * Gelen TİCARİ faturaya KABUL / RED (e-Logo uygulama yanıtı; canlı hesapta kilitli) ve
 * gelen / giden e-faturada harici itiraz / iptal kaydı (KEP · noter · GİB portalı).
 */
export const EGovResponseModal: React.FC<{ egovId: number; onClose: () => void; onChanged: () => void }> = ({
  egovId,
  onClose,
  onChanged,
}) => {
  const [s, setS] = useState<EGovResponseState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [form, setForm] = useState({ kind: 'ITIRAZ', method: 'KEP', date: '', docNo: '', description: '' });

  const load = useCallback(async () => {
    try {
      setS(await getResponseState(egovId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [egovId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<EGovResponseState>, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      setS(await f());
      setNotice(ok);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (code: 'KABUL' | 'RED') => {
    if (!s) return;
    if (code === 'RED' && !note.trim()) return setError('Red gerekçesi yazın.');
    const ok = await appConfirm(
      `${s.documentNo} faturasına GİB üzerinden ${code} yanıtı gönderilecek. Bu yanıt tedarikçiye iletilir ve geri alınamaz. Devam edilsin mi?`,
    );
    if (!ok) return;
    await run(() => respondInvoice(egovId, code, note.trim() || null), `${code} yanıtı gönderildi.`);
  };

  const saveObjection = async () => {
    await run(
      () =>
        addObjection(egovId, {
          kind: form.kind,
          method: form.method,
          date: form.date,
          docNo: form.docNo.trim() || null,
          description: form.description.trim(),
        }),
      'İtiraz / iptal kaydedildi.',
    );
    setForm((f) => ({ ...f, docNo: '', description: '' }));
  };

  const undo = async (objectionId: number) => {
    if (!(await appConfirm('Bu itiraz / iptal kaydı geri alınsın mı? (Kayıt silinmez, pasife alınır.)'))) return;
    await run(() => cancelObjection(egovId, objectionId), 'Kayıt geri alındı.');
  };

  const isIncoming = s?.direction === 1;
  const isTicari = (s?.profileId ?? '').toUpperCase() === 'TICARIFATURA';
  const active = s?.objections.filter((o) => o.isActive) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onMouseDown={() => !busy && onClose()}>
      <div className="w-full max-w-3xl rounded-md bg-white shadow-xl my-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
            <Scale className="w-5 h-5 text-slate-500" /> Kabul / Red · İtiraz / İptal
          </h3>
          <button type="button" onClick={onClose} disabled={busy} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-[12px]">
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-700">{error}</div>}
          {notice && <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-800">{notice}</div>}
          {!s && !error && <div className="text-slate-500">Yükleniyor…</div>}

          {s && (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-slate-600">
                <span>
                  Belge: <b className="text-slate-800">{s.documentNo}</b>
                </span>
                <span>{s.customerTitle}</span>
                <span>
                  {isIncoming ? 'Gelen' : 'Giden'} · {s.profileId ?? '—'}
                </span>
                {s.status && (
                  <span>
                    Durum: <b className="text-slate-800">{s.status}</b>
                  </span>
                )}
              </div>
              {s.invoiceWarning && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800 inline-flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {s.invoiceWarning}
                </div>
              )}

              {isIncoming && s.docKind === 1 && (
                <section className="rounded-sm border border-slate-200 p-3 space-y-2">
                  <div className="font-medium text-slate-700">GİB üzerinden yanıt (yalnız TİCARİ fatura, 8 gün içinde)</div>
                  {s.responseStatus === 'Gönderildi' ? (
                    <div className={s.responseCode === 'RED' ? 'text-red-700' : 'text-emerald-700'}>
                      {s.responseCode} yanıtı verildi · {s.responseAt ? new Date(s.responseAt).toLocaleString('tr-TR') : ''}
                      {s.responseNote ? ` · ${s.responseNote}` : ''}
                    </div>
                  ) : (
                    <>
                      {isTicari && s.deadline && (
                        <div className="text-slate-600">
                          Son gün: <b>{day(s.deadline)}</b>
                          {s.daysLeft != null && (s.daysLeft >= 0 ? ` (${s.daysLeft} gün kaldı)` : ' (süre doldu)')}
                          <span className="text-slate-400"> · süre fatura tarihinden hesaplanır</span>
                        </div>
                      )}
                      {s.responseStatus === 'Hata' && <div className="text-red-700">Son deneme başarısız: {s.responseError}</div>}
                      {s.canRespond ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex flex-col gap-0.5 flex-1 min-w-[240px]">
                            <span className="text-slate-500">Açıklama (red için zorunlu)</span>
                            <input className={inp} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                          </label>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void respond('KABUL')}
                            className="inline-flex items-center gap-1 rounded-sm bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Kabul et
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void respond('RED')}
                            className="inline-flex items-center gap-1 rounded-sm bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Reddet
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-amber-800 inline-flex items-start gap-1.5">
                          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {s.respondBlockReason}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              <section className="rounded-sm border border-slate-200 p-3 space-y-2">
                <div className="font-medium text-slate-700">
                  Harici itiraz / iptal {isIncoming ? '(faturaya bizim itirazımız)' : '(alıcının faturamıza itirazı)'}
                </div>
                <p className="text-slate-500">
                  GİB yanıt süresi dışında itiraz KEP ya da noter ile yapılır. Burada yalnız programa kayıt
                  girilir; karşı tarafa bir şey gönderilmez.
                </p>
                {s.objections.length > 0 && (
                  <ul className="space-y-1">
                    {s.objections.map((o) => (
                      <li
                        key={o.eGovDocumentObjectionID}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-sm border px-2 py-1 ${
                          o.isActive ? 'border-red-200 bg-red-50/50' : 'border-slate-200 text-slate-400 line-through'
                        }`}
                      >
                        <b>{o.kind === 'IPTAL' ? 'İptal' : 'İtiraz'}</b>
                        <span>{methodLabel(o.method)}</span>
                        <span>{day(o.objectionDate)}</span>
                        {o.objectionDocNo && <span>No: {o.objectionDocNo}</span>}
                        <span className="flex-1">{o.description}</span>
                        <span className="text-slate-400">{o.createdByName ?? ''}</span>
                        {o.isActive && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void undo(o.eGovDocumentObjectionID)}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                            title="Kaydı geri al"
                          >
                            <Undo2 className="w-3.5 h-3.5" /> Geri al
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {active.length === 0 && (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Tür</span>
                      <select className={inp} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                        <option value="ITIRAZ">İtiraz</option>
                        <option value="IPTAL">Karşılıklı iptal</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Yöntem</span>
                      <select className={inp} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                        {OBJECTION_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Belge tarihi</span>
                      <input type="date" className={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Belge no (KEP / yevmiye)</span>
                      <input className={`${inp} w-44`} value={form.docNo} maxLength={100} onChange={(e) => setForm({ ...form, docNo: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-0.5 flex-1 min-w-[220px]">
                      <span className="text-slate-500">Açıklama / gerekçe</span>
                      <input
                        className={inp}
                        value={form.description}
                        maxLength={500}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveObjection()}
                      className="rounded-sm bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Kaydet
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
