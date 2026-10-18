import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Save, Truck, UserPlus, X } from 'lucide-react';
import { EGovDespatchPreview, getEGovDespatchPreview, saveEGovDespatch } from '../api/egovDespatchApi';
import { LookupOption, loadLookupOptions } from '../api/lookupApi';
import { isoToDisplay } from '../utils/dateFormat';
import { ProductPicker } from './EGovIncomingSaveModal';
import { EGovPartyCardModal } from './EGovPartyCardModal';

const qty = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 4 });
const day = (v?: string | null) => (v ? isoToDisplay(String(v).slice(0, 10)) : '');

interface Props {
  egovId: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * Gelen e-İrsaliyeyi alış irsaliyesi olarak kaydet (E-05): satırlar malzeme kartı ↔ cari bağlantısıyla
 * (ProductCustomerAlias — gelen e-faturayla aynı) eşlenir, seçilen ambara stok girişi yapılır.
 */
export const EGovDespatchSaveModal: React.FC<Props> = ({ egovId, onClose, onSaved }) => {
  const [preview, setPreview] = useState<EGovDespatchPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [products, setProducts] = useState<LookupOption[]>([]);
  const [serviceIds, setServiceIds] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<LookupOption[]>([]);
  const [whouses, setWhouses] = useState<LookupOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [whouseId, setWhouseId] = useState('');
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [pv, prod, given, taken, comp, wh] = await Promise.all([
          getEGovDespatchPreview(egovId),
          loadLookupOptions('ProductCardID'),
          loadLookupOptions('ProductCardID', { filterColumn: 'ProductType', filterValue: '2' }),
          loadLookupOptions('ProductCardID', { filterColumn: 'ProductType', filterValue: '3' }),
          loadLookupOptions('CompanyID'),
          loadLookupOptions('WhouseID'),
        ]);
        if (off) return;
        setPreview(pv);
        setProducts(prod ?? []);
        setServiceIds(new Set([...(given ?? []), ...(taken ?? [])].map((o) => o.value)));
        setCompanies(comp ?? []);
        setWhouses(wh ?? []);
        if (reloadTick === 0) {
          if (comp?.length === 1) setCompanyId(comp[0].value);
          if (wh?.length === 1) setWhouseId(wh[0].value);
        }
        setMapping((cur) => {
          const m: Record<number, string> = { ...cur };
          for (const l of pv.lines) if (l.productCardID && !m[l.lineNo]) m[l.lineNo] = String(l.productCardID);
          return m;
        });
      } catch (e) {
        if (!off) setLoadError(e instanceof Error ? e.message : 'İrsaliye okunamadı');
      }
    })();
    return () => {
      off = true;
    };
  }, [egovId, reloadTick]);

  // Stok hareketi yalnız malzeme kartında — hizmet kartları listelenmez
  const materials = useMemo(() => products.filter((o) => !serviceIds.has(o.value)), [products, serviceIds]);
  const allowed = useMemo(() => new Set(materials.map((o) => o.value)), [materials]);
  const mapped = (lineNo: number) => (mapping[lineNo] && allowed.has(mapping[lineNo]) ? mapping[lineNo] : '');

  const lines = preview?.lines ?? [];
  const included = lines.filter((l) => !excluded.has(l.lineNo));
  const unmapped = included.filter((l) => !mapped(l.lineNo)).length;
  const saved = !!preview?.productVoucherID;
  const canSave = !!preview?.supplierCardID && !!whouseId && unmapped === 0 && included.length > 0 && !busy && !saved;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await saveEGovDespatch(egovId, {
        companyId: companyId ? Number(companyId) : null,
        whouseId: Number(whouseId),
        lines: lines.map((l) =>
          excluded.has(l.lineNo)
            ? { lineNo: l.lineNo, productCardID: 0, exclude: true }
            : { lineNo: l.lineNo, productCardID: Number(mapped(l.lineNo)) },
        ),
      });
      onSaved(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 align-top';
  const sel = 'h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onMouseDown={() => !busy && onClose()}>
        <div className="w-full max-w-5xl rounded-md bg-white shadow-xl my-6" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900 inline-flex items-center gap-2">
              <Truck className="w-5 h-5 text-slate-500" /> Gelen e-İrsaliyeyi Alış İrsaliyesi Olarak Kaydet
            </h3>
            <button type="button" onClick={onClose} disabled={busy} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {loadError && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{loadError}</div>}
            {!preview && !loadError && <div className="text-[12px] text-slate-500">İrsaliye okunuyor…</div>}

            {preview && (
              <>
                {saved && (
                  <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-800">
                    Bu e-İrsaliye alış irsaliyesi #{preview.productVoucherID} olarak kaydedildi.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                  <div className="space-y-0.5">
                    <div>
                      <span className="text-slate-500">İrsaliye No:</span> <b>{preview.despatchNo}</b>
                    </div>
                    <div>
                      <span className="text-slate-500">Tarih / sevk:</span> {day(preview.issueDate)}
                      {preview.actualDespatchDate ? ` / ${day(preview.actualDespatchDate)}` : ''}
                    </div>
                    <div>
                      <span className="text-slate-500">Plaka / şoför:</span> {preview.plateNo || '—'} / {preview.driverName || '—'}
                    </div>
                    {preview.orderRefs.length > 0 && (
                      <div>
                        <span className="text-slate-500">Sipariş:</span> {preview.orderRefs.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-slate-500">Tedarikçi</div>
                    <div>
                      {preview.supplierName} · VKN/TCKN {preview.supplierTaxNr}
                    </div>
                    {preview.supplierCardID ? (
                      <div className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Cari: {preview.supplierCode} — {preview.supplierTitle}
                      </div>
                    ) : (
                      <div className="inline-flex items-start gap-1 text-red-700">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          Bu VKN/TCKN ile cari kart yok.{' '}
                          <button
                            type="button"
                            onClick={() => setPartyOpen(true)}
                            className="inline-flex items-center gap-1 ml-1 px-1.5 h-5 rounded-sm border border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <UserPlus className="w-3 h-3" /> e-Belgeden cari kartı aç
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-slate-500">Firma</span>
                      <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={`${sel} flex-1`}>
                        <option value="">—</option>
                        {companies.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="w-12 text-slate-500">Ambar*</span>
                      <select value={whouseId} onChange={(e) => setWhouseId(e.target.value)} className={`${sel} flex-1 ${whouseId ? '' : 'border-amber-400'}`}>
                        <option value="">Seçiniz</option>
                        {whouses.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-sm border border-slate-300 overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className={th}>Dahil</th>
                        <th className={th}>#</th>
                        <th className={th}>Tedarikçi Kodu</th>
                        <th className={th}>Tedarikçi Malzeme Adı</th>
                        <th className={`${th} text-right`}>Miktar</th>
                        <th className={th}>Bizim Malzeme*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const out = excluded.has(l.lineNo);
                        const auto = l.productCardID && mapped(l.lineNo) === String(l.productCardID);
                        return (
                          <tr key={l.lineNo} className={out ? 'bg-slate-50 text-slate-400' : ''}>
                            <td className={`${td} text-center`}>
                              <input
                                type="checkbox"
                                checked={!out}
                                disabled={saved}
                                onChange={() =>
                                  setExcluded((s) => {
                                    const n = new Set(s);
                                    if (n.has(l.lineNo)) n.delete(l.lineNo);
                                    else n.add(l.lineNo);
                                    return n;
                                  })
                                }
                              />
                            </td>
                            <td className={td}>{l.lineNo}</td>
                            <td className={`${td} font-mono text-[11px]`}>{l.sellerCode ?? <span className="text-slate-400">—</span>}</td>
                            <td className={td}>
                              <div className={out ? 'line-through' : 'font-medium'}>{l.name}</div>
                              {l.description && <div className="text-[11px] text-slate-500">{l.description}</div>}
                            </td>
                            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>
                              {qty(l.quantity)} <span className="text-[10px] text-slate-400">{l.unitCode}</span>
                            </td>
                            <td className={td}>
                              {out ? (
                                <span className="text-[11px]">İrsaliyeye yazılmayacak</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <ProductPicker
                                    options={materials}
                                    value={mapped(l.lineNo)}
                                    onChange={(v) => setMapping((m) => ({ ...m, [l.lineNo]: v }))}
                                    placeholder="Malzeme ara (kod / ad)…"
                                  />
                                  {auto ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 whitespace-nowrap">
                                      <Link2 className="w-3 h-3" /> otomatik
                                    </span>
                                  ) : mapped(l.lineNo) ? (
                                    <span className="text-[10px] text-blue-700 whitespace-nowrap">yeni eşleme</span>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-500">
                  {unmapped > 0 ? `${unmapped} satır için malzeme seçin. ` : ''}
                  Kayıtla seçilen ambara stok girişi yapılır. Eşlemeler malzeme kartının cari bağlantılarına yazılır; aynı tedarikçinin
                  e-fatura ve e-irsaliyelerinde kullanılır.
                </p>
              </>
            )}

            {error && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</div>}
          </div>

          <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 h-8 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void save()}
              className="inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" /> Alış irsaliyesi olarak kaydet
            </button>
          </div>
        </div>
      </div>
      {partyOpen && (
        <EGovPartyCardModal
          egovId={egovId}
          onClose={() => {
            setPartyOpen(false);
            setReloadTick((t) => t + 1);
          }}
        />
      )}
    </>
  );
};
