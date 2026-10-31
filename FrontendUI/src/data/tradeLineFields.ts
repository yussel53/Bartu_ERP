import type { FormFieldDto } from '../types/formTypes';

function select(opts: { label: string; value: string }[]) {
  return JSON.stringify(opts);
}

const unitOptions = select([
  { label: 'Adet', value: '1' },
  { label: 'Kg', value: '2' },
  { label: 'Lt', value: '3' },
  { label: 'Mt', value: '4' },
]);

export const TRADE_LINE_DEFAULT_VISIBLE = [
  'LineType',
  'ProductCardID',
  'ItemsID',
  'Description',
  'Description1',
  'Description2',
  'Quantity',
  'UnitID',
  'Price',
  'TotalDiscount',
  'TaxRate',
  'TotalTax',
  'TotalPrice',
  'NetTotal',
] as const;

/** Sipariş / irsaliye / fatura ortak satır alanları */
export function buildTradeLineFields(opts: {
  baseId: number;
  /** Sipariş: ItemsID · irsaliye/fatura: ProductCardID */
  productField: 'ItemsID' | 'ProductCardID';
  descriptionField?: 'Description' | 'Description1';
  includeSerialLot?: boolean;
  includeCostDims?: boolean;
}): FormFieldDto[] {
  const {
    baseId,
    productField,
    descriptionField = productField === 'ItemsID' ? 'Description' : 'Description1',
    includeSerialLot = false,
    includeCostDims = false,
  } = opts;

  const fields: FormFieldDto[] = [
    {
      fieldId: baseId + 1,
      fieldName: 'LineType',
      label: 'Tür',
      fieldType: 'select',
      isRequired: false,
      colSpan: 1,
      orderIndex: 1,
      defaultValue: '1',
      optionsJson: select([
        { label: 'Malzeme', value: '1' },
        { label: 'İndirim', value: '2' },
      ]),
    },
    {
      fieldId: baseId + 2,
      fieldName: productField,
      label: 'Kod',
      fieldType: 'select',
      isRequired: true,
      colSpan: 3,
      orderIndex: 2,
      optionsJson: select([
        { label: 'URN-001 — Demo Ürün', value: '1' },
        { label: 'URN-002 — Vida M8', value: '2' },
        { label: 'URN-003 — Panel 18mm', value: '3' },
      ]),
    },
    {
      fieldId: baseId + 3,
      fieldName: descriptionField,
      label: 'Açıklama',
      fieldType: 'text',
      isRequired: false,
      colSpan: 2,
      orderIndex: 3,
    },
    {
      fieldId: baseId + 4,
      fieldName: 'Description2',
      label: 'Açıklama2',
      fieldType: 'text',
      isRequired: false,
      colSpan: 2,
      orderIndex: 4,
    },
    {
      fieldId: baseId + 5,
      fieldName: 'Quantity',
      label: 'Miktar',
      fieldType: 'number',
      isRequired: true,
      colSpan: 1,
      orderIndex: 5,
    },
  ];

  if (includeSerialLot) {
    fields.push({
      fieldId: baseId + 6,
      fieldName: 'SerialLotNo',
      label: 'Lot / Seri',
      fieldType: 'text',
      isRequired: false,
      colSpan: 2,
      orderIndex: 5.5,
    });
  }

  fields.push(
    {
      fieldId: baseId + 7,
      fieldName: 'UnitID',
      label: 'Birim',
      fieldType: 'select',
      isRequired: false,
      colSpan: 1,
      orderIndex: 6,
      optionsJson: unitOptions,
    },
    {
      fieldId: baseId + 8,
      fieldName: 'Price',
      label: 'Birim Fiyat',
      fieldType: 'number',
      isRequired: true,
      colSpan: 1,
      orderIndex: 7,
    },
    {
      fieldId: baseId + 9,
      fieldName: 'TotalDiscount',
      label: 'İskonto',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 8,
    },
    {
      fieldId: baseId + 10,
      fieldName: 'TaxCardID',
      label: 'Vergi Kodu',
      fieldType: 'select',
      isRequired: false,
      colSpan: 2,
      orderIndex: 9,
      useLookup: true,
    },
    {
      fieldId: baseId + 11,
      fieldName: 'TaxRate',
      label: '%',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 10,
    },
    {
      fieldId: baseId + 12,
      fieldName: 'TotalTax',
      label: 'KDV',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 11,
    },
    {
      fieldId: baseId + 13,
      fieldName: 'TotalPrice',
      label: 'Tutar',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 12,
    },
    {
      fieldId: baseId + 14,
      fieldName: 'NetTotal',
      label: 'Net Tutar',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 13,
    },
  );

  if (includeCostDims) {
    fields.push(
      {
        fieldId: baseId + 15,
        fieldName: 'CostDimCardID1',
        label: 'İşyeri',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 2,
        orderIndex: 13.1,
        useLookup: true,
      },
      {
        fieldId: baseId + 16,
        fieldName: 'CostDimCardID2',
        label: 'Kişiler',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 2,
        orderIndex: 13.2,
        useLookup: true,
        dependentLookup: {
          parentField: 'CostDimCardID1',
          filterColumn: 'LinkedCostDimCardID',
          emptyText: 'Önce işyeri',
        },
      },
      {
        fieldId: baseId + 17,
        fieldName: 'CostDimCardID3',
        label: 'Araçlar',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 2,
        orderIndex: 13.3,
        useLookup: true,
      },
    );
  }

  fields.push({
    fieldId: baseId + 18,
    fieldName: 'AuxilCode',
    label: 'Hareket Özel Kodu',
    fieldType: 'text',
    isRequired: false,
    colSpan: 1,
    orderIndex: 14,
  });

  return fields;
}

export function tradeGridStorageKey(formCode: string) {
  return `tradeGridCols:${formCode}`;
}

export function defaultVisibleTradeCols(allKeys: string[]): string[] {
  const preferred = TRADE_LINE_DEFAULT_VISIBLE as readonly string[];
  const hit = allKeys.filter((k) => preferred.includes(k));
  return hit.length ? hit : allKeys;
}

export function loadVisibleTradeCols(formCode: string, allKeys: string[]): string[] {
  try {
    const raw = localStorage.getItem(tradeGridStorageKey(formCode));
    if (!raw) return defaultVisibleTradeCols(allKeys);
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || !parsed.length) return defaultVisibleTradeCols(allKeys);
    const hit = parsed.filter((k) => allKeys.includes(k));
    return hit.length ? hit : defaultVisibleTradeCols(allKeys);
  } catch {
    return defaultVisibleTradeCols(allKeys);
  }
}

export function saveVisibleTradeCols(formCode: string, keys: string[]) {
  localStorage.setItem(tradeGridStorageKey(formCode), JSON.stringify(keys));
}
