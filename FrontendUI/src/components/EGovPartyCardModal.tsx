import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, UserPlus, X } from 'lucide-react';
import { EGovPartyInfo, getEGovPartyCard } from '../api/egovPartyCardApi';
import { buildOpenDocHref, createOpenDocId, useOpenDocumentsOptional } from '../contexts/OpenDocumentsContext';
import { CustomerAddressType } from '../data/customerAddressTypes';
import { DynamicFormDataDto } from '../types/formTypes';
import { getRecord } from '../api/recordsApi';

const CARI_SCREEN = { path: 'finans/ana-kayitlar/cari-kartlar', title: 'Cari Kartlar', formCode: 'CustomerCardForm' };

interface Props {
  egovId: number;
  onClose: () => void;
}

/** e-Belgenin karşı tarafından yeni cari kart taslağı — kaydı / değişiklikleri kullanıcı yapar */
function buildCariDraft(info: EGovPartyInfo): DynamicFormDataDto {
  const incoming = info.direction !== 2;
  const status =
    info.isEInvoiceUser == null ? '' : info.isEInvoiceUser ? 'e-Fatura mükellefi (GİB)' : 'e-Fatura mükellefi değil (GİB)';
  const address: Record<string, unknown> = {
    AdressType: String(CustomerAddressType.Merkez),
    IsDefault: true,
    Active: true,
    Title: 'Merkez',
    AdressCode: '',
    Country: info.country || 'Türkiye',
    City: info.city || '',
    Town: info.town || '',
    Dictrict: info.district || '',
    Adress: [info.street, info.postalZone].filter(Boolean).join(' '),
    PostLabel: info.postLabel || '',
    SenderLabel: info.senderLabel || '',
    EinvoiceEmailAdress: '',
    TaxNr: info.taxNr || '',
    TaxOffice: (info.taxOffice || '').slice(0, 50),
    MukellefCheckStatus: status,
  };
  const contacts =
    info.phone || info.email
      ? [{ ContactTitle: 'Genel', Name: info.title || '', Phone: info.phone || '', Email: info.email || '', IsDefault: true }]
      : [];
  const einvoice = info.isEInvoiceUser === false || (info.profileId || '').includes('EARSIV') ? '2' : '1';
  return {
    recordId: 0,
    standardFields: {
      Active: true,
      Code: info.suggestedCode || '',
      Title: info.title || '',
      Type_: incoming ? '2' : '1', // gelen: Satıcı · giden: Alıcı
      TaxType: String(info.taxType ?? (String(info.taxNr || '').length === 11 ? 2 : 1)),
      TaxNr: info.taxNr || '',
      TaxOffice: (info.taxOffice || '').slice(0, 50),
      EinvoiceType: einvoice,
      EinvoiceEntryDate: info.einvoiceEntryDate ? info.einvoiceEntryDate.slice(0, 10) : '',
      SalesModuleCheck: !incoming,
      PurchaseModuleCheck: incoming,
      FinanceModuleCheck: true,
    },
    additionalFields: {},
    addresses: [address],
    contacts,
  };
}

const isEmpty = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');
const norm = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');

/** Kart alanları (Türkçe ad) — güncelleme özetinde */
const FIELD_LABELS: Record<string, string> = {
  TaxNr: 'VKN/TCKN',
  TaxOffice: 'Vergi dairesi',
  TaxType: 'Vergi tipi',
  EinvoiceType: 'e-Fatura tipi',
  EinvoiceEntryDate: 'e-Fatura geçiş tarihi',
  Title: 'Ünvan',
  Code: 'Cari kodu',
};
const ADDRESS_FILL = ['PostLabel', 'SenderLabel', 'TaxNr', 'TaxOffice', 'Dictrict', 'Town', 'City', 'Country', 'MukellefCheckStatus'];

/**
 * Var olan cari + e-Fatura bilgisi: yalnız BOŞ alanlar doldurulur (dolu alan ezilmez); farklı adres / ilgili kişi
 * yeni satır olarak eklenir, aynı adresin boş alanları (PK/GB etiketi vb.) tamamlanır.
 */
