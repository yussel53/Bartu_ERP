import type { FormFieldDto, FormSchemaDto } from '../types/formTypes';
import { loadLookupOptions, lookupSourceForField } from '../api/lookupApi';

type Opt = { label: string; value: string };

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function parseOpts(field: FormFieldDto): Opt[] {
  if (!field.optionsJson) return [];
  try {
    const arr = JSON.parse(field.optionsJson) as Opt[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function fmtDate(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s || s.startsWith('1900-01-01')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return s;
}

function fmtNum(v: unknown): string {
  if (v == null || v === '') return '';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function isMoneyField(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes('price') ||
    n.includes('amount') ||
    n.includes('total') ||
    n.includes('debit') ||
    n.includes('credit') ||
    n.includes('tax') ||
    n.includes('discount') ||
    n === 'quantity' ||
    n.includes('rate') ||
    n.includes('net')
  );
}

function isDateField(name: string, type?: string): boolean {
  if (type === 'date' || type === 'datetime') return true;
  const n = name.toLowerCase();
  return n.includes('date') || n.endsWith('at') || n === 'voucherTime'.toLowerCase();
}

async function buildLabelMaps(
  fields: FormFieldDto[],
  values: Record<string, unknown>[],
): Promise<Map<string, Map<string, string>>> {
  const byField = new Map<string, Map<string, string>>();
  const needLoad = new Set<string>();

  for (const f of fields) {
    const map = new Map<string, string>();
    for (const o of parseOpts(f)) {
      if (o.value != null && o.value !== '') map.set(String(o.value), o.label || String(o.value));
    }
    byField.set(f.fieldName, map);
    if (f.useLookup !== false && lookupSourceForField(f.fieldName)) needLoad.add(f.fieldName);
  }

  for (const fname of needLoad) {
    const ids = new Set<string>();
    for (const row of values) {
      const raw = row[fname];
      if (raw != null && raw !== '' && raw !== 0 && raw !== '0') ids.add(String(raw));
    }
    if (ids.size === 0) continue;
    try {
      const opts = await loadLookupOptions(fname);
      if (!opts?.length) continue;
      const map = byField.get(fname) || new Map();
      for (const o of opts) {
        if (ids.has(o.value)) map.set(o.value, o.label);
      }
      byField.set(fname, map);
    } catch {
      /* etiket yoksa ham id yazılır */
    }
  }
  return byField;
}

function cell(
  field: FormFieldDto,
  raw: unknown,
  labels: Map<string, Map<string, string>>,
): string {
  if (raw == null || raw === '') return '';
  const map = labels.get(field.fieldName);
  const key = String(raw);
  if (map?.has(key)) return map.get(key)!;
  if (isDateField(field.fieldName, field.fieldType)) return fmtDate(raw);
  if (field.fieldType === 'number' || isMoneyField(field.fieldName)) return fmtNum(raw);
  if (field.fieldType === 'checkbox') return raw === true || raw === 1 || raw === '1' ? 'Evet' : 'Hayır';
  return String(raw);
}

/** Fiş formundaki anlık veriyi kaydetmeden yazdırır */
export async function printDocumentForm(args: {
  schema: FormSchemaDto;
  standardFields: Record<string, unknown>;
  lines?: Record<string, unknown>[];
  paymentPlans?: Record<string, unknown>[];
  recordId?: number;
}): Promise<void> {
  const { schema, recordId } = args;
  const sf = { ...(args.standardFields || {}), ...(schema.fixedStandardFields || {}) };
  const headerFields = (schema.fields || []).filter(
    (f) => !f.fieldName.startsWith('U_') && canShowHeader(f.fieldName),
  );
  const lineFields = (schema.lineFields || []).filter((f) =>
    ['ItemsID', 'ProductCardID', 'Description', 'Quantity', 'UnitID', 'Price', 'TotalDiscount', 'TotalPrice', 'TotalTax', 'NetTotal', 'Debit', 'Credit', 'Amount', 'TaxRate'].includes(
      f.fieldName,
    ),
  );
  const lineFieldsUse =
    lineFields.length > 0
      ? lineFields
      : (schema.lineFields || []).slice(0, 8);

  const lines = (args.lines || []).filter((r) =>
    Object.values(r).some((v) => v != null && String(v).trim() !== ''),
  );
  const payments = (args.paymentPlans || []).filter(
    (r) =>
      String(r.DueDate || '').trim() !== '' ||
      Number(r.Amount) > 0 ||
      String(r.Description || '').trim() !== '',
  );

  const headerLabels = await buildLabelMaps(headerFields, [sf]);
  const lineLabels = await buildLabelMaps(schema.lineFields || [], lines);

  const docNo =
    String(sf.DocumentNumber ?? sf.OrderSlipNo ?? sf.VoucherNo ?? '').trim() ||
    (recordId && recordId > 0 ? `#${recordId}` : 'Yeni (kayıtsız)');

  const headerRows = headerFields
    .map((f) => {
      const v = cell(f, sf[f.fieldName], headerLabels);
      if (!v) return '';
      return `<tr><th>${esc(f.label)}</th><td>${esc(v)}</td></tr>`;
    })
    .filter(Boolean)
    .join('');

  const lineHead = lineFieldsUse.map((f) => `<th>${esc(f.label)}</th>`).join('');
  const lineBody = lines
    .map((row, i) => {
      const tds = lineFieldsUse
        .map((f) => {
          const align =
            f.fieldType === 'number' || isMoneyField(f.fieldName) ? ' class="n"' : '';
          return `<td${align}>${esc(cell(f, row[f.fieldName], lineLabels))}</td>`;
        })
        .join('');
      return `<tr><td class="n">${i + 1}</td>${tds}</tr>`;
    })
    .join('');

  const sumNet = lines.reduce((a, r) => a + (Number(r.NetTotal) || Number(r.TotalPrice) || 0), 0);
  const sumTax = lines.reduce((a, r) => a + (Number(r.TotalTax) || 0), 0);
  const sumGross = lines.reduce(
    (a, r) => a + (Number(r.TotalPrice) || Number(r.Amount) || Number(r.Debit) || Number(r.Credit) || 0),
    0,
  );

  const payBody = payments
    .map(
      (r, i) =>
        `<tr><td class="n">${i + 1}</td><td>${esc(fmtDate(r.DueDate))}</td><td class="n">${esc(fmtNum(r.Amount))}</td><td class="n">${esc(fmtNum(r.RatePercent))}</td><td>${esc(r.Description ?? '')}</td></tr>`,
    )
    .join('');

  const w = window.open('', '_blank', 'width=960,height=720');
  if (!w) {
    throw new Error('Açılır pencere engellendi — yazdırma için izin verin.');
  }

  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>${esc(schema.title)} · ${esc(docNo)}</title>
<style>
body{font:12px "Segoe UI",system-ui,sans-serif;color:#0f172a;margin:18px 22px;background:#fff}
.toolbar{display:flex;gap:8px;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e2e8f0}
.toolbar button{font:12px inherit;padding:6px 12px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;cursor:pointer}
.toolbar button.primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
.badge{font-size:10px;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;padding:2px 8px;border-radius:999px}
h1{font-size:18px;margin:0 0 2px}.muted{color:#64748b;font-size:11px}
.meta{display:flex;justify-content:space-between;gap:16px;margin:12px 0 16px;align-items:flex-end}
table.hdr{border-collapse:collapse;width:100%;max-width:640px}table.hdr th{text-align:left;color:#64748b;font-weight:600;padding:2px 10px 2px 0;white-space:nowrap;vertical-align:top}
table.hdr td{padding:2px 0}
table.grid{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
table.grid th,table.grid td{border:1px solid #e2e8f0;padding:4px 6px;text-align:left}
table.grid th{background:#f1f5f9;font-weight:600}
.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.tot{margin-top:10px;text-align:right;font-size:12px}.tot b{font-size:13px}
h2{font-size:13px;margin:18px 0 6px;color:#334155}
@media print{.toolbar{display:none}body{margin:8mm}}
</style></head><body>
<div class="toolbar">
  <button class="primary" type="button" onclick="window.print()">Yazdır / PDF</button>
  <button type="button" onclick="window.close()">Kapat</button>
  <span class="badge">Kaydetmeden yazdır · önizleme</span>
</div>
<div class="meta">
  <div>
    <div class="muted">${esc(schema.tableName)}</div>
    <h1>${esc(schema.title)}</h1>
    <div>Belge No: <b>${esc(docNo)}</b></div>
  </div>
  <div class="muted" style="text-align:right">
    Yazdırma: ${esc(new Date().toLocaleString('tr-TR'))}<br>
    ${recordId && recordId > 0 ? `Kayıt #${esc(recordId)}` : 'Henüz kaydedilmedi'}
  </div>
</div>
<table class="hdr"><tbody>${headerRows}</tbody></table>
${
  lineFieldsUse.length && lines.length
    ? `<h2>Kalemler (${lines.length})</h2>
<table class="grid"><thead><tr><th>#</th>${lineHead}</tr></thead><tbody>${lineBody}</tbody></table>
<div class="tot">
  ${sumGross ? `Ara toplam: <b>${esc(fmtNum(sumGross))}</b>` : ''}
  ${sumTax ? ` · KDV: <b>${esc(fmtNum(sumTax))}</b>` : ''}
  ${sumNet ? ` · Net: <b>${esc(fmtNum(sumNet))}</b>` : ''}
</div>`
    : lines.length === 0 && schema.lineFields?.length
      ? '<p class="muted">Kalem satırı yok.</p>'
      : ''
}
${
  payments.length
    ? `<h2>Ödeme planı</h2>
<table class="grid"><thead><tr><th>#</th><th>Vade</th><th class="n">Tutar</th><th class="n">Oran %</th><th>Açıklama</th></tr></thead>
<tbody>${payBody}</tbody></table>`
    : ''
}
</body></html>`);
  w.document.close();
}

function canShowHeader(name: string): boolean {
  const skip = new Set([
    'AdditionalFields',
    'CreatedAt',
    'UpdatedAt',
    'CreatedUserID',
    'UpdatedUserID',
    'GUID',
  ]);
  return !skip.has(name);
}
