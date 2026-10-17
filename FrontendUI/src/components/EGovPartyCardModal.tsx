import React, { useEffect, useState } from 'react';
import { CheckCircle2, UserPlus, X } from 'lucide-react';
import { createEGovPartyCard, EGovPartyInfo, getEGovPartyCard } from '../api/egovPartyCardApi';

interface Props {
  egovId: number;
  onClose: () => void;
  /** Cari açıldığında ya da zaten kayıtlıysa */
  onDone: (card: { id: number; code: string; title: string }, message: string) => void;
}

/**
 * e-Faturanın (UBL) karşı tarafından cari kart: unvan, VKN/TCKN, vergi dairesi, adres, iletişim
 * belgeden okunur; kod ve unvan değiştirilebilir. Aynı VKN/TCKN'li cari varsa yenisi açılmaz.
 */
export const EGovPartyCardModal: React.FC<Props> = ({ egovId, onClose, onDone }) => {
  const [info, setInfo] = useState<EGovPartyInfo | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getEGovPartyCard(egovId)
      .then((r) => {
        if (!alive) return;
        setInfo(r);
        setCode(r.suggestedCode || '');
        setTitle(r.title || '');
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [egovId]);

  const save = async () => {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      const r = await createEGovPartyCard(egovId, { code: code.trim(), title: title.trim() });
      onDone({ id: r.customerCardID, code: r.code, title: title.trim() }, r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const incoming = info?.direction !== 2;
  const lbl = 'w-24 shrink-0 text-slate-500';
  const val = 'min-w-0 flex-1 truncate';
  const input = 'min-w-0 flex-1 h-7 px-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-blue-500';
  const row = (label: string, value?: string | null) => (
    <div className="flex items-center gap-2">
      <span className={lbl}>{label}</span>
      <span className={val} title={value || ''}>
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
      onMouseDown={() => !busy && onClose()}
    >
      <div
        className="mt-16 w-full max-w-xl bg-white rounded-sm shadow-xl border border-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserPlus className="w-4 h-4 text-blue-700" />
            e-Faturadan Cari Kaydet{info?.documentNo ? ` · ${info.documentNo}` : ''}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2 text-xs">
          {!info && !error && <div className="text-slate-500">Belge okunuyor…</div>}
          {error && <div className="px-2 py-1.5 rounded-sm border border-red-200 bg-red-50 text-red-700">{error}</div>}
          {info && (
            <>
              {info.existingCardID ? (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  Bu VKN/TCKN ile cari zaten kayıtlı: <b>{info.existingCode}</b> — {info.existingTitle}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  <label className="flex items-center gap-2">
                    <span className={lbl}>Cari Kodu</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={50} className={input} />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className={lbl}>Ünvan</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
                  </label>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-slate-100">
                {row(info.taxType === 2 ? 'TCKN' : 'VKN', info.taxNr)}
                {row('Vergi Dairesi', info.taxOffice)}
                {row('Cari Tür', incoming ? 'Satıcı (gelen fatura)' : 'Alıcı (giden fatura)')}
                {row('e-Fatura Tipi', (info.profileId || '').includes('EARSIV') ? 'e-Arşiv' : 'e-Fatura')}
                {row('Telefon', info.phone)}
                {row('E-posta', info.email)}
              </div>
              <div className="flex items-start gap-2">
                <span className={lbl}>Adres (Merkez)</span>
                <span className="min-w-0 flex-1">{address || <span className="text-slate-300">—</span>}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-7 px-3 text-xs rounded-sm border border-slate-300 bg-white hover:bg-slate-50"
          >
            Kapat
          </button>
          {info?.existingCardID ? (
            <button
              type="button"
              onClick={() =>
                onDone(
                  { id: info.existingCardID!, code: info.existingCode || '', title: info.existingTitle || '' },
                  `Cari zaten kayıtlı: ${info.existingCode}`,
                )
              }
              className="h-7 px-3 text-xs rounded-sm border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Bu cariyi kullan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void save()}
              disabled={!info || busy || !code.trim() || !title.trim()}
              className="h-7 px-3 text-xs rounded-sm border border-blue-700 bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" /> {busy ? 'Kaydediliyor…' : 'Cari Olarak Kaydet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
