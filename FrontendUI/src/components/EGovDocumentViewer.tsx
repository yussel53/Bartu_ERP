import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Loader2, Receipt, X } from 'lucide-react';
import { API_BASE } from '../config/api';

type Tab = 'view' | 'pdf';
type Source = 'auto' | 'embedded' | 'design';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'auto', label: 'Otomatik' },
  { value: 'embedded', label: 'Gönderen tasarımı' },
  { value: 'design', label: 'Tasarım şablonumuz' },
];

/** Chrome / Edge / Firefox'ta true; PDF eklentisi olmayan gömülü tarayıcılarda false */
const canShowPdf = (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;

const viewUrl = (id: number, source: Source) => `${API_BASE}/api/egov/documents/${id}/view?source=${source}`;
const pdfUrl = (id: number) => `${API_BASE}/api/egov/documents/${id}/pdf`;

interface Props {
  egovId: number;
  documentNo?: string | null;
  customerTitle?: string | null;
  hasXml: boolean;
  hasPdf: boolean;
  onClose: () => void;
}

/**
 * e-Belge görüntüleyici: UBL + XSLT ile oluşan fatura görünümü (gönderenin gömülü tasarımı ya da
 * Tasarım Şablonları) ve PDF — ikisi de program içinde, indirmeden.
 */
export const EGovDocumentViewer: React.FC<Props> = ({ egovId, documentNo, customerTitle, hasXml, hasPdf, onClose }) => {
  const [tab, setTab] = useState<Tab>(hasXml ? 'view' : 'pdf');
  const [source, setSource] = useState<Source>('auto');
  const [html, setHtml] = useState<string | null>(null);
  const [usedSource, setUsedSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'view' || !hasXml) return;
    let off = false;
    setLoading(true);
    setError(null);
    setHtml(null);
    fetch(viewUrl(egovId, source))
      .then(async (r) => {
        const text = await r.text();
        if (off) return;
        if (!r.ok) {
          let msg = 'Görünüm oluşturulamadı';
          try {
            msg = (JSON.parse(text) as { message?: string }).message || msg;
          } catch {
            /* düz metin */
          }
          setError(msg);
          return;
        }
        setHtml(text);
        setUsedSource(decodeURIComponent(r.headers.get('X-View-Source') || ''));
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : 'Görünüm oluşturulamadı'))
      .finally(() => !off && setLoading(false));
    return () => {
      off = true;
    };
  }, [egovId, source, tab, hasXml]);

  // Esc ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sourceLabel = (() => {
    if (!usedSource) return null;
    const [kind, name] = usedSource.split(';');
    return kind === 'embedded' ? `Gönderen tasarımı (${name})` : kind === 'design' ? `Tasarım şablonu: ${name}` : usedSource;
  })();

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode, enabled: boolean) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => setTab(t)}
      title={enabled ? undefined : t === 'pdf' ? 'Bu belgenin PDF’i yok' : 'Bu belgenin UBL/XML içeriği yok'}
      className={`inline-flex items-center gap-1 px-3 h-7 text-[12px] font-medium border-r last:border-r-0 border-slate-300 disabled:opacity-40 ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3" onMouseDown={onClose}>
      <div className="w-full max-w-5xl h-[94vh] rounded-md bg-white shadow-xl flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-200">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-slate-900 truncate">{documentNo}</div>
            <div className="text-[11px] text-slate-500 truncate">{customerTitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-sm border border-slate-300 bg-white overflow-hidden">
              {tabBtn('view', 'Görünüm', <Receipt className="w-3.5 h-3.5" />, hasXml)}
              {tabBtn('pdf', 'PDF', <FileText className="w-3.5 h-3.5" />, hasPdf)}
            </div>
            {tab === 'view' && (
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as Source)}
                className="h-7 px-2 text-[12px] rounded-sm border border-slate-300 bg-white"
                title="Görünüm tasarımı"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            <a
              href={tab === 'view' ? viewUrl(egovId, source) : pdfUrl(egovId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              title="Yeni sekmede aç (yazdırmak için)"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Yeni sekmede aç
            </a>
            <button type="button" onClick={onClose} className="p-1 rounded-sm text-slate-500 hover:bg-slate-100" title="Kapat (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tab === 'view' && sourceLabel && !error && (
          <div className="px-4 py-1 text-[11px] text-slate-500 border-b border-slate-100 bg-slate-50">Görünüm: {sourceLabel}</div>
        )}

        <div className="flex-1 relative bg-slate-100">
          {tab === 'view' ? (
            loading ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-[12px] text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Görünüm hazırlanıyor…
              </div>
            ) : error ? (
              <div className="m-4 space-y-2">
                <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>
                {hasPdf && (
                  <button
                    type="button"
                    onClick={() => setTab('pdf')}
                    className="inline-flex items-center gap-1 px-3 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF'i göster
                  </button>
                )}
              </div>
            ) : html != null ? (
              // Gönderen tasarımı dış kaynaklı: allow-scripts (QR kod) var, allow-same-origin yok → uygulamaya erişemez
              <iframe title="e-Belge görünümü" sandbox="allow-scripts" srcDoc={html} className="absolute inset-0 w-full h-full bg-white" />
            ) : null
          ) : canShowPdf ? (
            <iframe title="e-Belge PDF" src={pdfUrl(egovId)} className="absolute inset-0 w-full h-full bg-white" />
          ) : (
            <div className="m-4 space-y-2 text-[12px] text-slate-600">
              <div className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Bu tarayıcıda yerleşik PDF görüntüleyici yok; PDF sayfa içinde gösterilemiyor. «Görünüm» sekmesi faturayı
                tasarımıyla gösterir; PDF için yeni sekmede açabilirsiniz.
              </div>
              <a
                href={pdfUrl(egovId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 h-7 rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="w-3.5 h-3.5" /> PDF'i yeni sekmede aç
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
