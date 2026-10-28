import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookCheck, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { apiJson } from '../config/api';
import { InvoiceTypeLabels, SafeVoucherTypeLabels } from '../data/documentTypes';
import { appToast } from '../utils/appToast';

interface PoolRow {
  AccPoolID: number;
  SourceModule: number;
  SourceID: number;
  SourceType?: number | null;
  DocumentDate?: string | null;
  DocumentNumber?: string | null;
  Description?: string | null;
  CustomerTitle?: string | null;
  SumDebit: number;
  SumCredit: number;
  Status_: number;
  AccountVoucherID?: number | null;
  ErrorMessage?: string | null;
  SourceLabel?: string;
}

interface PoolLine {
  AccPoolLineID: number;
  LineNo: number;
  AccountCardID?: number | null;
  AccountCode?: string | null;
  AccountTitle?: string | null;
  Description?: string | null;
  Debit: number;
  Credit: number;
  LinkHint?: string | null;
}

const STATUS: Record<number, { label: string; cls: string }> = {
  0: { label: 'Bekliyor', cls: 'text-amber-800 bg-amber-50 border-amber-200' },
  1: { label: 'Muhasebeleşti', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  2: { label: 'Eksik / Hata', cls: 'text-red-800 bg-red-50 border-red-200' },
  3: { label: 'İptal', cls: 'text-slate-600 bg-slate-100 border-slate-200' },
};

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeLabel(module: number, type?: number | null) {
  if (type == null) return '';
  const key = String(type);
  if (module === 7) return (InvoiceTypeLabels as Record<string, string>)[key] ?? key;
  if (module === 4) return (SafeVoucherTypeLabels as Record<string, string>)[key] ?? key;
  return key;
}

function pick(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] != null) return r[k];
    const found = Object.keys(r).find((x) => x.toLowerCase() === k.toLowerCase());
    if (found && r[found] != null) return r[found];
  }
  return undefined;
}

function normPool(raw: Record<string, unknown>): PoolRow {
  return {
    AccPoolID: Number(pick(raw, 'AccPoolID') ?? 0),
    SourceModule: Number(pick(raw, 'SourceModule') ?? 0),
    SourceID: Number(pick(raw, 'SourceID') ?? 0),
    SourceType: pick(raw, 'SourceType') == null ? null : Number(pick(raw, 'SourceType')),
    DocumentDate: (pick(raw, 'DocumentDate') as string) ?? null,
    DocumentNumber: (pick(raw, 'DocumentNumber') as string) ?? null,
    Description: (pick(raw, 'Description') as string) ?? null,
    CustomerTitle: (pick(raw, 'CustomerTitle') as string) ?? null,
    SumDebit: Number(pick(raw, 'SumDebit') ?? 0),
    SumCredit: Number(pick(raw, 'SumCredit') ?? 0),
    Status_: Number(pick(raw, 'Status_') ?? 0),
    AccountVoucherID:
      pick(raw, 'AccountVoucherID') == null ? null : Number(pick(raw, 'AccountVoucherID')),
    ErrorMessage: (pick(raw, 'ErrorMessage') as string) ?? null,
    SourceLabel: (pick(raw, 'SourceLabel') as string) ?? undefined,
  };
}

function normLine(raw: Record<string, unknown>): PoolLine {
  return {
    AccPoolLineID: Number(pick(raw, 'AccPoolLineID') ?? 0),
    LineNo: Number(pick(raw, 'LineNo') ?? 0),
    AccountCardID: pick(raw, 'AccountCardID') == null ? null : Number(pick(raw, 'AccountCardID')),
    AccountCode: (pick(raw, 'AccountCode') as string) ?? null,
    AccountTitle: (pick(raw, 'AccountTitle') as string) ?? null,
    Description: (pick(raw, 'Description') as string) ?? null,
    Debit: Number(pick(raw, 'Debit') ?? 0),
    Credit: Number(pick(raw, 'Credit') ?? 0),
    LinkHint: (pick(raw, 'LinkHint') as string) ?? null,
  };
}

