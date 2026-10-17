/**
 * Excel'den kopyalanan hücreleri (sekme / satır sonu ile ayrılmış metin) fiş kalem tablosuna aktarma.
 * - İlk satır sütun başlıklarıysa (Malzeme Kodu, Miktar, Fiyat…) sütunlar başlığa göre eşlenir.
 * - Seçim (lookup) alanlarında koddan / addan kayıt bulunur; malzemede barkod da denenir.
 * - Sayılar «1.234,56» ve «1,234.56» biçimlerinde okunur; tarih gg.aa.yyyy → yyyy-aa-gg.
 */
import { FormFieldDto } from '../types/formTypes';
import { listRecords } from '../api/recordsApi';
import { loadLookupOptions, lookupSourceForField, LookupOption } from '../api/lookupApi';
import { displayToIso } from './dateFormat';
import { resolveBarcode } from '../api/barcodesApi';

/** Panodaki tabloyu hücrelere böl (Excel: \t ve \r\n; tırnaklı hücre içi satır sonu desteklenir) */
export function parseClipboardGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Sondaki tamamen boş satırları at
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
  return rows.map((r) => r.map((c) => c.trim()));
}

/** «1.234,56» / «1,234.56» / «12,5» / «%18» → sayı */
export function parseLocaleNumber(raw: string): number | null {
  let s = raw.replace(/[\s%₺$€]/g, '').replace(/TL$/i, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/g, ' ')
    .trim();

/** Başlık eş anlamlıları (alan adı → olası Excel başlıkları) */
const HEADER_SYNONYMS: Record<string, string[]> = {
  ItemsID: ['malzeme kodu', 'malzeme', 'stok kodu', 'ürün kodu', 'urun kodu', 'kod', 'kodu', 'barkod', 'item', 'code'],
  ProductCardID: ['malzeme kodu', 'malzeme', 'stok kodu', 'ürün kodu', 'urun kodu', 'kod', 'kodu', 'barkod', 'item', 'code'],
  Description: ['açıklama', 'aciklama', 'malzeme adı', 'malzeme adi', 'ürün adı', 'urun adi', 'stok adı', 'ad', 'adı', 'tanım', 'name'],
  Quantity: ['miktar', 'adet', 'qty', 'quantity'],
  Price: ['fiyat', 'birim fiyat', 'birim fiyatı', 'price'],
  UnitID: ['birim', 'unit', 'ölçü birimi'],
  TotalDiscount: ['iskonto', 'indirim', 'discount'],
  TaxRate: ['kdv', 'kdv oranı', 'vergi oranı', '%'],
  CustomerID: ['cari', 'cari kodu', 'cari hesap'],
  AccountID: ['hesap', 'hesap kodu', 'muhasebe hesabı', 'hesap no'],
  Debit: ['borç', 'borc'],
  Credit: ['alacak'],
  Amount: ['tutar', 'amount'],
  DueDate: ['vade', 'vade tarihi'],
};

/** İlk satır başlık mı? Öyleyse her sütunun alanını döndürür (eşleşmeyen sütun null) */
export function matchHeaderRow(cells: string[], fields: FormFieldDto[]): (FormFieldDto | null)[] | null {
  let hits = 0;
  const used = new Set<string>();
  const mapped = cells.map((c) => {
    const h = norm(c);
    if (!h) return null;
    const f =
      fields.find((x) => !used.has(x.fieldName) && (norm(x.label) === h || norm(x.fieldName) === h)) ??
      fields.find(
        (x) => !used.has(x.fieldName) && (HEADER_SYNONYMS[x.fieldName] || []).some((syn) => norm(syn) === h),
      ) ??
      null;
    if (f) {
      used.add(f.fieldName);
      hits++;
    }
    return f;
  });
  // Başlık kabulü: en az iki sütun eşleşmeli ve satırda sayı ağırlığı olmamalı
  const numeric = cells.filter((c) => parseLocaleNumber(c) != null).length;
  return hits >= 2 && numeric < hits ? mapped : null;
}

const PRODUCT_FIELDS = new Set(['ItemsID', 'ProductCardID', 'SubProductCardID', 'MainProductCardID']);

function optionCode(o: LookupOption): string {
  return o.label.split(' — ')[0]?.trim() ?? '';
}
function optionTitle(o: LookupOption): string {
  const i = o.label.indexOf(' — ');
  return i > -1 ? o.label.slice(i + 3).trim() : o.label.trim();
}

/** Lookup alanında koddan / addan / barkoddan kayıt ID'si (bulunamazsa null) — sonuçlar önbelleğe alınır */
export function createLookupResolver() {
  const cache = new Map<string, Promise<string | null>>();
  /** Birim barkodundan okunan miktarlar (metin → miktar) */
  const barcodeQty = new Map<string, number>();
  const resolve = (fieldName: string, text: string): Promise<string | null> => {
    const key = `${fieldName}|${text.toLocaleLowerCase('tr-TR')}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const p = (async () => {
      const want = text.trim();
      if (!want) return null;
      const lw = want.toLocaleLowerCase('tr-TR');
      const opts = (await loadLookupOptions(fieldName)) || [];
      const byCode = opts.find((o) => optionCode(o).toLocaleLowerCase('tr-TR') === lw);
      if (byCode) return byCode.value;
      const byLabel = opts.find(
        (o) => o.label.toLocaleLowerCase('tr-TR') === lw || optionTitle(o).toLocaleLowerCase('tr-TR') === lw,
      );
      if (byLabel) return byLabel.value;

      // Listede yoksa (ilk 500 kayıt dışı) doğrudan tabloda kod ile ara
      const src = lookupSourceForField(fieldName);
      if (src) {
        try {
          const res = await listRecords(src.table, {
            pk: src.pk,
            filterColumn: src.codeCols[0],
            filterValue: want,
            take: 2,
          });
          const row = (res.rows as Record<string, unknown>[])[0];
          if (row && row[src.pk] != null) return String(row[src.pk]);
        } catch {
          /* yoksay */
        }
      }
      // Malzeme: barkod (birim barkodunda miktar da okunur: 27000000500 → 500)
      if (PRODUCT_FIELDS.has(fieldName)) {
        try {
          const r = await resolveBarcode(want);
          if (r.found) {
            if (r.quantity != null) barcodeQty.set(want, r.quantity);
            return String(r.productCardID);
          }
        } catch {
          /* yoksay */
        }
      }
      return null;
    })();
    cache.set(key, p);
    return p;
  };
  return Object.assign(resolve, { barcodeQty });
}

/** Basit select: değer veya etiketle eşle («1 — Satış», «Satış», «1») */
export function matchSelectOption(field: FormFieldDto, text: string): string | null {
  if (!field.optionsJson) return null;
  let opts: { label: string; value: string }[] = [];
  try {
    opts = JSON.parse(field.optionsJson);
  } catch {
    return null;
  }
  const lw = text.trim().toLocaleLowerCase('tr-TR');
  const hit =
    opts.find((o) => String(o.value).toLocaleLowerCase('tr-TR') === lw) ??
    opts.find((o) => o.label.toLocaleLowerCase('tr-TR') === lw) ??
    opts.find((o) => o.label.toLocaleLowerCase('tr-TR').replace(/^\S+\s+—\s+/, '') === lw) ??
    opts.find((o) => o.label.toLocaleLowerCase('tr-TR').startsWith(lw));
  return hit ? String(hit.value) : null;
}

/** Tarih: gg.aa.yyyy / gg/aa/yyyy / yyyy-aa-gg / Excel seri numarası */
export function parsePastedDate(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  if (/^\d{5}$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const iso = displayToIso(t.replace(/\//g, '.').replace(/-/g, '.'));
  return iso || null;
}
