import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, ExternalLink, Mail, Paperclip, Send } from 'lucide-react';
import {
  MAIL_STATUS,
  crmApi,
  fmtDateTime,
  type CrmLookups,
  type CrmMail,
  type CrmMailDraft,
  type CrmOffer,
} from '../../api/crmApi';
import { Badge, Btn, Empty, ErrorNote, Field, Modal, Spinner, errMsg, inputCls, textareaCls } from './CrmUi';

const STATUS_CLS: Record<number, string> = {
  0: 'bg-slate-100 text-slate-600 border-slate-200',
  1: 'bg-blue-50 text-blue-700 border-blue-200',
  2: 'bg-rose-50 text-rose-700 border-rose-200',
  3: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function MailRow({ m, onOpen }: { m: CrmMail; onOpen: (m: CrmMail) => void }) {
  const incoming = m.direction === 2;
  return (
    <button
      type="button"
      onClick={() => onOpen(m)}
      className="w-full text-left px-2.5 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {incoming ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />}
        <span className="truncate">{incoming ? m.mailFrom : m.mailTo}</span>
        <span className="ml-auto whitespace-nowrap">{fmtDateTime(m.mailDate || m.createDate)}</span>
      </div>
      <div className="text-[12px] font-medium text-slate-800 dark:text-slate-100 truncate mt-0.5">{m.subject || '(konusuz)'}</div>
      <div className="flex items-center gap-1 mt-1">
        <Badge className={STATUS_CLS[m.status] || ''}>{MAIL_STATUS[m.status] || m.status}</Badge>
        <Badge className="bg-white text-slate-500 border-slate-200">{m.channel}</Badge>
        {m.offerDocNum && <Badge className="bg-white text-slate-500 border-slate-200">Teklif {m.offerDocNum}</Badge>}
        {m.attachmentNames && <Paperclip className="w-3 h-3 text-slate-400" />}
      </div>
    </button>
  );
}

export function MailViewer({ mail, onClose }: { mail: CrmMail; onClose: () => void }) {
  const [full, setFull] = React.useState<CrmMail>(mail);
  React.useEffect(() => {
    crmApi.getMail(mail.mailLogID).then(setFull).catch(() => undefined);
  }, [mail.mailLogID]);
  return (
    <Modal
      title={full.subject || '(konusuz)'}
      subtitle={`${full.direction === 2 ? 'Gelen' : 'Giden'} · ${MAIL_STATUS[full.status] || ''} · ${full.channel} · ${fmtDateTime(full.mailDate || full.createDate)}`}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          {full.hasRaw && (
            <a href={crmApi.mailFileUrl(full.mailLogID)} className="inline-flex">
              <Btn icon={<Download className="w-3.5 h-3.5" />}>Ham maili indir ({full.rawFileName || '.msg'})</Btn>
            </a>
          )}
          <Btn onClick={onClose}>Kapat</Btn>
        </>
      }
    >
      <div className="text-[12px] space-y-0.5 mb-2">
        <div>
          <span className="text-slate-500 w-14 inline-block">Kimden</span> {full.mailFrom || '-'}
        </div>
        <div>
          <span className="text-slate-500 w-14 inline-block">Kime</span> {full.mailTo || '-'}
        </div>
        {full.mailCc && (
          <div>
            <span className="text-slate-500 w-14 inline-block">Bilgi</span> {full.mailCc}
          </div>
        )}
        {full.attachmentNames && (
          <div className="flex items-center gap-1">
            <Paperclip className="w-3 h-3 text-slate-400" /> {full.attachmentNames}
          </div>
        )}
        {full.errorMessage && <ErrorNote error={full.errorMessage} />}
      </div>
      {full.isHtml ? (
        <iframe title="mail" className="w-full h-[420px] rounded border border-slate-200 bg-white" sandbox="" srcDoc={full.body || ''} />
      ) : (
        <pre className="whitespace-pre-wrap text-[12px] font-sans rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 max-h-[420px] overflow-auto">
          {full.body || ''}
        </pre>
      )}
    </Modal>
  );
}

