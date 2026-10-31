import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { apiJson } from '../config/api';
import { getRecord, listRecords } from '../api/recordsApi';

/** 1 girişte numara oluşur · 2 çıkışta seçilir · 3 transferde seçilir · 0 yok */
export function serialLotDirection(voucherType: number): 0 | 1 | 2 | 3 {
  if ([1, 2, 5, 9].includes(voucherType)) return 1;
  if ([3, 4, 8, 10].includes(voucherType)) return 2;
  if (voucherType === 6) return 3;
  return 0;
}

/** Fatura türü: 2 alış / 3 satış iade giriş, 1 satış / 4 alış iade çıkış */
export function invoiceSerialDirection(invoiceType: number): 0 | 1 | 2 {
  if (invoiceType === 2 || invoiceType === 3) return 1;
  if (invoiceType === 1 || invoiceType === 4) return 2;
  return 0;
}

/** 1 Lot · 2 Seri · 3 Seri grubu */
type TrackMode = 0 | 1 | 2 | 3;

interface TrackInfo {
  mode: TrackMode;
  trackLocation: boolean;
}

const infoCache = new Map<number, TrackInfo>();

function fieldOf(row: Record<string, unknown>, name: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
  const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? row[key] : undefined;
}

async function trackingInfo(productId: number): Promise<TrackInfo> {
  const hit = infoCache.get(productId);
  if (hit) return hit;
  try {
    const rec = await getRecord('ProductCard', productId, 'ProductCardID');
    const std = (rec.standardFields || {}) as Record<string, unknown>;
    const modeKey = Object.keys(std).find((k) => k.toLowerCase() === 'trackingmode');
    const locKey = Object.keys(std).find((k) => k.toLowerCase() === 'tracklocation');
    if (!modeKey) return { mode: 0, trackLocation: false };
    const n = Number(std[modeKey] ?? 0);
    const mode: TrackMode = n === 1 || n === 2 || n === 3 ? n : 0;
    const loc = std[locKey ?? ''] === true || std[locKey ?? ''] === 1 || std[locKey ?? ''] === '1';
    const info = { mode, trackLocation: loc };
    infoCache.set(productId, info);
    return info;
  } catch {
    return { mode: 0, trackLocation: false };
  }
}

interface Opt {
  productSerialLotID: number;
  code: string;
  qty?: number | null;
  serials?: string | null;
  expireDate?: string | null;
  description?: string | null;
  stockLocationID?: number | null;
}

interface Entry {
  c: string;
  q: string;
  e: string;
  n: string;
  l: string;
  s: string;
}

interface Place {
  id: string;
  label: string;
  whouseId: string;
}

const emptyEntry = (qty = ''): Entry => ({ c: '', q: qty, e: '', n: '', l: '', s: '' });

function numText(v: unknown): string {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? String(n) : '';
}

function parseEntries(value: string, quantity: number): Entry[] {
  const t = value.trim();
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as Record<string, unknown>[];
      if (Array.isArray(arr) && arr.length) {
        return arr.map((r) => ({
          c: String(r.c ?? r.code ?? '').trim(),
          q: numText(r.q ?? r.qty ?? ''),
          e: String(r.e ?? r.expire ?? '').slice(0, 10),
          n: String(r.n ?? r.note ?? ''),
          l: r.l != null && String(r.l) !== '' ? String(r.l) : '',
          s: String(r.s ?? r.serials ?? ''),
        }));
      }
    } catch {
      /* eski metin */
    }
  }
  const lines = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return [emptyEntry(quantity > 0 ? String(quantity) : '')];
  return lines.map((line, i) => {
    const bar = line.indexOf('|');
    if (bar > 0) {
      const left = line.slice(0, bar).trim();
      const right = line.slice(bar + 1).trim();
      if (/^\d+([.,]\d+)?$/.test(right)) return { ...emptyEntry(), c: left, q: right.replace(',', '.') };
      return { ...emptyEntry('1'), c: left, s: right };
    }
    return { ...emptyEntry(i === 0 && quantity > 0 ? String(quantity) : '1'), c: line };
  });
}

function writeEntries(rows: Entry[]): string {
  const filled = rows.filter((r) => r.c.trim() || r.s.trim() || Number(r.q) > 0);
  return JSON.stringify(
    filled.map((r) => {
      const q = Number(String(r.q).replace(',', '.'));
      const o: Record<string, unknown> = { c: r.c.trim(), q: Number.isFinite(q) ? q : 0 };
      if (r.e) o.e = r.e;
      if (r.n.trim()) o.n = r.n.trim();
      if (Number(r.l) > 0) o.l = Number(r.l);
      if (r.s.trim()) o.s = r.s.trim();
      return o;
    }),
  );
}

const box = 'w-full h-7 px-1.5 text-[12px] border border-slate-200 rounded-sm bg-white';

