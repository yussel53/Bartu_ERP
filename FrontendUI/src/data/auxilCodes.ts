import type { FormFieldDto } from '../types/formTypes';

/** AuxilCodeTrans.ModuleNr — kart/fiş ayrımı */
export const AUXIL_MODULE_NR: Record<string, number> = {
  ProductCard: 1,
  CustomerCard: 2,
  BankCard: 3,
  SafeCard: 4,
  BankAccountCard: 5,
  TaxCard: 6,
  OrderVoucher: 10,
  Invoice: 11,
  ProductVoucher: 12,
  BankVoucher: 13,
  CustomerVoucher: 14,
  AccountVoucher: 15,
  PaymentTrans: 16,
  BoundTrans: 17,
};

/** Tanım ekranında hedef seçenekleri */
export const AUXIL_TARGET_OPTIONS = [
  { label: 'Cari Kart', value: 'CustomerCard' },
  { label: 'Malzeme Kartı', value: 'ProductCard' },
  { label: 'Banka Kartı', value: 'BankCard' },
  { label: 'Kasa Kartı', value: 'SafeCard' },
  { label: 'Vergi Kartı', value: 'TaxCard' },
  { label: 'Sipariş', value: 'OrderVoucher' },
  { label: 'Fatura', value: 'Invoice' },
  { label: 'İrsaliye / Malzeme Fişi', value: 'ProductVoucher' },
  { label: 'Banka Fişi', value: 'BankVoucher' },
  { label: 'Cari Fiş', value: 'CustomerVoucher' },
  { label: 'Muhasebe Fişi', value: 'AccountVoucher' },
  { label: 'Ödeme Hareketi', value: 'PaymentTrans' },
  { label: 'Çek / Senet', value: 'BoundTrans' },
] as const;

export const AUXIL_VALUE_KIND = {
  Code: 1,
  Description: 2,
} as const;

export const AUXIL_CODE_CARD_TABLES = new Set([
  'CustomerCard',
  'ProductCard',
  'BankCard',
  'SafeCard',
  'TaxCard',
]);

export const AUXIL_CODE_VOUCHER_TABLES = new Set([
  'OrderVoucher',
  'Invoice',
  'ProductVoucher',
  'BankVoucher',
  'CustomerVoucher',
  'AccountVoucher',
  'PaymentTrans',
  'BoundTrans',
]);

export function auxilModuleNrForTable(tableName: string): number {
  return AUXIL_MODULE_NR[tableName] ?? 0;
}

/** Tanım kartı → AuxilCodeValue satır alanları */
export function buildAuxilValueFields(baseId = 9200): FormFieldDto[] {
  return [
    {
      fieldId: baseId + 1,
      fieldName: 'ValueKind',
      label: 'Tür',
      fieldType: 'select',
      isRequired: true,
      colSpan: 3,
      orderIndex: 1,
      optionsJson: JSON.stringify([
        { label: 'Kod değeri', value: '1' },
        { label: 'Açıklama seçeneği', value: '2' },
      ]),
      defaultValue: '1',
    },
    {
      fieldId: baseId + 2,
      fieldName: 'Code',
      label: 'Kod',
      fieldType: 'text',
      isRequired: true,
      colSpan: 3,
      orderIndex: 2,
    },
    {
      fieldId: baseId + 3,
      fieldName: 'Title',
      label: 'Görünen Ad',
      fieldType: 'text',
      isRequired: true,
      colSpan: 4,
      orderIndex: 3,
    },
    {
      fieldId: baseId + 4,
      fieldName: 'SortOrder',
      label: 'Sıra',
      fieldType: 'number',
      isRequired: false,
      colSpan: 2,
      orderIndex: 4,
      defaultValue: '10',
    },
  ];
}

/** Kart/fiş atama satırı — UI özel editör kullanır; şema alanları yedek */
export function buildAuxilCodeFields(baseId = 9100): FormFieldDto[] {
  return [
    {
      fieldId: baseId + 1,
      fieldName: 'LineNr',
      label: 'No',
      fieldType: 'number',
      isRequired: false,
      colSpan: 1,
      orderIndex: 1,
    },
    {
      fieldId: baseId + 2,
      fieldName: 'AuxilCodesID',
      label: 'Özel Kod Tanımı',
      fieldType: 'select',
      isRequired: true,
      colSpan: 3,
      orderIndex: 2,
    },
    {
      fieldId: baseId + 3,
      fieldName: 'AuxilCode',
      label: 'Özel Kod',
      fieldType: 'select',
      isRequired: true,
      colSpan: 3,
      orderIndex: 3,
    },
    {
      fieldId: baseId + 4,
      fieldName: 'Definition',
      label: 'Açıklama',
      fieldType: 'select',
      isRequired: false,
      colSpan: 3,
      orderIndex: 4,
    },
    {
      fieldId: baseId + 5,
      fieldName: 'TransDate',
      label: 'Tarih',
      fieldType: 'date',
      isRequired: false,
      colSpan: 2,
      orderIndex: 5,
    },
  ];
}

export function defaultAuxilCodeRow(lineNr = 1): Record<string, unknown> {
  return {
    LineNr: lineNr,
    AuxilCodesID: '',
    AuxilCodeValueID: '',
    AuxilCode: '',
    Definition: '',
    TransDate: '',
  };
}

export function defaultAuxilValueRow(
  kind: number = AUXIL_VALUE_KIND.Code,
  sortOrder = 10,
): Record<string, unknown> {
  return {
    ValueKind: String(kind),
    Code: '',
    Title: '',
    SortOrder: sortOrder,
    IsActive: true,
  };
}
