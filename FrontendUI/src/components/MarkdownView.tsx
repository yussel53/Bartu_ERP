import React from 'react';

/**
 * Yardım sayfaları için küçük ve güvenli markdown çizici (HTML enjekte edilmez):
 * başlık, paragraf, liste (madde / numaralı), tablo, kod bloğu, satır içi kalın / italik / kod / bağlantı.
 * Bağlantı «sayfa-adi» ya da «sayfa-adi#bolum» ise yardım içinde açılır (onNavigate).
 */
interface Props {
  markdown: string;
  onNavigate?: (slug: string, anchor?: string) => void;
}

export const slugify = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function inline(text: string, onNavigate: Props['onNavigate'], keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const rx = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = rx.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith('`')) out.push(<code key={k} className="px-1 rounded bg-slate-100 text-[0.92em] font-mono text-slate-800">{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('*')) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t) ?? [];
      const external = /^https?:/i.test(href);
      out.push(
        external ? (
          <a key={k} href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline">
            {label}
          </a>
        ) : (
          <button
            key={k}
            type="button"
            onClick={() => {
              const [slug, anchor] = href.split('#');
              onNavigate?.(slug, anchor);
            }}
            className="text-blue-700 underline"
          >
            {label}
          </button>
        ),
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const MarkdownView: React.FC<Props> = ({ markdown, onNavigate }) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Kod bloğu
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={k()} className="my-2 p-2 rounded bg-slate-900 text-slate-100 text-[11px] overflow-auto">
          {body.join('\n')}
        </pre>,
      );
      continue;
    }
    // Başlık
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const cls =
        level === 1
          ? 'text-[18px] font-semibold text-slate-900 mt-1 mb-2'
          : level === 2
            ? 'text-[15px] font-semibold text-slate-800 mt-4 mb-1.5 pb-1 border-b border-slate-200'
            : 'text-[13px] font-semibold text-slate-800 mt-3 mb-1';
      const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
      blocks.push(
        <Tag key={k()} id={slugify(text)} className={cls}>
          {inline(text, onNavigate, `h${key}`)}
        </Tag>,
      );
      i++;
      continue;
    }
    // Tablo
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={k()} className="my-2 overflow-auto">
          <table className="min-w-full text-[12px] border border-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="px-2 py-1 text-left font-semibold text-slate-700 border-b border-slate-200">
                    {inline(c, onNavigate, `th${key}${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-slate-100">
                  {r.map((c, j) => (
                    <td key={j} className="px-2 py-1 align-top text-slate-700">
                      {inline(c, onNavigate, `td${key}${ri}${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    // Liste
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={k()} className={`my-1.5 pl-5 space-y-0.5 text-[13px] text-slate-700 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, onNavigate, `li${key}${j}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    // Paragraf
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push(
      <p key={k()} className="my-1.5 text-[13px] leading-relaxed text-slate-700">
        {inline(para.join(' '), onNavigate, `p${key}`)}
      </p>,
    );
  }
  return <div>{blocks}</div>;
};