/** Teklif maili: Outlook'ta aç (.eml) veya SMTP ile gönder + bu teklifin yazışma geçmişi */
export function OfferMailModal({
  offer,
  lookups,
  onClose,
  onChanged,
}: {
  offer: CrmOffer;
  lookups: CrmLookups;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = React.useState<CrmMailDraft | null>(null);
  const [history, setHistory] = React.useState<CrmMail[] | null>(null);
  const [viewing, setViewing] = React.useState<CrmMail | null>(null);
  const [busy, setBusy] = React.useState<'' | 'smtp' | 'outlook'>('');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(() => {
    crmApi
      .listMails(offer.opportunityID)
      .then((l) => setHistory(l.filter((m) => m.offerID === offer.offerID || m.offerID == null)))
      .catch(() => setHistory([]));
  }, [offer.opportunityID, offer.offerID]);

  React.useEffect(() => {
    crmApi.mailDraft(offer.offerID).then(setDraft).catch((e) => setError(errMsg(e)));
    loadHistory();
  }, [offer.offerID, loadHistory]);

  const set = (p: Partial<CrmMailDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const addTo = (addr: string) => {
    if (!draft) return;
    const parts = draft.to.split(/[;,]\s*/).filter(Boolean);
    if (!parts.some((p) => p.toLowerCase() === addr.toLowerCase())) set({ to: [...parts, addr].join('; ') });
  };

  const outlook = async () => {
    if (!draft) return;
    setBusy('outlook');
    setError(null);
    try {
      await crmApi.outlookDraft(draft);
      setInfo('Taslak (.eml) indirildi. Dosyayı açınca Outlook yeni mail penceresi açar; gönderdiğinizde Outlook CRM eklentisi kaydı "Gönderildi" yapar.');
      loadHistory();
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  const smtp = async () => {
    if (!draft) return;
    setBusy('smtp');
    setError(null);
    try {
      await crmApi.sendMail(draft);
      setInfo('Mail gönderildi ve kayda işlendi.');
      loadHistory();
      onChanged();
    } catch (e) {
      setError(errMsg(e));
      loadHistory();
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Modal
        title={`Teklif Maili · ${draft?.docNumber ?? offer.docNum}`}
        subtitle={draft ? `${draft.customerName || ''} · konu etiketi ${draft.tag} Outlook eklentisi ile eşleştirmede kullanılır` : undefined}
        onClose={onClose}
        width="max-w-5xl"
        footer={
          <>
            <Btn onClick={onClose}>Kapat</Btn>
            <Btn icon={<ExternalLink className="w-3.5 h-3.5" />} busy={busy === 'outlook'} disabled={!draft || !!busy} onClick={outlook}>
              Outlook'ta Aç (.eml)
            </Btn>
            <Btn
              variant="primary"
              icon={<Send className="w-3.5 h-3.5" />}
              busy={busy === 'smtp'}
              disabled={!draft || !!busy || !(draft.smtpReady ?? lookups.smtpReady)}
              title={(draft?.smtpReady ?? lookups.smtpReady) ? '' : 'Bu kullanıcı için mail (SMTP) tanımı yok — Sistem Yönetimi › Tanımlar › CRM Ayarları › Mail tanımları'}
              onClick={smtp}
            >
              SMTP ile Gönder
            </Btn>
          </>
        }
      >
        <ErrorNote error={error} />
        {info && <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-700">{info}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            {!draft ? (
              <Spinner />
            ) : (
              <div className="space-y-2">
                <Field label="Kime">
                  <input className={inputCls} value={draft.to} onChange={(e) => set({ to: e.target.value })} />
                </Field>
                {draft.suggestedAddresses.length > 0 && (
                  <div className="flex flex-wrap gap-1 -mt-1">
                    {draft.suggestedAddresses.map((a) => (
                      <button key={a} type="button" onClick={() => addTo(a)} className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-[11px] text-slate-600">
                        + {a}
                      </button>
                    ))}
                  </div>
                )}
                <Field label="Bilgi (CC)">
                  <input className={inputCls} value={draft.cc} onChange={(e) => set({ cc: e.target.value })} />
                </Field>
                <Field label="Konu" hint={`${draft.tag} etiketi silinse bile gönderimde geri eklenir.`}>
                  <input className={inputCls} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
                </Field>
                <Field label="İleti">
                  <textarea className={textareaCls} rows={9} value={draft.body} onChange={(e) => set({ body: e.target.value })} />
                </Field>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-700 dark:text-slate-200">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={draft.includeOfferTable} onChange={(e) => set({ includeOfferTable: e.target.checked })} />
                    Teklif tablosunu mail gövdesine ekle
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={draft.attachOfferHtml} onChange={(e) => set({ attachOfferHtml: e.target.checked })} />
                    Teklif belgesini ekle (.html)
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={draft.copyToMe} onChange={(e) => set({ copyToMe: e.target.checked })} />
                    Bana kopya (BCC)
                  </label>
                </div>
                <div className="text-[11px] text-slate-500">
                  Mail tanımı: <b>{draft.profileSource || 'tanım yok (yalnız Outlook)'}</b>
                </div>
                <div className="text-[11px] text-slate-500">
                  Gönderen: {draft.senderName || '-'} {draft.senderEmail ? `<${draft.senderEmail}>` : '(kullanıcı e-postası tanımlı değil — Sistem Yönetimi › Tanımlar › CRM Ayarları)'}
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
              <Mail className="w-3.5 h-3.5" /> Yazışma geçmişi
            </div>
            <div className="rounded-md border border-slate-200 dark:border-slate-700 max-h-[440px] overflow-auto">
              {history == null ? <Spinner /> : history.length === 0 ? <Empty>Henüz yazışma yok</Empty> : history.map((m) => <MailRow key={m.mailLogID} m={m} onOpen={setViewing} />)}
            </div>
          </div>
        </div>
      </Modal>
      {viewing && <MailViewer mail={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
