/** SELECT … FROM arasından / sonuçtan kolon adlarını çıkarır */

/** SQL alias / kolon ifadelerinden kabaca isim listesi (test sonucu yoksa yedek) */
export function extractColumnsFromSql(sql: string): string[] {
  if (!sql?.trim()) return [];
  const cleaned = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Son SELECT … FROM (CTE / alt sorgular için)
  const matches = [...cleaned.matchAll(/\bSELECT\b([\s\S]+?)\bFROM\b/gi)];
  const selectList = matches.length ? matches[matches.length - 1][1] : '';
  if (!selectList) return [];

  if (/^\s*\*/.test(selectList.trim())) return [];

  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < selectList.length; i++) {
    const ch = selectList[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  const names: string[] = [];
  for (const p of parts) {
    // AS [Kolon Adı] / AS "Kolon" / AS 'Kolon' / AS Kolon
    const asBracket = p.match(/\bas\s+\[([^\]]+)\]\s*$/i);
    if (asBracket) {
      names.push(asBracket[1].trim());
      continue;
    }
    const asDq = p.match(/\bas\s+"([^"]+)"\s*$/i);
    if (asDq) {
      names.push(asDq[1].trim());
      continue;
    }
    const asSq = p.match(/\bas\s+'([^']+)'\s*$/i);
    if (asSq) {
      names.push(asSq[1].trim());
      continue;
    }
    const asPlain = p.match(/\bas\s+([^\s,]+)\s*$/i);
    if (asPlain) {
      names.push(asPlain[1].replace(/^\[|\]$/g, '').trim());
      continue;
    }
    // tablo.[kolon] veya [kolon]
    const bracket = p.match(/\[([^\]]+)\]\s*$/);
    if (bracket) {
      names.push(bracket[1].trim());
      continue;
    }
    const simple = p.match(/(?:^|[\s.])([A-Za-z_\u00C0-\u024F][\w\u00C0-\u024F]*)\s*$/);
    if (
      simple &&
      !/^(select|case|when|then|else|end|null|cast|convert|distinct|top|into)$/i.test(simple[1])
    ) {
      names.push(simple[1]);
    }
  }
  return [...new Set(names.filter(Boolean))];
}

export function mergeColumnLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const c of list) {
      const key = c.trim();
      if (!key) continue;
      const low = key.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(key);
    }
  }
  return out;
}
