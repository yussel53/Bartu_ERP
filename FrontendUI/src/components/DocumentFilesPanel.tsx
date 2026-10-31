import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
} from 'lucide-react';
import {
  deleteDocFile,
  docFileDownloadUrl,
  listDocFiles,
  uploadDocFile,
  type DocFileRow,
} from '../api/docFilesApi';
import { appToast } from '../utils/appToast';
import { appConfirm } from '../utils/appConfirm';

const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,.odt,.ods,.png,.jpg,.jpeg,.gif,.webp,.zip,.msg,.eml';

function formatSize(n?: number | null): string {
  if (n == null || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ExtIcon({ ext }: { ext?: string | null }) {
  const e = (ext || '').toLowerCase();
  const cls = 'w-3.5 h-3.5 shrink-0';
  if (e === '.pdf' || e === '.txt' || e === '.rtf' || e === '.doc' || e === '.docx' || e === '.odt')
    return <FileText className={`${cls} text-rose-600`} />;
  if (e === '.xls' || e === '.xlsx' || e === '.csv' || e === '.ods')
    return <FileSpreadsheet className={`${cls} text-emerald-600`} />;
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(e))
    return <FileImage className={`${cls} text-sky-600`} />;
  return <File className={`${cls} text-slate-500`} />;
}

interface Props {
  tableName: string;
  recordId: number;
  readOnly?: boolean;
}

/** Kayıtlı kart / fişe istenildiği kadar doküman (PDF, Word, Excel, txt…) */
export const DocumentFilesPanel: React.FC<Props> = ({ tableName, recordId, readOnly }) => {
  const [rows, setRows] = useState<DocFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!(recordId > 0) || !tableName) return;
    setLoading(true);
    try {
      setRows(await listDocFiles(tableName, recordId));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tableName, recordId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!(recordId > 0) || !tableName) return null;

  const onPick = async (files: FileList | null) => {
    if (!files?.length || readOnly) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const f of Array.from(files)) {
        try {
          await uploadDocFile(tableName, recordId, f);
          ok += 1;
        } catch (e) {
          appToast(`${f.name}: ${e instanceof Error ? e.message : 'yüklenemedi'}`, {
            kind: 'error',
            durationMs: 5000,
          });
        }
      }
      if (ok) {
        appToast(ok === 1 ? 'Doküman eklendi' : `${ok} doküman eklendi`);
        await reload();
        setOpen(true);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDelete = async (row: DocFileRow) => {
    if (
      !(await appConfirm(`«${row.fileName}» silinsin mi?`, {
        title: 'Doküman sil',
        okLabel: 'Sil',
        danger: true,
      }))
    )
      return;
    try {
      await deleteDocFile(row.documentFileID);
      appToast('Doküman silindi');
      await reload();
    } catch (e) {
      appToast(e instanceof Error ? e.message : 'Silinemedi', { kind: 'error' });
    }
  };

  return (
    <div className="mb-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
        >
          <Paperclip className="w-3.5 h-3.5 text-slate-500" />
          Dokümanlar
          <span className="text-[10px] font-normal text-slate-500">
            ({loading ? '…' : rows.length})
          </span>
        </button>
        <div className="flex items-center gap-1 ml-auto">
          {!readOnly && (
            <>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => void onPick(e.target.files)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-semibold rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="PDF, Word, Excel, txt, görsel, zip…"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Ekle
              </button>
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-2.5 py-2 space-y-1 max-h-48 overflow-y-auto">
          {loading && rows.length === 0 && (
            <p className="text-[11px] text-slate-400 inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> yükleniyor…
            </p>
          )}
          {!loading && rows.length === 0 && (
            <p className="text-[11px] text-slate-400">
              Henüz doküman yok. PDF, Word, Excel, txt vb. ekleyebilirsiniz.
            </p>
          )}
          {rows.map((r) => (
            <div
              key={r.documentFileID}
              className="flex items-center gap-2 rounded-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1"
            >
              <ExtIcon ext={r.extension || (r.fileName.includes('.') ? `.${r.fileName.split('.').pop()}` : '')} />
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-medium text-slate-800 dark:text-slate-100 truncate" title={r.fileName}>
                  {r.title?.trim() || r.fileName}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {r.fileName}
                  {r.sizeBytes != null ? ` · ${formatSize(r.sizeBytes)}` : ''}
                  {r.createdAt
                    ? ` · ${new Date(r.createdAt).toLocaleString('tr-TR')}`
                    : ''}
                </div>
              </div>
              <a
                href={docFileDownloadUrl(r.documentFileID)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 hover:bg-slate-100"
                title="İndir"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void onDelete(r)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-red-600 hover:bg-red-50"
                  title="Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
