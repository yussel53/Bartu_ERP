import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { FormTabs } from './FormTabs';
import { CardStatementReport } from './CardStatementReport';
import {
  CardSection,
  CardStatementKind,
  CardStatementResult,
  getCardStatement,
} from '../api/cardStatementApi';
import { displayToIso, getSystemDatePlaceholder } from '../utils/dateFormat';
import { downloadCsv, fmtBalance, fmtCell, fmtDate, fmtNum } from '../utils/cardStatementFormat';
import { FilterInput, FilterSummary, SortLabel, useGridSortFilter } from './GridSortFilter';

interface CardStatementModalProps {
  kind: CardStatementKind;
  cardId: number;
  /** Kart türü başlığı (Cari, Malzeme…) */
  kindTitle: string;
  /** Ekstre rapor başlığı (Cari Hesap Ekstresi, Muavin Defter…) */
  reportTitle: string;
  /** Açılışta seçili sekme: 'ekstre' veya bölüm anahtarı */
  initialTab: string;
  onClose: () => void;
}

export const CardStatementModal: React.FC<CardStatementModalProps> = ({
  kind,
  cardId,
  kindTitle,
  reportTitle,
  initialTab,
  onClose,
}) => {
  const [data, setData] = useState<CardStatementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(initialTab);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getCardStatement(kind, cardId, range));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ekstre alınamadı');
    } finally {
      setLoading(false);
    }
  }, [kind, cardId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyRange = () => {
    const from = fromText.trim() ? displayToIso(fromText.trim()) : null;
    const to = toText.trim() ? displayToIso(toText.trim()) : null;
    if ((fromText.trim() && !from) || (toText.trim() && !to)) {
      setError(`Tarih biçimi geçersiz (${getSystemDatePlaceholder()})`);
      return;
    }
    setRange({ from, to });
  };

  const hasStatement = kind !== 'bound';
  const tabs = useMemo(() => {
    if (!data) return [{ id: tab, label: 'Yükleniyor…' }];
    const list: { id: string; label: string; count?: number }[] = [];
    if (hasStatement) list.push({ id: 'ekstre', label: 'Ekstre', count: data.statement.length });
    for (const s of data.sections) list.push({ id: s.key, label: s.title, count: s.rows.length });
    return list;
  }, [data, hasStatement, tab]);

  useEffect(() => {
    if (!data) return;
    const ids = new Set([...(hasStatement ? ['ekstre'] : []), ...data.sections.map((s) => s.key)]);
    if (!ids.has(tab)) setTab(hasStatement ? 'ekstre' : data.sections[0]?.key ?? 'ekstre');
  }, [data, hasStatement, tab]);

  const activeSection: CardSection | undefined = data?.sections.find((s) => s.key === tab);
  const headerTitle = data
    ? [data.cardCode, data.cardTitle].filter(Boolean).join(' · ') || `#${cardId}`
    : `#${cardId}`;

  const exportActive = () => {
    if (!data) return;
    const base = `${kindTitle}-${data.cardCode || cardId}`.replace(/[^\p{L}\p{N}_-]+/gu, '_');
    if (tab === 'ekstre') {
      const numFmt = data.unit === 'qty' ? 'qty' : 'money';
      downloadCsv(
        `${base}-ekstre.csv`,
        ['Tarih', 'Belge No', 'Belge Türü', 'Tür', 'Açıklama', 'İlgili', data.debitLabel, data.creditLabel, 'Bakiye'],
        data.statement.map((r) => [
          fmtDate(r.date),
          r.docNo ?? '',
          r.source,
          r.typeLabel ?? '',
          r.description ?? '',
          r.party ?? '',
          fmtNum(r.debit, numFmt),
          fmtNum(r.credit, numFmt),
          fmtBalance(r.balance, numFmt, data.debitLabel === 'Borç'),
        ]),
      );
      return;
    }
    if (!activeSection) return;
    downloadCsv(
      `${base}-${activeSection.key}.csv`,
      activeSection.columns.map((c) => c.label),
      activeSection.rows.map((r) => activeSection.columns.map((c) => fmtCell(r[c.key], c))),
    );
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-7xl h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${kindTitle} ekstre`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{kindTitle}</p>
            <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{headerTitle}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              value={fromText}
              onChange={(e) => setFromText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyRange()}
              placeholder={`Başlangıç ${getSystemDatePlaceholder()}`}
              className="w-32 h-7 px-2 text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            />
            <input
              value={toText}
              onChange={(e) => setToText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyRange()}
              placeholder={`Bitiş ${getSystemDatePlaceholder()}`}
              className="w-32 h-7 px-2 text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            />
            <button
              type="button"
              onClick={applyRange}
              disabled={loading}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Getir
            </button>
            <button
              type="button"
              onClick={exportActive}
              disabled={!data}
              title="Görünen sekmeyi Excel (CSV) olarak indir"
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          <FormTabs variant="segment" size="sm" tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {(error || (data?.warnings.length ?? 0) > 0) && (
          <div className="px-3 py-1.5 text-[11px] text-red-600 flex items-start gap-1 border-b border-slate-100">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>{[error, ...(data?.warnings ?? [])].filter(Boolean).join(' · ')}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {loading && !data ? (
            <p className="px-3 py-8 text-center text-[12px] text-slate-400">Yükleniyor…</p>
          ) : !data ? null : tab === 'ekstre' ? (
            <CardStatementReport
              data={data}
              kindTitle={kindTitle}
              reportTitle={reportTitle}
              rangeFrom={range.from}
              rangeTo={range.to}
            />
          ) : activeSection ? (
            <SectionTable key={activeSection.key} section={activeSection} />
          ) : (
            <p className="px-3 py-8 text-center text-[12px] text-slate-400">Bu kart için bu bölümde kayıt yok.</p>
          )}
        </div>
      </div>
    </div>
  );
};

/** Bölüm tablosu (Hareketler, Siparişler…) — başlığa tıklayınca sıralama, başlık altında filtre */
const SectionTable: React.FC<{ section: CardSection }> = ({ section }) => {
  const isNum = (c: CardSection['columns'][number]) => c.format === 'money' || c.format === 'qty';
  const grid = useGridSortFilter(section.rows, (r, key) => {
    const col = section.columns.find((c) => c.key === key);
    return col ? fmtCell(r[key], col) : String(r[key] ?? '');
  });
  const th = 'px-2 py-1.5 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap';
  const td = 'px-2 py-1 text-slate-700 dark:text-slate-200 whitespace-nowrap';
  return (
    <>
      {section.note && (
        <p className="px-3 py-1.5 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/40">{section.note}</p>
      )}
      <table className="min-w-full text-[12px]">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-[1]">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {section.columns.map((c) => (
              <th key={c.key} className={`${th} ${isNum(c) ? 'text-right' : 'text-left'}`}>
                <SortLabel
                  label={c.label}
                  colKey={c.key}
                  sort={grid.sort}
                  onSort={grid.toggleSort}
                  align={isNum(c) ? 'right' : 'left'}
                />
              </th>
            ))}
          </tr>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60">
            {section.columns.map((c) => (
              <th key={c.key} className="px-1.5 py-1 font-normal">
                <FilterInput colKey={c.key} value={grid.filters[c.key] ?? ''} onChange={grid.setFilter} numeric={isNum(c)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.view.length === 0 ? (
            <tr>
              <td colSpan={section.columns.length} className="px-3 py-6 text-center text-slate-400">
                {section.rows.length === 0 ? 'Kayıt yok' : 'Filtreye uyan kayıt yok'}
              </td>
            </tr>
          ) : (
            grid.view.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {section.columns.map((c) => (
                  <td
                    key={c.key}
                    className={isNum(c) ? `${td} text-right tabular-nums` : `${td} max-w-[260px] truncate`}
                  >
                    {fmtCell(r[c.key], c)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {grid.hasFilter && (
        <div className="px-3 py-1.5 border-t border-slate-100">
          <FilterSummary shown={grid.view.length} total={section.rows.length} active onClear={grid.clear} />
        </div>
      )}
    </>
  );
};
