import React from 'react';
import { BookOpen, Loader2, X } from 'lucide-react';
import { apiJson } from '../config/api';

type AccInfo = {
  accountCardID?: number | null;
  code?: string | null;
  title?: string | null;
  missing?: boolean;
};

type HeaderRow = { role?: string; stored?: boolean; account?: AccInfo | null };
type LineRow = {
  lineNo?: number;
  productCode?: string | null;
  customerCode?: string | null;
  checkCode?: string | null;
  description?: string | null;
  amount?: number | null;
  productAccount?: AccInfo | null;
  productStored?: boolean;
  taxAccount?: AccInfo | null;
  taxStored?: boolean;
  account?: AccInfo | null;
  stored?: boolean;
};
type ExtraRow = {
  productTransID?: number;
  role?: string;
  amount?: number | null;
  description?: string | null;
  account?: AccInfo | null;
  stored?: boolean;
};

type DocCodes = {
  source?: string;
  id?: number;
  documentNumber?: string | null;
  customerTitle?: string | null;
  header?: HeaderRow[];
  lines?: LineRow[];
  extras?: ExtraRow[];
  notes?: string[];
};

function fmtAcc(a?: AccInfo | null): string {
  if (!a) return '—';
  if (a.missing || (!a.code && !a.title)) return 'Eksik';
  const code = (a.code ?? '').trim();
  const title = (a.title ?? '').trim();
  if (code && title) return `${code} — ${title}`;
  return code || title || '—';
}

function Badge({ stored }: { stored?: boolean }) {
  return stored ? (
    <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      belgede
    </span>
  ) : (
    <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      bağlantı
    </span>
  );
}

/** Liste / belge sağ tık → Muhasebe Kodları */
export const DocumentAccountCodesModal: React.FC<{
  source: string;
  id: number;
  title?: string;
  onClose: () => void;
}> = ({ source, id, title, onClose }) => {
  const [data, setData] = React.useState<DocCodes | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setData(null);
    setError(null);
    apiJson<DocCodes>(`/api/accounting/document-codes/${encodeURIComponent(source)}/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [source, id]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const docLabel = data?.documentNumber || title || `#${id}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />
            Muhasebe Kodları
            <span className="font-normal text-slate-500 truncate">· {docLabel}</span>
            {data?.customerTitle && (
              <span className="font-normal text-slate-400 truncate hidden sm:inline">· {data.customerTitle}</span>
            )}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800" title="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto p-3 space-y-3 text-xs">
          {error && (
            <div className="px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-700">{error}</div>
          )}
          {!data && !error && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor…
            </div>
          )}

          {data?.header && data.header.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Başlık</h3>
              <table className="w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                <tbody>
                  {data.header.map((h, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800 first:border-0">
                      <td className="px-2.5 py-1.5 text-slate-500 w-36">{h.role ?? 'Hesap'}</td>
                      <td className="px-2.5 py-1.5 text-slate-800 dark:text-slate-100 font-medium">{fmtAcc(h.account)}</td>
                      <td className="px-2.5 py-1.5 w-20 text-right">
                        <Badge stored={h.stored} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data?.lines && data.lines.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Satırlar</h3>
              <table className="w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-left">
                    <th className="px-2 py-1 font-medium w-10">#</th>
                    <th className="px-2 py-1 font-medium">Kalem</th>
                    <th className="px-2 py-1 font-medium">Hesap / KDV</th>
                    <th className="px-2 py-1 font-medium w-20 text-right">Kaynak</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => {
                    const label =
                      [l.productCode, l.customerCode, l.checkCode, l.description]
                        .map((v) => String(v ?? '').trim())
                        .filter(Boolean)
                        .join(' · ') || '—';
                    const hasTax = l.taxAccount != null;
                    return (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800 align-top">
                        <td className="px-2 py-1.5 text-slate-400 tabular-nums">{l.lineNo ?? i + 1}</td>
                        <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">
                          <div>{label}</div>
                          {l.amount != null && (
                            <div className="text-slate-400 tabular-nums">
                              {Number(l.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">
                          {l.productAccount || l.taxAccount ? (
                            <div className="space-y-0.5">
                              <div>{fmtAcc(l.productAccount)}</div>
                              {hasTax && (
                                <div className="text-slate-500">
                                  KDV: {fmtAcc(l.taxAccount)}{' '}
                                  <Badge stored={l.taxStored} />
                                </div>
                              )}
                            </div>
                          ) : (
                            fmtAcc(l.account)
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Badge stored={l.productStored ?? l.stored} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {data?.extras && data.extras.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Ek vergi / satırlar
              </h3>
              <table className="w-full border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                <tbody>
                  {data.extras.map((e, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800 first:border-0">
                      <td className="px-2.5 py-1.5 text-slate-500 w-28">{e.role ?? 'Ek'}</td>
                      <td className="px-2.5 py-1.5 text-slate-700">{e.description || '—'}</td>
                      <td className="px-2.5 py-1.5 font-medium">{fmtAcc(e.account)}</td>
                      <td className="px-2.5 py-1.5 w-20 text-right">
                        <Badge stored={e.stored} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data &&
            !(data.header?.length || data.lines?.length || data.extras?.length) &&
            !error && (
              <div className="text-slate-400">Bu belge için muhasebe kodu satırı yok.</div>
            )}

          {data?.notes && data.notes.length > 0 && (
            <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
              {data.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-7 px-3 text-[12px] rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