function mergeIntoExisting(existing: DynamicFormDataDto, draft: DynamicFormDataDto): { data: DynamicFormDataDto; changes: string[] } {
  const changes: string[] = [];
  const std = { ...existing.standardFields };
  for (const [k, v] of Object.entries(draft.standardFields)) {
    if (typeof v === 'boolean' || isEmpty(v) || k === 'Code' || k === 'Title' || k === 'Type_') continue;
    if (isEmpty(std[k])) {
      std[k] = v;
      changes.push(`${FIELD_LABELS[k] || k}: ${String(v)}`);
    }
  }

  const addresses = [...(existing.addresses ?? [])].map((a) => ({ ...a }));
  for (const na of draft.addresses ?? []) {
    const key = norm(na.Adress) + '|' + norm(na.City) + '|' + norm(na.Town);
    const same = addresses.find((a) => norm(a.Adress) + '|' + norm(a.City) + '|' + norm(a.Town) === key)
      // adres metni farklı olsa da e-Fatura etiketi aynı adrese aittir
      ?? (na.PostLabel ? addresses.find((a) => norm(a.PostLabel) === norm(na.PostLabel)) : undefined);
    if (same) {
      const filled = ADDRESS_FILL.filter((f) => isEmpty(same[f]) && !isEmpty(na[f]));
      filled.forEach((f) => (same[f] = na[f]));
      if (filled.length) changes.push(`Adres «${same.Title || same.Adress}»: ${filled.length} boş alan dolduruldu`);
    } else {
      addresses.push({ ...na, IsDefault: addresses.length === 0, Title: addresses.length ? 'e-Fatura adresi' : na.Title });
      changes.push(`Yeni adres eklendi: ${[na.Adress, na.Town, na.City].filter(Boolean).join(', ')}`);
    }
  }

  const contacts = [...(existing.contacts ?? [])].map((c) => ({ ...c }));
  for (const nc of draft.contacts ?? []) {
    const exists = contacts.some(
      (c) => (!isEmpty(nc.Phone) && norm(c.Phone) === norm(nc.Phone)) || (!isEmpty(nc.Email) && norm(c.Email) === norm(nc.Email)),
    );
    if (!exists) {
      contacts.push({ ...nc, IsDefault: contacts.length === 0 });
      changes.push(`Yeni ilgili kişi eklendi: ${[nc.Phone, nc.Email].filter(Boolean).join(' · ')}`);
    }
  }
  return { data: { ...existing, standardFields: std, addresses, contacts }, changes };
}

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : null);

/**
 * e-Faturanın (UBL) karşı tarafı + GİB PK/GB etiketleri → yeni cari kart formu doldurulur;
 * kaydetmek / değiştirmek kullanıcıya bırakılır. Aynı VKN/TCKN'li cari varsa o kart eksik alanları doldurulmuş
 * (adres / ilgili kişi yalnız yeni satır olarak eklenmiş) halde «Değiştir» modunda açılır.
 */
