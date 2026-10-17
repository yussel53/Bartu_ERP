import React from 'react';
import { ListOrdered, Eye, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  applyJournalNumbering,
  fetchJournalNumberingHistory,
  previewJournalNumbering,
  suggestJournalStart,
  type JournalNumberingLogRow,
  type JournalNumberingRequest,
  type JournalNumberingResult,
} from '../api/journalNumberingApi';
import { getCurrentUserId } from '../data/permissions';
import { appConfirm } from '../utils/appConfirm';

interface JournalNumberingPageProps {
  onBack?: () => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const yearStart = () => `${new Date().getFullYear()}-01-01`;

const fmtDate = (v?: string | null) => {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}.${m}.${y}` : s;
};
const fmtMoney = (n?: number | null) =>
  (n ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  'w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900';

export const JournalNumberingPage: React.FC<JournalNumberingPageProps> = () => {
  const [startDate, setStartDate] = React.useState(yearStart());
  const [endDate, setEndDate] = React.useState(today());
  const [startNumber, setStartNumber] = React.useState(1);
  const [onlyUnnumbered, setOnlyUnnumbered] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<JournalNumberingResult | null>(null);
  const [history, setHistory] = React.useState<JournalNumberingLogRow[]>([]);

  const req = (): JournalNumberingRequest => ({
    startDate,
    endDate,
    startNumber,
    onlyUnnumbered,
    note: note.trim() || undefined,
    appliedBy: getCurrentUserId(),
  });

  const loadHistory = React.useCallback(async () => {
    try {
      setHistory(await fetchJournalNumberingHistory());
    } catch {
      setHistory([]);
    }
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Parametre değişince eski önizleme geçersiz
  React.useEffect(() => {
    setPreview(null);
    setInfo(null);
  }, [startDate, endDate, startNumber, onlyUnnumbered]);

  const suggest = async () => {
    setError(null);
    try {
      setStartNumber(await suggestJournalStart(startDate));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Öneri alınamadı');
    }
  };

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      setPreview(await previewJournalNumbering(req()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Önizleme başarısız');
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    if (!preview || preview.count === 0) return;
    const msg = onlyUnnumbered
      ? `${preview.count} fişe ${preview.startNumber}–${preview.endNumber} yevmiye no verilecek. Onaylıyor musunuz?`
      : `${fmtDate(startDate)}–${fmtDate(endDate)} aralığındaki ${preview.count} fiş yeniden numaralanacak (mevcut numaralar değişir). Onaylıyor musunuz?`;
    if (!await appConfirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await applyJournalNumbering(req());
      setPreview(r);
      setInfo(`${r.count} fiş numaralandı (${r.startNumber}–${r.endNumber ?? r.startNumber}).`);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Numaralandırma başarısız');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <ListOrdered className="w-4 h-4 text-blue-600" />
        <div>
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
            Yevmiye Madde Numaralandırma
          </h2>
          <p className="text-[11px] text-slate-500">
            Fişler tarih → saat → fiş sırasıyla ardışık numaralanır. İptal ve e-Deftere gönderilmeyecek fişler atlanır.
          </p>
        </div>
      </div>

      <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <label className="md:col-span-2 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Başlangıç Tarihi</span>
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Bitiş Tarihi</span>
            <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">İlk Yevmiye No</span>
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                className={`${inputCls} tabular-nums`}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
              />
              <button
                type="button"
                title="Başlangıç tarihinden önceki son yevmiye no + 1"
                onClick={suggest}
                className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-300 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </label>
          <label className="md:col-span-3 inline-flex items-center gap-2 h-8 text-[12px] text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={onlyUnnumbered}
              onChange={(e) => setOnlyUnnumbered(e.target.checked)}
            />
            Sadece yevmiye no'su boş fişler
          </label>
          <label className="md:col-span-3 space-y-1">
            <span className="text-[11px] font-medium text-slate-600">Not</span>
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            disabled={busy}
            onClick={runPreview}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            Önizle
          </button>
          <button
            type="button"
            disabled={busy || !preview || preview.count === 0 || preview.applied}
            onClick={runApply}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Numaralandır
          </button>
          {preview && (
            <span className="text-[12px] text-slate-600">
              {preview.count} fiş
              {preview.count > 0 ? ` · ${preview.startNumber} – ${preview.endNumber}` : ''}
            </span>
          )}
          {error && <span className="text-[12px] text-red-600">{error}</span>}
          {info && <span className="text-[12px] text-emerald-700">{info}</span>}
        </div>
      </section>

      {preview && (
        <section className="rounded-md border border-slate-200 dark:border-slate-700 overflow-auto max-h-[50vh]">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
              <tr className="text-[11px] text-slate-600">
                <th className="px-2 py-1.5 w-[90px]">Yeni No</th>
                <th className="px-2 py-1.5 w-[90px]">Eski No</th>
                <th className="px-2 py-1.5 w-[100px]">Tarih</th>
                <th className="px-2 py-1.5 w-[70px]">Saat</th>
                <th className="px-2 py-1.5">Fiş No</th>
                <th className="px-2 py-1.5 text-right w-[120px]">Borç</th>
                <th className="px-2 py-1.5 text-right w-[120px]">Alacak</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                    Bu aralıkta numaralanacak fiş yok.
                  </td>
                </tr>
              ) : (
                preview.rows.map((r) => {
                  const changed = String(r.oldJournalNo ?? '').trim() !== String(r.newJournalNo);
                  return (
                    <tr key={r.accountVoucherID} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1 font-semibold tabular-nums">{r.newJournalNo}</td>
                      <td className={`px-2 py-1 tabular-nums ${changed ? 'text-amber-600' : 'text-slate-400'}`}>
                        {r.oldJournalNo || '—'}
                      </td>
                      <td className="px-2 py-1">{fmtDate(r.voucherDate)}</td>
                      <td className="px-2 py-1 tabular-nums">{r.voucherTime?.slice(0, 5) || '—'}</td>
                      <td className="px-2 py-1">{r.documentNumber}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoney(r.sumDebit)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoney(r.sumCredit)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      <section className="space-y-1.5">
        <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Numaralandırma Geçmişi</h3>
        <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr className="text-[11px] text-slate-600">
                <th className="px-2 py-1.5">Tarih Aralığı</th>
                <th className="px-2 py-1.5">Numara</th>
                <th className="px-2 py-1.5">Fiş</th>
                <th className="px-2 py-1.5">Mod</th>
                <th className="px-2 py-1.5">Not</th>
                <th className="px-2 py-1.5">Uygulama</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                    Henüz numaralandırma yapılmadı.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1">
                      {fmtDate(h.startDate)} – {fmtDate(h.endDate)}
                    </td>
                    <td className="px-2 py-1 tabular-nums">
                      {h.startNumber} – {h.endNumber ?? '—'}
                    </td>
                    <td className="px-2 py-1 tabular-nums">{h.voucherCount}</td>
                    <td className="px-2 py-1">{h.onlyUnnumbered ? 'Boş olanlar' : 'Tümü'}</td>
                    <td className="px-2 py-1">{h.note}</td>
                    <td className="px-2 py-1 text-slate-500">
                      {new Date(h.appliedAt.endsWith('Z') ? h.appliedAt : `${h.appliedAt}Z`).toLocaleString('tr-TR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
