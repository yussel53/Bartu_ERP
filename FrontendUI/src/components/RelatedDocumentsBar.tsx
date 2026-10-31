import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { fetchDocumentLinks, type DocumentLink } from '../api/documentLinksApi';
import { useAppModules } from '../contexts/AppModulesContext';
import { findScreenByFormCode } from '../utils/findScreenByForm';
import { buildOpenDocHref } from '../contexts/OpenDocumentsContext';
import { appToast } from '../utils/appToast';

const LINK_TABLES = new Set([
  'Invoice',
  'ProductVoucher',
  'OrderVoucher',
  'AccountVoucher',
  'SafeVoucher',
  'CustomerVoucher',
]);

interface Props {
  tableName: string;
  recordId: number;
}

/** Fiş üstünde bağlı belgeler — tıklayınca ilgili fişe gider */
export const RelatedDocumentsBar: React.FC<Props> = ({ tableName, recordId }) => {
  const { modules } = useAppModules();
  const [links, setLinks] = useState<DocumentLink[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!LINK_TABLES.has(tableName) || !(recordId > 0)) {
      setLinks([]);
      return;
    }
    let off = false;
    setLoading(true);
    void fetchDocumentLinks(tableName, recordId)
      .then((rows) => {
        if (!off) setLinks(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!off) setLinks([]);
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [tableName, recordId]);

  if (!(recordId > 0) || !LINK_TABLES.has(tableName)) return null;
  if (!loading && links.length === 0) return null;

  const open = (link: DocumentLink) => {
    const screen = findScreenByFormCode(modules, link.formCode, link.typeHint);
    const path = screen?.path;
    if (!path) {
      appToast(`${link.label} ekranı menüde bulunamadı (${link.formCode})`, { kind: 'error' });
      return;
    }
    window.location.hash = `#/${buildOpenDocHref(path, 'edit', { recordId: String(link.id) })}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1 text-[11px]">
      <span className="text-slate-500 font-medium shrink-0">Bağlı belgeler:</span>
      {loading && (
        <span className="inline-flex items-center gap-1 text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" /> aranıyor…
        </span>
      )}
      {links.map((l) => (
        <button
          key={`${l.table}-${l.id}`}
          type="button"
          onClick={() => open(l)}
          title={`${l.label} #${l.id}`}
          className="inline-flex items-center gap-1 px-2 h-6 rounded-md border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200"
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="font-semibold">{l.label}</span>
          <span className="font-mono text-[10px] opacity-80">
            {l.documentNumber?.trim() || `#${l.id}`}
          </span>
        </button>
      ))}
    </div>
  );
};
