import React, { useEffect, useState } from 'react';
import { BookOpen, Loader2, Search } from 'lucide-react';
import { apiJson } from '../config/api';
import { MarkdownView } from '../components/MarkdownView';

interface HelpItem {
  slug: string;
  title: string;
  order: number;
}

/** Yardım: sayfalar sunucudan yalnız oturum açıkken gelir (program dışından erişilemez) */
export const HelpPage: React.FC<{ slug?: string; onNavigate: (path: string) => void }> = ({ slug, onNavigate }) => {
  const [list, setList] = useState<HelpItem[]>([]);
  const [page, setPage] = useState<{ slug: string; title: string; markdown: string } | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ slug: string; title: string; snippet: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<HelpItem[]>('/api/help')
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const current = slug || list[0]?.slug;

  useEffect(() => {
    if (!current) return;
    const [s, anchor] = current.split('#');
    setPage(null);
    apiJson<{ slug: string; title: string; markdown: string }>(`/api/help/${encodeURIComponent(s)}`)
      .then((p) => {
        setPage(p);
        if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [current]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits(null);
      return;
    }
    const t = setTimeout(() => {
      apiJson<{ slug: string; title: string; snippet: string }[]>(`/api/help/search?q=${encodeURIComponent(q.trim())}`)
        .then(setHits)
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = (s: string, anchor?: string) => {
    setHits(null);
    setQ('');
    onNavigate(`yardim/${s}${anchor ? `#${anchor}` : ''}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3">
      <aside className="bg-white border border-slate-200 rounded-md p-2 h-fit lg:sticky lg:top-2">
        <div className="flex items-center gap-1.5 px-1 pb-2 text-[13px] font-semibold text-slate-800">
          <BookOpen className="w-4 h-4 text-blue-700" /> Yardım
        </div>
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Yardımda ara…"
            className="w-full h-7 pl-7 pr-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        {hits ? (
          <ul className="space-y-1">
            {hits.length === 0 && <li className="px-1 text-xs text-slate-400">Sonuç yok.</li>}
            {hits.map((h) => (
              <li key={h.slug}>
                <button type="button" onClick={() => go(h.slug)} className="w-full text-left px-1.5 py-1 rounded hover:bg-blue-50">
                  <div className="text-xs font-medium text-slate-800">{h.title}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-2">…{h.snippet}…</div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-0.5">
            {list.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => go(p.slug)}
                  className={`w-full text-left px-1.5 h-7 rounded text-xs ${
                    p.slug === current?.split('#')[0] ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main className="bg-white border border-slate-200 rounded-md p-4 min-h-[60vh]">
        {error && <div className="text-xs text-red-700">{error}</div>}
        {!page && !error && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Yükleniyor…
          </div>
        )}
        {page && <MarkdownView markdown={page.markdown} onNavigate={go} />}
      </main>
    </div>
  );
};
