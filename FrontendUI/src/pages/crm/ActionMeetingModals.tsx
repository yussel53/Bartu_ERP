import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  addDaysInput,
  crmApi,
  nowLocalInput,
  toDateInput,
  type CrmAction,
  type CrmContact,
  type CrmLookups,
  type CrmMeeting,
  type CrmOffer,
  type CrmOpportunity,
} from '../../api/crmApi';
import { getCurrentUserId } from '../../data/permissions';
import { Btn, ErrorNote, Field, Modal, errMsg, inputCls, textareaCls } from './CrmUi';
import { OfferHeaderFields, OfferLinesEditor, newOfferDraft } from './OfferEditor';
import { contactLabel } from './OpportunityModal';
import { appConfirm } from '../../utils/appConfirm';

function useContacts(customerId?: number | null) {
  const [contacts, setContacts] = React.useState<CrmContact[]>([]);
  React.useEffect(() => {
    if (!customerId) return;
    crmApi.contacts(customerId).then(setContacts).catch(() => setContacts([]));
  }, [customerId]);
  return contacts;
}

/* ─── Aksiyon ─────────────────────────────────────────────────────────────── */
export function ActionModal({
  opportunity,
  initial,
  lookups,
  withOffer,
  onClose,
  onSaved,
}: {
  opportunity: CrmOpportunity;
  initial?: CrmAction | null;
  lookups: CrmLookups;
  withOffer?: boolean;
  onClose: () => void;
  onSaved: (r: { id: number; offerId?: number | null; closed?: string | null }) => void;
}) {
  const contacts = useContacts(opportunity.customerCardID);
  const [a, setA] = React.useState<Partial<CrmAction>>(
    () =>
      initial ?? {
        actionID: 0,
        opportunityID: opportunity.opportunityID,
        actionTypeID: lookups.actionTypes.find((t) => t.closeKind === 0)?.actionTypeID,
        actionDate: nowLocalInput(),
        dueDate: addDaysInput(7),
        customerContactID: opportunity.customerContactID ?? null,
        contactName: opportunity.contactName ?? '',
        assignedUserID: Number(getCurrentUserId()) || null,
        isDone: false,
      },
  );
  const [addOffer, setAddOffer] = React.useState(!!withOffer && !initial);
  const [offer, setOffer] = React.useState<Partial<CrmOffer>>(() => newOfferDraft(opportunity.opportunityID, lookups, opportunity.currencyID));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (p: Partial<CrmAction>) => setA((x) => ({ ...x, ...p }));
  const type = lookups.actionTypes.find((t) => t.actionTypeID === a.actionTypeID);

  React.useEffect(() => {
    if (withOffer && !initial) {
      const t = lookups.actionTypes.find((x) => /teklif/i.test(x.title));
      if (t) set({ actionTypeID: t.actionTypeID });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!a.actionTypeID) {
      setError('Aksiyon tipi seçin.');
      return;
    }
    if (type && type.closeKind > 0) {
      const kind = type.closeKind === 1 ? 'OLUMLU (Kazanıldı)' : 'OLUMSUZ (Kaybedildi)';
      if (!await appConfirm(`Bu aksiyon tipi fırsatı ${kind} olarak kapatacak. Devam edilsin mi?`)) return;
    }
    let newOffer: Partial<CrmOffer> | null = null;
    if (addOffer) {
      const lines = (offer.lines || []).filter((l) => l.productCardID || (l.description || '').trim());
      if (!lines.length) {
        setError('Teklif için en az bir kalem girin ya da "Teklif ekle" seçimini kaldırın.');
        return;
      }
      newOffer = { ...offer, lines };
    }
    setBusy(true);
    setError(null);
    try {
      const r = await crmApi.saveAction({ ...a, dueDate: a.dueDate || null, newOffer });
      onSaved(r);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={a.actionID ? `Aksiyon #${a.actionID}` : 'Yeni Aksiyon'}
      subtitle={`Fırsat #${opportunity.opportunityID} · ${opportunity.title}`}
      onClose={onClose}
      width={addOffer ? 'max-w-5xl' : 'max-w-2xl'}
      footer={
        <>
          <Btn onClick={onClose}>Vazgeç</Btn>
          <Btn variant="primary" busy={busy} onClick={save}>
            Kaydet
          </Btn>
        </>
      }
    >
      <ErrorNote error={error} />
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
        <Field label="Aksiyon tipi *" className="sm:col-span-3">
          <select className={inputCls} value={a.actionTypeID ?? ''} onChange={(e) => set({ actionTypeID: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Seçiniz…</option>
            {lookups.actionTypes.map((t) => (
              <option key={t.actionTypeID} value={t.actionTypeID}>
                {t.title}
                {t.closeKind === 1 ? ' (fırsatı kazanır)' : t.closeKind === 2 ? ' (fırsatı kaybeder)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aksiyon tarihi" className="sm:col-span-2">
          <input className={inputCls} type="datetime-local" value={a.actionDate ? String(a.actionDate).slice(0, 16) : ''} onChange={(e) => set({ actionDate: e.target.value })} />
        </Field>
        <Field label="Vade" className="sm:col-span-1">
          <input className={inputCls} type="date" value={toDateInput(a.dueDate)} onChange={(e) => set({ dueDate: e.target.value || null })} />
        </Field>
        {type && type.closeKind > 0 && (
          <div className="sm:col-span-6 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            Bu tip fırsatı <b>{type.closeKind === 1 ? 'olumlu' : 'olumsuz'}</b> kapatır; kayıttan sonra fırsat kapanacak.
          </div>
        )}
        <Field label="İletişim kişisi" className="sm:col-span-3">
          <select
            className={inputCls}
            value={a.customerContactID ?? ''}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              const c = contacts.find((x) => x.customerContactID === id);
              set({ customerContactID: id, contactName: c?.name || a.contactName });
            }}
          >
            <option value="">{contacts.length ? '—' : 'Cari iletişim kaydı yok'}</option>
            {contacts.map((c) => (
              <option key={c.customerContactID} value={c.customerContactID}>
                {contactLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kişi adı" className="sm:col-span-1">
          <input className={inputCls} value={a.contactName || ''} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <Field label="Sorumlu" className="sm:col-span-2">
          <select className={inputCls} value={a.assignedUserID ?? ''} onChange={(e) => set({ assignedUserID: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {lookups.users.map((u) => (
              <option key={u.systemUserID} value={u.systemUserID}>
                {u.fullName || u.nickName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Açıklama" className="sm:col-span-6">
          <textarea className={textareaCls} rows={3} value={a.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>

      {!a.actionID && (
        <label className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" checked={addOffer} onChange={(e) => setAddOffer(e.target.checked)} />
          Bu aksiyona teklif ekle
        </label>
      )}
      {addOffer && (
        <div className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3">
          <h4 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 mb-2">Teklif detayları</h4>
          <OfferHeaderFields offer={offer} onChange={setOffer} lookups={lookups} />
          <OfferLinesEditor offer={offer} onChange={setOffer} customerId={opportunity.customerCardID} />
        </div>
      )}
    </Modal>
  );
}

/* ─── Görüşme ─────────────────────────────────────────────────────────────── */
const CHANNELS = ['Telefon', 'Yüz yüze', 'Online toplantı', 'WhatsApp', 'Not'];

export function MeetingModal({
  opportunity,
  initial,
  actionId,
  onClose,
  onSaved,
}: {
  opportunity: CrmOpportunity;
  initial?: CrmMeeting | null;
  actionId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [m, setM] = React.useState<Partial<CrmMeeting>>(
    () =>
      initial ?? {
        meetingID: 0,
        opportunityID: opportunity.opportunityID,
        actionID: actionId ?? null,
        meetingDate: nowLocalInput(),
        channel: 'Telefon',
        direction: 2,
        contactName: opportunity.contactName ?? '',
      },
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (p: Partial<CrmMeeting>) => setM((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!(m.subject || '').trim() && !(m.notes || '').trim()) {
      setError('Konu veya görüşme notu girin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await crmApi.saveMeeting({ ...m, nextStepDate: m.nextStepDate || null });
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={m.meetingID ? 'Görüşmeyi düzenle' : 'Yeni Görüşme'}
      subtitle={`Fırsat #${opportunity.opportunityID} · ${opportunity.title}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Vazgeç</Btn>
          <Btn variant="primary" busy={busy} onClick={save}>
            Kaydet
          </Btn>
        </>
      }
    >
      <ErrorNote error={error} />
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
        <Field label="Tarih / saat" className="sm:col-span-2">
          <input className={inputCls} type="datetime-local" value={m.meetingDate ? String(m.meetingDate).slice(0, 16) : ''} onChange={(e) => set({ meetingDate: e.target.value })} />
        </Field>
        <Field label="Kanal" className="sm:col-span-2">
          <select className={inputCls} value={m.channel} onChange={(e) => set({ channel: e.target.value })}>
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Yön" className="sm:col-span-1">
          <select className={inputCls} value={m.direction} onChange={(e) => set({ direction: Number(e.target.value) })}>
            <option value={2}>Giden</option>
            <option value={1}>Gelen</option>
          </select>
        </Field>
        <Field label="Süre (dk)" className="sm:col-span-1">
          <input className={`${inputCls} text-right`} type="number" min={0} value={m.durationMin ?? ''} onChange={(e) => set({ durationMin: e.target.value === '' ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Görüşülen kişi" className="sm:col-span-2">
          <input className={inputCls} value={m.contactName || ''} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <Field label="Konu" className="sm:col-span-4">
          <input className={inputCls} value={m.subject || ''} onChange={(e) => set({ subject: e.target.value })} autoFocus />
        </Field>
        <Field label="Görüşme notu" className="sm:col-span-6">
          <textarea className={textareaCls} rows={5} value={m.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <Field label="Sonraki adım" className="sm:col-span-4">
          <input className={inputCls} value={m.nextStep || ''} onChange={(e) => set({ nextStep: e.target.value })} placeholder="örn. Revize teklif gönderilecek" />
        </Field>
        <Field label="Sonraki adım tarihi" className="sm:col-span-2">
          <input className={inputCls} type="date" value={toDateInput(m.nextStepDate)} onChange={(e) => set({ nextStepDate: e.target.value || null })} />
        </Field>
      </div>
    </Modal>
  );
}
