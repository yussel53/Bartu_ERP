import React from 'react';
import { Search } from 'lucide-react';
import { crmApi, type CrmContact, type CrmLookupItem, type CrmLookups, type CrmOpportunity, toDateInput } from '../../api/crmApi';
import { getCurrentUserId } from '../../data/permissions';
import { Btn, ErrorNote, Field, Modal, errMsg, inputCls, textareaCls } from './CrmUi';

const OPP_TYPES = ['Satış', 'Hizmet', 'Proje', 'Bakım / Destek', 'Yenileme'];
const SOURCES = ['Telefon', 'E-posta', 'Web', 'Referans', 'Fuar / Etkinlik', 'Ziyaret', 'Mevcut Müşteri'];

/** Cari arama (CustomerCard) */
export function CustomerPicker({
  value,
  label,
  onChange,
}: {
  value?: number | null;
  label?: string | null;
  onChange: (c: CrmLookupItem | null) => void;
}) {
  const [q, setQ] = React.useState(label || '');
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<CrmLookupItem[]>([]);
  React.useEffect(() => setQ(label || ''), [label]);
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      crmApi.customers(q === label ? '' : q).then(setItems).catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, label]);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputCls} pl-7`}
          value={q}
          placeholder="Cari kodu / unvanı ara…"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value) onChange(null);
          }}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
          {items.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-slate-400">Kayıt yok</div>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c);
                  setQ(c.title || '');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 dark:hover:bg-slate-700 ${value === c.id ? 'bg-blue-50' : ''}`}
              >
                <span className="font-mono text-[11px] text-slate-500 mr-2">{c.code}</span>
                {c.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function contactEmail(c: CrmContact): string | null {
  if (c.email) return c.email;
  return c.contact && c.contact.includes('@') ? c.contact : null;
}
export function contactLabel(c: CrmContact): string {
  return [c.name, c.contactTitle, contactEmail(c) || c.phone || c.contact].filter(Boolean).join(' · ') || `#${c.customerContactID}`;
}

interface Props {
  initial?: CrmOpportunity | null;
  lookups: CrmLookups;
  onClose: () => void;
  onSaved: (id: number) => void;
}

export function OpportunityModal({ initial, lookups, onClose, onSaved }: Props) {
  const [o, setO] = React.useState<Partial<CrmOpportunity>>(
    () =>
      initial ?? {
        opportunityID: 0,
        title: '',
        priority: 2,
        status: 0,
        oppType: 'Satış',
        currencyID: lookups.currencies[0]?.id ?? 1,
        ownerUserID: Number(getCurrentUserId()) || undefined,
        probability: 50,
      },
  );
  const [contacts, setContacts] = React.useState<CrmContact[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (patch: Partial<CrmOpportunity>) => setO((p) => ({ ...p, ...patch }));

  React.useEffect(() => {
    if (!o.customerCardID) {
      setContacts([]);
      return;
    }
    crmApi.contacts(o.customerCardID).then(setContacts).catch(() => setContacts([]));
  }, [o.customerCardID]);

  const save = async () => {
    if (!o.title?.trim()) {
      setError('Fırsat başlığı zorunlu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await crmApi.saveOpportunity({
        ...o,
        expectedCloseDate: o.expectedCloseDate || null,
        reminderDate: o.reminderDate || null,
      });
      onSaved(r.id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={o.opportunityID ? `Fırsat #${o.opportunityID}` : 'Yeni Fırsat'}
      subtitle="CRM_Opportunity · müşteri, ilgili kişi ve beklenen tutar"
      onClose={onClose}
      width="max-w-3xl"
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
        <Field label="Başlık *" className="sm:col-span-6">
          <input className={inputCls} value={o.title || ''} onChange={(e) => set({ title: e.target.value })} autoFocus placeholder="örn. 2027 ERP lisans yenilemesi" />
        </Field>
        <Field label="Müşteri (Cari)" className="sm:col-span-3">
          <CustomerPicker
            value={o.customerCardID}
            label={o.customerTitle}
            onChange={(c) =>
              set({ customerCardID: c?.id ?? null, customerTitle: c?.title ?? null, customerCode: c?.code ?? null, customerContactID: null })
            }
          />
        </Field>
        <Field label="İlgili kişi (cari iletişim)" className="sm:col-span-3">
          <select
            className={inputCls}
            value={o.customerContactID ?? ''}
            disabled={!o.customerCardID}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              const c = contacts.find((x) => x.customerContactID === id);
              set({
                customerContactID: id,
                contactName: c ? c.name || o.contactName : o.contactName,
                contactEmail: c ? contactEmail(c) || o.contactEmail : o.contactEmail,
                contactPhone: c ? c.phone || o.contactPhone : o.contactPhone,
              });
            }}
          >
            <option value="">{o.customerCardID ? (contacts.length ? 'Seçiniz…' : 'Kayıtlı kişi yok') : 'Önce cari seçin'}</option>
            {contacts.map((c) => (
              <option key={c.customerContactID} value={c.customerContactID}>
                {contactLabel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kişi adı" className="sm:col-span-2">
          <input className={inputCls} value={o.contactName || ''} onChange={(e) => set({ contactName: e.target.value })} />
        </Field>
        <Field label="E-posta" className="sm:col-span-2" hint="Teklif maili bu adrese önerilir">
          <input className={inputCls} type="email" value={o.contactEmail || ''} onChange={(e) => set({ contactEmail: e.target.value })} />
        </Field>
        <Field label="Telefon" className="sm:col-span-2">
          <input className={inputCls} value={o.contactPhone || ''} onChange={(e) => set({ contactPhone: e.target.value })} />
        </Field>
        <Field label="Tür" className="sm:col-span-2">
          <input className={inputCls} list="crm-opp-types" value={o.oppType || ''} onChange={(e) => set({ oppType: e.target.value })} />
          <datalist id="crm-opp-types">
            {OPP_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Kaynak" className="sm:col-span-2">
          <input className={inputCls} list="crm-opp-sources" value={o.source || ''} onChange={(e) => set({ source: e.target.value })} />
          <datalist id="crm-opp-sources">
            {SOURCES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Öncelik" className="sm:col-span-2">
          <select className={inputCls} value={o.priority ?? 2} onChange={(e) => set({ priority: Number(e.target.value) })}>
            <option value={1}>Yüksek</option>
            <option value={2}>Normal</option>
            <option value={3}>Düşük</option>
          </select>
        </Field>
        <Field label="Beklenen tutar" className="sm:col-span-2">
          <input
            className={`${inputCls} text-right`}
            type="number"
            step="0.01"
            value={o.expectedAmount ?? ''}
            onChange={(e) => set({ expectedAmount: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
        <Field label="Para birimi" className="sm:col-span-1">
          <select className={inputCls} value={o.currencyID ?? ''} onChange={(e) => set({ currencyID: e.target.value ? Number(e.target.value) : null })}>
            {lookups.currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Olasılık %" className="sm:col-span-1">
          <input
            className={`${inputCls} text-right`}
            type="number"
            min={0}
            max={100}
            value={o.probability ?? ''}
            onChange={(e) => set({ probability: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </Field>
        <Field label="Tahmini kapanış" className="sm:col-span-2">
          <input className={inputCls} type="date" value={toDateInput(o.expectedCloseDate)} onChange={(e) => set({ expectedCloseDate: e.target.value || null })} />
        </Field>
        <Field label="Sorumlu" className="sm:col-span-3">
          <select className={inputCls} value={o.ownerUserID ?? ''} onChange={(e) => set({ ownerUserID: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {lookups.users.map((u) => (
              <option key={u.systemUserID} value={u.systemUserID}>
                {u.fullName || u.nickName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hatırlatma" className="sm:col-span-3">
          <input
            className={inputCls}
            type="datetime-local"
            value={o.reminderDate ? String(o.reminderDate).slice(0, 16) : ''}
            onChange={(e) => set({ reminderDate: e.target.value || null })}
          />
        </Field>
        <Field label="Açıklama / not" className="sm:col-span-6">
          <textarea className={textareaCls} rows={3} value={o.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
