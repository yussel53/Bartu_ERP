import React, { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, Link2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { MenuScreen } from '../types/formTypes';
import { EGovDocumentList, listEGovDocuments } from '../api/egovDocumentsApi';
import { egovPdfUrl } from '../api/processApi';
import { deleteRecord } from '../api/recordsApi';
import { EGovDirection, EGovDocKindLabels } from '../data/egovTypes';
import { appConfirm } from '../utils/appConfirm';
import { isoToDisplay } from '../utils/dateFormat';

const fmtAmount = (v?: number | null) =>
  v == null ? '' : v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v?: string | null) => (v ? isoToDisplay(String(v).slice(0, 10)) : '');

function statusClass(status?: string | null): string {
  const s = (status || '').toLocaleLowerCase('tr-TR');
  if (s.startsWith('onay') || s.startsWith('kabul')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s.startsWith('red') || s.startsWith('hata') || s.startsWith('iptal')) return 'bg-red-50 text-red-700 border-red-200';
  if (s.startsWith('gönder')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s.startsWith('bekl')) return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

interface EGovDocumentListPageProps {
  screen: MenuScreen;
  onNew: () => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
}

/** E-Devlet kutusu: EGovDocument DocKind + Direction + IsArchived (api/egov/documents) */
export const EGovDocumentListPage: React.FC<EGovDocumentListPageProps> = ({ screen, onNew, onView, onEdit }) => {
  const box = screen.egovList!;
  const [data, setData] = useState<EGovDocumentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listEGovDocuments({
        docKind: box.docKind,
        direction: box.direction,
        archived: box.archived,
        from: from || null,
        to: to || null,
        search: appliedSearch,
        status,
      });
      setData(r);
      if (r.warning) setError(r.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Belgeler okunamadı');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [box.docKind, box.direction, box.archived, from, to, appliedSearch, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Arama: yazmayı bırakınca uygula
  useEffect(() => {
    const t = window.setTimeout(() => setAppliedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const remove = async (id: number, no?: string | null) => {
    if (!(await appConfirm(`${no || `#${id}`} belgesi silinsin mi?`, { danger: true, okLabel: 'Sil' }))) return;
    try {
      await deleteRecord('EGovDocument', id, 'EGovDocumentID');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const rows = data?.rows ?? [];
  const allCount = (data?.statusCounts ?? []).reduce((a, c) => a + c.count, 0);
  const isIncoming = box.direction === EGovDirection.Gelen;

  const th = 'px-2 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const thR = 'px-2 py-1 text-right font-medium text-slate-600 border-b border-r border-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 border-b border-r border-slate-200 whitespace-nowrap';
  const tdR = `${td} text-right tabular-nums`;
  const iconBtn = 'p-1 rounded-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {EGovDocKindLabels[box.docKind]} · {box.archived ? 'Arşiv ' : ''}
            {isIncoming ? 'Gelen' : 'Giden'}
          </h2>
          <p className="text-[11px] text-slate-500">{screen.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-1.5 top-1.5 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Belge no, cari, VKN, ETTN"
              className="w-56 h-7 pl-6 pr-2 text-[12px] rounded-sm border border-slate-300 bg-white"
            />
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            title="Başlangıç tarihi"
            className="h-7 px-1.5 text-[12px] rounded-sm border border-slate-300 bg-white"
          />
          <span className="text-[11px] text-slate-400">–</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            title="Bitiş tarihi"
            className="h-7 px-1.5 text-[12px] rounded-sm border border-slate-300 bg-white"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Yenile
          </button>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1 px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600"
          >
            <Plus className="w-3.5 h-3.5" /> Yeni
          </button>
        </div>
      </div>

      {/* Durum çipleri */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setStatus(null)}
          className={`px-2 h-6 text-[11px] rounded-sm border ${status == null ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
        >
          Tümü <span className="opacity-70">{allCount}</span>
        </button>
        {(data?.statusCounts ?? []).map((c) => (
          <button
            key={c.status}
            type="button"
            onClick={() => setStatus(status === c.status ? null : c.status)}
            className={`px-2 h-6 text-[11px] rounded-sm border ${status === c.status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
          >
            {c.status || 'Durumsuz'} <span className="opacity-70">{c.count}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">{error}</div>
      )}

      <section className="rounded-sm border border-slate-300 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead className="bg-slate-100">
              <tr>
                <th className={th}>İşlem</th>
                <th className={th}>Belge No</th>
                <th className={th}>Tarih</th>
                <th className={th}>{isIncoming ? 'Gönderen' : 'Alıcı'}</th>
                <th className={th}>VKN / TCKN</th>
                <th className={th}>ETTN</th>
                <th className={th}>Profil</th>
                <th className={thR}>Tutar</th>
                <th className={thR}>Vergi</th>
                <th className={th}>PB</th>
                <th className={th}>Durum</th>
                <th className={th}>Bağ</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                    {loading ? 'Yükleniyor…' : 'Bu kutuda belge yok.'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.eGovDocumentID}
                    onDoubleClick={() => onView(r.eGovDocumentID)}
                    className={`hover:bg-blue-50/40 cursor-default ${r.isActive ? '' : 'text-slate-400'}`}
                  >
                    <td className={`${td} py-0.5`}>
                      <div className="flex items-center gap-0.5">
                        <button type="button" title="İncele" onClick={() => onView(r.eGovDocumentID)} className={iconBtn}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" title="Değiştir" onClick={() => onEdit(r.eGovDocumentID)} className={iconBtn}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {r.hasPdf ? (
                          <a
                            href={egovPdfUrl(r.eGovDocumentID)}
                            target="_blank"
                            rel="noreferrer"
                            title="PDF"
                            className={iconBtn}
                          >
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                          </a>
                        ) : (
                          <span className="p-1 opacity-30" title="PDF yok">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <button
                          type="button"
                          title="Sil"
                          onClick={() => void remove(r.eGovDocumentID, r.documentNo)}
                          className={`${iconBtn} hover:text-red-600`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className={`${td} font-medium`}>{r.documentNo}</td>
                    <td className={td}>{fmtDate(r.documentDate)}</td>
                    <td className={`${td} max-w-[260px] truncate`} title={r.customerTitle ?? ''}>
                      {r.customerTitle}
                    </td>
                    <td className={td}>{r.taxNr}</td>
                    <td className={`${td} font-mono text-[11px] text-slate-500`} title={r.uuid ?? ''}>
                      {r.uuid ? `${r.uuid.slice(0, 8)}…` : ''}
                    </td>
                    <td className={`${td} text-[11px]`}>{r.profileId}</td>
                    <td className={tdR}>{fmtAmount(r.amount)}</td>
                    <td className={tdR}>{fmtAmount(r.taxAmount)}</td>
                    <td className={td}>{r.currencyCode}</td>
                    <td className={td}>
                      {r.status ? (
                        <span className={`inline-block px-1.5 py-px rounded-sm border text-[11px] ${statusClass(r.status)}`}>
                          {r.status}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${td} text-[11px] text-slate-500`}>
                      {r.invoiceID ? (
                        <span className="inline-flex items-center gap-0.5 mr-1.5" title={`Fatura #${r.invoiceID}`}>
                          <Link2 className="w-3 h-3" /> Fatura
                        </span>
                      ) : null}
                      {r.orderVoucherID ? (
                        <span className="inline-flex items-center gap-0.5" title={`Sipariş #${r.orderVoucherID}`}>
                          <Link2 className="w-3 h-3" /> Sipariş
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-2.5 py-1 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
          {rows.length} / {data?.total ?? 0} belge
          {data && data.total > rows.length ? ' · ilk 500 gösteriliyor, filtreyi daraltın' : ''}
        </div>
      </section>
    </div>
  );
};
