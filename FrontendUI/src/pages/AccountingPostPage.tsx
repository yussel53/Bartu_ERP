import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookCheck, Loader2 } from 'lucide-react';
import { apiJson } from '../config/api';
import { FilterInput, SortLabel, useGridSortFilter } from '../components/GridSortFilter';
import { InvoiceTypeLabels, SAFE_VOUCHER_TYPE_OPTIONS } from '../data/documentTypes';

interface Row {
  Source: 'invoice' | 'safevoucher';
  Id: number;
  Type: number;
  Date: string;
  DocumentNumber?: string | null;
  CustomerTitle?: string | null;
}

const COLS: { key: string; label: string }[] = [
  { key: 'kind', label: 'Belge' },
  { key: 'type', label: 'Tür' },
  { key: 'date', label: 'Tarih' },
  { key: 'no', label: 'Belge no' },
  { key: 'customer', label: 'Cari' },
];

const typeLabel = (r: Row) =>
  r.Source === 'invoice'
    ? (InvoiceTypeLabels as Record<string, string>)[String(r.Type)] ?? String(r.Type)
    : SAFE_VOUCHER_TYPE_OPTIONS.find((o) => String(o.value) === String(r.Type))?.label ?? String(r.Type);

/** Genel Muhasebe → İşlemler → Muhasebeleştirme (Y-09): fiş oluşmamış fatura / kasa fişleri */
export const AccountingPostPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean; list?: string[] } | null>(null);

  const query = useCallback(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return q.toString();
  }, [from, to]);

  const load = useCallback(async () => {
    try {
      setRows(await apiJson<Row[]>(`/api/accounting/pending?${query()}`));
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const postOne = async (r: Row) => {
    setBusy(`${r.Source}-${r.Id}`);
    setMsg(null);
    try {
      const res = await apiJson<{ message: string }>(`/api/accounting/post/${r.Source}/${r.Id}`, { method: 'POST' });
      setMsg({ text: res.message });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const postAll = async () => {
    setBusy('all');
    setMsg(null);
    try {
      const res = await apiJson<{ posted: number; failed: number; errors: string[] }>(`/api/accounting/post-pending?${query()}`, {
        method: 'POST',
      });
      setMsg({ text: `${res.posted} belge muhasebeleştirildi, ${res.failed} belge kaldı.`, error: res.failed > 0, list: res.errors });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  const cellText = (r: Row, key: string) => {
    switch (key) {
      case 'kind':
        return r.Source === 'invoice' ? 'Fatura' : 'Kasa fişi';
      case 'type':
        return typeLabel(r);
      case 'date':
        return r.Date ? new Date(r.Date).toLocaleDateString('tr-TR') : '';
      case 'no':
        return r.DocumentNumber ?? '';
      case 'customer':
        return r.CustomerTitle ?? '';
      default:
        return '';
    }
  };
  const grid = useGridSortFilter(rows, cellText);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <BookCheck className="w-4 h-4 text-slate-500" /> Muhasebeleştirme
          </h1>
          <p className="text-[12px] text-slate-500">
            Muhasebe fişi oluşmamış fatura ve kasa fişleri · hesaplar Muhasebe Bağlantılarından · kayıtta otomatik için parametre ACC_AUTO_POST = 1
          </p>
        </div>
        <div className="flex items-end gap-2 text-xs">
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Başlangıç</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 px-2 border border-slate-300 rounded-sm" />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Bitiş</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 px-2 border border-slate-300 rounded-sm" />
          </label>
          <button
            type="button"
            onClick={() => void postAll()}
            disabled={!!busy || rows.length === 0}
            className="h-7 px-3 rounded-sm bg-blue-700 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {busy === 'all' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Tümünü muhasebeleştir
          </button>
        </div>
      </div>

      {msg && (
        <div className={`px-3 py-1.5 rounded-md text-xs border ${msg.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {msg.text}
          {msg.list && msg.list.length > 0 && (
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {msg.list.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-1.5 font-semibold text-slate-700 text-left">
                  <SortLabel colKey={c.key} label={c.label} sort={grid.sort} onSort={grid.toggleSort} align="left" />
                </th>
              ))}
              <th />
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="px-1 pb-1">
                  <FilterInput colKey={c.key} value={grid.filters[c.key] ?? ''} onChange={grid.setFilter} />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {grid.view.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 1} className="px-3 py-4 text-center text-slate-400">
                  Muhasebeleştirilmemiş belge yok.
                </td>
              </tr>
            )}
            {grid.view.map((r) => (
              <tr key={`${r.Source}-${r.Id}`} className="border-b border-slate-100 hover:bg-blue-50/40">
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-1 whitespace-nowrap">
                    {cellText(r, c.key)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right">
                  <button
                    type="button"
                    onClick={() => void postOne(r)}
                    disabled={!!busy}
                    className="h-6 px-2 rounded-sm border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {busy === `${r.Source}-${r.Id}` && <Loader2 className="w-3 h-3 animate-spin" />} Muhasebeleştir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
