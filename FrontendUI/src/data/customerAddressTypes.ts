/** Cari adres tipi — CustomerAdress.AdressType */
export const CustomerAddressType = {
  Merkez: 1,
  Sevkiyat: 2,
  Fatura: 3,
  Diger: 4,
} as const;

export type CustomerAddressTypeValue =
  (typeof CustomerAddressType)[keyof typeof CustomerAddressType];

export const CUSTOMER_ADDRESS_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Merkez', value: String(CustomerAddressType.Merkez) },
  { label: 'Sevkiyat Adresi', value: String(CustomerAddressType.Sevkiyat) },
  { label: 'Fatura Adresi', value: String(CustomerAddressType.Fatura) },
  { label: 'Diğer', value: String(CustomerAddressType.Diger) },
];

export function customerAddressTypeLabel(type: string | number | undefined): string {
  const v = String(type ?? '');
  return CUSTOMER_ADDRESS_TYPE_OPTIONS.find((o) => o.value === v)?.label || 'Adres';
}

/** Yeni cari kaydında varsayılan ilk adres satırı */
export function defaultCustomerAddressRow(): Record<string, unknown> {
  return {
    AdressType: String(CustomerAddressType.Merkez),
    IsDefault: true,
    Active: true,
    Title: 'Merkez',
    AdressCode: '',
    Country: 'Türkiye',
    City: '',
    Town: '',
    Dictrict: '',
    Adress: '',
    PostLabel: '',
    SenderLabel: '',
    EinvoiceEmailAdress: '',
    TaxNr: '',
    MukellefCheckStatus: '',
  };
}
