/**
 * Ek alan formülleri için küçük ve güvenli ifade değerlendirici.
 * eval / new Function kullanmaz; yalnızca aşağıdaki dilbilgisini çözer.
 *
 *   [Alan]  veya  Alan        → kayıttaki alan değeri
 *   1234    '  metin  '       → sabit
 *   + - * / %  ( )            → aritmetik ( + metinlerde birleştirir )
 *   = <> < <= > >=  AND OR    → karşılaştırma (IF içinde)
 *   IF(k; a; b) ROUND(x; n) ABS MIN MAX LEN UPPER LOWER CONCAT TODAY YEAR MONTH DAY
 *
 * Argüman ayracı hem ';' hem ',' olabilir.
 */

export type FormulaValue = string | number | boolean | null;

export interface FormulaResult {
  value: FormulaValue;
  error?: string;
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'field'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'sep' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const WORD_OPS = new Set(['AND', 'OR', 'NOT']);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '[') {
      const end = src.indexOf(']', i + 1);
      if (end < 0) throw new Error('Kapanmayan [ ] ');
      out.push({ kind: 'field', value: src.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw new Error('Kapanmayan tırnak');
      out.push({ kind: 'str', value: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const num = Number(src.slice(i, j));
      if (!Number.isFinite(num)) throw new Error(`Geçersiz sayı: ${src.slice(i, j)}`);
      out.push({ kind: 'num', value: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      out.push(
        WORD_OPS.has(word.toUpperCase())
          ? { kind: 'op', value: word.toUpperCase() }
          : { kind: 'name', value: word },
      );
      i = j;
      continue;
    }
    if (ch === '(') {
      out.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      out.push({ kind: 'rparen' });
      i++;
      continue;
    }
    if (ch === ';' || ch === ',') {
      out.push({ kind: 'sep' });
      i++;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
      out.push({ kind: 'op', value: two === '!=' ? '<>' : two });
      i += 2;
      continue;
    }
    if ('+-*/%=<>'.includes(ch)) {
      out.push({ kind: 'op', value: ch });
      i++;
      continue;
    }
    throw new Error(`Beklenmeyen karakter: ${ch}`);
  }
  return out;
}

function toNum(v: FormulaValue): number {
  if (v === null || v === '' || v === false) return 0;
  if (v === true) return 1;
  if (typeof v === 'number') return v;
  const cleaned = String(v).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(/[,]/.test(String(v)) ? cleaned : String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: FormulaValue): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? '1' : '';
  return String(v);
}

function callFunction(name: string, args: FormulaValue[]): FormulaValue {
  switch (name.toUpperCase()) {
    case 'IF':
      return args[0] ? (args[1] ?? null) : (args[2] ?? null);
    case 'ROUND': {
      const p = Math.max(0, Math.min(10, Math.trunc(toNum(args[1] ?? 0))));
      const f = 10 ** p;
      return Math.round(toNum(args[0]) * f) / f;
    }
    case 'ABS':
      return Math.abs(toNum(args[0]));
    case 'MIN':
      return Math.min(...args.map(toNum));
    case 'MAX':
      return Math.max(...args.map(toNum));
    case 'LEN':
      return toStr(args[0]).length;
    case 'UPPER':
      return toStr(args[0]).toLocaleUpperCase('tr-TR');
    case 'LOWER':
      return toStr(args[0]).toLocaleLowerCase('tr-TR');
    case 'TRIM':
      return toStr(args[0]).trim();
    case 'CONCAT':
      return args.map(toStr).join('');
    case 'LEFT':
      return toStr(args[0]).slice(0, Math.max(0, Math.trunc(toNum(args[1]))));
    case 'RIGHT': {
      const n = Math.max(0, Math.trunc(toNum(args[1])));
      return n === 0 ? '' : toStr(args[0]).slice(-n);
    }
    case 'TODAY':
      return new Date().toISOString().slice(0, 10);
    case 'YEAR':
      return new Date(toStr(args[0])).getFullYear() || 0;
    case 'MONTH':
      return new Date(toStr(args[0])).getMonth() + 1 || 0;
    case 'DAY':
      return new Date(toStr(args[0])).getDate() || 0;
    default:
      throw new Error(`Bilinmeyen fonksiyon: ${name}`);
  }
}

export const FORMULA_FUNCTIONS = [
  'IF', 'ROUND', 'ABS', 'MIN', 'MAX', 'LEN', 'UPPER', 'LOWER', 'TRIM',
  'CONCAT', 'LEFT', 'RIGHT', 'TODAY', 'YEAR', 'MONTH', 'DAY',
];

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly lookup: (name: string) => FormulaValue,
  ) {}

  parse(): FormulaValue {
    const v = this.parseOr();
    if (this.pos < this.tokens.length) throw new Error('Formül sonunda fazlalık var');
    return v;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private eatOp(...ops: string[]): string | null {
    const t = this.peek();
    if (t?.kind === 'op' && ops.includes(t.value)) {
      this.pos++;
      return t.value;
    }
    return null;
  }

  private parseOr(): FormulaValue {
    let left = this.parseAnd();
    while (this.eatOp('OR')) left = Boolean(left) || Boolean(this.parseAnd());
    return left;
  }

  private parseAnd(): FormulaValue {
    let left = this.parseCompare();
    while (this.eatOp('AND')) left = Boolean(left) && Boolean(this.parseCompare());
    return left;
  }

  private parseCompare(): FormulaValue {
    const left = this.parseAdd();
    const op = this.eatOp('=', '<>', '<', '<=', '>', '>=');
    if (!op) return left;
    const right = this.parseAdd();
    const bothText = typeof left === 'string' && typeof right === 'string';
    const a = bothText ? toStr(left) : toNum(left);
    const b = bothText ? toStr(right) : toNum(right);
    switch (op) {
      case '=': return a === b;
      case '<>': return a !== b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      default: return a >= b;
    }
  }

  private parseAdd(): FormulaValue {
    let left = this.parseMul();
    for (;;) {
      const op = this.eatOp('+', '-');
      if (!op) return left;
      const right = this.parseMul();
      if (op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        left = toStr(left) + toStr(right);
      } else {
        left = op === '+' ? toNum(left) + toNum(right) : toNum(left) - toNum(right);
      }
    }
  }

  private parseMul(): FormulaValue {
    let left = this.parseUnary();
    for (;;) {
      const op = this.eatOp('*', '/', '%');
      if (!op) return left;
      const right = toNum(this.parseUnary());
      if ((op === '/' || op === '%') && right === 0) throw new Error('Sıfıra bölme');
      const a = toNum(left);
      left = op === '*' ? a * right : op === '/' ? a / right : a % right;
    }
  }

  private parseUnary(): FormulaValue {
    if (this.eatOp('-')) return -toNum(this.parseUnary());
    if (this.eatOp('+')) return toNum(this.parseUnary());
    if (this.eatOp('NOT')) return !this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaValue {
    const t = this.peek();
    if (!t) throw new Error('Formül eksik');
    this.pos++;

    if (t.kind === 'num') return t.value;
    if (t.kind === 'str') return t.value;
    if (t.kind === 'field') return this.lookup(t.value);
    if (t.kind === 'lparen') {
      const v = this.parseOr();
      if (this.peek()?.kind !== 'rparen') throw new Error('Kapanmayan parantez');
      this.pos++;
      return v;
    }
    if (t.kind === 'name') {
      if (this.peek()?.kind !== 'lparen') return this.lookup(t.value);
      this.pos++; // (
      const args: FormulaValue[] = [];
      if (this.peek()?.kind !== 'rparen') {
        for (;;) {
          args.push(this.parseOr());
          if (this.peek()?.kind === 'sep') {
            this.pos++;
            continue;
          }
          break;
        }
      }
      if (this.peek()?.kind !== 'rparen') throw new Error(`${t.value}( ... ) kapanmadı`);
      this.pos++;
      return callFunction(t.value, args);
    }
    throw new Error('Formül okunamadı');
  }
}

/** Formülde geçen alan adları — bağımlılık takibi için */
export function formulaFieldRefs(formula: string): string[] {
  try {
    const names = tokenize(formula)
      .filter((t, i, arr): t is Extract<Token, { kind: 'field' | 'name' }> => {
        if (t.kind === 'field') return true;
        if (t.kind !== 'name') return false;
        return arr[i + 1]?.kind !== 'lparen';
      })
      .map((t) => t.value);
    return [...new Set(names)];
  } catch {
    return [];
  }
}

export function evaluateFormula(
  formula: string,
  values: Record<string, unknown>,
): FormulaResult {
  if (!formula.trim()) return { value: null };
  const index = new Map<string, unknown>();
  for (const [k, v] of Object.entries(values)) index.set(k.toLocaleLowerCase('tr-TR'), v);

  try {
    const parser = new Parser(tokenize(formula), (name) => {
      const raw = index.get(name.toLocaleLowerCase('tr-TR'));
      if (raw === undefined || raw === null) return null;
      if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') return raw;
      return String(raw);
    });
    return { value: parser.parse() };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : 'Formül hatası' };
  }
}

/** Hesaplanan değeri alanın veri tipine çevirir */
export function coerceFormulaValue(
  value: FormulaValue,
  dataType: 'text' | 'date' | 'float',
): string | number | null {
  if (value === null) return null;
  if (dataType === 'float') {
    const n = toNum(value);
    return Number.isFinite(n) ? n : null;
  }
  if (dataType === 'date') {
    const s = toStr(value).trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
  }
  return toStr(value);
}
