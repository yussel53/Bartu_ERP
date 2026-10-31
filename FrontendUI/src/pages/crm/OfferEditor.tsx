import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  addDaysInput,
  calcLine,
  calcOffer,
  crmApi,
  fmtMoney,
  todayInput,
  toDateInput,
  type CrmLookups,
  type CrmOffer,
  type CrmOfferLine,
  type CrmProduct,
} from '../../api/crmApi';
import { Btn, ErrorNote, Field, Modal, errMsg, inputCls, textareaCls } from './CrmUi';
import { fetchProductUnitOptions } from '../../data/productLineUnits';

export const emptyLine = (): CrmOfferLine => ({
  productCardID: null,
  productCode: '',
  description: '',
  quantity: 1,
  unitName: 'Adet',
  price: 0,
  discountRate: 0,
  discountAmount: 0,
  vatRate: 20,
});

export function newOfferDraft(opportunityId: number, lookups: CrmLookups, currencyID?: number | null): Partial<CrmOffer> {
  return {
    offerID: 0,
    opportunityID: opportunityId,
    offerDate: todayInput(),
    validityDate: addDaysInput(15),
    currencyID: currencyID ?? lookups.currencies[0]?.id ?? 1,
    generalDiscount: 0,
    status: 0,
    lines: [emptyLine()],
  };
}

