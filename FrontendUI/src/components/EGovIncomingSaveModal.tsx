import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Save, UserPlus, X } from 'lucide-react';
import { EGovIncomingPreview, getEGovIncomingSavePreview, saveEGovIncoming } from '../api/egovIncomingApi';
import { LookupOption, loadLookupOptions } from '../api/lookupApi';
import { isoToDisplay } from '../utils/dateFormat';
import { EGovPartyCardModal } from './EGovPartyCardModal';

const fmt = (v?: number | null, digits = 2) =>
  v == null ? '' : v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Aranabilir malzeme seçici (ProductCard lookup listesi) */
const ProductPicker: React.FC<{
  options: LookupOption[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr-TR');
    const list = s ? options.filter((o) => o.label.toLocaleLowerCase('tr-TR').includes(s)) : options;
    return list.slice(0, 50);
  }, [options, q]);

  return (
    <div ref={ref} className="relative w-64">
      <input
        value={open ? q : selected?.label ?? ''}
        onFocus={() => {
          setQ('');
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        placeholder="Malzeme ara (kod / ad)…"
        className={`w-full h-7 px-2 text-[12px] rounded-sm border bg-white ${value ? 'border-emerald-400' : 'border-amber-400'}`}
      />
      {open && (
        <ul className="absolute z-10 mt-0.5 w-full max-h-56 overflow-y-auto rounded-sm border border-slate-300 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-[12px] text-slate-400">Eşleşen malzeme yok</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 text-[12px] hover:bg-blue-50 ${o.value === value ? 'bg-blue-50 font-medium' : ''}`}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

interface Props {
  egovId: number;
  userId: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * Onaylanmış gelen e-faturayı alış faturası olarak kaydet.
 * Satırlar malzeme kartı ↔ cari bağlantısıyla (ProductCustomerAlias) eşlenir; seçimler oraya yazılır.
 */
export const EGovIncomingSaveModal: React.FC<Props> = ({ egovId, userId, onClose, onSaved }) => {
  const [preview, setPreview] = useState<EGovIncomingPreview | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<LookupOption[]>([]);
  const [companies, setCompanies] = useState<LookupOption[]>([]);
  const [whouses, setWhouses] = useState<LookupOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [whouseId, setWhouseId] = useState('');
  const [mapping, setMapping] = useState<Record<number, string>>({});
  /** Faturaya yazılmayacak satırlar (bilgi satırları varsayılan olarak burada) */
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [pv, prod, comp, wh] = await Promise.all([
          getEGovIncomingSavePreview(egovId),
          loadLookupOptions('ProductCardID'),
          loadLookupOptions('CompanyID'),
          loadLookupOptions('WhouseID'),
        ]);
        if (off) return;
        setPreview(pv.preview);
        setProducts(prod ?? []);
        setCompanies(comp ?? []);
        setWhouses(wh ?? []);
        // Yeniden yüklemede (cari kart açıldıktan sonra) kullanıcı seçimleri korunur
        if (reloadTick === 0) {
          if (comp?.length === 1) setCompanyId(comp[0].value);
          if (wh?.length === 1) setWhouseId(wh[0].value);
          setExcluded(new Set(pv.preview.lines.filter((l) => l.isInfoLine).map((l) => l.lineNo)));
        }
        setMapping((cur) => {
          const m: Record<number, string> = { ...cur };
          for (const l of pv.preview.lines) if (l.productCardID && !m[l.lineNo]) m[l.lineNo] = String(l.productCardID);
          return m;
        });
      } catch (e) {
        if (!off) setLoadError(e instanceof Error ? e.message : 'Fatura okunamadı');
      }
    })();
    return () => {
      off = true;
    };
  }, [egovId, reloadTick]);

  const lines = preview?.lines ?? [];
  const included = lines.filter((l) => !excluded.has(l.lineNo));
  const autoCount = included.filter((l) => l.productCardID && mapping[l.lineNo] === String(l.productCardID)).length;
  const unmapped = included.filter((l) => !mapping[l.lineNo]).length;
  const includedTotal = included.reduce((a, l) => a + l.lineAmount, 0);
  const totalsDiffer = !!preview && Math.abs(includedTotal - preview.lineExtensionAmount) > 0.01;
  const canSave = !!preview?.supplierCardID && !!whouseId && unmapped === 0 && included.length > 0 && !busy;

  const toggleLine = (lineNo: number) =>
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(lineNo)) n.delete(lineNo);
      else n.add(lineNo);
      return n;
    });

  const save = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const r = await saveEGovIncoming(egovId, {
        userId,
        companyId: companyId ? Number(companyId) : null,
        whouseId: Number(whouseId),
        lines: lines.map((l) =>
          excluded.has(l.lineNo)
            ? { lineNo: l.lineNo, productCardID: 0, exclude: true }
            : { lineNo: l.lineNo, productCardID: Number(mapping[l.lineNo]) },
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
  const thR = `${th} text-right`;
  const td = 'px-2 py-1 border-b border-r border-slate-200 align-top';
  const tdR = `${td} text-right tabular-nums whitespace-nowrap`;
  const sel = 'h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white';

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onMouseDown={() => !busy && onClose()}>
      <div className="w-full max-w-6xl rounded-md bg-white shadow-xl my-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Gelen e-Faturayı ERP'ye Kaydet</h3>
          <button type="button" onClick={onClose} disabled={busy} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {loadError && <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{loadError}</div>}
          {!preview && !loadError && <div className="text-[12px] text-slate-500">Fatura okunuyor…</div>}

          {preview && (
            <>
              {/* Başlık */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                <div className="space-y-0.5">
                  <div>
                    <span className="text-slate-500">Fatura No:</span> <b>{preview.invoiceNo}</b>
                  </div>
                  <div>
                    <span className="text-slate-500">Tarih:</span> {preview.issueDate ? isoToDisplay(String(preview.issueDate).slice(0, 10)) : ''}
                  </div>
                  <div>
                    <span className="text-slate-500">Senaryo / Tip:</span> {preview.profileId} / {preview.typeCode}
                  </div>
                  <div>
                    <span className="text-slate-500">Kaydedilecek:</span>{' '}
                    <b>{preview.invoiceType === 3 ? 'Satış İade Faturası' : 'Alış Faturası'}</b>
                  </div>
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
                          <UserPlus className="w-3 h-3" /> e-Faturadan cari kartı aç
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
                    <span className="w-12 text-slate-500">Depo*</span>
                    <select
                      value={whouseId}
                      onChange={(e) => setWhouseId(e.target.value)}
                      className={`${sel} flex-1 ${whouseId ? '' : 'border-amber-400'}`}
                    >
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

              {/* Satırlar */}
              <div className="rounded-sm border border-slate-300 overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className={th} title="Faturaya dahil">Dahil</th>
                      <th className={th}>#</th>
                      <th className={th}>Tedarikçi Kodu</th>
                      <th className={th}>Tedarikçi Malzeme Adı</th>
                      <th className={thR}>Miktar</th>
                      <th className={thR}>Fiyat</th>
                      <th className={thR}>İskonto</th>
                      <th className={thR}>Tutar</th>
                      <th className={thR}>KDV</th>
                      <th className={th}>Bizim Malzeme*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const auto = l.productCardID && mapping[l.lineNo] === String(l.productCardID);
                      const out = excluded.has(l.lineNo);
                      return (
                        <tr key={l.lineNo} className={out ? 'bg-slate-50 text-slate-400' : ''}>
                          <td className={`${td} text-center`}>
                            <input
                              type="checkbox"
                              checked={!out}
                              onChange={() => toggleLine(l.lineNo)}
                              title={out ? 'Faturaya dahil et' : 'Faturaya yazma'}
                            />
                          </td>
                          <td className={td}>{l.lineNo}</td>
                          <td className={`${td} font-mono text-[11px]`}>{l.sellerCode ?? <span className="text-slate-400">—</span>}</td>
                          <td className={td}>
                            <div className={out ? 'line-through' : 'font-medium'}>{l.name}</div>
                            {l.description && <div className="text-[11px] text-slate-500">{l.description}</div>}
                            {l.isInfoLine && (
                              <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-px rounded-sm border text-[10px] bg-amber-50 text-amber-800 border-amber-200 no-underline">
                                <AlertTriangle className="w-3 h-3" /> {l.infoReason || 'Bilgi satırı'}
                              </div>
                            )}
                          </td>
                          <td className={tdR}>
                            {fmt(l.quantity, 2)} <span className="text-[10px] text-slate-400">{l.unitCode}</span>
                          </td>
                          <td className={tdR}>{fmt(l.price)}</td>
                          <td className={tdR}>{l.discount ? fmt(l.discount) : ''}</td>
                          <td className={tdR}>{fmt(l.lineAmount)}</td>
                          <td className={tdR}>
                            %{fmt(l.taxRate, 0)} · {fmt(l.taxAmount)}
                          </td>
                          <td className={td}>
                            {out ? (
                              <span className="text-[11px]">Faturaya yazılmayacak</span>
                            ) : (
                            <div className="flex items-center gap-1.5">
                              <ProductPicker
                                options={products}
                                value={mapping[l.lineNo] ?? ''}
                                onChange={(v) => setMapping((m) => ({ ...m, [l.lineNo]: v }))}
                              />
                              {auto ? (
                                <span title="Malzeme–cari bağlantısından otomatik eşleşti" className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 whitespace-nowrap">
                                  <Link2 className="w-3 h-3" /> otomatik
                                </span>
                              ) : mapping[l.lineNo] ? (
                                <span className="text-[10px] text-blue-700 whitespace-nowrap">yeni eşleme</span>
                              ) : null}
                            </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={7} className={`${td} text-right text-slate-500`}>
                        Faturaya yazılacak satırlar ({included.length}/{lines.length})
                      </td>
                      <td className={`${tdR} font-semibold ${totalsDiffer ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(includedTotal)}</td>
                      <td className={tdR} />
                      <td className={td} />
                    </tr>
                    <tr>
                      <td colSpan={7} className={`${td} text-right text-slate-500`}>
                        e-Fatura toplamı: Mal/hizmet · KDV · Ödenecek ({preview.currency})
                      </td>
                      <td className={`${tdR} font-semibold`}>{fmt(preview.lineExtensionAmount)}</td>
                      <td className={`${tdR} font-semibold`}>{fmt(preview.taxTotal)}</td>
                      <td className={`${td} font-semibold`}>{fmt(preview.payableAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {totalsDiffer && (
                <div className="flex items-start gap-1.5 rounded-sm border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Faturaya yazılacak satırların toplamı ({fmt(includedTotal)}) e-Fatura mal/hizmet toplamını (
                    {fmt(preview.lineExtensionAmount)}) tutmuyor. Toplama dahil olmayan bilgi satırlarını «Dahil» kutusundan çıkarın.
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                {autoCount} satır malzeme–cari bağlantısından otomatik eşleşti
                {unmapped > 0 ? ` · ${unmapped} satır için malzeme seçin` : ''}. Seçimler malzeme kartındaki cari bağlantılarına
                (tedarikçi kodu / adı ile) kaydedilir; bu tedarikçinin sonraki faturalarında ve giden belgelerde kullanılır.
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
            <Save className="w-3.5 h-3.5" /> {preview?.invoiceType === 3 ? 'Satış iade faturası' : 'Alış faturası'} olarak kaydet
          </button>
        </div>
      </div>
    </div>
    {/* Tedarikçi cari kartı yoksa: e-Faturanın UBL bilgisinden aç */}
    {partyOpen && (
      <EGovPartyCardModal
        egovId={egovId}
        onClose={() => {
          setPartyOpen(false);
          // Cari kart açıldıysa tedarikçi eşleşmesini yenile
          setReloadTick((t) => t + 1);
        }}
      />
    )}
    </>
  );
};
