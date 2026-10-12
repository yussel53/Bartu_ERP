import React from 'react';
import { ChevronDown, ChevronUp, FileText, Maximize2, Minimize2, X } from 'lucide-react';
import { buildOpenDocHref, useOpenDocuments } from '../contexts/OpenDocumentsContext';

interface OpenDocumentsTrayProps {
  onNavigate: (path: string) => void;
}

export const OpenDocumentsTray: React.FC<OpenDocumentsTrayProps> = ({ onNavigate }) => {
  const { documents, activeId, closeDocument, setActiveId } = useOpenDocuments();
  const [collapsed, setCollapsed] = React.useState(false);
  const [wide, setWide] = React.useState(false);

  if (documents.length === 0) return null;

  const widthClass = wide
    ? 'w-[min(100vw-1.5rem,420px)]'
    : 'w-[min(100vw-1.5rem,240px)]';

  return (
    <div
      className={`fixed top-3 right-3 z-50 flex flex-col items-end gap-1 pointer-events-none ${widthClass}`}
      aria-label="Açık fişler"
    >
      <div className="pointer-events-auto w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 shadow-lg backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-slate-100 dark:border-slate-700/80">
          <button
            type="button"
            title={collapsed ? 'Listeyi aç' : 'Listeyi kısalt'}
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 min-w-0 flex-1 px-1 py-0.5 rounded text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <FileText className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">
              Açık fişler ({documents.length})
            </span>
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
            )}
          </button>
          <button
            type="button"
            title={wide ? 'Daralt' : 'Genişlet'}
            onClick={() => setWide((w) => !w)}
            className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {wide ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-1.5 py-1.5 space-y-1 max-h-[40vh] overflow-y-auto">
            {documents.map((doc) => {
              const active = doc.id === activeId;
              const modeLabel =
                doc.mode === 'create' ? 'Yeni' : doc.mode === 'edit' ? 'Değiştir' : 'İncele';
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-1 min-w-0 ${
                    active
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/50'
                      : 'border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60'
                  }`}
                >
                  <button
                    type="button"
                    title={`${doc.screenTitle} — ${modeLabel}\nKaydet veya İptal ile kapatılır`}
                    onClick={() => {
                      setActiveId(doc.id);
                      onNavigate(
                        buildOpenDocHref(doc.screenPath, doc.mode, {
                          draftId: doc.mode === 'create' ? doc.id : undefined,
                          recordId: doc.recordId,
                        }),
                      );
                    }}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  >
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
                        {doc.label}
                      </span>
                      <span className="block text-[9px] text-slate-400 truncate leading-tight">
                        {modeLabel}
                        {doc.mode === 'create' ? ' · kaydedilmedi' : ''}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title="İptal — fişi kapat"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        !window.confirm(
                          `"${doc.label}" kapatılsın mı?\nKaydedilmemiş değişiklikler kaybolur.`,
                        )
                      ) {
                        return;
                      }
                      const wasActive = doc.id === activeId;
                      closeDocument(doc.id);
                      if (wasActive) {
                        onNavigate(doc.screenPath);
                      }
                    }}
                    className="shrink-0 p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