export const EGovPartyCardModal: React.FC<Props> = ({ egovId, onClose }) => {
  const docs = useOpenDocumentsOptional();
  const [info, setInfo] = useState<EGovPartyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [merge, setMerge] = useState<{ data: DynamicFormDataDto; changes: string[] } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getEGovPartyCard(egovId);
        if (!alive) return;
        setInfo(r);
        if (r.existingCardID) {
          // Var olan kart: güncellenecek alanlar önceden hesaplanır (kayıt kullanıcıda)
          const rec = await getRecord('CustomerCard', r.existingCardID, 'CustomerCardID');
          const existing: DynamicFormDataDto = {
            recordId: rec.recordId,
            standardFields: { ...rec.standardFields },
            additionalFields: { ...(rec.additionalFields || {}) },
            addresses: rec.addresses || [],
            contacts: rec.contacts || [],
          };
          if (alive) setMerge(mergeIntoExisting(existing, buildCariDraft(r)));
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [egovId]);

  const openNew = () => {
    if (!info) return;
    const draftId = createOpenDocId('create');
    const label = `Yeni · ${info.title || info.taxNr}`;
    if (docs) {
      docs.openOrFocus({
        id: draftId,
        formCode: CARI_SCREEN.formCode,
        screenPath: CARI_SCREEN.path,
        screenTitle: CARI_SCREEN.title,
        mode: 'create',
        label,
      });
      docs.updateDraft(draftId, { data: buildCariDraft(info), label });
    }
    onClose();
    window.location.hash = `#/${buildOpenDocHref(CARI_SCREEN.path, 'create', { draftId })}`;
  };

  const openExisting = () => {
    if (!info?.existingCardID) return;
    const recordId = String(info.existingCardID);
    if (docs && merge && merge.changes.length > 0) {
      // Birleştirilmiş veri «Değiştir» taslağı olarak açılır; kaydetmek kullanıcıda
      const draftId = createOpenDocId('edit', recordId);
      const label = `Değiştir · ${info.existingTitle || info.title}`;
      docs.openOrFocus({
        id: draftId,
        formCode: CARI_SCREEN.formCode,
        screenPath: CARI_SCREEN.path,
        screenTitle: CARI_SCREEN.title,
        mode: 'edit',
        recordId,
        label,
      });
      docs.updateDraft(draftId, { data: merge.data, label });
    }
    onClose();
    window.location.hash = `#/${buildOpenDocHref(CARI_SCREEN.path, 'edit', { recordId: String(info.existingCardID) })}`;
  };

  const incoming = info?.direction !== 2;
  const lbl = 'w-28 shrink-0 text-slate-500';
  const row = (label: string, value?: string | null) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className={lbl}>{label}</span>
      <span className="min-w-0 flex-1 truncate" title={value || ''}>
        {value || <span className="text-slate-300">—</span>}
      </span>
    </div>
  );
  const address = [info?.street, info?.district, info?.town, info?.city, info?.postalZone, info?.country]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className="mt-16 w-full max-w-xl bg-white rounded-sm shadow-xl border border-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserPlus className="w-4 h-4 text-blue-700" />
            e-Faturadan Cari Kartı{info?.documentNo ? ` · ${info.documentNo}` : ''}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2 text-xs">
          {!info && !error && <div className="text-slate-500">Belge ve GİB etiketleri okunuyor…</div>}
          {error && <div className="px-2 py-1.5 rounded-sm border border-red-200 bg-red-50 text-red-700">{error}</div>}
          {info && (
            <>
              {info.existingCardID ? (
                <div className="px-2 py-1.5 rounded-sm border border-amber-200 bg-amber-50 text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-700" />
                    <span>
                      Bu VKN/TCKN ile cari kayıtlı: <b>{info.existingCode}</b> — {info.existingTitle}.{' '}
                      {merge == null ? 'Karşılaştırılıyor…' : merge.changes.length ? <b>Kayıt güncellenecek:</b> : 'Kayıttaki bilgiler güncel.'}
                    </span>
                  </div>
                  {merge && merge.changes.length > 0 && (
                    <ul className="list-disc pl-6 text-[11px] text-amber-900">
                      {merge.changes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                  {merge && merge.changes.length > 0 && (
                    <div className="text-[11px] text-amber-800">
                      Yalnız boş alanlar doldurulur; dolu alanlar, mevcut adresler ve ilgili kişiler değiştirilmez. Kaydetmek size kalır.
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-2 py-1.5 rounded-sm border border-blue-200 bg-blue-50 text-blue-800">
                  Bilgiler yeni cari kart formuna yerleştirilir; kontrol edip kaydetmek size kalır.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {row('Ünvan', info.title)}
                {row('Cari Kodu', info.suggestedCode)}
                {row(info.taxType === 2 ? 'TCKN' : 'VKN', info.taxNr)}
                {row('Vergi Dairesi', info.taxOffice)}
                {row('Cari Tür', incoming ? 'Satıcı (gelen fatura)' : 'Alıcı (giden fatura)')}
                {row('e-Fatura Geçiş', fmtDate(info.einvoiceEntryDate))}
                {row('Telefon', info.phone)}
                {row('E-posta', info.email)}
              </div>
              <div className="flex items-start gap-2">
                <span className={lbl}>Adres (Merkez)</span>
                <span className="min-w-0 flex-1">{address || <span className="text-slate-300">—</span>}</span>
              </div>
              <div className="pt-1 border-t border-slate-100 space-y-1">
                {row('Posta Kutusu (PK)', info.postLabel)}
                {row('Gönderici (GB)', info.senderLabel)}
                {info.labelMessage && <div className="text-[11px] text-slate-500">{info.labelMessage}</div>}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 text-xs rounded-sm border border-slate-300 bg-white hover:bg-slate-50"
          >
            Kapat
          </button>
          {info?.existingCardID ? (
            <button
              type="button"
              onClick={openExisting}
              className="h-7 px-3 text-xs rounded-sm border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {merge?.changes.length ? 'Cari kartında güncelle' : 'Cari kartını aç'}
            </button>
          ) : (
            <button
              type="button"
              onClick={openNew}
              disabled={!info}
              className="h-7 px-3 text-xs rounded-sm border border-blue-700 bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> Cari kartında aç
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
