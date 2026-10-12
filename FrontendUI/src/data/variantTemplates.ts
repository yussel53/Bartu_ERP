/** Varyant şablonu — özellik eksenleri × değerler → VariantCard kombinasyonları */

export interface VariantTemplateDim {
  code: string;
  title: string;
  /** Virgülle ayrılmış değerler: S,M,L */
  values: string[];
}

export interface VariantTemplateDef {
  id: string;
  code: string;
  title: string;
  dims: VariantTemplateDim[];
}

/** Örnek şablonlar (API bağlanana kadar UI / üretici kaynağı) */
export const SAMPLE_VARIANT_TEMPLATES: VariantTemplateDef[] = [
  {
    id: '1',
    code: 'BEDEN-RENK',
    title: 'Beden × Renk',
    dims: [
      { code: 'BEDEN', title: 'Beden', values: ['S', 'M', 'L', 'XL'] },
      { code: 'RENK', title: 'Renk', values: ['Kırmızı', 'Mavi', 'Siyah'] },
    ],
  },
  {
    id: '2',
    code: 'BEDEN',
    title: 'Sadece Beden',
    dims: [{ code: 'BEDEN', title: 'Beden', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }],
  },
  {
    id: '3',
    code: 'VOLTAJ',
    title: 'Voltaj',
    dims: [{ code: 'V', title: 'Voltaj', values: ['12V', '24V', '220V'] }],
  },
];

export function parseValuesText(text: string): string[] {
  return String(text || '')
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function variantTemplateSelectOptions(
  templates: VariantTemplateDef[] = SAMPLE_VARIANT_TEMPLATES,
): { label: string; value: string }[] {
  return templates.map((t) => ({
    label: `${t.code} — ${t.title}`,
    value: t.id,
  }));
}

function cartesian(dims: VariantTemplateDim[]): string[][] {
  const lists = dims.map((d) => (d.values.length ? d.values : ['']));
  return lists.reduce<string[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((v) => [...prefix, v])),
    [[]],
  );
}

/** Şablondan VariantCard satırları üretir */
export function generateVariantsFromTemplate(
  template: VariantTemplateDef,
  opts?: { productCode?: string; productTitle?: string },
): { Code: string; Title: string; UnitID: string }[] {
  const dims = template.dims.filter((d) => d.values.length > 0);
  if (!dims.length) return [];

  const productCode = (opts?.productCode || '').trim();
  const productTitle = (opts?.productTitle || '').trim();
  const combos = cartesian(dims);

  return combos.map((parts) => {
    const codeSuffix = parts.join('-');
    const titleSuffix = parts.join(' / ');
    return {
      Code: productCode ? `${productCode}-${codeSuffix}` : codeSuffix,
      Title: productTitle ? `${productTitle} — ${titleSuffix}` : titleSuffix,
      UnitID: '',
    };
  });
}

export function findVariantTemplate(
  id: string,
  templates: VariantTemplateDef[] = SAMPLE_VARIANT_TEMPLATES,
): VariantTemplateDef | undefined {
  return templates.find((t) => t.id === String(id));
}
