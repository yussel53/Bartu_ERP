/**
 * Kart / muhasebe bağlantısı (AccountLinkDetail)
 * Module + Type: fiş/işlem türüne göre seçenekler
 * ConditionTitle / ConditionJson: koşul ekranı
 */
import { FormFieldDto } from '../types/formTypes';
import {
  DispatchType,
  InvoiceType,
  InvoiceTypeLabels,
  BANK_VOUCHER_TYPE_OPTIONS,
  BOUND_TRANS_TYPE_OPTIONS,
  CUSTOMER_VOUCHER_TYPE_OPTIONS,
} from './documentTypes';

export const AccountLinkModule = {
  Product: 1,
  Customer: 2,
  BankAccount: 3,
  Safe: 4,
  Bound: 5,
  Tax: 6,
  Invoice: 7,
} as const;

export type AccountLinkModuleValue =
  (typeof AccountLinkModule)[keyof typeof AccountLinkModule];

export const ACCOUNT_LINK_MODULE_OPTIONS = [
  { label: 'Malzeme', value: String(AccountLinkModule.Product) },
  { label: 'Cari', value: String(AccountLinkModule.Customer) },
  { label: 'Banka', value: String(AccountLinkModule.BankAccount) },
  { label: 'Kasa', value: String(AccountLinkModule.Safe) },
  { label: 'Çek / Senet', value: String(AccountLinkModule.Bound) },
  { label: 'KDV', value: String(AccountLinkModule.Tax) },
  { label: 'Fatura', value: String(AccountLinkModule.Invoice) },
];

/** Cari / banka kart — tek kart muhasebe kodu */
export const AccountLinkType = {
  Kart: 1,
} as const;

/** Malzeme kartı sabit satırları (Alış / Satış / İade) */
export const ProductAccountLinkType = {
  Alis: 1,
  Satis: 2,
  Iade: 3,
} as const;

export const AccountLinkTypeLabels: Record<string, string> = {
  [String(AccountLinkType.Kart)]: 'Kart Muhasebe Kodu',
};

export const ProductAccountLinkTypeLabels: Record<string, string> = {
  [String(ProductAccountLinkType.Alis)]: 'Alış',
  [String(ProductAccountLinkType.Satis)]: 'Satış',
  [String(ProductAccountLinkType.Iade)]: 'İade',
};

export const PRODUCT_ACCOUNT_LINK_TYPE_OPTIONS = [
  { label: 'Alış', value: String(ProductAccountLinkType.Alis) },
  { label: 'Satış', value: String(ProductAccountLinkType.Satis) },
  { label: 'İade', value: String(ProductAccountLinkType.Iade) },
];

/** Muhasebe Bağlantıları — Malzeme fiş / hareket türleri */
export const PRODUCT_VOUCHER_LINK_TYPE_OPTIONS = [
  { label: 'Alış', value: DispatchType.Alis },
  { label: 'Satış', value: DispatchType.Satis },
  { label: 'Alış İade', value: DispatchType.AlisIade },
  { label: 'Satış İade', value: DispatchType.SatisIade },
  { label: 'Sarf', value: DispatchType.Sarf },
  { label: 'Üretimden Giriş', value: DispatchType.UretimdenGiris },
  { label: 'Fire', value: DispatchType.Fire },
  { label: 'Devir', value: DispatchType.Devir },
  { label: 'Ambar Transfer', value: DispatchType.Transfer },
  { label: 'Sayım', value: DispatchType.Sayim },
  { label: 'Maliyet Dağıtım', value: DispatchType.MaliyetDagitim },
];

/** KDV bağlantı türleri */
export const TAX_ACCOUNT_LINK_TYPE_OPTIONS = [
  { label: 'KDV Alış', value: '1' },
  { label: 'KDV Satış', value: '2' },
  { label: 'KDV İade', value: '3' },
  { label: 'KDV Alış İade', value: '4' },
  { label: 'KDV Satış İade', value: '5' },
];

/** Fatura türleri */
export const INVOICE_ACCOUNT_LINK_TYPE_OPTIONS = [
  { label: InvoiceTypeLabels[InvoiceType.Alis], value: InvoiceType.Alis },
  { label: InvoiceTypeLabels[InvoiceType.Satis], value: InvoiceType.Satis },
  { label: InvoiceTypeLabels[InvoiceType.AlisIade], value: InvoiceType.AlisIade },
  { label: InvoiceTypeLabels[InvoiceType.SatisIade], value: InvoiceType.SatisIade },
];

export const SAFE_ACCOUNT_LINK_TYPE_OPTIONS = [
  { label: 'Nakit Giriş', value: '1' },
  { label: 'Nakit Çıkış', value: '2' },
  { label: 'Virman', value: '3' },
  { label: 'Açılış', value: '4' },
];

export function getAccountLinkTypeOptions(
  module: string | number | undefined,
): { label: string; value: string }[] {
  const m = Number(module);
  switch (m) {
    case AccountLinkModule.Product:
      return PRODUCT_VOUCHER_LINK_TYPE_OPTIONS;
    case AccountLinkModule.Customer:
      return CUSTOMER_VOUCHER_TYPE_OPTIONS;
    case AccountLinkModule.BankAccount:
      return BANK_VOUCHER_TYPE_OPTIONS;
    case AccountLinkModule.Bound:
      return BOUND_TRANS_TYPE_OPTIONS;
    case AccountLinkModule.Tax:
      return TAX_ACCOUNT_LINK_TYPE_OPTIONS;
    case AccountLinkModule.Invoice:
      return INVOICE_ACCOUNT_LINK_TYPE_OPTIONS;
    case AccountLinkModule.Safe:
      return SAFE_ACCOUNT_LINK_TYPE_OPTIONS;
    default:
      return [{ label: 'Kart Muhasebe Kodu', value: String(AccountLinkType.Kart) }];
  }
}