export const SerialLotLineCell: React.FC<{
  productId: number | null;
  voucherType: number;
  direction?: 0 | 1 | 2 | 3;
  quantity: number;
  value: string;
  readOnly?: boolean;
  whouseId?: number | null;
  /** icon: miktar yanı · text: lot sütunu */
  trigger?: 'icon' | 'text';
  autoOpen?: boolean;
  onChange: (value: string) => void;
  onQuantity?: (qty: number) => void;
}> = ({
  productId,
  voucherType,
  direction,
  quantity,
  value,
  readOnly,
  whouseId,
  trigger = 'text',
  autoOpen = false,
  onChange,
  onQuantity,
}) => {
  const dir = direction ?? serialLotDirection(voucherType);
  const [mode, setMode] = useState<TrackMode>(0);
  const [trackLocation, setTrackLocation] = useState(false);
  const [options, setOptions] = useState<Opt[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Entry[]>([emptyEntry()]);
  const [pick, setPick] = useState('');
  const openedFor = useRef('');

  useEffect(() => {
    if (!productId || dir === 0) {
      setMode(0);
      setTrackLocation(false);
      return;
    }
    let cancel = false;
    void trackingInfo(productId).then((info) => {
      if (cancel) return;
      setMode(info.mode);
      setTrackLocation(info.trackLocation);
    });
    return () => {
      cancel = true;
    };
  }, [productId, dir]);

  useEffect(() => {
    if (!productId || mode === 0 || dir === 1) {
      setOptions([]);
      return;
    }
    let cancel = false;
    void apiJson<Opt[]>(`/api/serial-lots/available?productCardId=${productId}&kind=${mode}`)
      .then((list) => {
        if (!cancel) setOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancel) setOptions([]);
      });
    return () => {
      cancel = true;
    };
  }, [productId, mode, dir]);

  useEffect(() => {
    if (!open || !trackLocation) return;
    let cancel = false;
    void listRecords('StockLocation', { take: 300 }).then((res) => {
      if (cancel) return;
      const list = (res.rows || [])
        .map((r) => {
          const row = r as Record<string, unknown>;
          const id = String(fieldOf(row, 'StockLocationID') ?? '');
          const active = fieldOf(row, 'IsActive');
          if (!id || active === false || active === 0 || active === '0') return null;
          const code = String(fieldOf(row, 'Code') ?? '');
          const title = String(fieldOf(row, 'Title') ?? '');
          return {
            id,
            label: title ? `${code} — ${title}` : code,
            whouseId: String(fieldOf(row, 'WhouseID') ?? ''),
          };
        })
        .filter((p): p is Place => Boolean(p));
      setPlaces(list);
    }).catch(() => {
      if (!cancel) setPlaces([]);
    });
    return () => {
      cancel = true;
    };
  }, [open, trackLocation]);

  useEffect(() => {
    if (!autoOpen || !productId || mode === 0 || dir === 0 || readOnly || value.trim()) return;
    const key = `${productId}:${dir}:${mode}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    setRows(parseEntries('', quantity));
    setOpen(true);
  }, [autoOpen, productId, mode, dir, readOnly, value, quantity]);

  if (!productId || dir === 0 || mode === 0) {
    return trigger === 'icon' ? null : <span className="block px-1 text-[11px] text-slate-300">—</span>;
  }

  const codeLabel = mode === 1 ? 'Lot no' : mode === 2 ? 'Seri no' : 'Grup no';
  const count = parseEntries(value, 0).filter((r) => r.c || r.s).length;
  const summary = count > 0 ? `${count} kalem` : 'Seri lot…';

  const openWindow = () => {
    const next = parseEntries(value, quantity);
    if (mode !== 1) next.forEach((r) => { if (!r.q) r.q = '1'; });
    setRows(next);
    setOpen(true);
  };

  const confirm = () => {
    const filled = rows.filter((r) => r.c.trim() || r.s.trim() || Number(String(r.q).replace(',', '.')) > 0);
    const ready = filled.map((r) => (mode === 1 ? r : { ...r, q: '1' }));
    onChange(ready.length ? writeEntries(ready) : '');
    const sum = ready.reduce((a, r) => a + (Number(String(r.q).replace(',', '.')) || 0), 0);
    if (sum > 0) onQuantity?.(sum);
    setOpen(false);
  };

  const visiblePlaces = places.filter((p) => !p.whouseId || !whouseId || p.whouseId === String(whouseId));

  const addStock = (code: string) => {
    const opt = options.find((o) => o.code === code);
    if (!opt) return;
    const available = Number(opt.qty ?? 0);
    let q = mode === 1 ? (available > 0 ? String(available) : '') : '1';
    // Kısmi çıkış: satırda yazılan miktar kadar al, lotun tamamını yazma.
    if (mode === 1 && (dir === 2 || dir === 3) && quantity > 0 && available > 0) {
      const used = rows
        .filter((r) => r.c.trim())
        .reduce((acc, r) => acc + (Number(String(r.q).replace(',', '.')) || 0), 0);
      const remain = quantity - used;
      const take = remain > 0 ? Math.min(remain, available) : available;
      q = String(take);
    }
    setRows((list) => [
      ...list.filter((r) => r.c.trim() || r.s.trim()),
      {
        c: opt.code,
        q,
        e: (opt.expireDate || '').slice(0, 10),
        n: opt.description || '',
        l: opt.stockLocationID ? String(opt.stockLocationID) : '',
        s: opt.serials || '',
      },
    ]);
    setPick('');
  };

  const patch = (i: number, p: Partial<Entry>) =>
    setRows((list) => list.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  return (
    <>
      {trigger === 'icon' ? (
        <button
          type="button"
          title="Seri / lot ekle"
          onClick={openWindow}
          className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          title="Seri lot bilgileri"
          onClick={openWindow}
          className="w-full min-w-[88px] h-7 px-1.5 text-left text-[12px] border border-slate-200 rounded-sm bg-white truncate text-slate-700"
        >
          {summary}
        </button>
      )}
      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-md bg-white shadow-lg border border-slate-200 p-3"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-sm font-semibold text-slate-800">Seri Lot Bilgileri</div>
            <p className="mb-2 text-[11px] text-slate-500">
              Aynı satırda birden çok {mode === 1 ? 'lot' : mode === 2 ? 'seri' : 'seri grubu'} girilir. Boş numara kayıtta otomatik verilir.
            </p>
            {dir !== 1 ? (
              <div className="mb-2 flex items-center gap-2">
                <select className={`${box} max-w-xs`} value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Stoktan ekle</option>
                  {options.map((o) => (
                    <option key={o.productSerialLotID} value={o.code}>
                      {o.code}{o.qty != null ? ` · ${o.qty}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="h-7 px-2 text-[12px] rounded-sm border border-slate-200"
                  disabled={!pick || readOnly}
                  onClick={() => addStock(pick)}
                >
                  Ekle
                </button>
              </div>
            ) : null}
            <div className="overflow-auto max-h-[50vh]">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-2 font-medium">{codeLabel}</th>
                    {mode === 3 ? <th className="py-1 pr-2 font-medium">Seri nolar</th> : null}
                    <th className="py-1 pr-2 font-medium w-20">Miktar</th>
                    <th className="py-1 pr-2 font-medium w-36">Son kullanma</th>
                    <th className="py-1 pr-2 font-medium">Açıklama</th>
                    {trackLocation ? <th className="py-1 pr-2 font-medium w-40">Stok yeri</th> : null}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="py-0.5 pr-2">
                        <input value={row.c} disabled={readOnly} placeholder={codeLabel} onChange={(e) => patch(i, { c: e.target.value })} className={box} />
                      </td>
                      {mode === 3 ? (
                        <td className="py-0.5 pr-2">
                          <input value={row.s} disabled={readOnly} placeholder="seri1, seri2" onChange={(e) => patch(i, { s: e.target.value })} className={box} />
                        </td>
                      ) : null}
                      <td className="py-0.5 pr-2">
                        <input
                          value={mode === 1 ? row.q : '1'}
                          disabled={readOnly || mode !== 1}
                          inputMode="decimal"
                          onChange={(e) => patch(i, { q: e.target.value })}
                          className={box}
                        />
                      </td>
                      <td className="py-0.5 pr-2">
                        <input type="date" value={row.e} disabled={readOnly} onChange={(e) => patch(i, { e: e.target.value })} className={box} />
                      </td>
                      <td className="py-0.5 pr-2">
                        <input value={row.n} disabled={readOnly} onChange={(e) => patch(i, { n: e.target.value })} className={box} />
                      </td>
                      {trackLocation ? (
                        <td className="py-0.5 pr-2">
                          <select value={row.l} disabled={readOnly} onChange={(e) => patch(i, { l: e.target.value })} className={box}>
                            <option value="">—</option>
                            {visiblePlaces.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      <td className="py-0.5 text-center">
                        {!readOnly && rows.length > 1 ? (
                          <button type="button" className="text-slate-400 hover:text-red-600" title="Satırı çıkar" onClick={() => setRows((list) => list.filter((_, idx) => idx !== i))}>
                            ×
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly ? (
              <button
                type="button"
                className="mt-2 text-[12px] text-blue-700 hover:underline"
                onClick={() => setRows((list) => [...list, emptyEntry(mode === 1 ? '' : '1')])}
              >
                Satır ekle
              </button>
            ) : null}
            <div className="mt-3 flex items-center justify-end gap-3">
              <span className="mr-auto text-[12px] text-slate-600">
                Toplam {rows.reduce((acc, r) => acc + (Number(String(r.q).replace(',', '.')) || 0), 0)} — fiş satırı bu kadar olur
              </span>
              <button type="button" className="h-8 px-3 text-[12px] rounded-sm border border-slate-200" onClick={() => setOpen(false)}>
                Kapat
              </button>
              {!readOnly ? (
                <button type="button" className="h-8 px-3 text-[12px] rounded-sm bg-blue-700 text-white" onClick={confirm}>
                  Tamam
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
