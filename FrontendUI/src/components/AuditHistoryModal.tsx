import React from 'react';
import { History, Loader2, X } from 'lucide-react';
import { apiJson } from '../config/api';

interface AuditChange {
  f: string;
  o?: string | null;
  n?: string | null;
}

interface AuditEntry {
  id: number;
  action: 'I' | 'U' | 'D' | string;
  userName?: string | null;
  at: string;
  changes: AuditChange[];
}

const ACTION: Record<string, { label: string; cls: string }> = {
  I: { label: 'Eklendi', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  U: { label: 'Değişti', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  D: { label: 'Silindi', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

/** Sağ tık → Değişiklik Geçmişi (Y-15, SYS_AuditLog) */
export const AuditHistoryModal: React.FC<{ tableName: string; recordId: number; pk?: string; title?: string; onClose: () => void }> = ({
  tableName,
  recordId,
  pk,
  title,
  onClose,
}) => {
  const [rows, setRows] = React.useState<AuditEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = pk ? `?pk=${encodeURIComponent(pk)}` : '';
    apiJson<AuditEntry[]>(`/api/audit/${encodeURIComponent(tableName)}/${recordId}${q}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [tableName, recordId, pk]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" /> Değişiklik Geçmişi
            {title && <span className="font-normal text-slate-500 truncate max-w-[340px]">· {title}</span>}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800" title="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto p-3 space-y-2 text-xs">
          {error && <div className="px-3 py-1.5 rounded-md border border-red-200 bg-red-50 text-red-700">{error}</div>}
          {!rows && !error && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor…
            </div>
          )}
          {rows && rows.length === 0 && (
            <div className="text-slate-400">Bu kayıt için değişiklik geçmişi yok (geçmiş, özellik açıldıktan sonraki kayıtlardan tutulur).</div>
          )}
          {rows?.map((e) => {
            const a = ACTION[e.action] ?? { label: e.action, cls: 'bg-slate-100 text-slate-700' };
            return (
              <div key={e.id} className="border border-slate-200 dark:border-slate-700 rounded-md">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${a.cls}`}>{a.label}</span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{e.userName || '—'}</span>
                  <span className="text-slate-500 ml-auto">{new Date(e.at).toLocaleString('tr-TR')}</span>
                </div>
                {e.changes.length > 0 && (
                  <table className="w-full">
                    <tbody>
                      {e.changes.map((c, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800 first:border-0">
                          <td className="px-2.5 py-0.5 text-slate-500 w-44 align-top">{c.f === '#Satır' ? 'Satırlar' : c.f}</td>
                          {e.action === 'U' ? (
                            <>
                              <td className="px-2 py-0.5 text-red-700 dark:text-red-400 line-through decoration-red-300 align-top break-all">{c.o ?? '(boş)'}</td>
                              <td className="px-1 text-slate-400 align-top">→</td>
                              <td className="px-2 py-0.5 text-emerald-800 dark:text-emerald-300 align-top break-all">{c.n ?? '(boş)'}</td>
                            </>
                          ) : (
                            <td className="px-2 py-0.5 text-slate-700 dark:text-slate-200 break-all" colSpan={3}>
                              {(e.action === 'D' ? c.o : c.n) ?? ''}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