/** Genel Muhasebe → Muhasebe Havuzu: işlem sonrası biriken muhasebe kodları */
export const AccountingPoolPage: React.FC<{
  onBack: () => void;
  onOpenParams?: () => void;
}> = ({ onBack, onOpenParams }) => {
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<string>('open'); // open = 0+2
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [lines, setLines] = useState<PoolLine[]>([]);
  const [autoPost, setAutoPost] = useState(false);

  const query = useCallback(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (status === '0' || status === '1' || status === '2' || status === '3') q.set('status', status);
    return q.toString();
  }, [from, to, status]);

  const load = useCallback(async () => {
    try {
      const list = await apiJson<Record<string, unknown>[]>(`/api/accounting/pool?${query()}`);
      const mapped = (list || []).map(normPool);
      const filtered =
        status === 'open' ? mapped.filter((r) => r.Status_ === 0 || r.Status_ === 2) : mapped;
      setRows(filtered);
      setSelected(new Set());
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
    }
  }, [query, status]);

  const loadConfig = useCallback(async () => {
    try {
      const c = await apiJson<{ autoPost: boolean; AutoPost?: boolean }>('/api/accounting/config');
      setAutoPost(Boolean(c.autoPost ?? c.AutoPost));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadConfig();
  }, [load, loadConfig]);

  const openLines = async (id: number) => {
    setDetailId(id);
    try {
      const raw = await apiJson<Record<string, unknown>[]>(`/api/accounting/pool/${id}/lines`);
      setLines((raw || []).map(normLine));
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
    }
  };

  const postOne = async (id: number) => {
    setBusy(`p-${id}`);
    try {
      const res = await apiJson<{ message?: string; Message?: string }>(
        `/api/accounting/pool/${id}/post`,
        { method: 'POST' },
      );
      appToast(res.message || res.Message || 'Muhasebeleştirildi');
      await load();
      if (detailId === id) await openLines(id);
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error', durationMs: 5000 });
    } finally {
      setBusy(null);
    }
  };

  const rebuild = async (id: number) => {
    setBusy(`r-${id}`);
    try {
      const res = await apiJson<{ message?: string; Message?: string }>(
        `/api/accounting/pool/${id}/rebuild`,
        { method: 'POST' },
      );
      appToast(res.message || res.Message || 'Yeniden hesaplandı', { kind: 'info' });
      await load();
      if (detailId === id) await openLines(id);
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const postSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      appToast('Kayıt seçin', { kind: 'info' });
      return;
    }
    setBusy('sel');
    try {
      const res = await apiJson<{ posted: number; failed: number; errors: string[] }>(
        '/api/accounting/pool/post-selected',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) },
      );
      appToast(
        `${res.posted} kayıt muhasebeleştirildi${res.failed ? `, ${res.failed} kaldı` : ''}`,
        { kind: res.failed ? 'error' : 'ok', durationMs: 4000 },
      );
      if (res.errors?.length) appToast(res.errors.slice(0, 3).join('\n'), { kind: 'error' });
      await load();
    } catch (e) {
      appToast(e instanceof Error ? e.message : String(e), { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const openIds = useMemo(
    () => rows.filter((r) => r.Status_ === 0 || r.Status_ === 2).map((r) => r.AccPoolID),
    [rows],
  );

  const toggleAll = () => {
    if (selected.size === openIds.length) setSelected(new Set());
    else setSelected(new Set(openIds));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Geri
          </button>
          <h1 className="text-[16px] font-semibold text-slate-800 flex items-center gap-2">
            <BookCheck className="w-4 h-4 text-slate-500" /> Muhasebe Havuzu
          </h1>
          <p className="text-[12px] text-slate-500 max-w-2xl">
            Kayıt sonrası muhasebe kodları burada toplanır. Parametre «otomatik» ise fiş hemen oluşur;
            «elle» ise seçerek muhasebeleştirirsiniz.
            {autoPost ? (
              <span className="ml-1 text-emerald-700 font-medium">· Otomatik açık</span>
            ) : (
              <span className="ml-1 text-amber-700 font-medium">· Elle / seçerek</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          {onOpenParams && (
            <button
              type="button"
              onClick={onOpenParams}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <Settings2 className="w-3.5 h-3.5" /> Parametreler
            </button>
          )}
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Başlangıç</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 px-2 border border-slate-300 rounded-sm"
            />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Bitiş</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 px-2 border border-slate-300 rounded-sm"
            />
          </label>
          <label className="space-y-0.5">
            <span className="block text-[11px] text-slate-500">Durum</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 px-2 border border-slate-300 rounded-sm bg-white"
            >
              <option value="open">Açık (bekleyen + hata)</option>
              <option value="0">Bekliyor</option>
              <option value="2">Eksik / Hata</option>
              <option value="1">Muhasebeleşti</option>
              <option value="3">İptal</option>
              <option value="all">Tümü</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="h-8 px-2.5 rounded-sm border border-slate-300 bg-white hover:bg-slate-50 inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
          <button
            type="button"
            disabled={busy !== null || selected.size === 0}
            onClick={() => void postSelected()}
            className="h-8 px-3 rounded-sm bg-emerald-700 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {busy === 'sel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookCheck className="w-3.5 h-3.5" />}
            Seçilenleri muhasebeleştir ({selected.size})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-3">
        <div className="overflow-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-2 py-1.5 w-8">
                  <input
                    type="checkbox"
                    checked={openIds.length > 0 && selected.size === openIds.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-2 py-1.5">Durum</th>
                <th className="px-2 py-1.5">Belge</th>
                <th className="px-2 py-1.5">Tür</th>
                <th className="px-2 py-1.5">Tarih</th>
                <th className="px-2 py-1.5">No</th>
                <th className="px-2 py-1.5">Cari / Açıklama</th>
                <th className="px-2 py-1.5 text-right">Borç</th>
                <th className="px-2 py-1.5">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                    Havuzda kayıt yok
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const st = STATUS[r.Status_] ?? STATUS[0];
                  const canPost = r.Status_ === 0 || r.Status_ === 2;
                  return (
                    <tr
                      key={r.AccPoolID}
                      className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                        detailId === r.AccPoolID ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        {canPost ? (
                          <input
                            type="checkbox"
                            checked={selected.has(r.AccPoolID)}
                            onChange={() => {
                              setSelected((prev) => {
                                const n = new Set(prev);
                                if (n.has(r.AccPoolID)) n.delete(r.AccPoolID);
                                else n.add(r.AccPoolID);
                                return n;
                              });
                            }}
                          />
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[10px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.SourceLabel}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {typeLabel(r.SourceModule, r.SourceType)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {r.DocumentDate
                          ? new Date(r.DocumentDate).toLocaleDateString('tr-TR')
                          : ''}
                      </td>
                      <td className="px-2 py-1.5 font-medium">{r.DocumentNumber}</td>
                      <td className="px-2 py-1.5 max-w-[220px] truncate" title={r.ErrorMessage || r.Description || ''}>
                        {r.CustomerTitle || r.Description}
                        {r.ErrorMessage ? (
                          <span className="block text-[10px] text-red-600 truncate">{r.ErrorMessage}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmt(Number(r.SumDebit))}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          className="text-blue-700 hover:underline mr-2"
                          onClick={() => void openLines(r.AccPoolID)}
                        >
                          Kodlar
                        </button>
                        {canPost && (
                          <>
                            <button
                              type="button"
                              disabled={busy !== null}
                              className="text-emerald-700 hover:underline mr-2 disabled:opacity-50"
                              onClick={() => void postOne(r.AccPoolID)}
                            >
                              {busy === `p-${r.AccPoolID}` ? '…' : 'Muhasebeleştir'}
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              className="text-slate-600 hover:underline disabled:opacity-50"
                              onClick={() => void rebuild(r.AccPoolID)}
                            >
                              Yenile
                            </button>
                          </>
                        )}
                        {r.AccountVoucherID ? (
                          <span className="text-slate-400">Fiş #{r.AccountVoucherID}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-md border border-slate-200 bg-white p-3 min-h-[200px]">
          <h2 className="text-[12px] font-semibold text-slate-700 mb-2">Muhasebe kodları</h2>
          {!detailId ? (
            <p className="text-[11px] text-slate-400">Satırdan «Kodlar» ile hesap dağılımını görün.</p>
          ) : lines.length === 0 ? (
            <p className="text-[11px] text-slate-400">Satır yok</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left py-1">Hesap</th>
                  <th className="text-right py-1">Borç</th>
                  <th className="text-right py-1">Alacak</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.AccPoolLineID} className="border-t border-slate-100">
                    <td className="py-1 pr-1">
                      <div className="font-medium text-slate-800">
                        {l.AccountCode || (
                          <span className="text-red-600">{l.LinkHint || 'Hesap yok'}</span>
                        )}
                      </div>
                      <div className="text-slate-500 truncate max-w-[180px]">
                        {l.AccountTitle || l.Description}
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{l.Debit ? fmt(Number(l.Debit)) : ''}</td>
                    <td className="text-right tabular-nums">{l.Credit ? fmt(Number(l.Credit)) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </aside>
      </div>
    </div>
  );
};
