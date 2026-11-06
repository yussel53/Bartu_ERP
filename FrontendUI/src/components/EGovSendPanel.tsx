import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCode2, Info, Lock, RefreshCw, Send, X, XCircle } from 'lucide-react';
import { OutgoingIssue, OutgoingPreview, downloadOutgoingUbl, outgoingStatus, previewOutgoing, sendOutgoing } from '../api/egovOutgoingApi';

const n = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** E-03: e-belge olarak gönderilen fatura tipleri — 1 Satış · 3 Satış İade · 4 Alış İade */
const OUTGOING_TYPES = new Set(['1', '3', '4']);

const IssueIcon: React.FC<{ level: OutgoingIssue['level'] }> = ({ level }) =>
  level === 'error' ? (
    <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
  ) : level === 'warning' ? (
    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
  ) : (
    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
  );

/**
 * E-03: kayıtlı satış / iade faturasında e-belge önizleme, UBL indirme, doğrulama ve gönderim.
 * Gönderim sunucuda kilitlidir: canlı entegratör adresinde firma ayarında ayrıca açılmadıkça reddedilir.
 */
export const EGovSendPanel: React.FC<{ invoiceId?: number; invoiceType: unknown }> = ({ invoiceId, invoiceType }) => {
  const [open, setOpen] = useState(false);
  if (!invoiceId || !OUTGOING_TYPES.has(String(invoiceType ?? ''))) return null;
  return (
    <>
      <div className="mt-3 flex items-center justify-between rounded-sm border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-[12px] text-slate-600 inline-flex items-center gap-1.5">
          <FileCode2 className="w-4 h-4 text-slate-400" /> e-Fatura / e-Arşiv
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
        >
          e-Belge önizle ve gönder
        </button>
      </div>
      {open && <EGovSendModal invoiceId={invoiceId} onClose={() => setOpen(false)} />}
    </>
  );
};