/** Ürün kodu/adı hücresi — ProductCard arama */
function ProductCell({
  line,
  customerId,
  onPick,
  onText,
}: {
  line: CrmOfferLine;
  customerId?: number | null;
  onPick: (p: CrmProduct) => void;
  onText: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<CrmProduct[]>([]);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => crmApi.products(q, customerId).then(setItems).catch(() => setItems([])), 200);
    return () => clearTimeout(t);
  }, [q, open, customerId]);
  return (
    <div className="relative">
      <input
        className={`${inputCls} h-7`}
        value={line.description || ''}
        placeholder="Ürün / hizmet ara veya yaz…"
        onFocus={() => {
          setQ('');
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => {
          onText(e.target.value);
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {line.productCode && <span className="absolute right-1.5 top-1.5 text-[10px] font-mono text-slate-400 bg-white/80 px-1">{line.productCode}</span>}
      {open && items.length > 0 && (
        <div className="absolute z-50 mt-1 w-[420px] max-h-60 overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
          {items.map((p) => (
            <button
              key={p.productCardID}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(p);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-[12px] hover:bg-blue-50 dark:hover:bg-slate-700"
            >
              <span className="truncate">
                <span className="font-mono text-[11px] text-slate-500 mr-2">{p.code}</span>
                {p.title}
              </span>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {p.price ? fmtMoney(p.price) : ''} {p.unitName || ''} · %{p.vatRate}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Seçilen malzemenin birim seti. Eşleşme yoksa serbest metin kalır. */
function OfferUnitCell({
  productId,
  value,
  onChange,
}: {
  productId?: number | null;
  value: string;
  onChange: (unitName: string) => void;
}) {
  const [options, setOptions] = React.useState<{ label: string; value: string }[]>([]);
  React.useEffect(() => {
    const pid = Number(productId);
    if (!Number.isFinite(pid) || pid <= 0) {
      setOptions([]);
      return;
    }
    let cancel = false;
    void fetchProductUnitOptions(pid, 'sales').then((info) => {
      if (cancel) return;
      setOptions(info.options);
    });
    return () => {
      cancel = true;
    };
  }, [productId]);

  if (!options.length) {
    return (
      <input className={`${inputCls} h-7`} value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  const known = options.some((o) => o.label === value);
  return (
    <select className={`${inputCls} h-7`} value={known ? value : value || options[0].label} onChange={(e) => onChange(e.target.value)}>
      {!known && value ? <option value={value}>{value}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.label}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function OfferLinesEditor({
  offer,
  onChange,
  customerId,
  readOnly,
}: {
  offer: Partial<CrmOffer>;
  onChange: (o: Partial<CrmOffer>) => void;
  customerId?: number | null;
  readOnly?: boolean;
}) {
  const lines = offer.lines || [];
  const setLine = (i: number, patch: Partial<CrmOfferLine>) =>
    onChange({ ...offer, lines: lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const totals = calcOffer(lines, Number(offer.generalDiscount || 0));
  const cur = offer.currencyCode || '';
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
        <table className="w-full text-[12px] min-w-[760px]">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[11px]">
            <tr>
              <th className="px-2 py-1.5 text-left w-7">#</th>
              <th className="px-2 py-1.5 text-left">Ürün / Hizmet</th>
              <th className="px-2 py-1.5 text-right w-20">Miktar</th>
              <th className="px-2 py-1.5 text-left w-16">Birim</th>
              <th className="px-2 py-1.5 text-right w-28">Birim fiyat</th>
              <th className="px-2 py-1.5 text-right w-16">İsk. %</th>
              <th className="px-2 py-1.5 text-right w-16">KDV %</th>
              <th className="px-2 py-1.5 text-right w-28">Tutar</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                <td className="px-1 py-1">
                  {readOnly ? (
                    <span>
                      {l.productCode && <span className="font-mono text-[11px] text-slate-500 mr-1.5">{l.productCode}</span>}
                      {l.description}
                    </span>
                  ) : (
                    <ProductCell
                      line={l}
                      customerId={customerId}
                      onText={(v) => setLine(i, { description: v })}
                      onPick={(p) =>
                        setLine(i, {
                          productCardID: p.productCardID,
                          productCode: p.code,
                          description: p.title,
                          unitName: p.unitName || l.unitName,
                          vatRate: Number(p.vatRate ?? 20),
                          price: p.price ? Number(p.price) : l.price,
                        })
                      }
                    />
                  )}
                </td>
                {readOnly ? (
                  <>
                    <td className="px-2 py-1 text-right">{l.quantity}</td>
                    <td className="px-2 py-1">{l.unitName}</td>
                    <td className="px-2 py-1 text-right">{fmtMoney(l.price)}</td>
                    <td className="px-2 py-1 text-right">{l.discountRate || '-'}</td>
                    <td className="px-2 py-1 text-right">{l.vatRate}</td>
                  </>
                ) : (
                  <>
                    <td className="px-1 py-1">
                      <input className={`${inputCls} h-7 text-right`} type="number" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: num(e.target.value) })} />
                    </td>
                    <td className="px-1 py-1">
                      <OfferUnitCell
                        productId={l.productCardID}
                        value={l.unitName || ''}
                        onChange={(unitName) => setLine(i, { unitName })}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input className={`${inputCls} h-7 text-right`} type="number" step="any" value={l.price} onChange={(e) => setLine(i, { price: num(e.target.value) })} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={`${inputCls} h-7 text-right`} type="number" step="any" min={0} max={100} value={l.discountRate} onChange={(e) => setLine(i, { discountRate: num(e.target.value) })} />
                    </td>
                    <td className="px-1 py-1">
                      <input className={`${inputCls} h-7 text-right`} type="number" step="any" value={l.vatRate} onChange={(e) => setLine(i, { vatRate: num(e.target.value) })} />
                    </td>
                  </>
                )}
                <td className="px-2 py-1 text-right font-medium tabular-nums">{fmtMoney(calcLine(l))}</td>
                {!readOnly && (
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Satırı sil"
                      onClick={() => onChange({ ...offer, lines: lines.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2">
        {!readOnly ? (
          <Btn icon={<Plus className="w-3.5 h-3.5" />} onClick={() => onChange({ ...offer, lines: [...lines, emptyLine()] })}>
            Kalem ekle
          </Btn>
        ) : (
          <span />
        )}
        <div className="text-[12px] min-w-[240px] space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Ara toplam</span>
            <span className="tabular-nums">{fmtMoney(totals.sub, cur)}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-500">Genel iskonto</span>
            {readOnly ? (
              <span className="tabular-nums">{fmtMoney(offer.generalDiscount, cur)}</span>
            ) : (
              <input
                className={`${inputCls} h-7 w-28 text-right`}
                type="number"
                step="any"
                value={offer.generalDiscount ?? 0}
                onChange={(e) => onChange({ ...offer, generalDiscount: num(e.target.value) })}
              />
            )}
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">KDV</span>
            <span className="tabular-nums">{fmtMoney(totals.vat, cur)}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100">
            <span>Genel toplam</span>
            <span className="tabular-nums">{fmtMoney(totals.grand, cur)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Teklif başlık alanları (tarih / geçerlilik / döviz / açıklama / şartlar) */
export function OfferHeaderFields({
  offer,
  onChange,
  lookups,
  readOnly,
}: {
  offer: Partial<CrmOffer>;
  onChange: (o: Partial<CrmOffer>) => void;
  lookups: CrmLookups;
  readOnly?: boolean;
}) {
  const set = (p: Partial<CrmOffer>) => onChange({ ...offer, ...p });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 mb-3">
      <Field label="Teklif tarihi" className="sm:col-span-1">
        <input className={inputCls} type="date" disabled={readOnly} value={toDateInput(offer.offerDate)} onChange={(e) => set({ offerDate: e.target.value })} />
      </Field>
      <Field label="Geçerlilik" className="sm:col-span-1">
        <input className={inputCls} type="date" disabled={readOnly} value={toDateInput(offer.validityDate)} onChange={(e) => set({ validityDate: e.target.value || null })} />
      </Field>
      <Field label="Para birimi" className="sm:col-span-1">
        <select
          className={inputCls}
          disabled={readOnly}
          value={offer.currencyID ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            set({ currencyID: id, currencyCode: lookups.currencies.find((c) => c.id === id)?.code });
          }}
        >
          {lookups.currencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Konu / açıklama" className="col-span-2 sm:col-span-3">
        <input className={inputCls} disabled={readOnly} value={offer.description || ''} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="Ödeme şartları" className="col-span-2 sm:col-span-3">
        <input className={inputCls} disabled={readOnly} value={offer.paymentTerms || ''} onChange={(e) => set({ paymentTerms: e.target.value })} placeholder="örn. %50 peşin, %50 teslimde" />
      </Field>
      <Field label="Teslimat şartları" className="col-span-2 sm:col-span-3">
        <input className={inputCls} disabled={readOnly} value={offer.deliveryTerms || ''} onChange={(e) => set({ deliveryTerms: e.target.value })} placeholder="örn. Sipariş sonrası 10 iş günü" />
      </Field>
    </div>
  );
}

export function OfferModal({
  initial,
  title,
  lookups,
  customerId,
  readOnly,
  onClose,
  onSaved,
}: {
  initial: Partial<CrmOffer>;
  title: string;
  lookups: CrmLookups;
  customerId?: number | null;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [offer, setOffer] = React.useState<Partial<CrmOffer>>(() => ({
    ...initial,
    currencyCode: initial.currencyCode || lookups.currencies.find((c) => c.id === initial.currencyID)?.code,
  }));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    const lines = (offer.lines || []).filter((l) => l.productCardID || (l.description || '').trim());
    if (!lines.length) {
      setError('En az bir kalem girin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await crmApi.saveOffer({ ...offer, lines, validityDate: offer.validityDate || null });
      onSaved(r.id);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      subtitle="CRM_Offer · CRM_OfferLine"
      onClose={onClose}
      width="max-w-5xl"
      footer={
        readOnly ? (
          <Btn onClick={onClose}>Kapat</Btn>
        ) : (
          <>
            <Btn onClick={onClose}>Vazgeç</Btn>
            <Btn variant="primary" busy={busy} onClick={save}>
              Teklifi kaydet
            </Btn>
          </>
        )
      }
    >
      <ErrorNote error={error} />
      <OfferHeaderFields offer={offer} onChange={setOffer} lookups={lookups} readOnly={readOnly} />
      <OfferLinesEditor offer={offer} onChange={setOffer} customerId={customerId} readOnly={readOnly} />
      <Field label="Notlar (teklif altında yazdırılır)" className="mt-3">
        <textarea className={textareaCls} rows={2} disabled={readOnly} value={offer.notes || ''} onChange={(e) => setOffer({ ...offer, notes: e.target.value })} />
      </Field>
    </Modal>
  );
}