export function accountLinkModuleLabel(module: string | number | undefined): string {
  const found = ACCOUNT_LINK_MODULE_OPTIONS.find((o) => o.value === String(module ?? ''));
  return found?.label || 'Modül';
}

const SAMPLE_ACCOUNTS = [
  { label: '150 — İlk Madde ve Malzeme', value: '150' },
  { label: '153 — Ticari Mallar', value: '153' },
  { label: '191 — İndirilecek KDV', value: '191' },
  { label: '391 — Hesaplanan KDV', value: '391' },
  { label: '600 — Yurt İçi Satışlar', value: '600' },
  { label: '610 — Satıştan İadeler', value: '610' },
  { label: '620 — Satılan Malın Maliyeti', value: '620' },
  { label: '120 — Alıcılar', value: '120' },
  { label: '320 — Satıcılar', value: '320' },
  { label: '100 — Kasa', value: '100' },
  { label: '101 — Alınan Çekler', value: '101' },
  { label: '102 — Bankalar', value: '102' },
  { label: '103 — Verilen Çekler', value: '103' },
];

export function sampleAccountOptionsJson(): string {
  return JSON.stringify(SAMPLE_ACCOUNTS);
}

function select(opts: { label: string; value: string | number }[]) {
  return JSON.stringify(opts.map((o) => ({ label: o.label, value: String(o.value) })));
}

/** Kart formundaki Muhasebe Hesapları sekmesi alanları */
export function buildAccountLinkFields(opts?: {
  lockType?: boolean;
  typeOptions?: { label: string; value: string }[];
}): FormFieldDto[] {
  const typeOpts = opts?.typeOptions ?? [
    { label: 'Kart Muhasebe Kodu', value: String(AccountLinkType.Kart) },
  ];
  return [
    {
      fieldId: 9101,
      fieldName: 'Type',
      label: 'Bağlantı Tipi',
      fieldType: 'select',
      isRequired: true,
      colSpan: 4,
      orderIndex: 1,
      optionsJson: select(typeOpts),
      defaultValue: typeOpts[0]?.value ?? String(AccountLinkType.Kart),
    },
    {
      fieldId: 9102,
      fieldName: 'AccountID',
      label: 'Muhasebe Hesabı',
      fieldType: 'select',
      isRequired: false,
      colSpan: 8,
      orderIndex: 2,
      optionsJson: select(SAMPLE_ACCOUNTS),
    },
  ];
}

export function defaultAccountLinkRow(
  module: number,
  type: string | number = AccountLinkType.Kart,
): Record<string, unknown> {
  return {
    Module: module,
    Type: String(type),
    AccountID: '',
    AccountLinkDetailID: 0,
    ConditionTitle: '',
    ConditionJson: '',
  };
}

/** Malzeme kartı: malzeme yönetimi fiş türlerine göre muhasebe kodları */
export function defaultProductAccountLinkRows(
  module: number = AccountLinkModule.Product,
): Record<string, unknown>[] {
  return PRODUCT_VOUCHER_LINK_TYPE_OPTIONS.map((t) =>
    defaultAccountLinkRow(module, t.value),
  );
}

/** Muhasebe Bağlantıları formu — boş detay satırı */
export function defaultAccountLinkDetailRow(): Record<string, unknown> {
  return {
    Module: String(AccountLinkModule.Product),
    Type: DispatchType.Alis,
    AccountID: '',
    AccountLinkDetailID: 0,
    ConditionTitle: '',
    ConditionJson: '',
  };
}

export function accountLinkTypeLabel(
  type: string | number | undefined,
  module?: number,
): string {
  const key = String(type ?? '');
  if (module === AccountLinkModule.Product) {
    const fromVoucher = PRODUCT_VOUCHER_LINK_TYPE_OPTIONS.find((o) => o.value === key);
    if (fromVoucher) return fromVoucher.label;
    return ProductAccountLinkTypeLabels[key] || 'Muhasebe Bağlantısı';
  }
  if (module === AccountLinkModule.Tax) {
    return TAX_ACCOUNT_LINK_TYPE_OPTIONS.find((o) => o.value === key)?.label || key;
  }
  if (module === AccountLinkModule.BankAccount) {
    return BANK_VOUCHER_TYPE_OPTIONS.find((o) => o.value === key)?.label || key;
  }
  if (module === AccountLinkModule.Bound) {
    return BOUND_TRANS_TYPE_OPTIONS.find((o) => o.value === key)?.label || key;
  }
  if (module === AccountLinkModule.Customer) {
    return CUSTOMER_VOUCHER_TYPE_OPTIONS.find((o) => o.value === key)?.label || key;
  }
  if (module === AccountLinkModule.Invoice) {
    return INVOICE_ACCOUNT_LINK_TYPE_OPTIONS.find((o) => o.value === key)?.label || key;
  }
  if (module === AccountLinkModule.Safe) {
    return SAFE_ACCOUNT_LINK_TYPE_OPTIONS.find((o) => o.value === key)?.label || key;
  }
  return AccountLinkTypeLabels[key] || ProductAccountLinkTypeLabels[key] || 'Muhasebe Bağlantısı';
}
