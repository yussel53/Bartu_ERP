import { FormSchemaDto } from '../types/formTypes';
import { ProductCardType } from './productCardTypes';
import { OrderType, DispatchType, InvoiceType, BankVoucherType, PaymentType, PriceType, CUSTOMER_VOUCHER_TYPE_OPTIONS, BANK_VOUCHER_TYPE_OPTIONS, BOUND_TRANS_TYPE_OPTIONS, MATERIAL_VOUCHER_TYPE_OPTIONS, SAFE_VOUCHER_TYPE_OPTIONS } from './documentTypes';
import { CUSTOMER_ADDRESS_TYPE_OPTIONS } from './customerAddressTypes';
import {
  MODULE_KEY_OPTIONS,
  VOUCHER_TARGET_OPTIONS,
  PRODUCT_TARGET_OPTIONS,
  CUSTOMER_TARGET_OPTIONS,
  getTypeOptionsForTarget,
  TypeDefKind,
} from './typeDefinitions';
import { companyOptions, workplaceOptions, whouseOptions, orgUnitOptions } from './orgUnits';
import { currencyOptionsJson, LOCAL_CURRENCY_ID } from './currencies';
import { variantTemplateSelectOptions } from './variantTemplates';
import {
  AccountLinkModule,
  buildAccountLinkFields,
  PRODUCT_VOUCHER_LINK_TYPE_OPTIONS,
} from './cardAccountLinks';
import {
  AUXIL_CODE_CARD_TABLES,
  AUXIL_CODE_VOUCHER_TABLES,
  AUXIL_TARGET_OPTIONS,
  auxilModuleNrForTable,
  buildAuxilCodeFields,
  buildAuxilValueFields,
} from './auxilCodes';

const select = (opts: { label: string; value: string | number }[]) =>
  JSON.stringify(opts.map((o) => ({ label: o.label, value: String(o.value) })));

const companyOptionsJson = select(companyOptions());
const workplaceOptionsJson = select(workplaceOptions());
const whouseOptionsJson = select(whouseOptions());
const orgUnitOptionsJson = select(orgUnitOptions());
const currencyOptionsSelectJson = currencyOptionsJson();
const unitOptions = select([
  { label: 'Adet', value: '1' },
  { label: 'Koli', value: '2' },
  { label: 'Paket', value: '3' },
  { label: 'Kg', value: '4' },
  { label: 'Litre', value: '5' },
  { label: 'Metre', value: '6' },
  { label: 'Saat', value: '7' },
  { label: 'Gün', value: '8' },
]);

