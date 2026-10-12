import React from 'react';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { MenuScreen } from '../types/formTypes';
import { RAPORLAMA_BASE_URL } from '../config/integrations';

interface ExternalEmbedPageProps {
  screen: MenuScreen;
  breadcrumb?: string;
  onBack: () => void;
}

export const ExternalEmbedPage: React.FC<ExternalEmbedPageProps> = ({
  screen,
  breadcrumb,
  onBack,
}) => {
  const url = screen.externalUrl || RAPORLAMA_BASE_URL;

  return (
    <div className="h-full min-h-[70vh] flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Ana Sayfa
          </button>
          {breadcrumb && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{breadcrumb}</p>
          )}
          <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{screen.title}</h1>
          {screen.subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{screen.subtitle}</p>
          )}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Yeni sekmede aç
        </a>
      </div>

      <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white overflow-hidden min-h-[60vh]">
        {screen.embedExternal ? (
          <iframe
            title={screen.title}
            src={url}
            className="w-full h-full min-h-[60vh] border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
          />
        ) : (
          <div className="p-6 text-center text-[13px] text-slate-600">
            <p>Bu ekran harici uygulamada açılır.</p>
            <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-600 font-semibold">
              {url}
            </a>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400">
        Raporlama adresi: <span className="font-mono">{RAPORLAMA_BASE_URL}</span>
        {' '}— değiştirmek için <span className="font-mono">VITE_RAPORLAMA_URL</span> kullan.
      </p>
    </div>
  );
};