const EGovSendModal: React.FC<{ invoiceId: number; onClose: () => void }> = ({ invoiceId, onClose }) => {
  const [pv, setPv] = useState<OutgoingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<string>('');
  const [returnNo, setReturnNo] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [tab, setTab] = useState<'view' | 'checks'>('view');
  const [status, setStatus] = useState<Record<string, string> | null>(null);

  const opts = useCallback(
    () => ({
      profile: profile || null,
      returnInvoiceNo: returnNo.trim() || null,
      returnInvoiceDate: returnDate || null,
    }),
    [profile, returnNo, returnDate],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await previewOutgoing(invoiceId, { ...opts(), html: true });
      setPv(r);
      if (r.issues.some((i) => i.level === 'error')) setTab('checks');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [invoiceId, opts]);

  useEffect(() => {
    void load();
    // yalnız açılışta; seçenek değişince «Yenile»
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSend = async () => {
    if (!pv) return;
    if (!window.confirm(`${pv.invoiceNo} numarasıyla ${pv.docKind === 2 ? 'e-Arşiv' : 'e-Fatura'} olarak gönderilsin mi? Gönderilen belge geri alınamaz.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await sendOutgoing(invoiceId, opts());
      setNotice(r.sendStatus === 'Gönderildi' ? `Gönderildi: ${r.invoiceNo}` : `Gönderilemedi: ${r.sendBlockReason ?? ''}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doStatus = async () => {
    if (!pv?.eGovDocumentId) return;
    setBusy(true);
    try {
      setStatus(await outgoingStatus(pv.eGovDocumentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const errors = pv?.issues.filter((i) => i.level === 'error').length ?? 0;
  const warnings = pv?.issues.filter((i) => i.level === 'warning').length ?? 0;
  const isReturn = pv?.typeCode === 'IADE';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onMouseDown={() => !busy && onClose()}>
      <div className="w-full max-w-5xl rounded-md bg-white shadow-xl my-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-slate-500" /> e-Belge Önizleme ve Gönderim
          </h3>
          <button type="button" onClick={onClose} disabled={busy} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</div>}
          {notice && <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800">{notice}</div>}
          {!pv && !error && <div className="text-[12px] text-slate-500">Hazırlanıyor…</div>}

          {pv && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
                <Field label="Belge türü" value={pv.docKind === 2 ? 'e-Arşiv' : 'e-Fatura'} />
                <Field label="Senaryo / tip" value={`${pv.profileId} · ${pv.typeCode}`} />
                <Field
                  label={pv.invoiceNoIsProjected ? 'Numara (gönderimde verilir)' : 'Numara'}
                  value={pv.invoiceNo + (pv.invoiceNoIsProjected ? ' (öngörülen)' : '')}
                />
                <Field
                  label="Alıcı etiketi"
                  value={
                    pv.receiverAlias
                      ? `${pv.receiverAlias} (${pv.receiverAliasSource === 'cari' ? 'cari adresi' : 'GİB listesi'})`
                      : 'Yok — e-Fatura mükellefi değil'
                  }
                />
                <Field label="Mal / hizmet" value={n(pv.totals.lineExtension)} />
                <Field label="KDV" value={n(pv.totals.tax)} />
                {pv.totals.withholding > 0 && <Field label="Tevkifat" value={n(pv.totals.withholding)} />}
                <Field label="Ödenecek" value={`${n(pv.totals.payable)}`} />
                <Field label="Tasarım" value={pv.designTitle ?? 'e-Logo varsayılanı'} />
              </div>

              <div className="flex flex-wrap items-end gap-2 text-[12px]">
                {pv.docKind === 1 && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-slate-500">Senaryo</span>
                    <select value={profile} onChange={(e) => setProfile(e.target.value)} className="rounded-sm border border-slate-300 px-2 py-1">
                      <option value="">Varsayılan</option>
                      <option value="TEMELFATURA">TEMELFATURA</option>
                      <option value="TICARIFATURA">TICARIFATURA</option>
                    </select>
                  </label>
                )}
                {isReturn && (
                  <>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-500">İade edilen fatura no</span>
                      <input value={returnNo} onChange={(e) => setReturnNo(e.target.value)} className="rounded-sm border border-slate-300 px-2 py-1 w-44" />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-slate-500">Tarihi</span>
                      <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="rounded-sm border border-slate-300 px-2 py-1" />
                    </label>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Yenile
                </button>
                <button
                  type="button"
                  onClick={() => void downloadOutgoingUbl(invoiceId, opts()).catch((e) => setError(e.message))}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> UBL indir
                </button>
                {pv.eGovDocumentId && (
                  <button
                    type="button"
                    onClick={() => void doStatus()}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Durum sorgula
                  </button>
                )}
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => void doSend()}
                  disabled={busy || !pv.sendAllowed}
                  title={pv.sendBlockReason ?? undefined}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
                >
                  {pv.sendAllowed ? <Send className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {pv.docKind === 2 ? 'e-Arşiv gönder' : 'e-Fatura gönder'}
                </button>
              </div>
              {!pv.sendAllowed && pv.sendBlockReason && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800 inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> {pv.sendBlockReason}
                </div>
              )}
              {pv.sendStatus && (
                <div className="text-[12px] text-slate-600">
                  Gönderim durumu: <b>{pv.sendStatus}</b>
                  {pv.sentAt ? ` · ${new Date(pv.sentAt).toLocaleString('tr-TR')}` : ''}
                </div>
              )}
              {status && (
                <pre className="max-h-40 overflow-auto rounded-sm border border-slate-200 bg-slate-50 p-2 text-[11px]">
                  {Object.entries(status).map(([k, v]) => `${k}: ${v}`).join('\n')}
                </pre>
              )}

              <div className="flex gap-1 border-b border-slate-200 text-[12px]">
                <TabBtn active={tab === 'view'} onClick={() => setTab('view')}>
                  Görünüm
                </TabBtn>
                <TabBtn active={tab === 'checks'} onClick={() => setTab('checks')}>
                  Kontroller{' '}
                  {errors > 0 ? (
                    <span className="text-red-600">({errors} hata)</span>
                  ) : warnings > 0 ? (
                    <span className="text-amber-600">({warnings} uyarı)</span>
                  ) : (
                    <CheckCircle2 className="inline w-3.5 h-3.5 text-emerald-600" />
                  )}
                </TabBtn>
              </div>

              {tab === 'view' &&
                (pv.html ? (
                  <iframe title="e-Belge görünümü" sandbox="allow-scripts" srcDoc={pv.html} className="w-full h-[70vh] rounded-sm border border-slate-200 bg-white" />
                ) : (
                  <div className="text-[12px] text-slate-500">{pv.htmlError ?? 'Tasarım yok; görünüm e-Logo varsayılan tasarımıyla oluşur.'}</div>
                ))}

              {tab === 'checks' && (
                <div className="space-y-3 text-[12px]">
                  <ul className="space-y-1">
                    {pv.issues.map((i, k) => (
                      <li key={k} className="flex gap-1.5">
                        <IssueIcon level={i.level} />
                        <span>
                          <span className="text-slate-400">[{i.source}]</span> {i.message}
                        </span>
                      </li>
                    ))}
                    {pv.issues.length === 0 && <li className="text-slate-500">Sorun yok.</li>}
                  </ul>
                  <div>
                    <div className="font-medium text-slate-700 mb-1">Gidiş-dönüş (UBL yaz → oku)</div>
                    {pv.roundTrip.ok ? (
                      <div className="text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Toplamlar faturayla aynı (KDV {n(pv.programTax)} · toplam {n(pv.programTotal)})
                      </div>
                    ) : (
                      <ul className="list-disc pl-5 text-amber-700">
                        {pv.roundTrip.diffs.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-700 mb-1">Belge kuralları</div>
                    {pv.ruleSteps.length === 0 ? (
                      <div className="text-slate-500">Etkin kural yok.</div>
                    ) : (
                      <ul className="space-y-0.5">
                        {pv.ruleSteps.map((s) => (
                          <li key={s.ruleId}>
                            {s.ruleName} — <span className="text-slate-500">{s.status ?? 'atlandı'}</span>
                            {s.message ? ` · ${s.message}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-sm border border-slate-200 px-2 py-1.5">
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className="font-medium text-slate-800 break-all">{value}</div>
  </div>
);

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 -mb-px border-b-2 ${active ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
  >
    {children}
  </button>
);