/** Ortak ProductCard alanları — tip ekrana göre fixedStandardFields ile set edilir */
function buildProductCardFields(codeLabel: string, titleLabel: string, includeMaterialKind: boolean) {
  const fields: FormSchemaDto['fields'] = [
    { fieldId: 1, fieldName: 'Code', label: codeLabel, fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
    { fieldId: 2, fieldName: 'Title', label: titleLabel, fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
  ];

  if (includeMaterialKind) {
    fields.push({
      fieldId: 3,
      fieldName: 'U_MaterialKind',
      label: 'Malzeme Sınıfı',
      fieldType: 'select',
      isRequired: false,
      colSpan: 4,
      orderIndex: 3,
      optionsJson: select([
        { label: 'Ticari Mal', value: 'ticari' },
        { label: 'Hammadde', value: 'hammadde' },
        { label: 'Yarı Mamul', value: 'yari' },
      ]),
    });
  }

  fields.push(
    {
      fieldId: 4,
      fieldName: 'DefaultUnitID',
      label: 'Ana Birim',
      fieldType: 'select',
      isRequired: true,
      colSpan: 4,
      orderIndex: 4,
      optionsJson: unitOptions,
    },
    { fieldId: 5, fieldName: 'U_UnitPrice', label: 'Birim Fiyat', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 5 },
    { fieldId: 6, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 6 },
    // Y-14 (SqlUpdates/90): eldeki miktar bu değere inince Genel Durum → Kritik stok
    { fieldId: 9953, fieldName: 'MinStock', label: 'Kritik Stok (min.)', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 6 },
    { fieldId: 7, fieldName: 'U_Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 7 },
    {
      fieldId: 8,
      fieldName: 'UseInMaterial',
      label: 'Malzeme yönetimi',
      fieldType: 'checkbox',
      isRequired: false,
      colSpan: 4,
      orderIndex: 20,
      defaultValue: 'true',
      group: 'Geçerli Olduğu Yerler',
    },
    {
      fieldId: 9,
      fieldName: 'UseInSales',
      label: 'Satış ve dağıtım',
      fieldType: 'checkbox',
      isRequired: false,
      colSpan: 4,
      orderIndex: 21,
      defaultValue: 'true',
      group: 'Geçerli Olduğu Yerler',
    },
    {
      fieldId: 10,
      fieldName: 'UseInPurchase',
      label: 'Satın alma yönetimi',
      fieldType: 'checkbox',
      isRequired: false,
      colSpan: 4,
      orderIndex: 22,
      defaultValue: 'true',
      group: 'Geçerli Olduğu Yerler',
    },
  );

  return fields;
}

function productCardSchema(
  formId: number,
  formCode: string,
  title: string,
  type: string,
  codeLabel: string,
  titleLabel: string,
  includeMaterialKind: boolean,
): FormSchemaDto {
  return {
    formId,
    formCode,
    title,
    tableName: 'ProductCard',
    primaryKeyColumn: 'ProductCardID',
    /** AccountGroupID DB'de NOT NULL */
    fixedStandardFields: { ProductType: type, AccountGroupID: 1 },
    enableBarcodesTab: false,
    enableUnitConvsTab: true,
    unitConvFields: [
      {
        fieldId: 650,
        fieldName: 'UnitID',
        label: 'Birim',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        optionsJson: unitOptions,
      },
      {
        fieldId: 651,
        fieldName: 'MainQty',
        label: 'Ana birim miktarı',
        fieldType: 'number',
        isRequired: true,
        colSpan: 4,
        orderIndex: 2,
        defaultValue: '12',
      },
      {
        fieldId: 652,
        fieldName: 'UnitQty',
        label: 'Çevrim birim miktarı',
        fieldType: 'number',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        defaultValue: '1',
      },
      {
        fieldId: 653,
        fieldName: 'Weight',
        label: 'Ağırlık (kg)',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 10,
      },
      {
        fieldId: 654,
        fieldName: 'Length',
        label: 'En (cm)',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 11,
      },
      {
        fieldId: 655,
        fieldName: 'Width',
        label: 'Boy (cm)',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 12,
      },
      {
        fieldId: 656,
        fieldName: 'Height',
        label: 'Yükseklik (cm)',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 13,
      },
      {
        fieldId: 657,
        fieldName: 'UseInMaterial',
        label: 'Malzeme yönetimi',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 20,
        defaultValue: 'true',
      },
      {
        fieldId: 658,
        fieldName: 'UseInSales',
        label: 'Satış ve dağıtım',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 21,
        defaultValue: 'true',
      },
      {
        fieldId: 659,
        fieldName: 'UseInPurchase',
        label: 'Satın alma yönetimi',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 22,
        defaultValue: 'true',
      },
    ],
    barcodeFields: [
      {
        fieldId: 611,
        fieldName: 'Barcode',
        label: 'Barkod',
        fieldType: 'text',
        isRequired: true,
        colSpan: 6,
        orderIndex: 1,
      },
      {
        fieldId: 612,
        fieldName: 'Type',
        label: 'Tip',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 2,
        optionsJson: select([
          { label: 'EAN-13', value: '1' },
          { label: 'İç Kod', value: '2' },
          { label: 'QR', value: '3' },
          { label: 'Code128', value: '4' },
          { label: 'Birim Barkodu (miktarlı)', value: '5' },
        ]),
        defaultValue: '1',
      },
      // Birim barkodu (Tip 5): 27000000500 → son «Miktar hanesi» kadar hane miktardır (500), bölen ile bölünür
      {
        fieldId: 614,
        fieldName: 'QtyDigits',
        label: 'Miktar Hanesi',
        fieldType: 'number',
        isRequired: false,
        colSpan: 2,
        orderIndex: 4,
      },
      {
        fieldId: 615,
        fieldName: 'QtyDivisor',
        label: 'Bölen',
        fieldType: 'select',
        isRequired: false,
        colSpan: 2,
        orderIndex: 5,
        optionsJson: select([
          { label: '1 (adet)', value: '1' },
          { label: '10', value: '10' },
          { label: '100', value: '100' },
          { label: '1000 (gram → kg)', value: '1000' },
        ]),
        defaultValue: '1',
      },
      {
        fieldId: 616,
        fieldName: 'HasCheckDigit',
        label: 'Kontrol Hanesi',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 2,
        orderIndex: 6,
      },
      {
        fieldId: 613,
        fieldName: 'LineNr',
        label: 'Sıra',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 3,
      },
    ],
    ...(includeMaterialKind
      ? {
          enableProductSubsTab: true as const,
          productSubFields: [
            {
              fieldId: 604,
              fieldName: 'Type',
              label: 'Tip',
              fieldType: 'select' as const,
              isRequired: false,
              colSpan: 3,
              orderIndex: 1,
              optionsJson: select([
                { label: 'Reçete', value: '1' },
                { label: 'Karma Koli', value: '2' },
              ]),
              defaultValue: '1',
            },
            {
              fieldId: 601,
              fieldName: 'SubProductCardID',
              label: 'Alt Malzeme',
              fieldType: 'select' as const,
              isRequired: true,
              colSpan: 5,
              orderIndex: 2,
              optionsJson: select([
                { label: 'URN-002 — Vida M8', value: '2' },
                { label: 'URN-003 — Somun M8', value: '3' },
              ]),
            },
            {
              fieldId: 602,
              fieldName: 'Quantity',
              label: 'Miktar',
              fieldType: 'number' as const,
              isRequired: true,
              colSpan: 2,
              orderIndex: 3,
            },
            {
              fieldId: 603,
              fieldName: 'UnitID',
              label: 'Birim',
              fieldType: 'select' as const,
              isRequired: false,
              colSpan: 2,
              orderIndex: 4,
              optionsJson: unitOptions,
            },
            {
              fieldId: 605,
              fieldName: 'CostRate',
              label: 'Maliyet Oranı',
              fieldType: 'number' as const,
              isRequired: false,
              colSpan: 3,
              orderIndex: 5,
            },
            {
              fieldId: 606,
              fieldName: 'PriceRate',
              label: 'Fiyat Oranı',
              fieldType: 'number' as const,
              isRequired: false,
              colSpan: 3,
              orderIndex: 6,
            },
          ],
          enableVariantsTab: true as const,
          variantTemplateField: {
            fieldId: 639,
            fieldName: 'VariantTemplateID',
            label: 'Varyant Şablonu',
            fieldType: 'select' as const,
            isRequired: false,
            colSpan: 6,
            orderIndex: 0,
            optionsJson: select(variantTemplateSelectOptions()),
          },
          variantFields: [
            {
              fieldId: 640,
              fieldName: 'Code',
              label: 'Varyant Kodu',
              fieldType: 'text' as const,
              isRequired: true,
              colSpan: 4,
              orderIndex: 1,
            },
            {
              fieldId: 641,
              fieldName: 'Title',
              label: 'Varyant Adı',
              fieldType: 'text' as const,
              isRequired: true,
              colSpan: 5,
              orderIndex: 2,
            },
            {
              fieldId: 642,
              fieldName: 'UnitID',
              label: 'Birim',
              fieldType: 'select' as const,
              isRequired: false,
              colSpan: 3,
              orderIndex: 3,
              optionsJson: unitOptions,
            },
          ],
        }
      : {}),
    enableCustomerAliasesTab: true,
    customerAliasFields: [
      {
        fieldId: 621,
        fieldName: 'CustomerCardID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '120.02 — XYZ Sanayi Ltd.', value: '2' },
        ]),
      },
      {
        fieldId: 622,
        fieldName: 'CustomerCode',
        label: 'Cari Malzeme Kodu',
        fieldType: 'text',
        isRequired: true,
        colSpan: 4,
        orderIndex: 2,
      },
      {
        fieldId: 623,
        fieldName: 'CustomerTitle',
        label: 'Cari Malzeme Adı',
        fieldType: 'text',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
      },
      {
        fieldId: 624,
        fieldName: 'Note',
        label: 'Not',
        fieldType: 'text',
        isRequired: false,
        colSpan: 12,
        orderIndex: 4,
      },
    ],
    enableAccountLinksTab: true,
    accountLinkModule: AccountLinkModule.Product,
    accountLinkSingle: false,
    accountLinkFixed: true,
    accountLinkFields: buildAccountLinkFields({
      typeOptions: PRODUCT_VOUCHER_LINK_TYPE_OPTIONS,
    }),
    fields: buildProductCardFields(codeLabel, titleLabel, includeMaterialKind),
  };
}

export const FORM_SCHEMAS: Record<string, FormSchemaDto> = {
  /** Malzeme — ProductType = 1 */
  ProductCardForm: productCardSchema(
    1,
    'ProductCardForm',
    'Malzeme Kartı',
    ProductCardType.Malzeme,
    'Malzeme Kodu',
    'Malzeme Adı',
    true,
  ),

  /** Verilen hizmet — ProductType = 2 (aynı ProductCard tablosu) */
  ServiceGivenForm: productCardSchema(
    6,
    'ServiceGivenForm',
    'Verilen Hizmet Kartı',
    ProductCardType.VerilenHizmet,
    'Hizmet Kodu',
    'Hizmet Adı',
    false,
  ),

  /** Alınan hizmet — ProductType = 3 (aynı ProductCard tablosu) */
  ServiceReceivedForm: productCardSchema(
    7,
    'ServiceReceivedForm',
    'Alınan Hizmet Kartı',
    ProductCardType.AlinanHizmet,
    'Hizmet Kodu',
    'Hizmet Adı',
    false,
  ),

  CustomerCardForm: {
    formId: 2,
    formCode: 'CustomerCardForm',
    title: 'Cari Kart',
    tableName: 'CustomerCard',
    primaryKeyColumn: 'CustomerCardID',
    enableAddressesTab: true,
    enableContactsTab: true,
    enableAccountLinksTab: true,
    accountLinkModule: AccountLinkModule.Customer,
    accountLinkSingle: true,
    accountLinkFields: buildAccountLinkFields({ lockType: true }),
    /** AccountGroupID DB'de zorunlu; cari tür Type_ (Alıcı/Satıcı) ile tutulur.
     *  CardKind: 1 Müşteri (aday) · 2 Cari — aynı tablo (SqlUpdates/72) */
    fixedStandardFields: { CardKind: 2, AccountGroupID: 1 },
    fields: [
      {
        fieldId: 30,
        fieldName: 'Active',
        label: 'Aktif',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 2,
        orderIndex: 0,
        headerRight: true,
        defaultValue: 'true',
      },
      { fieldId: 20, fieldName: 'Code', label: 'Cari Kodu', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 21, fieldName: 'Title', label: 'Ünvan', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      {
        fieldId: 22,
        fieldName: 'Type_',
        label: 'Cari Tür',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([
          { label: '1 — Alıcı', value: '1' },
          { label: '2 — Satıcı', value: '2' },
          { label: '3 — Alıcı / Satıcı', value: '3' },
        ]),
      },
      {
        fieldId: 23,
        fieldName: 'TaxType',
        label: 'Vergi Tipi',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Tüzel', value: '1' },
          { label: 'Gerçek', value: '2' },
        ]),
      },
      { fieldId: 24, fieldName: 'TaxNr', label: 'Vergi / TCKN', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 6 },
      { fieldId: 25, fieldName: 'TaxOffice', label: 'Vergi Dairesi', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 7 },
      {
        fieldId: 26,
        fieldName: 'EinvoiceType',
        label: 'e-Fatura Tipi',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 8,
        optionsJson: select([
          { label: 'Yok', value: '0' },
          { label: 'e-Fatura', value: '1' },
          { label: 'e-Arşiv', value: '2' },
        ]),
      },
      {
        fieldId: 33,
        fieldName: 'DefaultCurrency',
        label: 'Öndeğer Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 9,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      {
        fieldId: 27,
        fieldName: 'SalesModuleCheck',
        label: 'Satış',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 10,
        group: 'Modüller',
        defaultValue: 'true',
      },
      {
        fieldId: 28,
        fieldName: 'PurchaseModuleCheck',
        label: 'Satınalma',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 11,
        group: 'Modüller',
      },
      {
        fieldId: 29,
        fieldName: 'FinanceModuleCheck',
        label: 'Finans',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 12,
        group: 'Modüller',
      },
      { fieldId: 31, fieldName: 'U_Phone', label: 'Telefon', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 13 },
      { fieldId: 32, fieldName: 'U_Email', label: 'E-posta', fieldType: 'text', isRequired: false, colSpan: 8, orderIndex: 14 },
      // Y-12 (SqlUpdates/87): risk grubu ve cariye özel limit (boş → grubun limiti)
      { fieldId: 9951, fieldName: 'RiskGroupID', label: 'Risk Grubu', fieldType: 'lookup', isRequired: false, colSpan: 4, orderIndex: 15, useLookup: true },
      { fieldId: 9952, fieldName: 'RiskLimit', label: 'Risk Limiti', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 16 },
    ],
    addressFields: [
      {
        fieldId: 201,
        fieldName: 'AdressType',
        label: 'Adres Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: select(CUSTOMER_ADDRESS_TYPE_OPTIONS),
      },
      { fieldId: 202, fieldName: 'Title', label: 'Adres Adı', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 2 },
      { fieldId: 203, fieldName: 'AdressCode', label: 'Adres Kodu', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 3 },
      { fieldId: 204, fieldName: 'IsDefault', label: 'Varsayılan', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 4 },
      { fieldId: 205, fieldName: 'Country', label: 'Ülke', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 5 },
      { fieldId: 206, fieldName: 'City', label: 'İl', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 6 },
      { fieldId: 207, fieldName: 'Town', label: 'İlçe', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 7 },
      { fieldId: 208, fieldName: 'Dictrict', label: 'Mahalle', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 8 },
      { fieldId: 209, fieldName: 'Adress', label: 'Açık Adres', fieldType: 'textarea', isRequired: true, colSpan: 12, orderIndex: 9 },
      { fieldId: 210, fieldName: 'Active', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 10 },
      {
        fieldId: 214,
        fieldName: 'TaxNr',
        label: 'Adres VKN / TCKN',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 10.5,
        group: 'e-Fatura Posta Kutusu',
      },
      {
        fieldId: 211,
        fieldName: 'PostLabel',
        label: 'e-Fatura Gelen (PK)',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 11,
        group: 'e-Fatura Posta Kutusu',
      },
      {
        fieldId: 212,
        fieldName: 'SenderLabel',
        label: 'e-Fatura Giden (GB)',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 12,
        group: 'e-Fatura Posta Kutusu',
      },
      {
        fieldId: 213,
        fieldName: 'EinvoiceEmailAdress',
        label: 'e-Fatura E-posta',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 13,
        group: 'e-Fatura Posta Kutusu',
      },
      {
        fieldId: 215,
        fieldName: 'MukellefCheckStatus',
        label: 'Mükellef Kontrol',
        fieldType: 'text',
        isRequired: false,
        colSpan: 8,
        orderIndex: 14,
        group: 'e-Fatura Posta Kutusu',
      },
    ],
    contactFields: [
      { fieldId: 301, fieldName: 'ContactTitle', label: 'Ünvan / Görev', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 1 },
      { fieldId: 302, fieldName: 'Name', label: 'Ad Soyad', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 303, fieldName: 'Phone', label: 'Telefon', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 3 },
      { fieldId: 304, fieldName: 'Email', label: 'E-posta', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 4 },
      { fieldId: 305, fieldName: 'IsDefault', label: 'Varsayılan', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 5 },
    ],
  },

  OrderVoucherForm: {
    formId: 3,
    formCode: 'OrderVoucherForm',
    title: 'Sipariş Fişi',
    tableName: 'OrderVoucher',
    primaryKeyColumn: 'OrderVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 40, fieldName: 'OrderSlipNo', label: 'Sipariş No', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 41, fieldName: 'OrderDate', label: 'Sipariş Tarihi', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 2 },
      {
        fieldId: 43,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '120.02 — XYZ Ltd. Şti.', value: '2' },
          { label: '320.01 — Demir Tedarik', value: '3' },
        ]),
      },
      {
        fieldId: 44,
        fieldName: 'WhouseID',
        label: 'Depo',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      {
        fieldId: 45,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Açık', value: '1' },
          { label: 'Kısmi', value: '2' },
          { label: 'Kapalı', value: '3' },
        ]),
      },
      { fieldId: 46, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 6 },
    ],
    lineFields: [
      { fieldId: 50, fieldName: 'ItemsID', label: 'Kod', fieldType: 'select', isRequired: true, colSpan: 3, orderIndex: 1,
        optionsJson: select([
          { label: 'URN-001 — Demo Ürün', value: '1' },
          { label: 'URN-002 — Vida M8', value: '2' },
          { label: 'URN-003 — Panel 18mm', value: '3' },
        ]),
      },
      { fieldId: 55, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 2 },
      { fieldId: 56, fieldName: 'Description2', label: 'Açıklama2', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 3 },
      { fieldId: 51, fieldName: 'Quantity', label: 'Miktar', fieldType: 'number', isRequired: true, colSpan: 1, orderIndex: 4 },
      { fieldId: 57, fieldName: 'UnitID', label: 'Birim', fieldType: 'select', isRequired: false, colSpan: 1, orderIndex: 5, optionsJson: unitOptions },
      { fieldId: 52, fieldName: 'Price', label: 'Birim Fiyat', fieldType: 'number', isRequired: true, colSpan: 1, orderIndex: 6 },
      { fieldId: 53, fieldName: 'TotalDiscount', label: 'İskonto', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 7 },
      { fieldId: 58, fieldName: 'TaxCardID', label: 'Vergi Kodu', fieldType: 'select', isRequired: false, colSpan: 2, orderIndex: 8, useLookup: true },
      { fieldId: 59, fieldName: 'TaxRate', label: '%', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 9 },
      { fieldId: 591, fieldName: 'TotalTax', label: 'KDV', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 10 },
      { fieldId: 54, fieldName: 'TotalPrice', label: 'Tutar', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 11 },
      { fieldId: 592, fieldName: 'NetTotal', label: 'Net Tutar', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 12 },
      { fieldId: 593, fieldName: 'AuxilCode', label: 'Hareket Özel Kodu', fieldType: 'text', isRequired: false, colSpan: 1, orderIndex: 13 },
    ],
  },

  ProductVoucherForm: {
    formId: 4,
    formCode: 'ProductVoucherForm',
    title: 'İrsaliye Fişi',
    tableName: 'ProductVoucher',
    primaryKeyColumn: 'ProductVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 60, fieldName: 'DocumentNumber', label: 'İrsaliye No', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 61, fieldName: 'VoucherDate', label: 'İrsaliye Tarihi', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 2 },
      {
        fieldId: 63,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '120.02 — XYZ Ltd. Şti.', value: '2' },
          { label: '320.01 — Demir Tedarik', value: '3' },
        ]),
      },
      {
        fieldId: 64,
        fieldName: 'WhouseID',
        label: 'Depo',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      {
        fieldId: 65,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Açık', value: '1' },
          { label: 'Faturalandı', value: '2' },
          { label: 'İptal', value: '3' },
        ]),
      },
      { fieldId: 66, fieldName: 'U_PlateNo', label: 'Plaka', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 6 },
      { fieldId: 67, fieldName: 'U_DriverName', label: 'Şoför', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 7 },
      { fieldId: 68, fieldName: 'U_WaybillNo', label: 'Sevk İrsaliye No', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 8 },
      { fieldId: 69, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 9 },
    ],
    lineFields: [
      {
        fieldId: 70,
        fieldName: 'ProductCardID',
        label: 'Kod',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: select([
          { label: 'URN-001 — Demo Ürün', value: '1' },
          { label: 'URN-002 — Vida M8', value: '2' },
          { label: 'URN-003 — Panel 18mm', value: '3' },
        ]),
      },
      { fieldId: 74, fieldName: 'Description1', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 2 },
      { fieldId: 75, fieldName: 'Description2', label: 'Açıklama2', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 3 },
      { fieldId: 71, fieldName: 'Quantity', label: 'Miktar', fieldType: 'number', isRequired: true, colSpan: 1, orderIndex: 4 },
      { fieldId: 76, fieldName: 'UnitID', label: 'Birim', fieldType: 'select', isRequired: false, colSpan: 1, orderIndex: 5, optionsJson: unitOptions },
      { fieldId: 72, fieldName: 'Price', label: 'Birim Fiyat', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 6 },
      { fieldId: 77, fieldName: 'TotalDiscount', label: 'İskonto', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 7 },
      { fieldId: 78, fieldName: 'TaxCardID', label: 'Vergi Kodu', fieldType: 'select', isRequired: false, colSpan: 2, orderIndex: 8, useLookup: true },
      { fieldId: 79, fieldName: 'TaxRate', label: '%', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 9 },
      { fieldId: 791, fieldName: 'TotalTax', label: 'KDV', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 10 },
      { fieldId: 73, fieldName: 'TotalPrice', label: 'Tutar', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 11 },
      { fieldId: 792, fieldName: 'NetTotal', label: 'Net Tutar', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 12 },
      { fieldId: 793, fieldName: 'AuxilCode', label: 'Hareket Özel Kodu', fieldType: 'text', isRequired: false, colSpan: 1, orderIndex: 13 },
    ],
  },

  /** Malzeme Yönetimi — stok fişleri (devir / ambar / sarf / üretim / fire) */
  MaterialVoucherForm: {
    formId: 56,
    formCode: 'MaterialVoucherForm',
    title: 'Malzeme Fişi',
    tableName: 'ProductVoucher',
    primaryKeyColumn: 'ProductVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 560, fieldName: 'DocumentNumber', label: 'Fiş No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 561, fieldName: 'VoucherDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 562,
        fieldName: 'VoucherType',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select(MATERIAL_VOUCHER_TYPE_OPTIONS),
      },
      {
        fieldId: 563,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Açık', value: '1' },
          { label: 'Kapalı', value: '2' },
          { label: 'İptal', value: '3' },
        ]),
        defaultValue: '1',
      },
      {
        fieldId: 564,
        fieldName: 'WhouseID',
        label: 'Depo',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      {
        fieldId: 565,
        fieldName: 'AimWhouseID',
        label: 'Hedef Depo',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 6,
        optionsJson: select([
          { label: '(Yok)', value: '' },
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      { fieldId: 566, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 4, orderIndex: 7 },
    ],
    lineFields: [
      {
        fieldId: 570,
        fieldName: 'ProductCardID',
        label: 'Malzeme',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: select([
          { label: 'URN-001 — Demo Ürün', value: '1' },
          { label: 'URN-002 — Vida M8', value: '2' },
          { label: 'URN-003 — Panel 18mm', value: '3' },
        ]),
      },
      { fieldId: 571, fieldName: 'Quantity', label: 'Miktar', fieldType: 'number', isRequired: true, colSpan: 1, orderIndex: 2 },
      {
        fieldId: 575,
        fieldName: 'UnitID',
        label: 'Birim',
        fieldType: 'select',
        isRequired: false,
        colSpan: 1,
        orderIndex: 3,
        optionsJson: unitOptions,
      },
      { fieldId: 572, fieldName: 'Price', label: 'Birim Maliyet', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 4 },
      { fieldId: 573, fieldName: 'TotalPrice', label: 'Tutar', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 5 },
      { fieldId: 574, fieldName: 'Description1', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 6 },
    ],
  },

  MaterialCostingForm: {
    formId: 57,
    formCode: 'MaterialCostingForm',
    title: 'Maliyetlendirme',
    tableName: 'ProductTransCostCalc',
    primaryKeyColumn: 'ProductTransCostCalcID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 580, fieldName: 'DocumentNumber', label: 'İşlem No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 581, fieldName: 'ProcessDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 582,
        fieldName: 'PeriodYear',
        label: 'Yıl',
        fieldType: 'number',
        isRequired: true,
        colSpan: 2,
        orderIndex: 3,
      },
      {
        fieldId: 583,
        fieldName: 'PeriodMonth',
        label: 'Ay',
        fieldType: 'number',
        isRequired: true,
        colSpan: 2,
        orderIndex: 4,
      },
      {
        fieldId: 584,
        fieldName: 'WhouseID',
        label: 'Depo',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Tüm Depolar', value: '' },
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      {
        fieldId: 585,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 6,
        optionsJson: select([
          { label: 'Taslak', value: '0' },
          { label: 'Hesaplandı', value: '1' },
          { label: 'Onaylandı', value: '2' },
        ]),
        defaultValue: '0',
      },
      { fieldId: 586, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 7 },
    ],
  },

  MaterialLoadingForm: {
    formId: 58,
    formCode: 'MaterialLoadingForm',
    title: 'Yükleme',
    tableName: 'ProductVoucher',
    primaryKeyColumn: 'ProductVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 590, fieldName: 'DocumentNumber', label: 'Yükleme No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 591, fieldName: 'VoucherDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 592,
        fieldName: 'WhouseID',
        label: 'Depo',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select([
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      {
        fieldId: 593,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Bekliyor', value: '0' },
          { label: 'Yüklendi', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
        defaultValue: '0',
      },
      { fieldId: 594, fieldName: 'U_PlateNo', label: 'Plaka', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 5 },
      { fieldId: 595, fieldName: 'U_DriverName', label: 'Şoför', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 6 },
      { fieldId: 596, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 4, orderIndex: 7 },
    ],
    lineFields: [
      {
        fieldId: 597,
        fieldName: 'ProductCardID',
        label: 'Malzeme',
        fieldType: 'select',
        isRequired: true,
        colSpan: 5,
        orderIndex: 1,
        optionsJson: select([
          { label: 'URN-001 — Demo Ürün', value: '1' },
          { label: 'URN-002 — Vida M8', value: '2' },
          { label: 'URN-003 — Panel 18mm', value: '3' },
        ]),
      },
      { fieldId: 598, fieldName: 'Quantity', label: 'Miktar', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 599, fieldName: 'Description1', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
    ],
  },

  InvoiceForm: {
    formId: 5,
    formCode: 'InvoiceForm',
    title: 'Fatura',
    tableName: 'Invoice',
    primaryKeyColumn: 'InvoiceID',
    documentLayout: 'trade',
    /**
     * Kaydet sonrası örnek (aktif etmek için bırakıldı — istediğiniz SQL/API yazın).
     * SYS_FormPostSave tablosundan da FormCode ile eklenebilir.
     */
    postSave: [
      // Örnek (yorum satırı gibi boş bırakmayın; gerçek komut için açın):
      // { type: 'sql', title: 'Durumu onayla', command: 'UPDATE dbo.Invoice SET Status_ = 1 WHERE InvoiceID = {recId}' },
    ],
    fields: [
      { fieldId: 80, fieldName: 'DocumentNumber', label: 'Fatura No', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 81, fieldName: 'InvoiceDate', label: 'Fatura Tarihi', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 2 },
      {
        fieldId: 83,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '120.02 — XYZ Ltd. Şti.', value: '2' },
          { label: '320.01 — Demir Tedarik', value: '3' },
        ]),
      },
      {
        fieldId: 84,
        fieldName: 'WhouseID',
        label: 'Depo',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Merkez Depo', value: '1' },
          { label: 'Şube Depo', value: '2' },
        ]),
      },
      {
        fieldId: 85,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Taslak', value: '0' },
          { label: 'Onaylı', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
      },
      { fieldId: 86, fieldName: 'U_DueDate', label: 'Vade Tarihi', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 6 },
      {
        fieldId: 87,
        fieldName: 'U_PaymentType',
        label: 'Ödeme Tipi',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 7,
        optionsJson: select([
          { label: 'Nakit', value: '1' },
          { label: 'Havale', value: '2' },
          { label: 'Çek', value: '3' },
          { label: 'Açık Hesap', value: '4' },
        ]),
      },
      { fieldId: 88, fieldName: 'Currency', label: 'Döviz', fieldType: 'select', isRequired: false, colSpan: 2, orderIndex: 8, optionsJson: currencyOptionsSelectJson, defaultValue: LOCAL_CURRENCY_ID },
      { fieldId: 881, fieldName: 'CurrencyRate', label: 'Kur', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 8.5, defaultValue: '1' },
      { fieldId: 89, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 9 },
    ],
    lineFields: [
      {
        fieldId: 90,
        fieldName: 'ProductCardID',
        label: 'Kod',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: select([
          { label: 'URN-001 — Demo Ürün', value: '1' },
          { label: 'URN-002 — Vida M8', value: '2' },
          { label: 'URN-003 — Panel 18mm', value: '3' },
        ]),
      },
      { fieldId: 95, fieldName: 'Description1', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 2 },
      { fieldId: 96, fieldName: 'Description2', label: 'Açıklama2', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 3 },
      { fieldId: 91, fieldName: 'Quantity', label: 'Miktar', fieldType: 'number', isRequired: true, colSpan: 1, orderIndex: 4 },
      { fieldId: 97, fieldName: 'UnitID', label: 'Birim', fieldType: 'select', isRequired: false, colSpan: 1, orderIndex: 5, optionsJson: unitOptions },
      { fieldId: 92, fieldName: 'Price', label: 'Birim Fiyat', fieldType: 'number', isRequired: true, colSpan: 1, orderIndex: 6 },
      { fieldId: 98, fieldName: 'TotalDiscount', label: 'İskonto', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 7 },
      { fieldId: 99, fieldName: 'TaxCardID', label: 'Vergi Kodu', fieldType: 'select', isRequired: false, colSpan: 2, orderIndex: 8, useLookup: true },
      { fieldId: 991, fieldName: 'TaxRate', label: '%', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 9 },
      { fieldId: 93, fieldName: 'TotalTax', label: 'KDV', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 10 },
      { fieldId: 94, fieldName: 'TotalPrice', label: 'Tutar', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 11 },
      { fieldId: 992, fieldName: 'NetTotal', label: 'Net Tutar', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 12 },
      { fieldId: 993, fieldName: 'AuxilCode', label: 'Hareket Özel Kodu', fieldType: 'text', isRequired: false, colSpan: 1, orderIndex: 13 },
    ],
  },

  AccountCardForm: {
    formId: 20,
    formCode: 'AccountCardForm',
    title: 'Hesap Kartı',
    tableName: 'AccountCard',
    primaryKeyColumn: 'AccountCardID',
    fields: [
      { fieldId: 200, fieldName: 'Code', label: 'Hesap Kodu', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 201, fieldName: 'Title', label: 'Hesap Adı', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      {
        fieldId: 202,
        fieldName: 'Type_',
        label: 'Hesap Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([
          { label: 'Ana Hesap', value: '1' },
          { label: 'Detay Hesap', value: '2' },
        ]),
      },
      {
        fieldId: 207,
        fieldName: 'MainAccountID',
        label: 'Üst Hesap',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 8,
        orderIndex: 4,
        useLookup: true,
        helpText:
          'Kodda nokta (.) varsa üst hesap otomatik bağlanır (100.01 → 100). Noktasız kodlarda manuel seçin (ör. 10 → 1, 100 → 10).',
      },
      { fieldId: 203, fieldName: 'MainAccount', label: 'Ana Hesap mı?', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 5 },
      { fieldId: 204, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 6 },
      {
        fieldId: 205,
        fieldName: 'DefaultCurrency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 7,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      {
        fieldId: 206,
        fieldName: 'DefaultRate',
        label: 'Kur',
        fieldType: 'number',
        isRequired: false,
        colSpan: 4,
        orderIndex: 8,
        defaultValue: '1',
      },
    ],
  },

  CostCenterForm: {
    formId: 21,
    formCode: 'CostCenterForm',
    title: 'Masraf Merkezi',
    tableName: 'CostCenter',
    primaryKeyColumn: 'CostCenterID',
    fields: [
      { fieldId: 210, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 211, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      { fieldId: 212, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 3 },
      { fieldId: 213, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 4 },
    ],
  },

  ProjectCardForm: {
    formId: 25,
    formCode: 'ProjectCardForm',
    title: 'Proje',
    tableName: 'ProjectCard',
    primaryKeyColumn: 'ProjectCardID',
    fields: [
      { fieldId: 2600, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 2601, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      { fieldId: 2602, fieldName: 'StartDate', label: 'Başlangıç', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 3 },
      { fieldId: 2603, fieldName: 'EndDate', label: 'Bitiş', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 4 },
      { fieldId: 2604, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 5 },
      { fieldId: 2605, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 6 },
    ],
  },

  AccountPoolForm: {
    formId: 22,
    formCode: 'AccountPoolForm',
    title: 'Muhasebe Havuzu Kaydı',
    tableName: 'AccountLinkTrans',
    primaryKeyColumn: 'AccountLinkTransID',
    fields: [
      { fieldId: 220, fieldName: 'TransDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 1 },
      {
        fieldId: 221,
        fieldName: 'SourceModule',
        label: 'Kaynak',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 2,
        optionsJson: select([
          { label: 'Satış Faturası', value: '1' },
          { label: 'Alış Faturası', value: '2' },
          { label: 'Kasa', value: '3' },
          { label: 'Banka', value: '4' },
        ]),
      },
      { fieldId: 222, fieldName: 'DocumentNo', label: 'Belge No', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 3 },
      { fieldId: 223, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 4 },
      {
        fieldId: 224,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Bekliyor', value: '0' },
          { label: 'Aktarıldı', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
      },
      { fieldId: 225, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 6 },
    ],
  },

  AccountVoucherForm: {
    formId: 23,
    formCode: 'AccountVoucherForm',
    title: 'Muhasebe Fişi',
    tableName: 'AccountVoucher',
    primaryKeyColumn: 'AccountVoucherID',
    documentLayout: 'trade',
    fields: [
      {
        fieldId: 230,
        fieldName: 'DocumentNumber',
        label: 'Fiş No',
        fieldType: 'text',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
      },
      {
        fieldId: 231,
        fieldName: 'VoucherDate',
        label: 'Fiş Tarihi',
        fieldType: 'date',
        isRequired: true,
        colSpan: 4,
        orderIndex: 2,
      },
      {
        fieldId: 236,
        fieldName: 'VoucherTime',
        label: 'Fiş Saati (SS:DD)',
        fieldType: 'text',
        isRequired: false,
        colSpan: 2,
        orderIndex: 2,
      },
      {
        fieldId: 232,
        fieldName: 'Type',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([
          { label: 'Mahsup', value: '1' },
          { label: 'Tahsil', value: '2' },
          { label: 'Tediye', value: '3' },
        ]),
        defaultValue: '1',
      },
      {
        fieldId: 234,
        fieldName: 'journalNO',
        label: 'Yevmiye No',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 4,
        isReadOnly: true,
        helpText: 'İşlemler → Yevmiye Madde Numaralandırma ile verilir',
      },
      {
        fieldId: 235,
        fieldName: 'Status',
        label: 'Durum',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Açık', value: '1' },
          { label: 'Kapalı', value: '2' },
          { label: 'İptal', value: '3' },
        ]),
        defaultValue: '1',
      },
      {
        fieldId: 233,
        fieldName: 'Description',
        label: 'Açıklama',
        fieldType: 'textarea',
        isRequired: false,
        colSpan: 12,
        orderIndex: 6,
      },
    ],
    lineFields: [
      {
        fieldId: 240,
        fieldName: 'AccountCardID',
        label: 'Hesap',
        fieldType: 'lookup',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
      },
      { fieldId: 241, fieldName: 'Debit', label: 'Borç', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 2, decimals: 2 },
      { fieldId: 242, fieldName: 'Credit', label: 'Alacak', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 3, decimals: 2 },
      { fieldId: 243, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 4 },
    ],
    hidePaymentPlan: true,
    balanceFields: { debit: 'Debit', credit: 'Credit' },
    eLedgerFields: [
      {
        fieldId: 2800,
        fieldName: 'EDocumentType',
        label: 'Belge Türü',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: select([
          { label: 'Fatura', value: 'invoice' },
          { label: 'Çek', value: 'check' },
          { label: 'Senet', value: 'voucher' },
          { label: 'Makbuz', value: 'receipt' },
          { label: 'İrsaliye / Sevk', value: 'shipment' },
          { label: 'Müşteri Siparişi', value: 'order-customer' },
          { label: 'Satıcı Siparişi', value: 'order-vendor' },
          { label: 'Diğer', value: 'other' },
        ]),
      },
      {
        fieldId: 2801,
        fieldName: 'EDocumentTypeDesc',
        label: 'Belge Türü Açıklaması',
        fieldType: 'text',
        isRequired: false,
        colSpan: 3,
        orderIndex: 2,
        helpText: 'Belge türü «Diğer» ise zorunlu (ör. Dekont, Banka Ekstresi)',
      },
      { fieldId: 2802, fieldName: 'EDocumentNumber', label: 'Belge No', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 3 },
      { fieldId: 2803, fieldName: 'EDocumentDate', label: 'Belge Tarihi', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 4 },
      {
        fieldId: 2804,
        fieldName: 'EPaymentMethod',
        label: 'Ödeme Şekli',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Nakit', value: 'NAKIT' },
          { label: 'Banka / EFT / Havale', value: 'BANKA' },
          { label: 'Kredi Kartı', value: 'KREDIKARTI' },
          { label: 'Çek', value: 'CEK' },
          { label: 'Senet', value: 'SENET' },
          { label: 'Açık Hesap', value: 'ACIKHESAP' },
          { label: 'Diğer', value: 'DIGER' },
        ]),
      },
      {
        fieldId: 2805,
        fieldName: 'EEntryComment',
        label: 'Yevmiye Madde Açıklaması',
        fieldType: 'text',
        isRequired: false,
        colSpan: 6,
        orderIndex: 6,
      },
      {
        fieldId: 2806,
        fieldName: 'ELedgerExclude',
        label: 'e-Deftere gönderme',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 3,
        orderIndex: 7,
      },
    ],
    lineDistributionAmountFields: ['Debit', 'Credit'],
    lineDistributionFields: [
      { fieldId: 2700, fieldName: 'CostCenterID', label: 'Masraf Merkezi', fieldType: 'lookup', isRequired: false, colSpan: 3, orderIndex: 1, useLookup: true },
      { fieldId: 2701, fieldName: 'ProjectCardID', label: 'Proje', fieldType: 'lookup', isRequired: false, colSpan: 3, orderIndex: 2, useLookup: true },
      { fieldId: 2702, fieldName: 'RatePercent', label: 'Oran %', fieldType: 'number', isRequired: false, colSpan: 1, orderIndex: 3 },
      { fieldId: 2703, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 4 },
      { fieldId: 2704, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 5 },
    ],
  },

  JournalNumberingForm: {
    formId: 24,
    formCode: 'JournalNumberingForm',
    title: 'Yevmiye Madde Numaralandırma',
    tableName: 'AccountVoucher',
    primaryKeyColumn: 'AccountVoucherID',
    fields: [
      { fieldId: 250, fieldName: 'PeriodYear', label: 'Dönem Yılı', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 1, defaultValue: '2026' },
      { fieldId: 251, fieldName: 'StartDate', label: 'Başlangıç Tarihi', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 252, fieldName: 'EndDate', label: 'Bitiş Tarihi', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 3 },
      { fieldId: 253, fieldName: 'StartNumber', label: 'Başlangıç Madde No', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 4, defaultValue: '1' },
      {
        fieldId: 254,
        fieldName: 'OnlyUnnumbered',
        label: 'Sadece numarası olmayanlar',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 5,
      },
      { fieldId: 255, fieldName: 'U_Note', label: 'Not', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 6 },
    ],
  },

  SystemUserForm: {
    formId: 30,
    formCode: 'SystemUserForm',
    title: 'Kullanıcı',
    tableName: 'SystemUser',
    primaryKeyColumn: 'SystemUserID',
    fields: [
      { fieldId: 300, fieldName: 'NickName', label: 'Kullanıcı Adı', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 301, fieldName: 'Name', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 302, fieldName: 'Surname', label: 'Soyad', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 3 },
      {
        fieldId: 303,
        fieldName: 'Type',
        label: 'Tip',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Admin', value: '1' },
          { label: 'Kullanıcı', value: '2' },
        ]),
      },
      { fieldId: 305, fieldName: 'Password', label: 'Şifre', fieldType: 'password', isRequired: false, colSpan: 3, orderIndex: 5 },
      { fieldId: 306, fieldName: 'AuthCode', label: 'Yetki Kodu', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 6 },
      {
        fieldId: 307,
        fieldName: 'DefaultCompanyID',
        label: 'Öndeğer Firma',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 7,
        optionsJson: companyOptionsJson,
      },
      {
        fieldId: 308,
        fieldName: 'DefaultWorkplaceID',
        label: 'Öndeğer İş Yeri',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 8,
        optionsJson: workplaceOptionsJson,
      },
      {
        fieldId: 309,
        fieldName: 'DefaultWhouseID',
        label: 'Öndeğer Ambar',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 9,
        optionsJson: whouseOptionsJson,
      },
      {
        fieldId: 3100,
        fieldName: 'DefaultOrgUnitID',
        label: 'Öndeğer Bölüm/Birim',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 10,
        optionsJson: orgUnitOptionsJson,
      },
      { fieldId: 304, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 11 },
    ],
  },

  CompanyForm: {
    formId: 31,
    formCode: 'CompanyForm',
    title: 'Firma',
    tableName: 'SYS_Companies',
    primaryKeyColumn: 'CompanyId',
    /** Çok alanlı firma kartı: satırda 3 kutu */
    formColumns: 3,
    enableWorkplacesTab: true,
    /** Ambarlar işyeri kartı içinde yönetilir */
    enableWhousesTab: false,
    fields: [
      {
        fieldId: 3100,
        fieldName: 'IsActive',
        label: 'Aktif',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 2,
        orderIndex: 0,
        headerRight: true,
        defaultValue: 'true',
      },
      { fieldId: 310, fieldName: 'CompanyCode', label: 'Firma Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 311, fieldName: 'Title', label: 'Ünvan', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      { fieldId: 3111, fieldName: 'TradeTitle', label: 'Ticari Unvan', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
      {
        fieldId: 3112,
        fieldName: 'InstitutionType',
        label: 'Kurum Tipi',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: '— Seçiniz —', value: '' },
          { label: 'Tüzel Kişi', value: 'TUZEL' },
          { label: 'Gerçek Kişi', value: 'GERCEK' },
          { label: 'Kamu', value: 'KAMU' },
        ]),
      },
      { fieldId: 312, fieldName: 'TaxNumber', label: 'Vergi Numarası (VKN/TCKN)', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 5 },
      { fieldId: 313, fieldName: 'TaxOffice', label: 'Vergi Dairesi', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 6 },
      { fieldId: 3131, fieldName: 'TaxOfficeCode', label: 'VD Kodu', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 7 },
      { fieldId: 3132, fieldName: 'NaceCode', label: 'NACE Kodu', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 8 },
      { fieldId: 3133, fieldName: 'SskNo', label: 'SSK No', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 9 },
      { fieldId: 3161, fieldName: 'Street', label: 'Cadde', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 10, group: 'Adres' },
      { fieldId: 3162, fieldName: 'Street2', label: 'Sokak', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 11, group: 'Adres' },
      { fieldId: 3163, fieldName: 'DoorNo', label: 'Kapı No', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 12, group: 'Adres' },
      { fieldId: 3164, fieldName: 'PostalCode', label: 'Posta Kodu', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 13, group: 'Adres' },
      { fieldId: 317, fieldName: 'Town', label: 'İlçe', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 14, group: 'Adres' },
      { fieldId: 316, fieldName: 'City', label: 'Şehir / İl', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 15, group: 'Adres' },
      { fieldId: 3165, fieldName: 'Country', label: 'Ülke', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 16, group: 'Adres', defaultValue: 'TR' },
      { fieldId: 318, fieldName: 'AddressText', label: 'Açık Adres', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 17, group: 'Adres' },
      { fieldId: 315, fieldName: 'Phone', label: 'Telefon (1)', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 18, group: 'İletişim' },
      { fieldId: 3151, fieldName: 'Phone2', label: 'Telefon (2)', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 19, group: 'İletişim' },
      { fieldId: 3152, fieldName: 'Fax', label: 'Faks', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 20, group: 'İletişim' },
      { fieldId: 3153, fieldName: 'Email', label: 'E-posta', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 21, group: 'İletişim' },
      { fieldId: 3154, fieldName: 'WebAddress', label: 'Web Adresi', fieldType: 'text', isRequired: false, colSpan: 6, orderIndex: 22, group: 'İletişim' },
      {
        fieldId: 320,
        fieldName: 'PeriodStartDate',
        label: 'Firma Dönem Başlangıç Tarihi',
        fieldType: 'date',
        isRequired: false,
        colSpan: 4,
        orderIndex: 30,
        group: 'Dönem / e-Belge Başlangıç',
        helpText: 'Mali / muhasebe döneminin başladığı gün (genelde 01.01).',
      },
      {
        fieldId: 321,
        fieldName: 'EDefterStartDate',
        label: 'e-Defter Başlangıç Tarihi',
        fieldType: 'date',
        isRequired: false,
        colSpan: 4,
        orderIndex: 31,
        group: 'Dönem / e-Belge Başlangıç',
        helpText: 'e-Defter geçiş / zorunluluk başlangıcı.',
      },
      {
        fieldId: 322,
        fieldName: 'EInvoiceStartDate',
        label: 'e-Fatura Başlangıç Tarihi',
        fieldType: 'date',
        isRequired: false,
        colSpan: 4,
        orderIndex: 32,
        group: 'Dönem / e-Belge Başlangıç',
        helpText: 'e-Fatura mükellefiyetine geçiş tarihi.',
      },
      {
        fieldId: 370,
        fieldName: 'CalendarType',
        label: 'Takvim Türü',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 40,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: 'Miladi', value: 'Miladi' },
          { label: 'Hicri', value: 'Hicri' },
        ]),
        defaultValue: 'Miladi',
      },
      {
        fieldId: 371,
        fieldName: 'FiscalYearStartMonth',
        label: 'Mali Yıl Başlangıç Ayı',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 41,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: '1 — Ocak', value: '1' },
          { label: '2 — Şubat', value: '2' },
          { label: '3 — Mart', value: '3' },
          { label: '4 — Nisan', value: '4' },
          { label: '5 — Mayıs', value: '5' },
          { label: '6 — Haziran', value: '6' },
          { label: '7 — Temmuz', value: '7' },
          { label: '8 — Ağustos', value: '8' },
          { label: '9 — Eylül', value: '9' },
          { label: '10 — Ekim', value: '10' },
          { label: '11 — Kasım', value: '11' },
          { label: '12 — Aralık', value: '12' },
        ]),
        defaultValue: '1',
      },
      {
        fieldId: 372,
        fieldName: 'DbLanguage',
        label: 'Veritabanı Dili',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 42,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: 'Türkçe', value: 'tr' },
          { label: 'English', value: 'en' },
        ]),
        defaultValue: 'tr',
      },
      {
        fieldId: 373,
        fieldName: 'CurrencyCode',
        label: 'Para Birimi',
        fieldType: 'text',
        isRequired: false,
        colSpan: 3,
        orderIndex: 43,
        group: 'Çalışma Bilgileri',
        defaultValue: 'TRY',
      },
      {
        fieldId: 374,
        fieldName: 'ReportCurrency',
        label: 'Raporlama Birimi',
        fieldType: 'text',
        isRequired: false,
        colSpan: 3,
        orderIndex: 44,
        group: 'Çalışma Bilgileri',
        defaultValue: 'TRY',
      },
      {
        fieldId: 375,
        fieldName: 'VatRounding',
        label: 'KDV Yuvarlama',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 45,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: 'En Yakın Alt Birime', value: 'NEAREST_LOW' },
          { label: 'En Yakın Üst Birime', value: 'NEAREST_HIGH' },
          { label: 'Standart', value: 'STANDARD' },
        ]),
        defaultValue: 'NEAREST_LOW',
      },
      {
        fieldId: 376,
        fieldName: 'FxRateSource',
        label: 'Döviz Kur Kaynağı',
        fieldType: 'select',
        isRequired: false,
        colSpan: 5,
        orderIndex: 46,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: 'Merkez Bankası', value: 'TCMB' },
          { label: 'Manuel', value: 'MANUAL' },
        ]),
        defaultValue: 'TCMB',
      },
      { fieldId: 380, fieldName: 'AdvisorName', label: 'Adı', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 50, group: 'Mali Müşavir' },
      { fieldId: 381, fieldName: 'AdvisorSurname', label: 'Soyadı', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 51, group: 'Mali Müşavir' },
      { fieldId: 382, fieldName: 'AdvisorTckn', label: 'TC Kimlik No', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 52, group: 'Mali Müşavir' },
      { fieldId: 383, fieldName: 'AdvisorPhone', label: 'Telefon', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 53, group: 'Mali Müşavir' },
      { fieldId: 384, fieldName: 'AdvisorEmail', label: 'E-posta', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 54, group: 'Mali Müşavir' },
      { fieldId: 385, fieldName: 'AdvisorTaxOffice', label: 'Vergi Dairesi', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 55, group: 'Mali Müşavir' },
      { fieldId: 386, fieldName: 'AdvisorTaxNr', label: 'Vergi No', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 56, group: 'Mali Müşavir' },
      { fieldId: 387, fieldName: 'AdvisorChamberNo', label: 'Oda Sicil No', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 57, group: 'Mali Müşavir' },
      { fieldId: 388, fieldName: 'AdvisorAddress', label: 'Adres', fieldType: 'textarea', isRequired: false, colSpan: 9, orderIndex: 58, group: 'Mali Müşavir' },
      { fieldId: 389, fieldName: 'AdvisorContractDesc', label: 'Sözleşme Açıklaması', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 59, group: 'Mali Müşavir' },
      { fieldId: 390, fieldName: 'AdvisorContractType', label: 'Sözleşme Tipi', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 60, group: 'Mali Müşavir' },
      { fieldId: 391, fieldName: 'AdvisorContractNo', label: 'Sözleşme No', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 61, group: 'Mali Müşavir' },
      { fieldId: 392, fieldName: 'AdvisorContractEnd', label: 'Bitiş Tarihi', fieldType: 'date', isRequired: false, colSpan: 2, orderIndex: 62, group: 'Mali Müşavir' },
      {
        fieldId: 400,
        fieldName: 'EDevletKontrolTipi',
        label: 'e-Devlet Kontrol Tipi',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 70,
        group: 'e-Devlet',
        optionsJson: select([
          { label: 'Firma Bazında', value: 'FIRMA' },
          { label: 'İşyeri Bazında', value: 'ISYERI' },
        ]),
        defaultValue: 'ISYERI',
        helpText: 'İşyeri Bazında seçilirse e-Fatura / e-Defter bilgileri her işyerinde ayrı girilir.',
      },
      {
        fieldId: 401,
        fieldName: 'OnlineSend',
        label: 'Online Gönderme',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 3,
        orderIndex: 71,
        group: 'e-Devlet',
        defaultValue: 'false',
      },
      {
        fieldId: 330,
        fieldName: 'PostLabel',
        label: 'Gelen PK (Posta Kutusu)',
        fieldType: 'text',
        isRequired: false,
        colSpan: 6,
        orderIndex: 72,
        group: 'e-Devlet',
      },
      {
        fieldId: 331,
        fieldName: 'SenderLabel',
        label: 'Giden GB (Gönderici Etiketi)',
        fieldType: 'text',
        isRequired: false,
        colSpan: 6,
        orderIndex: 73,
        group: 'e-Devlet',
      },
      {
        fieldId: 332,
        fieldName: 'EinvoiceEmail',
        label: 'e-Fatura E-posta',
        fieldType: 'text',
        isRequired: false,
        colSpan: 6,
        orderIndex: 74,
        group: 'e-Devlet',
      },
      {
        fieldId: 333,
        fieldName: 'MukellefCheckStatus',
        label: 'Mükellef Kontrol Sonucu',
        fieldType: 'text',
        isRequired: false,
        colSpan: 6,
        orderIndex: 75,
        group: 'e-Devlet',
        isReadOnly: true,
      },
      {
        fieldId: 340,
        fieldName: 'IntegratorName',
        label: 'Entegratör',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 80,
        group: 'Entegratör Bilgileri',
        optionsJson: select([
          { label: '— Seçiniz —', value: '' },
          { label: 'e-Logo', value: 'ELOGO' },
          { label: 'GİB Portal', value: 'GIB' },
          { label: 'Logo', value: 'LOGO' },
          { label: 'EDM', value: 'EDM' },
          { label: 'Sovos / Foriba', value: 'SOVOS' },
          { label: 'NES', value: 'NES' },
          { label: 'Diğer', value: 'OTHER' },
        ]),
      },
      {
        fieldId: 341,
        fieldName: 'IntegratorWsUrl',
        label: 'Web Servis / Öndeğer Adres',
        fieldType: 'text',
        isRequired: false,
        colSpan: 8,
        orderIndex: 81,
        group: 'Entegratör Bilgileri',
        defaultValue: 'https://connect.elogo.com.tr/services/EdocumentService.svc',
      },
      {
        fieldId: 342,
        fieldName: 'IntegratorUser',
        label: 'Kullanıcı Adı',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 82,
        group: 'Entegratör Bilgileri',
      },
      {
        fieldId: 343,
        fieldName: 'IntegratorPassword',
        label: 'Şifre',
        fieldType: 'password',
        isRequired: false,
        colSpan: 4,
        orderIndex: 83,
        group: 'Entegratör Bilgileri',
      },
      {
        fieldId: 344,
        fieldName: 'IntegratorVkN',
        label: 'Entegratör VKN',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 84,
        group: 'Entegratör Bilgileri',
      },
      {
        fieldId: 345,
        fieldName: 'IntegratorApiKey',
        label: 'ApiKey',
        fieldType: 'password',
        isRequired: false,
        colSpan: 6,
        orderIndex: 85,
        group: 'Entegratör Bilgileri',
      },
      {
        fieldId: 350,
        fieldName: 'EnableMukellefCheck',
        label: 'Mükellef Kontrol Aktif',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 90,
        group: 'Entegratör Bilgileri',
        defaultValue: 'true',
      },
      {
        fieldId: 351,
        fieldName: 'EnableInvoiceSend',
        label: 'Fatura Gönder',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 91,
        group: 'Entegratör Bilgileri',
        defaultValue: 'true',
      },
      {
        fieldId: 352,
        fieldName: 'EnableInvoiceReceive',
        label: 'Fatura Al',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 4,
        orderIndex: 92,
        group: 'Entegratör Bilgileri',
        defaultValue: 'true',
      },
    ],
    workplaceFields: [
      { fieldId: 3610, fieldName: 'Code', label: 'İşyeri Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1, group: 'Genel' },
      { fieldId: 3611, fieldName: 'Title', label: 'İşyeri Adı', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2, group: 'Genel' },
      { fieldId: 3612, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 3, group: 'Genel', defaultValue: 'true' },
      { fieldId: 3613, fieldName: 'TaxNumber', label: 'VKN / TCKN', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 4, group: 'Genel' },
      { fieldId: 3614, fieldName: 'TaxOffice', label: 'Vergi Dairesi', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 5, group: 'Genel' },
      { fieldId: 3615, fieldName: 'TaxOfficeCode', label: 'VD Kodu', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 6, group: 'Genel' },
      { fieldId: 3616, fieldName: 'NaceCode', label: 'NACE', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 7, group: 'Genel' },
      { fieldId: 3617, fieldName: 'SskNo', label: 'SSK No', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 8, group: 'Genel' },
      { fieldId: 3620, fieldName: 'Street', label: 'Cadde', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 10, group: 'Adres' },
      { fieldId: 3621, fieldName: 'Street2', label: 'Sokak', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 11, group: 'Adres' },
      { fieldId: 3622, fieldName: 'DoorNo', label: 'Kapı No', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 12, group: 'Adres' },
      { fieldId: 3623, fieldName: 'PostalCode', label: 'Posta Kodu', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 13, group: 'Adres' },
      { fieldId: 3624, fieldName: 'Town', label: 'İlçe', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 14, group: 'Adres' },
      { fieldId: 3625, fieldName: 'City', label: 'Şehir', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 15, group: 'Adres' },
      { fieldId: 3626, fieldName: 'Country', label: 'Ülke', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 16, group: 'Adres', defaultValue: 'TR' },
      { fieldId: 3627, fieldName: 'AddressText', label: 'Açık Adres', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 17, group: 'Adres' },
      { fieldId: 3630, fieldName: 'Phone', label: 'Telefon', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 20, group: 'İletişim' },
      { fieldId: 3631, fieldName: 'Phone2', label: 'Telefon 2', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 21, group: 'İletişim' },
      { fieldId: 3632, fieldName: 'Fax', label: 'Faks', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 22, group: 'İletişim' },
      { fieldId: 3633, fieldName: 'Email', label: 'E-posta', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 23, group: 'İletişim' },
      { fieldId: 3634, fieldName: 'WebAddress', label: 'Web', fieldType: 'text', isRequired: false, colSpan: 6, orderIndex: 24, group: 'İletişim' },
      {
        fieldId: 3640,
        fieldName: 'CalendarType',
        label: 'Takvim',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 30,
        group: 'Çalışma Bilgileri',
        optionsJson: select([{ label: 'Miladi', value: 'Miladi' }]),
        defaultValue: 'Miladi',
      },
      {
        fieldId: 3641,
        fieldName: 'FiscalYearStartMonth',
        label: 'Mali Yıl Ayı',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 31,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: '1 — Ocak', value: '1' },
          { label: '4 — Nisan', value: '4' },
          { label: '7 — Temmuz', value: '7' },
          { label: '10 — Ekim', value: '10' },
        ]),
        defaultValue: '1',
      },
      { fieldId: 3642, fieldName: 'CurrencyCode', label: 'Para Birimi', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 32, group: 'Çalışma Bilgileri', defaultValue: 'TRY' },
      { fieldId: 3643, fieldName: 'ReportCurrency', label: 'Raporlama', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 33, group: 'Çalışma Bilgileri', defaultValue: 'TRY' },
      {
        fieldId: 3644,
        fieldName: 'VatRounding',
        label: 'KDV Yuvarlama',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 34,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: 'En Yakın Alt Birime', value: 'NEAREST_LOW' },
          { label: 'Standart', value: 'STANDARD' },
        ]),
        defaultValue: 'NEAREST_LOW',
      },
      {
        fieldId: 3645,
        fieldName: 'FxRateSource',
        label: 'Kur Kaynağı',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 35,
        group: 'Çalışma Bilgileri',
        optionsJson: select([
          { label: 'Merkez Bankası', value: 'TCMB' },
          { label: 'Manuel', value: 'MANUAL' },
        ]),
        defaultValue: 'TCMB',
      },
      { fieldId: 3650, fieldName: 'PeriodStartDate', label: 'Dönem Başlangıç', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 40, group: 'e-Devlet' },
      { fieldId: 3651, fieldName: 'EDefterStartDate', label: 'e-Defter Başlangıç', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 41, group: 'e-Devlet' },
      { fieldId: 3652, fieldName: 'EInvoiceStartDate', label: 'e-Fatura Başlangıç', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 42, group: 'e-Devlet' },
      { fieldId: 3653, fieldName: 'PostLabel', label: 'Gelen PK', fieldType: 'text', isRequired: false, colSpan: 6, orderIndex: 43, group: 'e-Devlet' },
      { fieldId: 3654, fieldName: 'SenderLabel', label: 'Giden GB', fieldType: 'text', isRequired: false, colSpan: 6, orderIndex: 44, group: 'e-Devlet' },
      { fieldId: 3655, fieldName: 'EinvoiceEmail', label: 'e-Fatura E-posta', fieldType: 'text', isRequired: false, colSpan: 6, orderIndex: 45, group: 'e-Devlet' },
      {
        fieldId: 3660,
        fieldName: 'IntegratorName',
        label: 'Entegratör',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 50,
        group: 'Entegratör',
        optionsJson: select([
          { label: '— Seçiniz —', value: '' },
          { label: 'e-Logo', value: 'ELOGO' },
          { label: 'GİB Portal', value: 'GIB' },
          { label: 'Logo', value: 'LOGO' },
          { label: 'EDM', value: 'EDM' },
          { label: 'Diğer', value: 'OTHER' },
        ]),
      },
      { fieldId: 3661, fieldName: 'IntegratorWsUrl', label: 'WS URL', fieldType: 'text', isRequired: false, colSpan: 8, orderIndex: 51, group: 'Entegratör' },
      { fieldId: 3662, fieldName: 'IntegratorUser', label: 'Kullanıcı', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 52, group: 'Entegratör' },
      { fieldId: 3663, fieldName: 'IntegratorPassword', label: 'Şifre', fieldType: 'password', isRequired: false, colSpan: 4, orderIndex: 53, group: 'Entegratör' },
      { fieldId: 3664, fieldName: 'IntegratorVkN', label: 'Entegratör VKN', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 54, group: 'Entegratör' },
      { fieldId: 3665, fieldName: 'IntegratorApiKey', label: 'ApiKey', fieldType: 'password', isRequired: false, colSpan: 6, orderIndex: 55, group: 'Entegratör' },
      { fieldId: 3666, fieldName: 'OnlineSend', label: 'Online Gönder', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 56, group: 'Entegratör' },
      { fieldId: 3667, fieldName: 'EnableMukellefCheck', label: 'Mükellef Kontrol', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 57, group: 'Entegratör', defaultValue: 'true' },
      { fieldId: 3668, fieldName: 'EnableInvoiceSend', label: 'Fatura Gönder', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 58, group: 'Entegratör', defaultValue: 'true' },
      { fieldId: 3669, fieldName: 'EnableInvoiceReceive', label: 'Fatura Al', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 59, group: 'Entegratör', defaultValue: 'true' },
    ],
    whouseFields: [
      { fieldId: 3720, fieldName: 'WhouseCode', label: 'Ambar Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 3721, fieldName: 'Name', label: 'Ambar Adı', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 3722,
        fieldName: 'WorkplaceCode',
        label: 'İşyeri',
        fieldType: 'select',
        isRequired: true,
        colSpan: 2,
        orderIndex: 3,
        useLookup: false,
        optionsJson: '[{"label":"— İşyeri —","value":""}]',
      },
      { fieldId: 3723, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 4, defaultValue: 'true' },
    ],
  },

  WorkplaceForm: {
    formId: 33,
    formCode: 'WorkplaceForm',
    title: 'İşyeri',
    tableName: 'SYS_Workplace',
    primaryKeyColumn: 'WorkplaceID',
    fields: [
      {
        fieldId: 330,
        fieldName: 'CompanyID',
        label: 'Firma',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        optionsJson: companyOptionsJson,
      },
      { fieldId: 331, fieldName: 'Code', label: 'İşyeri Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 332, fieldName: 'Title', label: 'İşyeri Adı', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 3 },
      { fieldId: 333, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 4 },
    ],
  },

  WarehouseForm: {
    formId: 32,
    formCode: 'WarehouseForm',
    title: 'Ambar',
    tableName: 'SYS_Whouse',
    primaryKeyColumn: 'WhouseId',
    fields: [
      {
        fieldId: 320,
        fieldName: 'CompanyId',
        label: 'Firma',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: companyOptionsJson,
      },
      {
        fieldId: 321,
        fieldName: 'WorkplaceID',
        label: 'İş Yeri',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 2,
        optionsJson: workplaceOptionsJson,
      },
      { fieldId: 322, fieldName: 'WhouseCode', label: 'Ambar Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 3 },
      { fieldId: 323, fieldName: 'Name', label: 'Ambar Adı', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 4 },
      { fieldId: 324, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 5 },
    ],
  },

  OrgUnitForm: {
    formId: 34,
    formCode: 'OrgUnitForm',
    title: 'Bölüm / Birim',
    tableName: 'SYS_OrgUnit',
    primaryKeyColumn: 'OrgUnitID',
    fields: [
      { fieldId: 340, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 341, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 342,
        fieldName: 'UnitKind',
        label: 'Tür',
        fieldType: 'select',
        isRequired: true,
        colSpan: 2,
        orderIndex: 3,
        optionsJson: select([
          { label: 'Bölüm', value: '1' },
          { label: 'Birim', value: '2' },
        ]),
        defaultValue: '1',
      },
      {
        fieldId: 343,
        fieldName: 'CompanyID',
        label: 'Firma (opsiyonel)',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: companyOptionsJson,
      },
      { fieldId: 344, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 5 },
    ],
  },

  CurrencyForm: {
    formId: 35,
    formCode: 'CurrencyForm',
    title: 'Döviz',
    tableName: 'SYS_Currency',
    primaryKeyColumn: 'CurrencyID',
    fields: [
      { fieldId: 350, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 2, orderIndex: 1 },
      { fieldId: 351, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 352, fieldName: 'Symbol', label: 'Sembol', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 3 },
      { fieldId: 353, fieldName: 'Rate', label: 'Kur', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 4, defaultValue: '1' },
      { fieldId: 354, fieldName: 'IsLocal', label: 'Yerel (TL)', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 5 },
      { fieldId: 355, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 6 },
      { fieldId: 356, fieldName: 'AutoRate', label: "TCMB'den otomatik indir", fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 7 },
    ],
  },

  NumberTemplateForm: {
    formId: 37,
    formCode: 'NumberTemplateForm',
    title: 'Kayıt Numaralama Şablonu',
    tableName: 'SYS_NumberTemplate',
    primaryKeyColumn: 'TemplateId',
    fields: [
      { fieldId: 3700, fieldName: 'Code', label: 'Şablon Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1, group: 'Genel' },
      { fieldId: 3701, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2, group: 'Genel' },
      {
        fieldId: 3702,
        fieldName: 'IsActive',
        label: 'Aktif',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 2,
        orderIndex: 3,
        defaultValue: 'true',
        headerRight: true,
      },
      {
        fieldId: 3710,
        fieldName: 'CardCode',
        label: 'Kart Kodu',
        fieldType: 'text',
        isRequired: false,
        colSpan: 2,
        orderIndex: 4,
        group: 'Genel',
        defaultValue: '*',
        helpText: '* = tüm kartlar',
      },
      {
        fieldId: 3703,
        fieldName: 'FormCode',
        label: 'Form Kodu',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 5,
        group: 'Genel',
        helpText: 'Örn: SalesInvoiceForm — boşsa Tablo ile eşleşir',
      },
      {
        fieldId: 3704,
        fieldName: 'TableName',
        label: 'Tablo',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 6,
        group: 'Genel',
        optionsJson: select([
          { label: '— Seçiniz —', value: '' },
          { label: 'Invoice (Fatura)', value: 'Invoice' },
          { label: 'OrderVoucher (Sipariş)', value: 'OrderVoucher' },
          { label: 'ProductVoucher (İrsaliye)', value: 'ProductVoucher' },
          { label: 'CustomerVoucher (Cari Fiş)', value: 'CustomerVoucher' },
          { label: 'BankVoucher (Banka Fiş)', value: 'BankVoucher' },
          { label: 'AccountVoucher (Muhasebe)', value: 'AccountVoucher' },
        ]),
      },
      {
        fieldId: 3705,
        fieldName: 'ScopeType',
        label: 'Sayaç Kapsamı',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 7,
        group: 'Genel',
        optionsJson: select([
          { label: '0 — Genel', value: '0' },
          { label: '1 — Firma', value: '1' },
          { label: '2 — İşyeri', value: '2' },
          { label: '3 — Ambar', value: '3' },
          { label: '4 — Kullanıcı', value: '4' },
        ]),
        defaultValue: '0',
        helpText: 'Sayaç bu boyutta ayrı ilerler',
      },
      {
        fieldId: 3711,
        fieldName: 'StartNumber',
        label: 'Başlangıç Numarası',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 8,
        group: 'Seçenekler',
        defaultValue: '1',
      },
      {
        fieldId: 3712,
        fieldName: 'EndNumber',
        label: 'Bitiş Numarası',
        fieldType: 'number',
        isRequired: false,
        colSpan: 3,
        orderIndex: 9,
        group: 'Seçenekler',
        helpText: 'Boş = sınırsız',
      },
      {
        fieldId: 3713,
        fieldName: 'ValidFrom',
        label: 'Geçerlilik Başlangıç',
        fieldType: 'date',
        isRequired: false,
        colSpan: 3,
        orderIndex: 10,
        group: 'Geçerlilik Tarihleri',
        defaultValue: '1900-01-01',
        helpText: 'Fiş tarihi bu aralıkta olmalı',
      },
      {
        fieldId: 3714,
        fieldName: 'ValidTo',
        label: 'Geçerlilik Bitiş',
        fieldType: 'date',
        isRequired: false,
        colSpan: 3,
        orderIndex: 11,
        group: 'Geçerlilik Tarihleri',
        defaultValue: '2100-12-31',
      },
      {
        fieldId: 3715,
        fieldName: 'PeriodKind',
        label: 'Dönem Sıfırlama',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 12,
        group: 'Seçenekler',
        optionsJson: select([
          { label: '0 — Otomatik (şablondan)', value: '0' },
          { label: '1 — Yıl', value: '1' },
          { label: '2 — Ay', value: '2' },
          { label: '3 — Hafta', value: '3' },
          { label: '4 — Gün', value: '4' },
          { label: '5 — Çeyrek yıl', value: '5' },
        ]),
        defaultValue: '0',
        helpText: 'Sayaç hangi dönemde sıfırlansın',
      },
      {
        fieldId: 3706,
        fieldName: 'Pattern',
        label: 'Numara Şablonu',
        fieldType: 'text',
        isRequired: true,
        colSpan: 8,
        orderIndex: 13,
        group: 'Numara Bölümleri',
        defaultValue: '{CO}-{YYYY}{SEQ:6}',
        helpText:
          '{YYYY}{YY} {MM}/{AY} {DD}/{GUN} {WW}/{HAFTA} {Q}/{CEYREK} · {SEQ:6} · {CO}/{FIRMA} {WP}/{ISYERI} {WH}/{AMBAR} {USR}/{KULLANICI}',
      },
      {
        fieldId: 3707,
        fieldName: 'SeqPad',
        label: 'Sıra Basamak',
        fieldType: 'number',
        isRequired: true,
        colSpan: 2,
        orderIndex: 14,
        group: 'Numara Bölümleri',
        defaultValue: '6',
      },
      {
        fieldId: 3708,
        fieldName: 'Priority',
        label: 'Öncelik',
        fieldType: 'number',
        isRequired: false,
        colSpan: 2,
        orderIndex: 15,
        group: 'Numara Bölümleri',
        defaultValue: '10',
      },
      {
        fieldId: 3720,
        fieldName: 'FilterCompanyID',
        label: 'Firma',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 20,
        group: 'Organizasyon Seçenekleri',
        optionsJson: select([{ label: '[Genel]', value: '' }, ...companyOptions()]),
        useLookup: false,
        helpText: 'Boş = [Genel] tüm firmalar',
      },
      {
        fieldId: 3721,
        fieldName: 'FilterWorkplaceID',
        label: 'İşyeri',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 21,
        group: 'Organizasyon Seçenekleri',
        optionsJson: select([{ label: '[Genel]', value: '' }, ...workplaceOptions()]),
        useLookup: false,
        helpText: 'Boş = [Genel]',
      },
      {
        fieldId: 3722,
        fieldName: 'FilterWhouseID',
        label: 'Ambar',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 22,
        group: 'Organizasyon Seçenekleri',
        optionsJson: select([{ label: '[Genel]', value: '' }, ...whouseOptions()]),
        useLookup: false,
        helpText: 'Boş = [Genel]',
      },
      {
        fieldId: 3723,
        fieldName: 'FilterUserId',
        label: 'Kullanıcı',
        fieldType: 'text',
        isRequired: false,
        colSpan: 3,
        orderIndex: 23,
        group: 'Kullanıcı Seçenekleri',
        helpText: 'Kullanıcı Id veya adı · boş = [Genel]',
      },
      {
        fieldId: 3709,
        fieldName: 'Notes',
        label: 'Not',
        fieldType: 'textarea',
        isRequired: false,
        colSpan: 12,
        orderIndex: 30,
        group: 'Genel',
      },
    ],
  },

  FormPostSaveForm: {
    formId: 36,
    formCode: 'FormPostSaveForm',
    title: 'Kaydet Sonrası Komut',
    tableName: 'SYS_FormPostSave',
    primaryKeyColumn: 'FormPostSaveID',
    fields: [
      {
        fieldId: 360,
        fieldName: 'FormCode',
        label: 'Form Kodu',
        fieldType: 'text',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        helpText: 'Örn: SalesInvoiceForm, CompanyForm, CustomerCardForm',
      },
      { fieldId: 361, fieldName: 'Title', label: 'Başlık', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 2 },
      { fieldId: 362, fieldName: 'ActionOrder', label: 'Sıra', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 3, defaultValue: '10' },
      {
        fieldId: 363,
        fieldName: 'ActionType',
        label: 'Tip',
        fieldType: 'select',
        isRequired: true,
        colSpan: 2,
        orderIndex: 4,
        optionsJson: select([
          { label: 'SQL', value: 'sql' },
          { label: 'API', value: 'api' },
        ]),
        defaultValue: 'sql',
      },
      {
        fieldId: 364,
        fieldName: 'CommandText',
        label: 'Komut',
        fieldType: 'textarea',
        isRequired: true,
        colSpan: 12,
        orderIndex: 5,
        helpText:
          'Yer tutucular: {recId} {ID} {pk} {Code} {Title} {DocumentNumber} {VoucherNo} {InvoiceNo} {CustomerID} {WhouseID} … — Yardım butonuna bakın',
      },
      {
        fieldId: 365,
        fieldName: 'Notes',
        label: 'Not',
        fieldType: 'text',
        isRequired: false,
        colSpan: 8,
        orderIndex: 6,
        helpText: 'Örn: Fiş onay / entegratör gönderim',
      },
      { fieldId: 366, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 7 },
    ],
  },
};

/** Aynı tablo + tip alanı (Type_ / VoucherType / InvoiceType) */
function typedDocumentSchema(
  baseCode: string,
  formCode: string,
  title: string,
  formId: number,
  typeField: string,
  typeValue: string,
): FormSchemaDto {
  const base = FORM_SCHEMAS[baseCode];
  return {
    ...base,
    formId,
    formCode,
    title,
    documentLayout: 'trade',
    fields: base.fields.filter((f) => f.fieldName !== typeField).map((f) => ({ ...f })),
    lineFields: base.lineFields?.map((f) => ({ ...f })),
    fixedStandardFields: { ...(base.fixedStandardFields || {}), [typeField]: typeValue },
  };
}

// Müşteri kartı → CustomerCard.CardKind = 1 (satış yapılınca / «Cariye Dönüştür» ile cari olur)
FORM_SCHEMAS.MusteriCardForm = {
  ...FORM_SCHEMAS.CustomerCardForm,
  formId: 775,
  formCode: 'MusteriCardForm',
  title: 'Müşteri Kartı',
  fields: FORM_SCHEMAS.CustomerCardForm.fields.map((f) =>
    f.fieldName === 'Code' ? { ...f, label: 'Müşteri Kodu' } : { ...f },
  ),
  fixedStandardFields: { ...(FORM_SCHEMAS.CustomerCardForm.fixedStandardFields || {}), CardKind: 1 },
};

// Sipariş → OrderVoucher.Type_
FORM_SCHEMAS.SalesOrderForm = typedDocumentSchema('OrderVoucherForm', 'SalesOrderForm', 'Satış Siparişi', 41, 'Type_', OrderType.Satis);
FORM_SCHEMAS.PurchaseOrderForm = typedDocumentSchema('OrderVoucherForm', 'PurchaseOrderForm', 'Alış Siparişi', 42, 'Type_', OrderType.Alis);
FORM_SCHEMAS.SalesReturnOrderForm = typedDocumentSchema('OrderVoucherForm', 'SalesReturnOrderForm', 'Satış İade Siparişi', 43, 'Type_', OrderType.SatisIade);
FORM_SCHEMAS.PurchaseReturnOrderForm = typedDocumentSchema('OrderVoucherForm', 'PurchaseReturnOrderForm', 'Alış İade Siparişi', 44, 'Type_', OrderType.AlisIade);
FORM_SCHEMAS.PurchaseRequestForm = typedDocumentSchema('OrderVoucherForm', 'PurchaseRequestForm', 'Alış Talebi', 411, 'Type_', OrderType.AlisTalep);
FORM_SCHEMAS.SalesRequestForm = typedDocumentSchema('OrderVoucherForm', 'SalesRequestForm', 'Satış Talebi', 412, 'Type_', OrderType.SatisTalep);

// İrsaliye / malzeme fişi → ProductVoucher.VoucherType (Create_DB: 1 Devir, 2 Alım, 3…)
FORM_SCHEMAS.SalesDispatchForm = typedDocumentSchema('ProductVoucherForm', 'SalesDispatchForm', 'Satış İrsaliyesi', 45, 'VoucherType', DispatchType.Satis);
FORM_SCHEMAS.PurchaseDispatchForm = typedDocumentSchema('ProductVoucherForm', 'PurchaseDispatchForm', 'Alış İrsaliyesi', 46, 'VoucherType', DispatchType.Alis);
FORM_SCHEMAS.SalesReturnDispatchForm = typedDocumentSchema('ProductVoucherForm', 'SalesReturnDispatchForm', 'Satış İade İrsaliyesi', 47, 'VoucherType', DispatchType.SatisIade);
FORM_SCHEMAS.PurchaseReturnDispatchForm = typedDocumentSchema('ProductVoucherForm', 'PurchaseReturnDispatchForm', 'Alış İade İrsaliyesi', 48, 'VoucherType', DispatchType.AlisIade);
FORM_SCHEMAS.StockTransferForm = typedDocumentSchema('ProductVoucherForm', 'StockTransferForm', 'Ambar Transfer Fişi', 53, 'VoucherType', DispatchType.Transfer);
FORM_SCHEMAS.StockOpeningForm = typedDocumentSchema('ProductVoucherForm', 'StockOpeningForm', 'Devir Fişi', 54, 'VoucherType', DispatchType.Devir);
FORM_SCHEMAS.StockCountForm = typedDocumentSchema('ProductVoucherForm', 'StockCountForm', 'Sayım Fişi', 55, 'VoucherType', DispatchType.Sayim);
FORM_SCHEMAS.CostAllocationForm = typedDocumentSchema(
  'MaterialVoucherForm',
  'CostAllocationForm',
  'Maliyet Dağıtım Fişi',
  59,
  'VoucherType',
  DispatchType.MaliyetDagitim,
);

// Fatura → Invoice.InvoiceType (fiş türü formda seçilir; ayrı iade menüsü yok)
function invoiceModuleSchema(
  formCode: string,
  title: string,
  formId: number,
  typeOptions: { label: string; value: string }[],
  defaultType: string,
): FormSchemaDto {
  const base = FORM_SCHEMAS.InvoiceForm;
  const fields = [
    {
      fieldId: 82,
      fieldName: 'InvoiceType',
      label: 'Fiş Türü',
      fieldType: 'select' as const,
      isRequired: true,
      colSpan: 4,
      orderIndex: 0,
      optionsJson: select(typeOptions),
      defaultValue: defaultType,
    },
    ...base.fields.map((f) => ({ ...f, orderIndex: f.orderIndex + 1 })),
  ];
  return {
    ...base,
    formId,
    formCode,
    title,
    fields,
    lineFields: base.lineFields?.map((f) => ({ ...f })),
    postSave: base.postSave ? [...base.postSave] : undefined,
  };
}

FORM_SCHEMAS.SalesInvoiceForm = invoiceModuleSchema(
  'SalesInvoiceForm',
  'Satış Faturası',
  49,
  [
    { label: 'Satış Faturası', value: InvoiceType.Satis },
    { label: 'Satış İade Faturası', value: InvoiceType.SatisIade },
    { label: 'Satış Fiyat Farkı Faturası (Alınan)', value: InvoiceType.SatisFiyatFarki },
  ],
  InvoiceType.Satis,
);
FORM_SCHEMAS.PurchaseInvoiceForm = invoiceModuleSchema(
  'PurchaseInvoiceForm',
  'Alış Faturası',
  50,
  [
    { label: 'Alış Faturası', value: InvoiceType.Alis },
    { label: 'Alış İade Faturası', value: InvoiceType.AlisIade },
    { label: 'Alınan Hizmet Faturası', value: InvoiceType.AlinanHizmet },
    { label: 'Satınalma Fiyat Farkı Faturası', value: InvoiceType.AlisFiyatFarki },
  ],
  InvoiceType.Alis,
);

// Create_DB kart / finans / sistem formları
Object.assign(FORM_SCHEMAS, {
  ProductSubForm: {
    formId: 60, formCode: 'ProductSubForm', title: 'Alt Malzeme / Reçete', tableName: 'ProductSub', primaryKeyColumn: 'ProductSubID',
    // Not: UI'da ProductCardForm içinde sekme; bu şema referans / yetki ağacı için tutulur
    fields: [
      { fieldId: 600, fieldName: 'MainProductCardID', label: 'Ana Malzeme', fieldType: 'select', isRequired: true, colSpan: 6, orderIndex: 1, optionsJson: select([{ label: 'URN-001 — Demo Ürün', value: '1' }]) },
      { fieldId: 601, fieldName: 'SubProductCardID', label: 'Alt Malzeme', fieldType: 'select', isRequired: true, colSpan: 6, orderIndex: 2, optionsJson: select([{ label: 'URN-002 — Vida M8', value: '2' }]) },
      { fieldId: 602, fieldName: 'Quantity', label: 'Miktar', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 3 },
      { fieldId: 603, fieldName: 'UnitID', label: 'Birim', fieldType: 'select', isRequired: false, colSpan: 4, orderIndex: 4, optionsJson: unitOptions },
      { fieldId: 604, fieldName: 'Type', label: 'Tip', fieldType: 'select', isRequired: false, colSpan: 4, orderIndex: 5, optionsJson: select([{ label: 'Reçete', value: '1' }, { label: 'Karma Koli', value: '2' }]) },
    ],
  },
  ProductBarcodeForm: {
    formId: 61, formCode: 'ProductBarcodeForm', title: 'Barkod', tableName: 'ProductBarcode', primaryKeyColumn: 'ProductBarcodeID',
    fields: [
      { fieldId: 610, fieldName: 'ProductCardID', label: 'Malzeme', fieldType: 'select', isRequired: true, colSpan: 6, orderIndex: 1, optionsJson: select([{ label: 'URN-001 — Demo Ürün', value: '1' }]) },
      { fieldId: 611, fieldName: 'Barcode', label: 'Barkod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 612, fieldName: 'Type', label: 'Tip', fieldType: 'select', isRequired: false, colSpan: 2, orderIndex: 3, optionsJson: select([{ label: 'EAN-13', value: '1' }, { label: 'İç Kod', value: '2' }, { label: 'QR', value: '3' }, { label: 'Code128', value: '4' }, { label: 'Birim Barkodu (miktarlı)', value: '5' }]) },
      { fieldId: 614, fieldName: 'QtyDigits', label: 'Miktar Hanesi', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 5 },
      { fieldId: 615, fieldName: 'QtyDivisor', label: 'Bölen', fieldType: 'select', isRequired: false, colSpan: 2, orderIndex: 6, optionsJson: select([{ label: '1 (adet)', value: '1' }, { label: '10', value: '10' }, { label: '100', value: '100' }, { label: '1000 (gram → kg)', value: '1000' }]), defaultValue: '1' },
      { fieldId: 616, fieldName: 'HasCheckDigit', label: 'Kontrol Hanesi', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 7 },
      { fieldId: 613, fieldName: 'UnitID', label: 'Birim', fieldType: 'select', isRequired: false, colSpan: 4, orderIndex: 4, optionsJson: unitOptions },
    ],
  },
  ProductUnitForm: {
    formId: 63,
    formCode: 'ProductUnitForm',
    title: 'Birim Çevirimi',
    tableName: 'ProductUnit',
    primaryKeyColumn: 'ProductUnitID',
    fields: [
      { fieldId: 630, fieldName: 'ProductCardID', label: 'Malzeme', fieldType: 'select', isRequired: true, colSpan: 6, orderIndex: 1 },
      { fieldId: 631, fieldName: 'UnitID', label: 'Çevrim Birimi', fieldType: 'select', isRequired: true, colSpan: 3, orderIndex: 2, optionsJson: unitOptions },
      { fieldId: 632, fieldName: 'MainQty', label: 'Ana birim miktarı', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 3 },
      { fieldId: 633, fieldName: 'UnitQty', label: 'Çevrim birim miktarı', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 4 },
      { fieldId: 634, fieldName: 'Weight', label: 'Ağırlık (kg)', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 5 },
      { fieldId: 635, fieldName: 'Length', label: 'En (cm)', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 6 },
      { fieldId: 636, fieldName: 'Width', label: 'Boy (cm)', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 7 },
      { fieldId: 637, fieldName: 'Height', label: 'Yükseklik (cm)', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 8 },
      { fieldId: 638, fieldName: 'UseInMaterial', label: 'Malzeme yönetimi', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 9, defaultValue: 'true' },
      { fieldId: 639, fieldName: 'UseInSales', label: 'Satış ve dağıtım', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 10, defaultValue: 'true' },
      { fieldId: 640, fieldName: 'UseInPurchase', label: 'Satın alma yönetimi', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 11, defaultValue: 'true' },
    ],
  },
  /** Malzeme + hizmet fiyatları — Type_: 1 Satış / 2 Alış */
  ProductPriceForm: {
    formId: 74,
    formCode: 'ProductPriceForm',
    title: 'Fiyat Kartı',
    tableName: 'ProductPrice',
    primaryKeyColumn: 'ProductPriceID',
    fields: [
      {
        fieldId: 6401,
        fieldName: 'Type_',
        label: 'Fiyat Yönü',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
        optionsJson: select([
          { label: 'Satış', value: PriceType.Satis },
          { label: 'Alış', value: PriceType.Alis },
        ]),
      },
      {
        fieldId: 6402,
        fieldName: 'IsActive',
        label: 'Aktif',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 2,
        orderIndex: 2,
        defaultValue: 'true',
        headerRight: true,
      },
      {
        fieldId: 6403,
        fieldName: 'Code',
        label: 'Liste / Kod',
        fieldType: 'text',
        isRequired: false,
        colSpan: 3,
        orderIndex: 3,
      },
      {
        fieldId: 6404,
        fieldName: 'Title',
        label: 'Açıklama',
        fieldType: 'text',
        isRequired: false,
        colSpan: 4,
        orderIndex: 4,
      },
      {
        fieldId: 6405,
        fieldName: 'ProductCardID',
        label: 'Malzeme / Hizmet',
        fieldType: 'lookup',
        isRequired: true,
        colSpan: 6,
        orderIndex: 5,
      },
      {
        fieldId: 6406,
        fieldName: 'UnitID',
        label: 'Birim',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 6,
        optionsJson: unitOptions,
      },
      {
        fieldId: 6407,
        fieldName: 'CustomerCardID',
        label: 'Cari (opsiyonel)',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 3,
        orderIndex: 7,
      },
      {
        fieldId: 6408,
        fieldName: 'Price',
        label: 'Birim Fiyat',
        fieldType: 'number',
        isRequired: true,
        colSpan: 3,
        orderIndex: 8,
      },
      {
        fieldId: 6409,
        fieldName: 'CurrencyID',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 9,
        optionsJson: currencyOptionsJson,
        defaultValue: String(LOCAL_CURRENCY_ID),
      },
      {
        fieldId: 6410,
        fieldName: 'VatIncluded',
        label: 'KDV dahil',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 2,
        orderIndex: 10,
      },
      {
        fieldId: 6411,
        fieldName: 'ValidFrom',
        label: 'Geçerlilik Başlangıç',
        fieldType: 'date',
        isRequired: false,
        colSpan: 3,
        orderIndex: 11,
      },
      {
        fieldId: 6412,
        fieldName: 'ValidTo',
        label: 'Geçerlilik Bitiş',
        fieldType: 'date',
        isRequired: false,
        colSpan: 3,
        orderIndex: 12,
      },
      {
        fieldId: 6413,
        fieldName: 'Description',
        label: 'Not',
        fieldType: 'textarea',
        isRequired: false,
        colSpan: 12,
        orderIndex: 13,
      },
    ],
  },
  VariantCardForm: {
    formId: 62, formCode: 'VariantCardForm', title: 'Varyant', tableName: 'VariantCard', primaryKeyColumn: 'VariantCardID',
    // Not: UI'da ProductCardForm içinde sekme; bu şema referans / yetki için tutulur
    fields: [
      { fieldId: 620, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 621, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      { fieldId: 622, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 3 },
    ],
  },
  VariantTemplateForm: {
    formId: 68,
    formCode: 'VariantTemplateForm',
    title: 'Varyant Şablonu',
    tableName: 'VariantTemplate',
    primaryKeyColumn: 'VariantTemplateID',
    fields: [
      { fieldId: 680, fieldName: 'Code', label: 'Şablon Kodu', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 681, fieldName: 'Title', label: 'Şablon Adı', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2 },
      { fieldId: 682, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 3, defaultValue: 'true', headerRight: true },
    ],
    lineFields: [
      {
        fieldId: 690,
        fieldName: 'Code',
        label: 'Özellik Kodu',
        fieldType: 'text',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
      },
      {
        fieldId: 691,
        fieldName: 'Title',
        label: 'Özellik Adı',
        fieldType: 'text',
        isRequired: true,
        colSpan: 3,
        orderIndex: 2,
      },
      {
        fieldId: 692,
        fieldName: 'ValuesText',
        label: 'Değerler (virgülle)',
        fieldType: 'text',
        isRequired: true,
        colSpan: 5,
        orderIndex: 3,
      },
      {
        fieldId: 693,
        fieldName: 'SortOrder',
        label: 'Sıra',
        fieldType: 'number',
        isRequired: false,
        colSpan: 1,
        orderIndex: 4,
        defaultValue: '10',
      },
    ],
  },
  TaxCardForm: {
    formId: 63, formCode: 'TaxCardForm', title: 'Vergi Kartı', tableName: 'TaxCard', primaryKeyColumn: 'TaxCardID',
    /** AccountGroupID DB'de NOT NULL */
    fixedStandardFields: { AccountGroupID: 1 },
    fields: [
      { fieldId: 630, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 631, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      { fieldId: 634, fieldName: 'Rate', label: 'Oran %', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 3, defaultValue: '20' },
      {
        fieldId: 632,
        fieldName: 'Type_',
        label: 'Tip',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'KDV', value: '1' },
          { label: 'ÖTV', value: '2' },
          { label: 'Tevkifat', value: '3' },
        ]),
        defaultValue: '1',
      },
      { fieldId: 633, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 5, defaultValue: 'true' },
    ],
  },
  BankCardForm: {
    formId: 64, formCode: 'BankCardForm', title: 'Banka', tableName: 'BankCard', primaryKeyColumn: 'BankCardID',
    enableAccountsTab: true,
    enableAccountLinksTab: true,
    accountLinkModule: AccountLinkModule.BankAccount,
    accountLinkSingle: true,
    accountLinkFields: buildAccountLinkFields(),
    fields: [
      { fieldId: 640, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 641, fieldName: 'Title', label: 'Banka Adı', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      { fieldId: 642, fieldName: 'BankCode', label: 'Banka Kodu', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
      { fieldId: 643, fieldName: 'Adress', label: 'Adres', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 4 },
      { fieldId: 644, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 5, headerRight: true },
    ],
    accountFields: [
      { fieldId: 651, fieldName: 'Code', label: 'Hesap Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 652, fieldName: 'Title', label: 'Hesap Adı', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 653, fieldName: 'IbanNO', label: 'IBAN', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
      { fieldId: 657, fieldName: 'AccountNO', label: 'Hesap No', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 4 },
      {
        fieldId: 655,
        fieldName: 'Currency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 2,
        orderIndex: 5,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      { fieldId: 656, fieldName: 'CurrencyRate', label: 'Kur', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 6, defaultValue: '1' },
      { fieldId: 658, fieldName: 'SwiftNO', label: 'SWIFT', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 7 },
      { fieldId: 654, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 8, defaultValue: 'true' },
    ],
  },
  BankAccountCardForm: {
    formId: 65, formCode: 'BankAccountCardForm', title: 'Banka Hesabı', tableName: 'BankAccountCard', primaryKeyColumn: 'BankAccountCardID',
    fields: [
      { fieldId: 650, fieldName: 'BankCardID', label: 'Banka', fieldType: 'select', isRequired: true, colSpan: 6, orderIndex: 1, optionsJson: select([{ label: 'Ziraat', value: '1' }]) },
      { fieldId: 651, fieldName: 'Code', label: 'Hesap Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 652, fieldName: 'Title', label: 'Hesap Adı', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 3 },
      { fieldId: 653, fieldName: 'IbanNO', label: 'IBAN', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 4 },
      {
        fieldId: 655,
        fieldName: 'Currency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 2,
        orderIndex: 5,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      { fieldId: 656, fieldName: 'CurrencyRate', label: 'Kur', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 6, defaultValue: '1' },
      { fieldId: 654, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 7 },
    ],
  },
  SafeCardForm: {
    formId: 66, formCode: 'SafeCardForm', title: 'Kasa', tableName: 'SafeCard', primaryKeyColumn: 'SafeCardID',
    enableAccountLinksTab: true,
    accountLinkModule: AccountLinkModule.Safe,
    accountLinkSingle: true,
    accountLinkFields: buildAccountLinkFields(),
    fields: [
      { fieldId: 660, fieldName: 'Code', label: 'Kasa Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 661, fieldName: 'Defintion', label: 'Tanım', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 663,
        fieldName: 'Currency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 2,
        orderIndex: 3,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      { fieldId: 664, fieldName: 'CurrencyRate', label: 'Kur', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 4, defaultValue: '1' },
      { fieldId: 662, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 5 },
    ],
  },
  BoundCardForm: {
    formId: 67, formCode: 'BoundCardForm', title: 'Çek / Senet', tableName: 'BoundCard', primaryKeyColumn: 'BoundCardID',
    enableAccountLinksTab: true,
    accountLinkModule: AccountLinkModule.Bound,
    accountLinkSingle: true,
    accountLinkFields: buildAccountLinkFields(),
    fields: [
      { fieldId: 670, fieldName: 'Type_', label: 'Tip', fieldType: 'select', isRequired: true, colSpan: 3, orderIndex: 1, optionsJson: select([{ label: 'Çek', value: '1' }, { label: 'Senet', value: '2' }]) },
      { fieldId: 671, fieldName: 'DocumentNr', label: 'Belge No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 2 },
      { fieldId: 672, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 3 },
      {
        fieldId: 674,
        fieldName: 'Currency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 2,
        orderIndex: 4,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      { fieldId: 675, fieldName: 'CurrencyRate', label: 'Kur', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 5, defaultValue: '1' },
      { fieldId: 673, fieldName: 'DueDate', label: 'Vade', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 6 },
    ],
  },
  BoundTransForm: {
    formId: 88,
    formCode: 'BoundTransForm',
    title: 'Çek / Senet Fişi',
    tableName: 'BoundTrans',
    primaryKeyColumn: 'BoundTransID',
    documentLayout: 'trade',
    fields: [
      {
        fieldId: 879,
        fieldName: 'DocumentNumber',
        label: 'Fiş No',
        fieldType: 'text',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
      },
      { fieldId: 881, fieldName: 'TransDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 880,
        fieldName: 'Type_',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select(BOUND_TRANS_TYPE_OPTIONS),
      },
      {
        fieldId: 882,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Açık', value: '0' },
          { label: 'Kapalı', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
        defaultValue: '0',
      },
      {
        fieldId: 883,
        fieldName: 'CheckID',
        label: 'Çek / Senet',
        fieldType: 'lookup',
        isRequired: true,
        colSpan: 4,
        orderIndex: 5,
      },
      {
        fieldId: 884,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 4,
        orderIndex: 6,
      },
      {
        fieldId: 885,
        fieldName: 'BankAccountID',
        label: 'Banka Hesabı',
        fieldType: 'lookup',
        isRequired: false,
        colSpan: 4,
        orderIndex: 7,
      },
    ],
  },
  PaidPlanCardForm: {
    formId: 97, formCode: 'PaidPlanCardForm', title: 'Ödeme / Tahsilat Planı', tableName: 'PaidPlanCard', primaryKeyColumn: 'PaidPlanID',
    fields: [
      { fieldId: 9701, fieldName: 'Code', label: 'Plan Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 9702, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      { fieldId: 9703, fieldName: 'PlanType', label: 'Plan Tipi', fieldType: 'select', isRequired: true, colSpan: 4, orderIndex: 3,
        optionsJson: select([
          { label: 'Ödeme', value: '1' },
          { label: 'Tahsilat', value: '2' },
          { label: 'Ödeme + Tahsilat', value: '3' },
        ]), defaultValue: '3' },
      { fieldId: 9704, fieldName: 'DayCount', label: 'Gün', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 4 },
      { fieldId: 9705, fieldName: 'InstallmentCnt', label: 'Taksit Sayısı', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 5 },
      { fieldId: 9706, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 6, defaultValue: 'true' },
    ],
    lineFields: [
      { fieldId: 9710, fieldName: 'LineNo', label: 'No', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 1 },
      { fieldId: 9711, fieldName: 'DayOffset', label: 'Gün Offset', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 2, defaultValue: '0' },
      { fieldId: 9712, fieldName: 'RatePercent', label: 'Oran %', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 3 },
      { fieldId: 9713, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 4 },
    ],
  },
  BankCreditForm: {
    formId: 98, formCode: 'BankCreditForm', title: 'Banka Kredisi', tableName: 'BankCredit', primaryKeyColumn: 'BankCreditID',
    fields: [
      { fieldId: 9801, fieldName: 'Code', label: 'Kredi Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 9802, fieldName: 'Title', label: 'Kredi Adı', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      { fieldId: 9803, fieldName: 'Status', label: 'Durum', fieldType: 'select', isRequired: false, colSpan: 4, orderIndex: 3,
        optionsJson: select([
          { label: 'Aktif', value: 'Aktif' },
          { label: 'Kapalı', value: 'Kapalı' },
          { label: 'Erken Kapama', value: 'Erken Kapama' },
        ]), defaultValue: 'Aktif' },
      { fieldId: 9804, fieldName: 'BankCardID', label: 'Banka', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 4 },
      { fieldId: 9805, fieldName: 'BankAccountID', label: 'Hesap', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 5 },
      { fieldId: 9806, fieldName: 'PaidPlanID', label: 'Ödeme Planı', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 6 },
      { fieldId: 9807, fieldName: 'CreditDate', label: 'Kredi Tarihi', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 7 },
      { fieldId: 9808, fieldName: 'StartDate', label: 'Başlangıç', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 8 },
      { fieldId: 9809, fieldName: 'EndDate', label: 'Bitiş', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 9 },
      { fieldId: 9810, fieldName: 'InstallmentCnt', label: 'Taksit', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 10 },
      { fieldId: 9811, fieldName: 'CreditAmount', label: 'Kredi Tutarı', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 11 },
      { fieldId: 9812, fieldName: 'InterestRate', label: 'Faiz %', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 12 },
      { fieldId: 9813, fieldName: 'CurrencyCode', label: 'PB', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 13, defaultValue: 'TRY' },
      { fieldId: 9814, fieldName: 'Notes', label: 'Not', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 14 },
      { fieldId: 9815, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 15, defaultValue: 'true' },
    ],
  },
  BankCreditInstallmentForm: {
    formId: 99, formCode: 'BankCreditInstallmentForm', title: 'Kredi Taksiti', tableName: 'BankCreditInstallment', primaryKeyColumn: 'BankCreditInstallmentID',
    fields: [
      { fieldId: 9901, fieldName: 'BankCreditID', label: 'Kredi', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 9902, fieldName: 'InstallmentNo', label: 'Taksit No', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 2 },
      { fieldId: 9903, fieldName: 'DueDate', label: 'Vade', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 3 },
      { fieldId: 9904, fieldName: 'Status', label: 'Durum', fieldType: 'select', isRequired: false, colSpan: 3, orderIndex: 4,
        optionsJson: select([
          { label: 'Açık', value: 'Açık' },
          { label: 'Ödendi', value: 'Ödendi' },
          { label: 'Gecikmiş', value: 'Gecikmiş' },
        ]), defaultValue: 'Açık' },
      { fieldId: 9905, fieldName: 'PrincipalAmount', label: 'Anapara', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 5 },
      { fieldId: 9906, fieldName: 'InterestAmount', label: 'Faiz', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 6 },
      { fieldId: 9907, fieldName: 'TotalAmount', label: 'Toplam', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 7 },
      { fieldId: 9908, fieldName: 'PaidAmount', label: 'Ödenen', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 8 },
      { fieldId: 9909, fieldName: 'PaymentDate', label: 'Ödeme Tarihi', fieldType: 'date', isRequired: false, colSpan: 4, orderIndex: 9 },
      { fieldId: 9910, fieldName: 'Notes', label: 'Not', fieldType: 'text', isRequired: false, colSpan: 8, orderIndex: 10 },
      { fieldId: 9911, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 11, defaultValue: 'true' },
    ],
  },
  RiskGroupForm: {
    formId: 68, formCode: 'RiskGroupForm', title: 'Risk Grubu', tableName: 'RiskGroup', primaryKeyColumn: 'RiskGroupID',
    fields: [
      { fieldId: 680, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 681, fieldName: 'Title', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 2 },
      { fieldId: 682, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 3 },
      // Y-12 (SqlUpdates/87): limit cari kartında boşsa bu limit geçerli
      { fieldId: 683, fieldName: 'RiskLimit', label: 'Risk Limiti', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 4 },
      {
        fieldId: 684,
        fieldName: 'RiskAction',
        label: 'Limit Aşılınca',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 5,
        defaultValue: '1',
        optionsJson: select([
          { label: 'Yalnız izle', value: '0' },
          { label: 'Uyar', value: '1' },
          { label: 'Yönetici onayı', value: '2' },
          { label: 'Engelle', value: '3' },
        ]),
      },
      { fieldId: 685, fieldName: 'IncOrders', label: 'Açık siparişler riske dahil', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 6, defaultValue: 'true' },
      { fieldId: 686, fieldName: 'IncDispatches', label: 'Faturalanmamış irsaliyeler riske dahil', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 7 },
      { fieldId: 687, fieldName: 'IncBounds', label: 'Portföydeki çek / senetler riske dahil', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 8, defaultValue: 'true' },
    ],
  },
  CustomerContactForm: {
    formId: 69, formCode: 'CustomerContactForm', title: 'Cari Yetkili', tableName: 'CustomerContact', primaryKeyColumn: 'CustomerContactID',
    fields: [
      { fieldId: 690, fieldName: 'CustomerCardID', label: 'Cari', fieldType: 'select', isRequired: true, colSpan: 6, orderIndex: 1, optionsJson: select([{ label: 'ABC Ticaret', value: '1' }]) },
      { fieldId: 691, fieldName: 'Name', label: 'Ad Soyad', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2 },
      { fieldId: 692, fieldName: 'Phone', label: 'Telefon', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
      { fieldId: 693, fieldName: 'Email', label: 'E-posta', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 4 },
    ],
  },
  CustomerVoucherForm: {
    formId: 70, formCode: 'CustomerVoucherForm', title: 'Cari Fiş', tableName: 'CustomerVoucher', primaryKeyColumn: 'CustomerVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 700, fieldName: 'DocumentNumber', label: 'Belge No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 701, fieldName: 'VoucherDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 702,
        fieldName: 'Type',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select(CUSTOMER_VOUCHER_TYPE_OPTIONS),
      },
      {
        fieldId: 706,
        fieldName: 'Status',
        label: 'Durum',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'Açık', value: '0' },
          { label: 'Kapalı', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
        defaultValue: '0',
      },
      {
        fieldId: 708,
        fieldName: 'Currency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
      { fieldId: 705, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 9, orderIndex: 6 },
    ],
    /** CustomerTrans satırları — bir fişte N cari / tutar */
    lineFields: [
      {
        fieldId: 760,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '120.02 — XYZ Ltd. Şti.', value: '2' },
          { label: '320.01 — Demir Tedarik', value: '3' },
        ]),
      },
      { fieldId: 761, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 2 },
      { fieldId: 762, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 3 },
      { fieldId: 763, fieldName: 'DueDate', label: 'Vade', fieldType: 'date', isRequired: false, colSpan: 2, orderIndex: 4 },
      {
        fieldId: 764,
        fieldName: 'CustomerCurrency',
        label: 'Döviz',
        fieldType: 'select',
        isRequired: false,
        colSpan: 2,
        orderIndex: 5,
        optionsJson: currencyOptionsSelectJson,
        defaultValue: LOCAL_CURRENCY_ID,
      },
    ],
  },
  BankVoucherForm: {
    formId: 71,
    formCode: 'BankVoucherForm',
    title: 'Banka Fişi',
    tableName: 'BankVoucher',
    primaryKeyColumn: 'BankVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 710, fieldName: 'DocumentNumber', label: 'Belge No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 711, fieldName: 'VoucherDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 712,
        fieldName: 'Type_',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select(BANK_VOUCHER_TYPE_OPTIONS),
      },
      {
        fieldId: 713,
        fieldName: 'BankAccountCardID',
        label: 'Banka Hesabı',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: 'TL-01 — Ziraat TL Vadesiz', value: '1' },
          { label: 'USD-01 — Garanti USD', value: '2' },
        ]),
      },
      {
        fieldId: 716,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Açık', value: '0' },
          { label: 'Kapalı', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
        defaultValue: '0',
      },
      { fieldId: 717, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 6 },
    ],
    /** BankTrans satırları — bir fişte N cari / tutar (örn. birden fazla gelen havale) */
    lineFields: [
      {
        fieldId: 750,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '120.02 — XYZ Ltd. Şti.', value: '2' },
          { label: '320.01 — Demir Tedarik', value: '3' },
        ]),
      },
      { fieldId: 751, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 2 },
      { fieldId: 752, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 3 },
      { fieldId: 753, fieldName: 'Expense', label: 'Masraf', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 4 },
      {
        fieldId: 754,
        fieldName: 'BankAccountCardID',
        label: 'Hesap (satır)',
        fieldType: 'select',
        isRequired: false,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: '(Fiş hesabı)', value: '' },
          { label: 'TL-01 — Ziraat TL', value: '1' },
          { label: 'USD-01 — Garanti USD', value: '2' },
        ]),
      },
    ],
  },
  /** Kasa fişi (Y-08) — SafeVoucher + SafeTrans: tahsilat / tediye / kasa↔banka / masraf / virman */
  SafeVoucherForm: {
    formId: 776,
    formCode: 'SafeVoucherForm',
    title: 'Kasa Fişi',
    tableName: 'SafeVoucher',
    primaryKeyColumn: 'SafeVoucherID',
    documentLayout: 'trade',
    fields: [
      { fieldId: 7401, fieldName: 'DocumentNumber', label: 'Belge No', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 1 },
      { fieldId: 7402, fieldName: 'VoucherDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 7403,
        fieldName: 'Type_',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select(SAFE_VOUCHER_TYPE_OPTIONS),
        defaultValue: '1',
      },
      { fieldId: 7404, fieldName: 'SafeCardID', label: 'Kasa', fieldType: 'select', isRequired: true, colSpan: 3, orderIndex: 4, optionsJson: select([]) },
      {
        fieldId: 7405,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 5,
        optionsJson: select([
          { label: 'Açık', value: '0' },
          { label: 'Kapalı', value: '1' },
          { label: 'İptal', value: '2' },
        ]),
        defaultValue: '0',
      },
      { fieldId: 7406, fieldName: 'AuthCode', label: 'Yetki Kodu', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 6 },
      { fieldId: 7407, fieldName: 'Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 7 },
    ],
    /** SafeTrans satırları: tahsilat / tediyede cari; kasa↔bankada banka hesabı; virmanda hedef kasa */
    lineFields: [
      { fieldId: 7450, fieldName: 'CustomerID', label: 'Cari', fieldType: 'select', isRequired: false, colSpan: 4, orderIndex: 1, optionsJson: select([]) },
      { fieldId: 7451, fieldName: 'BankAccountCardID', label: 'Banka Hesabı', fieldType: 'select', isRequired: false, colSpan: 3, orderIndex: 2, optionsJson: select([]) },
      { fieldId: 7452, fieldName: 'AimSafeCardID', label: 'Hedef Kasa', fieldType: 'select', isRequired: false, colSpan: 3, orderIndex: 3, optionsJson: select([]) },
      { fieldId: 7453, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 4 },
      { fieldId: 7454, fieldName: 'DueDate', label: 'Vade', fieldType: 'date', isRequired: false, colSpan: 2, orderIndex: 5 },
      { fieldId: 7455, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 6 },
    ],
  },
  PaymentTransForm: {
    formId: 72,
    formCode: 'PaymentTransForm',
    title: 'Ödeme / Tahsilat',
    tableName: 'PaymentTrans',
    primaryKeyColumn: 'PaymentTransID',
    documentLayout: 'trade',
    fields: [
      {
        fieldId: 719,
        fieldName: 'DocumentNumber',
        label: 'Fiş No',
        fieldType: 'text',
        isRequired: true,
        colSpan: 3,
        orderIndex: 1,
      },
      { fieldId: 720, fieldName: 'SourceSlipDate', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 3, orderIndex: 2 },
      {
        fieldId: 721,
        fieldName: 'Type_',
        label: 'Fiş Tipi',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 3,
        optionsJson: select([
          { label: 'Tahsilat', value: PaymentType.Tahsilat },
          { label: 'Ödeme', value: PaymentType.Odeme },
        ]),
      },
      {
        fieldId: 722,
        fieldName: 'CustomerID',
        label: 'Cari',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 4,
        optionsJson: select([
          { label: '120.01 — ABC Ticaret A.Ş.', value: '1' },
          { label: '320.01 — Demir Tedarik', value: '3' },
        ]),
      },
      {
        fieldId: 723,
        fieldName: 'BankAccountID',
        label: 'Banka Hesabı / Kasa',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 5,
        optionsJson: select([
          { label: 'KASA-01 — Merkez Kasa', value: '0' },
          { label: 'TL-01 — Ziraat TL', value: '1' },
          { label: 'USD-01 — Garanti USD', value: '2' },
        ]),
      },
      { fieldId: 724, fieldName: 'CurrencyTotal', label: 'Tutar', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 6 },
      { fieldId: 725, fieldName: 'DueDate', label: 'Vade', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 7 },
      {
        fieldId: 726,
        fieldName: 'Status_',
        label: 'Durum',
        fieldType: 'select',
        isRequired: true,
        colSpan: 3,
        orderIndex: 8,
        optionsJson: select([
          { label: 'Açık', value: '0' },
          { label: 'Kapalı', value: '1' },
        ]),
        defaultValue: '0',
      },
      { fieldId: 727, fieldName: 'U_Description', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 9 },
    ],
  },
  AccountGroupForm: {
    formId: 73, formCode: 'AccountGroupForm', title: 'Hesap Grubu', tableName: 'AccountGroup', primaryKeyColumn: 'AccountGroupID',
    fields: [
      { fieldId: 730, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 1 },
      { fieldId: 731, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 2 },
    ],
  },
  AccountLinkForm: {
    formId: 74,
    formCode: 'AccountLinkForm',
    title: 'Muhasebe Bağlantısı',
    tableName: 'AccountLink',
    primaryKeyColumn: 'AccountLinkID',
    fields: [
      {
        fieldId: 740,
        fieldName: 'AccountGroupID',
        label: 'Hesap Grubu',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 1,
        optionsJson: select([{ label: 'Standart TR', value: '1' }]),
      },
      { fieldId: 742, fieldName: 'StartDate', label: 'Başlangıç', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 2 },
      { fieldId: 743, fieldName: 'EndDate', label: 'Bitiş', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 3 },
      { fieldId: 741, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 4, defaultValue: 'true', headerRight: true },
    ],
    // Satırlar AccountLinkFormEngine ile (Module / Type / Account / Koşul)
  },
  AuxilCodesForm: {
    formId: 75,
    formCode: 'AuxilCodesForm',
    title: 'Özel Kod Tanımı (AUXIL)',
    tableName: 'AuxilCodes',
    primaryKeyColumn: 'AuxilCodesID',
    enableAuxilValuesTab: true,
    auxilValueFields: buildAuxilValueFields(7500),
    fields: [
      { fieldId: 750, fieldName: 'Code', label: 'Tanım Kodu', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 751, fieldName: 'Title', label: 'Tanım Adı', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 752,
        fieldName: 'TargetTable',
        label: 'Hedef (Kart / Fiş)',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([...AUXIL_TARGET_OPTIONS]),
        defaultValue: 'CustomerCard',
      },
      { fieldId: 753, fieldName: 'SlotNo', label: 'Sıra', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 4, defaultValue: '10' },
      {
        fieldId: 756,
        fieldName: 'HasDate',
        label: 'Tarih Öner',
        fieldType: 'checkbox',
        isRequired: false,
        colSpan: 3,
        orderIndex: 5,
        defaultValue: 'true',
      },
      { fieldId: 755, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 6, defaultValue: 'true' },
    ],
  },
  /** @deprecated — TypeDefVoucherForm kullan */
  VoucherTypeForm: {
    formId: 76, formCode: 'VoucherTypeForm', title: 'Fiş Tipi', tableName: 'VoucherType', primaryKeyColumn: 'VoucherTypeID',
    fields: [
      { fieldId: 760, fieldName: 'Code', label: 'Kod', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 761, fieldName: 'Description', label: 'Açıklama', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2 },
      { fieldId: 762, fieldName: 'Status', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 3 },
    ],
  },
  TypeDefVoucherForm: {
    formId: 82,
    formCode: 'TypeDefVoucherForm',
    title: 'Fiş Türü',
    tableName: 'SYS_TypeDef',
    primaryKeyColumn: 'TypeDefID',
    fixedStandardFields: { Kind: 1 },
    fields: [
      { fieldId: 820, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 821, fieldName: 'Title', label: 'Açıklama', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 822,
        fieldName: 'ModuleKey',
        label: 'Modül',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([...MODULE_KEY_OPTIONS]),
      },
      {
        fieldId: 823,
        fieldName: 'TargetTable',
        label: 'Hedef Belge',
        fieldType: 'select',
        isRequired: true,
        colSpan: 6,
        orderIndex: 4,
        optionsJson: select([...VOUCHER_TARGET_OPTIONS]),
      },
      { fieldId: 824, fieldName: 'SortOrder', label: 'Sıra', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 5, defaultValue: '10' },
      { fieldId: 825, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 6, defaultValue: 'true' },
    ],
  },
  TypeDefProductForm: {
    formId: 83,
    formCode: 'TypeDefProductForm',
    title: 'Malzeme Türü',
    tableName: 'SYS_TypeDef',
    primaryKeyColumn: 'TypeDefID',
    fixedStandardFields: { Kind: 2 },
    fields: [
      { fieldId: 830, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 831, fieldName: 'Title', label: 'Açıklama', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 832,
        fieldName: 'ModuleKey',
        label: 'Modül',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([...MODULE_KEY_OPTIONS]),
        defaultValue: 'malzeme',
      },
      {
        fieldId: 833,
        fieldName: 'TargetTable',
        label: 'Hedef',
        fieldType: 'select',
        isRequired: true,
        colSpan: 6,
        orderIndex: 4,
        optionsJson: select([...PRODUCT_TARGET_OPTIONS]),
        defaultValue: 'ProductCard',
      },
      { fieldId: 834, fieldName: 'SortOrder', label: 'Sıra', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 5, defaultValue: '10' },
      { fieldId: 835, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 6, defaultValue: 'true' },
    ],
  },
  TypeDefCustomerForm: {
    formId: 84,
    formCode: 'TypeDefCustomerForm',
    title: 'Cari Tür',
    tableName: 'SYS_TypeDef',
    primaryKeyColumn: 'TypeDefID',
    fixedStandardFields: { Kind: 3 },
    fields: [
      { fieldId: 840, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 841, fieldName: 'Title', label: 'Açıklama', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      {
        fieldId: 842,
        fieldName: 'ModuleKey',
        label: 'Modül',
        fieldType: 'select',
        isRequired: true,
        colSpan: 4,
        orderIndex: 3,
        optionsJson: select([...MODULE_KEY_OPTIONS]),
        defaultValue: 'finans',
      },
      {
        fieldId: 843,
        fieldName: 'TargetTable',
        label: 'Hedef',
        fieldType: 'select',
        isRequired: true,
        colSpan: 6,
        orderIndex: 4,
        optionsJson: select([...CUSTOMER_TARGET_OPTIONS]),
        defaultValue: 'CustomerCard',
      },
      { fieldId: 844, fieldName: 'SortOrder', label: 'Sıra', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 5, defaultValue: '10' },
      { fieldId: 845, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 6, defaultValue: 'true' },
    ],
  },
  SettingForm: {
    formId: 77, formCode: 'SettingForm', title: 'Ayar', tableName: 'Setting', primaryKeyColumn: 'SettingID',
    fields: [
      { fieldId: 770, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 771, fieldName: 'Title', label: 'Başlık', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 772, fieldName: 'Value', label: 'Değer', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
      {
        fieldId: 773,
        fieldName: 'ModuleKey',
        label: 'Modül',
        fieldType: 'select',
        isRequired: false,
        colSpan: 4,
        orderIndex: 4,
        optionsJson: JSON.stringify([
          { label: 'Genel', value: 'genel' },
          { label: 'Finans', value: 'finans' },
          { label: 'Satış', value: 'satis' },
          { label: 'Satınalma', value: 'satinalma' },
          { label: 'Muhasebe', value: 'muhasebe' },
        ]),
      },
    ],
  },
  SettingFinansForm: {
    formId: 771,
    formCode: 'SettingFinansForm',
    title: 'Finans Parametresi',
    tableName: 'Setting',
    primaryKeyColumn: 'SettingID',
    fixedStandardFields: { ModuleKey: 'finans' },
    fields: [
      { fieldId: 7710, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 7711, fieldName: 'Title', label: 'Başlık', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 7712, fieldName: 'Value', label: 'Değer', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
    ],
  },
  SettingSatisForm: {
    formId: 772,
    formCode: 'SettingSatisForm',
    title: 'Satış Parametresi',
    tableName: 'Setting',
    primaryKeyColumn: 'SettingID',
    fixedStandardFields: { ModuleKey: 'satis' },
    fields: [
      { fieldId: 7720, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 7721, fieldName: 'Title', label: 'Başlık', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 7722, fieldName: 'Value', label: 'Değer', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
    ],
  },
  SettingSatinalmaForm: {
    formId: 773,
    formCode: 'SettingSatinalmaForm',
    title: 'Satınalma Parametresi',
    tableName: 'Setting',
    primaryKeyColumn: 'SettingID',
    fixedStandardFields: { ModuleKey: 'satinalma' },
    fields: [
      { fieldId: 7730, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 7731, fieldName: 'Title', label: 'Başlık', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 7732, fieldName: 'Value', label: 'Değer', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
    ],
  },
  SettingMuhasebeForm: {
    formId: 774,
    formCode: 'SettingMuhasebeForm',
    title: 'Muhasebe Parametresi',
    tableName: 'Setting',
    primaryKeyColumn: 'SettingID',
    fixedStandardFields: { ModuleKey: 'muhasebe' },
    fields: [
      { fieldId: 7740, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 7741, fieldName: 'Title', label: 'Başlık', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 7742, fieldName: 'Value', label: 'Değer', fieldType: 'text', isRequired: false, colSpan: 4, orderIndex: 3 },
    ],
  },
  PersonCardForm: {
    formId: 78, formCode: 'PersonCardForm', title: 'Personel', tableName: 'PersonCard', primaryKeyColumn: 'PersonCardID',
    fields: [
      { fieldId: 780, fieldName: 'Code', label: 'Sicil No', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 781, fieldName: 'Name', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 2 },
      { fieldId: 782, fieldName: 'Surname', label: 'Soyad', fieldType: 'text', isRequired: true, colSpan: 4, orderIndex: 3 },
      { fieldId: 783, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 4 },
    ],
  },
  JobRegionForm: {
    formId: 79, formCode: 'JobRegionForm', title: 'İş Bölgesi', tableName: 'JobRegion', primaryKeyColumn: 'ID',
    fields: [
      { fieldId: 790, fieldName: 'Name', label: 'Ad', fieldType: 'text', isRequired: true, colSpan: 8, orderIndex: 1 },
      { fieldId: 791, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 2 },
    ],
  },
  DailyActionForm: {
    formId: 80, formCode: 'DailyActionForm', title: 'Günlük Puantaj', tableName: 'DailyAction', primaryKeyColumn: 'ID',
    fields: [
      { fieldId: 800, fieldName: 'Date_', label: 'Tarih', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 801, fieldName: 'Comment', label: 'Açıklama', fieldType: 'textarea', isRequired: false, colSpan: 12, orderIndex: 2 },
    ],
  },
  CityForm: {
    formId: 81, formCode: 'CityForm', title: 'İl', tableName: 'SYS_Province', primaryKeyColumn: 'ProvinceID',
    fields: [
      { fieldId: 810, fieldName: 'Code', label: 'Plaka', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 811, fieldName: 'Name', label: 'İl Adı', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2 },
      { fieldId: 812, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 3 },
    ],
  },
  CountryForm: {
    formId: 85, formCode: 'CountryForm', title: 'Ülke', tableName: 'SYS_Country', primaryKeyColumn: 'CountryID',
    fields: [
      { fieldId: 850, fieldName: 'Code', label: 'Kod', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 851, fieldName: 'Name', label: 'Ülke', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2 },
      { fieldId: 852, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 3 },
    ],
  },
  DistrictForm: {
    formId: 86, formCode: 'DistrictForm', title: 'İlçe', tableName: 'SYS_District', primaryKeyColumn: 'DistrictID',
    fields: [
      { fieldId: 860, fieldName: 'ProvinceID', label: 'İl', fieldType: 'number', isRequired: true, colSpan: 4, orderIndex: 1 },
      { fieldId: 861, fieldName: 'Name', label: 'İlçe', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      { fieldId: 862, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 3, orderIndex: 3 },
    ],
  },
  NeighborhoodForm: {
    formId: 87, formCode: 'NeighborhoodForm', title: 'Mahalle', tableName: 'SYS_Neighborhood', primaryKeyColumn: 'NeighborhoodID',
    fields: [
      { fieldId: 870, fieldName: 'DistrictID', label: 'İlçe', fieldType: 'number', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 871, fieldName: 'Name', label: 'Mahalle', fieldType: 'text', isRequired: true, colSpan: 5, orderIndex: 2 },
      { fieldId: 872, fieldName: 'PostalCode', label: 'Posta Kodu', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 3 },
      { fieldId: 873, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 4 },
    ],
  },
  /** E-Devlet — e-Fatura / e-Arşiv / e-İrsaliye (DocKind + Direction + IsArchived) */
  EGovDocumentForm: {
    formId: 95, formCode: 'EGovDocumentForm', title: 'e-Belge', tableName: 'EGovDocument', primaryKeyColumn: 'EGovDocumentID',
    fields: [
      { fieldId: 950, fieldName: 'DocumentNo', label: 'Belge No', fieldType: 'text', isRequired: true, colSpan: 3, orderIndex: 1 },
      { fieldId: 951, fieldName: 'UUID', label: 'ETTN / UUID', fieldType: 'text', isRequired: false, colSpan: 5, orderIndex: 2 },
      { fieldId: 952, fieldName: 'DocumentDate', label: 'Belge Tarihi', fieldType: 'date', isRequired: true, colSpan: 4, orderIndex: 3 },
      { fieldId: 953, fieldName: 'CustomerTitle', label: 'Cari Ünvan', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 4 },
      { fieldId: 954, fieldName: 'TaxNr', label: 'VKN / TCKN', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 5 },
      { fieldId: 955, fieldName: 'ProfileId', label: 'Profil', fieldType: 'select', isRequired: false, colSpan: 3, orderIndex: 6,
        optionsJson: JSON.stringify([
          { label: 'TEMELFATURA', value: 'TEMELFATURA' },
          { label: 'TICARIFATURA', value: 'TICARIFATURA' },
          { label: 'EARSIVFATURA', value: 'EARSIVFATURA' },
          { label: 'TEMELIRSALIYE', value: 'TEMELIRSALIYE' },
        ]) },
      { fieldId: 956, fieldName: 'Amount', label: 'Tutar', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 7 },
      { fieldId: 957, fieldName: 'TaxAmount', label: 'Vergi', fieldType: 'number', isRequired: false, colSpan: 3, orderIndex: 8 },
      { fieldId: 958, fieldName: 'CurrencyCode', label: 'Para Birimi', fieldType: 'text', isRequired: false, colSpan: 2, orderIndex: 9, defaultValue: 'TRY' },
      { fieldId: 959, fieldName: 'Status', label: 'Durum', fieldType: 'select', isRequired: false, colSpan: 4, orderIndex: 10,
        optionsJson: JSON.stringify([
          { label: 'Bekliyor', value: 'Bekliyor' },
          { label: 'Onaylandı', value: 'Onaylandı' },
          { label: 'Red', value: 'Red' },
          { label: 'Gönderildi', value: 'Gönderildi' },
          { label: 'Hata', value: 'Hata' },
        ]) },
      { fieldId: 960, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 11, defaultValue: 'true' },
    ],
  },
  ELedgerForm: {
    formId: 96, formCode: 'ELedgerForm', title: 'e-Defter', tableName: 'ELedger', primaryKeyColumn: 'ELedgerID',
    fields: [
      { fieldId: 970, fieldName: 'PeriodYear', label: 'Yıl', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 1 },
      { fieldId: 971, fieldName: 'PeriodMonth', label: 'Ay', fieldType: 'number', isRequired: true, colSpan: 2, orderIndex: 2 },
      { fieldId: 972, fieldName: 'PartNo', label: 'Parça No', fieldType: 'number', isRequired: false, colSpan: 2, orderIndex: 3 },
      { fieldId: 973, fieldName: 'LedgerType', label: 'Defter Türü', fieldType: 'select', isRequired: true, colSpan: 3, orderIndex: 4,
        optionsJson: JSON.stringify([
          { label: 'Yevmiye', value: 'YEVMIYE' },
          { label: 'Kebir', value: 'KEBIR' },
        ]) },
      { fieldId: 974, fieldName: 'FileName', label: 'Dosya Adı', fieldType: 'text', isRequired: false, colSpan: 5, orderIndex: 5 },
      { fieldId: 975, fieldName: 'StartDate', label: 'Başlangıç', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 6 },
      { fieldId: 976, fieldName: 'EndDate', label: 'Bitiş', fieldType: 'date', isRequired: false, colSpan: 3, orderIndex: 7 },
      { fieldId: 977, fieldName: 'Status', label: 'Durum', fieldType: 'select', isRequired: false, colSpan: 3, orderIndex: 8,
        optionsJson: JSON.stringify([
          { label: 'Hazırlanıyor', value: 'Hazırlanıyor' },
          { label: 'Oluşturuldu', value: 'Oluşturuldu' },
          { label: 'GİB Gönderildi', value: 'GİB Gönderildi' },
          { label: 'Onay', value: 'Onay' },
        ]) },
      { fieldId: 978, fieldName: 'GibStatus', label: 'GİB Durum', fieldType: 'text', isRequired: false, colSpan: 3, orderIndex: 9 },
      { fieldId: 979, fieldName: 'IsActive', label: 'Aktif', fieldType: 'checkbox', isRequired: false, colSpan: 2, orderIndex: 10, defaultValue: 'true' },
    ],
  },
} as Record<string, FormSchemaDto>);

function egovTypedForm(
  baseCode: string,
  formCode: string,
  title: string,
  formId: number,
  docKind: number,
  direction: number,
  archived = false,
): FormSchemaDto {
  const base = FORM_SCHEMAS[baseCode];
  return {
    ...base,
    formId,
    formCode,
    title,
    fixedStandardFields: {
      ...(base.fixedStandardFields || {}),
      DocKind: docKind,
      Direction: direction,
      IsArchived: archived,
    },
  };
}

FORM_SCHEMAS.EInvoiceInForm = egovTypedForm('EGovDocumentForm', 'EInvoiceInForm', 'Gelen e-Fatura', 951, 1, 1);
FORM_SCHEMAS.EInvoiceOutForm = egovTypedForm('EGovDocumentForm', 'EInvoiceOutForm', 'Giden e-Fatura', 952, 1, 2);
FORM_SCHEMAS.EInvoiceArchiveInForm = egovTypedForm('EGovDocumentForm', 'EInvoiceArchiveInForm', 'Arşiv Gelen e-Fatura', 955, 1, 1, true);
FORM_SCHEMAS.EInvoiceArchiveOutForm = egovTypedForm('EGovDocumentForm', 'EInvoiceArchiveOutForm', 'Arşiv Giden e-Fatura', 956, 1, 2, true);
FORM_SCHEMAS.EArchiveInForm = egovTypedForm('EGovDocumentForm', 'EArchiveInForm', 'Gelen e-Arşiv', 953, 2, 1);
FORM_SCHEMAS.EArchiveOutForm = egovTypedForm('EGovDocumentForm', 'EArchiveOutForm', 'Giden e-Arşiv', 954, 2, 2);
FORM_SCHEMAS.EDespatchInForm = egovTypedForm('EGovDocumentForm', 'EDespatchInForm', 'Gelen e-İrsaliye', 957, 3, 1);
FORM_SCHEMAS.EDespatchOutForm = egovTypedForm('EGovDocumentForm', 'EDespatchOutForm', 'Giden e-İrsaliye', 958, 3, 2);
FORM_SCHEMAS.EDespatchArchiveInForm = egovTypedForm('EGovDocumentForm', 'EDespatchArchiveInForm', 'Arşiv Gelen e-İrsaliye', 959, 3, 1, true);
FORM_SCHEMAS.EDespatchArchiveOutForm = egovTypedForm('EGovDocumentForm', 'EDespatchArchiveOutForm', 'Arşiv Giden e-İrsaliye', 960, 3, 2, true);

// Fiyat — ProductPrice.Type_ (malzeme + hizmet aynı şablon)
FORM_SCHEMAS.SalesPriceForm = typedDocumentSchema(
  'ProductPriceForm',
  'SalesPriceForm',
  'Satış Fiyatı',
  741,
  'Type_',
  PriceType.Satis,
);
FORM_SCHEMAS.PurchasePriceForm = typedDocumentSchema(
  'ProductPriceForm',
  'PurchasePriceForm',
  'Alış Fiyatı',
  742,
  'Type_',
  PriceType.Alis,
);
// Hizmet fiyatları — aynı tablo / şablon (Type_ ile yön)
FORM_SCHEMAS.ServiceSalesPriceForm = (() => {
  const s = typedDocumentSchema(
    'ProductPriceForm',
    'ServiceSalesPriceForm',
    'Verilen Hizmet Fiyatı',
    743,
    'Type_',
    PriceType.Satis,
  );
  s.fields = s.fields.map((f) =>
    f.fieldName === 'ProductCardID' ? { ...f, label: 'Hizmet' } : f,
  );
  return s;
})();
FORM_SCHEMAS.ServicePurchasePriceForm = (() => {
  const s = typedDocumentSchema(
    'ProductPriceForm',
    'ServicePurchasePriceForm',
    'Alınan Hizmet Fiyatı',
    744,
    'Type_',
    PriceType.Alis,
  );
  s.fields = s.fields.map((f) =>
    f.fieldName === 'ProductCardID' ? { ...f, label: 'Hizmet' } : f,
  );
  return s;
})();

// Banka / ödeme fişleri — Type_ ile ayrılır (base formlar Object.assign sonrası)
FORM_SCHEMAS.IncomingWireForm = typedDocumentSchema(
  'BankVoucherForm',
  'IncomingWireForm',
  'Gelen Havale/EFT',
  90,
  'Type_',
  BankVoucherType.GelenHavale,
);
FORM_SCHEMAS.OutgoingWireForm = typedDocumentSchema(
  'BankVoucherForm',
  'OutgoingWireForm',
  'Gönderilen Havale/EFT',
  91,
  'Type_',
  BankVoucherType.GidenHavale,
);
FORM_SCHEMAS.CollectionForm = typedDocumentSchema(
  'PaymentTransForm',
  'CollectionForm',
  'Tahsilat',
  93,
  'Type_',
  PaymentType.Tahsilat,
);
FORM_SCHEMAS.PaymentForm = typedDocumentSchema(
  'PaymentTransForm',
  'PaymentForm',
  'Ödeme',
  94,
  'Type_',
  PaymentType.Odeme,
);

/** Kart + fiş tablolarına Yetki Kodu alanı */
const AUTH_CODE_TABLES = new Set([
  'ProductCard',
  'ProductPrice',
  'CustomerCard',
  'BankCard',
  'BankAccountCard',
  'SafeCard',
  'BoundCard',
  'BoundTrans',
  'VariantCard',
  'TaxCard',
  'AccountCard',
  'PersonCard',
  'RiskGroup',
  'OrderVoucher',
  'ProductVoucher',
  'Invoice',
  'BankVoucher',
  'CustomerVoucher',
  'PaymentTrans',
  'AccountVoucher',
  'PaidPlanCard',
  'BankCredit',
  'BankCreditInstallment',
  'SystemUser',
  'EGovDocument',
  'ELedger',
]);

function ensureAuthCodeField(schema: FormSchemaDto) {
  // Cari kartta Yetki Kodu / Kurum / İşyeri gösterilmez
  if (schema.tableName === 'CustomerCard') return;
  if (!AUTH_CODE_TABLES.has(schema.tableName)) return;
  if (schema.fields.some((f) => f.fieldName === 'AuthCode')) return;
  const maxOrder = schema.fields.reduce((m, f) => Math.max(m, f.orderIndex), 0);
  schema.fields.push({
    fieldId: schema.formId * 1000 + 99,
    fieldName: 'AuthCode',
    label: 'Yetki Kodu',
    fieldType: 'text',
    isRequired: false,
    colSpan: 2,
    orderIndex: maxOrder + 1,
  });
}

/** Kurum → İş yeri → Depo sırası; Yetki Kodu durumun yanında */
function ensureHeaderOrgAndAuthLayout(schema: FormSchemaDto) {
  // Kart / org tanımları — fiş başlığı enjekte etme
  if (
    [
      'SystemUser',
      'SYS_Companies',
      'SYS_Workplace',
      'SYS_Whouse',
      'SYS_OrgUnit',
      'Company',
      'Workplace',
      'Warehouse',
      'CustomerCard',
      'TaxCard',
      'PaidPlanCard',
      'RiskGroup',
      'SafeCard',
      'BoundCard',
      'BankCard',
      'BankAccountCard',
      'PersonCard',
      'AccountCard',
      'AccountGroup',
      'VariantTemplate',
      'Setting',
      'AuxilCodes',
    ].includes(schema.tableName)
  ) {
    return;
  }

  const hasWhouse = schema.fields.some((f) => f.fieldName === 'WhouseID');
  const isDoc =
    AUTH_CODE_TABLES.has(schema.tableName) ||
    ['OrderVoucher', 'ProductVoucher', 'Invoice', 'BankVoucher', 'CustomerVoucher', 'PaymentTrans', 'AccountVoucher', 'BankCredit'].includes(
      schema.tableName,
    );
  if (!isDoc && !hasWhouse) return;

  const whouseField = schema.fields.find((f) => f.fieldName === 'WhouseID');
  const statusField = schema.fields.find((f) =>
    ['Status_', 'Status', 'IsActive'].includes(f.fieldName),
  );

  // Depo seçeneklerini kurumsal listeyle güncelle
  if (whouseField && (!whouseField.optionsJson || whouseField.optionsJson.length < 10)) {
    whouseField.optionsJson = whouseOptionsJson;
    whouseField.colSpan = Math.min(whouseField.colSpan || 3, 3);
  }

  const baseOrder =
    whouseField?.orderIndex ??
    statusField?.orderIndex ??
    schema.fields.reduce((m, f) => Math.max(m, f.orderIndex), 0);

  if (!schema.fields.some((f) => f.fieldName === 'CompanyID')) {
    schema.fields.push({
      fieldId: schema.formId * 1000 + 91,
      fieldName: 'CompanyID',
      label: 'Firma',
      fieldType: 'select',
      isRequired: false,
      colSpan: 2,
      orderIndex: baseOrder - 0.4,
      optionsJson: companyOptionsJson,
      useLookup: false,
    });
  } else {
    const co = schema.fields.find((f) => f.fieldName === 'CompanyID');
    if (co) {
      co.useLookup = false;
      if (!co.label || co.label === 'Kurum') co.label = 'Firma';
    }
  }

  if (!schema.fields.some((f) => f.fieldName === 'DepartmentID')) {
    schema.fields.push({
      fieldId: schema.formId * 1000 + 92,
      fieldName: 'DepartmentID',
      label: 'İşyeri',
      fieldType: 'select',
      isRequired: false,
      colSpan: 2,
      orderIndex: baseOrder - 0.3,
      optionsJson: workplaceOptionsJson,
      useLookup: false,
    });
  } else {
    const wp = schema.fields.find((f) => f.fieldName === 'DepartmentID');
    if (wp) {
      wp.useLookup = false;
      if (!wp.label || /department|iş\s*yeri/i.test(wp.label)) wp.label = 'İşyeri';
    }
  }

  if (!schema.fields.some((f) => f.fieldName === 'OrgUnitID') && isDoc) {
    schema.fields.push({
      fieldId: schema.formId * 1000 + 93,
      fieldName: 'OrgUnitID',
      label: 'Bölüm',
      fieldType: 'select',
      isRequired: false,
      colSpan: 2,
      orderIndex: baseOrder - 0.15,
      optionsJson: select(orgUnitOptions(null, 1)),
      useLookup: false,
    });
  } else {
    const ou = schema.fields.find((f) => f.fieldName === 'OrgUnitID');
    if (ou) {
      ou.useLookup = false;
      if (!ou.label || /bölüm\s*\/\s*birim/i.test(ou.label) || ou.label === 'OrgUnitID') {
        ou.label = 'Bölüm';
      }
      ou.optionsJson = select(orgUnitOptions(null, 1));
    }
  }

  if (!schema.fields.some((f) => f.fieldName === 'UnitID') && isDoc) {
    schema.fields.push({
      fieldId: schema.formId * 1000 + 94,
      fieldName: 'UnitID',
      label: 'Birim',
      fieldType: 'select',
      isRequired: false,
      colSpan: 2,
      orderIndex: baseOrder - 0.1,
      optionsJson: select(orgUnitOptions(null, 2)),
      useLookup: false,
    });
  } else {
    const un = schema.fields.find((f) => f.fieldName === 'UnitID');
    if (un) {
      un.useLookup = false;
      if (!un.label || un.label === 'UnitID') un.label = 'Birim';
      un.optionsJson = select(orgUnitOptions(null, 2));
    }
  }

  if (whouseField) {
    whouseField.useLookup = false;
    if (!whouseField.label || whouseField.label === 'Depo') whouseField.label = 'Ambar';
  }

  // Yetki kodunu durum / depo yanına al
  let auth = schema.fields.find((f) => f.fieldName === 'AuthCode');
  if (!auth && AUTH_CODE_TABLES.has(schema.tableName)) {
    auth = {
      fieldId: schema.formId * 1000 + 99,
      fieldName: 'AuthCode',
      label: 'Yetki Kodu',
      fieldType: 'text',
      isRequired: false,
      colSpan: 2,
      orderIndex: (statusField?.orderIndex ?? baseOrder) + 0.1,
    };
    schema.fields.push(auth);
  } else if (auth) {
    auth.colSpan = 2;
    auth.orderIndex = (statusField?.orderIndex ?? whouseField?.orderIndex ?? baseOrder) + 0.1;
  }

  if (statusField) {
    statusField.colSpan = Math.min(statusField.colSpan || 2, 2);
  }

  // orderIndex’e göre sırala (kesirleri tam sayıya çevir)
  schema.fields.sort((a, b) => a.orderIndex - b.orderIndex);
  schema.fields.forEach((f, i) => {
    f.orderIndex = i + 1;
  });
}

/** Sipariş / irsaliye / fatura: cari adresi + ödeme planı */
function ensureTradePartyFields(schema: FormSchemaDto) {
  if (!['OrderVoucher', 'ProductVoucher', 'Invoice'].includes(schema.tableName)) return;
  const maxOrder = schema.fields.reduce((m, f) => Math.max(m, f.orderIndex), 0);
  const cust = schema.fields.find((f) => f.fieldName === 'CustomerID');
  const base = cust?.orderIndex ?? maxOrder;

  if (!schema.fields.some((f) => f.fieldName === 'CustomerAdressID')) {
    schema.fields.push({
      fieldId: schema.formId * 1000 + 81,
      fieldName: 'CustomerAdressID',
      label: 'Adres',
      fieldType: 'select',
      isRequired: false,
      colSpan: 4,
      orderIndex: base + 0.1,
      useLookup: true,
    });
  } else {
    const a = schema.fields.find((f) => f.fieldName === 'CustomerAdressID');
    if (a) {
      a.label = a.label || 'Adres';
      a.useLookup = true;
      a.fieldType = 'select';
    }
  }

  if (!schema.fields.some((f) => f.fieldName === 'PaidPlanID')) {
    schema.fields.push({
      fieldId: schema.formId * 1000 + 82,
      fieldName: 'PaidPlanID',
      label: 'Ödeme Planı',
      fieldType: 'select',
      isRequired: false,
      colSpan: 4,
      orderIndex: base + 0.2,
      useLookup: true,
    });
  } else {
    const p = schema.fields.find((f) => f.fieldName === 'PaidPlanID');
    if (p) {
      p.label = p.label || 'Ödeme Planı';
      p.useLookup = true;
      p.fieldType = 'select';
    }
  }

  schema.fields.sort((a, b) => a.orderIndex - b.orderIndex);
  schema.fields.forEach((f, i) => {
    f.orderIndex = i + 1;
  });
}

/** Fiş / cari / finans kartlarına Döviz (TL) + Kur */
const CURRENCY_TABLES = new Set([
  'CustomerCard',
  'OrderVoucher',
  'ProductVoucher',
  'Invoice',
  'BankVoucher',
  'CustomerVoucher',
  'PaymentTrans',
  'AccountVoucher',
  'AccountCard',
  'BankAccountCard',
  'SafeCard',
  'BoundCard',
  'BankCredit',
  'PaidPlanCard',
  'EGovDocument',
]);

function ensureCurrencyAndRateFields(schema: FormSchemaDto) {
  if (!CURRENCY_TABLES.has(schema.tableName)) return;
  if (schema.tableName === 'SYS_Currency') return;

  const isCardDefault =
    schema.tableName === 'CustomerCard' || schema.tableName === 'AccountCard';
  const currencyFieldName = isCardDefault ? 'DefaultCurrency' : 'Currency';
  const rateFieldName = isCardDefault ? 'DefaultRate' : 'CurrencyRate';

  schema.fields = schema.fields.filter(
    (f) => f.fieldName !== 'U_Currency' && f.fieldName !== 'CurrencyCode',
  );

  let currencyField = schema.fields.find((f) => f.fieldName === currencyFieldName);
  if (!currencyField) {
    const maxOrder = schema.fields.reduce((m, f) => Math.max(m, f.orderIndex), 0);
    currencyField = {
      fieldId: schema.formId * 1000 + 81,
      fieldName: currencyFieldName,
      label: isCardDefault ? 'Öndeğer Döviz' : 'Döviz',
      fieldType: 'select',
      isRequired: false,
      colSpan: 2,
      orderIndex: maxOrder + 0.1,
      optionsJson: currencyOptionsSelectJson,
      defaultValue: LOCAL_CURRENCY_ID,
    };
    schema.fields.push(currencyField);
  } else {
    currencyField.fieldType = 'select';
    currencyField.optionsJson = currencyOptionsSelectJson;
    currencyField.defaultValue = currencyField.defaultValue || LOCAL_CURRENCY_ID;
    currencyField.colSpan = Math.min(currencyField.colSpan || 2, 3);
    if (!currencyField.label || currencyField.label === 'Currency') {
      currencyField.label = isCardDefault ? 'Öndeğer Döviz' : 'Döviz';
    }
  }

  if (schema.tableName === 'CustomerCard') {
    schema.fields = schema.fields.filter(
      (f) => f.fieldName !== 'DefaultRate' && f.fieldName !== 'CurrencyRate',
    );
  } else {
    let rateField = schema.fields.find((f) => f.fieldName === rateFieldName);
    if (!rateField) {
      rateField = {
        fieldId: schema.formId * 1000 + 82,
        fieldName: rateFieldName,
        label: 'Kur',
        fieldType: 'number',
        isRequired: false,
        colSpan: 2,
        orderIndex: (currencyField.orderIndex || 0) + 0.05,
        defaultValue: '1',
      };
      schema.fields.push(rateField);
    } else {
      rateField.fieldType = 'number';
      rateField.label = rateField.label || 'Kur';
      rateField.defaultValue = rateField.defaultValue || '1';
      rateField.colSpan = Math.min(rateField.colSpan || 2, 2);
      rateField.orderIndex = (currencyField.orderIndex || 0) + 0.05;
    }
  }

  schema.fields.sort((a, b) => a.orderIndex - b.orderIndex);
  schema.fields.forEach((f, i) => {
    f.orderIndex = i + 1;
  });
}

function ensureAuxilCodesTab(schema: FormSchemaDto) {
  const isCard = AUXIL_CODE_CARD_TABLES.has(schema.tableName);
  const isVoucher = AUXIL_CODE_VOUCHER_TABLES.has(schema.tableName);
  if (!isCard && !isVoucher) return;
  schema.enableAuxilCodesTab = true;
  if (!schema.auxilCodeFields?.length) {
    schema.auxilCodeFields = buildAuxilCodeFields(schema.formId * 100);
  }
  if (schema.auxilCodeModuleNr == null) {
    schema.auxilCodeModuleNr = auxilModuleNrForTable(schema.tableName);
  }
}

for (const schema of Object.values(FORM_SCHEMAS)) {
  ensureAuthCodeField(schema);
  ensureHeaderOrgAndAuthLayout(schema);
  ensureTradePartyFields(schema);
  ensureCurrencyAndRateFields(schema);
  ensureAuxilCodesTab(schema);
  if (schema.tableName === 'CustomerCard') {
    schema.fields = schema.fields.filter(
      (f) =>
        !['CompanyID', 'DepartmentID', 'WhouseID', 'OrgUnitID', 'UnitID', 'AuthCode'].includes(
          f.fieldName,
        ),
    );
  }
}

/** Form kodu → hangi alan SYS_TypeDef’den doldurulur */
const TYPE_DEF_FIELD_BINDINGS: Record<
  string,
  { fieldName: string; targetTable: string; moduleKey?: string; kind: TypeDefKind }[]
> = {
  SalesInvoiceForm: [{ fieldName: 'InvoiceType', targetTable: 'Invoice', moduleKey: 'satis', kind: 'voucher' }],
  PurchaseInvoiceForm: [{ fieldName: 'InvoiceType', targetTable: 'Invoice', moduleKey: 'satinalma', kind: 'voucher' }],
  InvoiceForm: [{ fieldName: 'InvoiceType', targetTable: 'Invoice', kind: 'voucher' }],
  BankVoucherForm: [{ fieldName: 'Type_', targetTable: 'BankVoucher', moduleKey: 'finans', kind: 'voucher' }],
  CustomerVoucherForm: [{ fieldName: 'Type', targetTable: 'CustomerVoucher', moduleKey: 'finans', kind: 'voucher' }],
  BoundTransForm: [{ fieldName: 'Type_', targetTable: 'BoundTrans', moduleKey: 'finans', kind: 'voucher' }],
  PaymentTransForm: [{ fieldName: 'Type_', targetTable: 'PaymentTrans', moduleKey: 'finans', kind: 'voucher' }],
  CustomerCardForm: [{ fieldName: 'Type_', targetTable: 'CustomerCard', kind: 'customer' }],
  MusteriCardForm: [{ fieldName: 'Type_', targetTable: 'CustomerCard', kind: 'customer' }],
  OrderVoucherForm: [{ fieldName: 'Type_', targetTable: 'OrderVoucher', kind: 'voucher' }],
  ProductVoucherForm: [{ fieldName: 'VoucherType', targetTable: 'ProductVoucher', kind: 'voucher' }],
};

function applyTypeDefOptions(schema: FormSchemaDto, formCode: string): FormSchemaDto {
  const bindings = TYPE_DEF_FIELD_BINDINGS[formCode];
  if (!bindings?.length) return schema;

  const patchFields = (fields: FormSchemaDto['fields']) =>
    fields.map((f) => {
      const bind = bindings.find((b) => b.fieldName === f.fieldName);
      if (!bind) return f;
      const opts = getTypeOptionsForTarget({
        targetTable: bind.targetTable,
        moduleKey: bind.moduleKey,
        kind: bind.kind,
      });
      if (!opts.length) return f;
      return { ...f, optionsJson: select(opts), defaultValue: f.defaultValue ?? opts[0]?.value };
    });

  return {
    ...schema,
    fields: patchFields(schema.fields),
  };
}

export function getFormSchema(formCode: string): FormSchemaDto | undefined {
  const base = FORM_SCHEMAS[formCode];
  if (!base) return undefined;
  return applyTypeDefOptions(base, formCode);
}
