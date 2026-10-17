import React from 'react';
import {
  useForm,
  useFieldArray,
  FieldValues,
  FieldError,
  get,
  Control,
  UseFormRegister,
} from 'react-hook-form';
import { FormSchemaDto, DynamicFormDataDto, FormFieldDto } from '../types/formTypes';
import { FieldRenderer } from './FieldRenderer';
import { DateField } from './DateField';
import { FormTabs, FormTabPanel } from './FormTabs';
import { SubListGrid } from './SubListGrid';
import {
  customerAddressTypeLabel,
  defaultCustomerAddressRow,
} from '../data/customerAddressTypes';
import {
  accountLinkTypeLabel,
  defaultAccountLinkRow,
  defaultProductAccountLinkRows,
  AccountLinkModule,
} from '../data/cardAccountLinks';
import {
  findVariantTemplate,
  generateVariantsFromTemplate,
} from '../data/variantTemplates';
import { canField } from '../data/permissions';
import { computeFormulaValues, formulaExtraFields } from '../data/extraFields';
import { getCurrencyRate, LOCAL_CURRENCY_ID } from '../data/currencies';
import { Plus, Trash2, MapPin, UserRound, Landmark, BookOpen, Barcode, Layers, Building2, Shapes, Wand2, Tags } from 'lucide-react';
import { UnitConvTabPanel } from './UnitConvTabPanel';
import { buildUnitConvFormRows, flattenUnitConvPayload } from '../data/productUnitConvs';
import {
  emptyProductUnits,
  fetchProductUnitOptions,
  resolveLineUnitId,
  unitsFromFormConvs,
  type ProductUnitsInfo,
  type UnitModuleFilter,
} from '../data/productLineUnits';
import { PriceType } from '../data/documentTypes';
import { FormFieldContext, InlineFieldGrid } from './FormFieldContext';
import { EinvoiceMukellefCheck } from './EinvoiceMukellefCheck';
import { PostSaveHelpButton } from './PostSaveHelpButton';
import { useOrgFieldCascade } from '../hooks/useOrgFieldCascade';
import { defaultAuxilValueRow, AUXIL_VALUE_KIND } from '../data/auxilCodes';
import { AuxilCodeAssignmentEditor } from './AuxilCodeAssignmentEditor';
import { listRecords } from '../api/recordsApi';
import { accountCodeHasParentDot, parentAccountCode } from '../data/accountParentLink';
import { appConfirm } from '../utils/appConfirm';

interface DynamicFormEngineProps {
  schema: FormSchemaDto;
  initialData?: DynamicFormDataDto;
  onSubmit: (data: DynamicFormDataDto) => void;
  isLoading?: boolean;
  /** İncele: tüm alanlar salt okunur */
  readOnly?: boolean;
  onLiveChange?: (data: DynamicFormDataDto) => void;
}

function splitFields(schema: FormSchemaDto): { general: FormFieldDto[]; custom: FormFieldDto[]; headerRight: FormFieldDto[] } {
  const registryCustom = schema.customFields || [];
  const fromSchemaCustom = schema.fields.filter((f) => f.fieldName.startsWith('U_'));
  const headerRight = schema.fields.filter((f) => f.headerRight && !f.fieldName.startsWith('U_'));
  const headerNames = new Set(headerRight.map((f) => f.fieldName));
  const general = schema.fields.filter(
    (f) => !f.fieldName.startsWith('U_') && !headerNames.has(f.fieldName),
  );
  const seen = new Set(registryCustom.map((f) => f.fieldName));
  const custom = [
    ...registryCustom,
    ...fromSchemaCustom.filter((f) => !seen.has(f.fieldName)),
  ];
  return { general, custom, headerRight };
}

/** Adres yer alanları — adres detayında tek satırda gösterilir */
const PLACE_FIELDS = ['Country', 'City', 'Town', 'Dictrict'];
/** Adres kimliği — tek satırda: Tip / Kod / Ad */
const ADDR_ID_FIELDS = ['AdressType', 'AdressCode', 'Title'];

export const DynamicFormEngine: React.FC<DynamicFormEngineProps> = ({
  schema,
  initialData,
  onSubmit,
  isLoading = false,
  readOnly = false,
  onLiveChange,
}) => {
  const { general, custom: allCustom, headerRight } = splitFields(schema);
  const custom = allCustom.filter((f) => canField(schema.tableName, f.fieldName, 'view'));
  const showCustomTab = schema.enableCustomFieldsTab !== false;
  const hasAddresses = Boolean(schema.enableAddressesTab && schema.addressFields?.length);
  const hasContacts = Boolean(schema.enableContactsTab && schema.contactFields?.length);
  const hasAccounts = Boolean(schema.enableAccountsTab && schema.accountFields?.length);
  const hasBarcodes = Boolean(schema.enableBarcodesTab && schema.barcodeFields?.length);
  const hasUnitConvs = Boolean(
    schema.enableUnitConvsTab && schema.unitConvFields?.length && schema.barcodeFields?.length,
  );
  const hasProductSubs = Boolean(schema.enableProductSubsTab && schema.productSubFields?.length);
  const hasCustomerAliases = Boolean(
    schema.enableCustomerAliasesTab && schema.customerAliasFields?.length,
  );
  const hasVariants = Boolean(schema.enableVariantsTab && schema.variantFields?.length);
  const hasAccountLinks = Boolean(schema.enableAccountLinksTab && schema.accountLinkFields?.length);
  const hasAuxilCodes = Boolean(schema.enableAuxilCodesTab && schema.auxilCodeFields?.length);
  const hasAuxilValues = Boolean(schema.enableAuxilValuesTab && schema.auxilValueFields?.length);
  const hasWorkplaces = Boolean(schema.enableWorkplacesTab && schema.workplaceFields?.length);
  /** Ambar: üst sekme veya işyeri kartı içinde */
  const hasWhouses = Boolean(schema.whouseFields?.length && (schema.enableWhousesTab || hasWorkplaces));
  const whousesUnderWorkplace = Boolean(hasWorkplaces && !schema.enableWhousesTab && schema.whouseFields?.length);
  /** e-Fatura kutusunda «e-Faturaya Geçiş Tarihi» (CustomerCard.EinvoiceEntryDate · SqlUpdates/14) */
  const hasEinvoiceEntryDate = schema.tableName === 'CustomerCard';
  const accountLinkSingle = Boolean(schema.accountLinkSingle);
  /** Kurumsal ızgara sütun sayısı (firma kartı gibi geniş formlarda 3) */
  const formCols: 2 | 3 = schema.formColumns === 3 ? 3 : 2;
  const accountLinkFixed = Boolean(schema.accountLinkFixed);
  const linkModule = schema.accountLinkModule ?? 0;
  const [tab, setTab] = React.useState('genel');
  const [addressError, setAddressError] = React.useState<string | null>(null);
  /** Adresler sekmesi: soldaki listede seçili adres (sağda detayı) */
  const [selectedAddr, setSelectedAddr] = React.useState(0);

  const fieldDefaults: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.defaultValue != null && f.defaultValue !== '' && !f.fieldName.startsWith('U_')) {
      fieldDefaults[f.fieldName] = f.defaultValue;
    }
  }
  if (schema.fields.some((f) => f.fieldName === 'DefaultCurrency') && fieldDefaults.DefaultCurrency == null) {
    fieldDefaults.DefaultCurrency = LOCAL_CURRENCY_ID;
  }
  if (schema.fields.some((f) => f.fieldName === 'Currency') && fieldDefaults.Currency == null) {
    fieldDefaults.Currency = LOCAL_CURRENCY_ID;
    fieldDefaults.CurrencyRate = 1;
  }

  const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<FieldValues>({
    defaultValues: {
      standardFields: {
        ...fieldDefaults,
        ...(schema.fixedStandardFields || {}),
        ...(initialData?.standardFields || {}),
      },
      additionalFields: initialData?.additionalFields || {},
      addresses: initialData?.addresses?.length
        ? initialData.addresses
        : hasAddresses
          ? [defaultCustomerAddressRow()]
          : [],
      contacts: initialData?.contacts?.length ? initialData.contacts : [],
      accounts: initialData?.accounts?.length ? initialData.accounts : [],
      barcodes: initialData?.barcodes?.length ? initialData.barcodes : [],
      unitConvs: hasUnitConvs
        ? buildUnitConvFormRows(
            initialData?.unitConvs,
            initialData?.barcodes,
            initialData?.standardFields?.DefaultUnitID ?? fieldDefaults.DefaultUnitID,
          )
        : [],
      productSubs: initialData?.productSubs?.length ? initialData.productSubs : [],
      customerAliases: initialData?.customerAliases?.length ? initialData.customerAliases : [],
      variants: initialData?.variants?.length ? initialData.variants : [],
      accountLinks: initialData?.accountLinks?.length
        ? initialData.accountLinks
        : hasAccountLinks
          ? linkModule === AccountLinkModule.Product || accountLinkFixed
            ? defaultProductAccountLinkRows(linkModule || AccountLinkModule.Product)
            : [defaultAccountLinkRow(linkModule)]
          : [],
      auxilCodes: initialData?.auxilCodes?.length ? initialData.auxilCodes : [],
      auxilValues: initialData?.auxilValues?.length ? initialData.auxilValues : [],
      workplaces: initialData?.workplaces?.length
        ? initialData.workplaces
        : hasWorkplaces && !(initialData?.recordId > 0)
          ? [{ Code: '0', Title: 'Merkez', IsActive: true }]
          : [],
      whouses: initialData?.whouses?.length
        ? initialData.whouses
        : hasWhouses && !(initialData?.recordId > 0)
          ? [{ WhouseCode: '0', Name: 'Merkez', WorkplaceCode: '0', IsActive: true }]
          : [],
    },
  });

  const watchedCurrency = watch('standardFields.Currency');
  const watchedDefaultCurrency = watch('standardFields.DefaultCurrency');
  const watchedAccountCode = watch('standardFields.Code');
  const isNewRecord = !initialData?.recordId;
  const { patchField } = useOrgFieldCascade({
    schema,
    watch,
    setValue,
    readOnly,
    applyDefaultsIfEmpty: isNewRecord,
  });
  const prevCurrency = React.useRef<unknown>(undefined);
  const prevDefaultCurrency = React.useRef<unknown>(undefined);
  React.useEffect(() => {
    if (readOnly) return;
    if (prevCurrency.current === undefined) {
      prevCurrency.current = watchedCurrency;
      return;
    }
    if (watchedCurrency != null && watchedCurrency !== '' && prevCurrency.current !== watchedCurrency) {
      setValue('standardFields.CurrencyRate', getCurrencyRate(watchedCurrency as string), {
        shouldDirty: true,
      });
    }
    prevCurrency.current = watchedCurrency;
  }, [watchedCurrency, readOnly, setValue]);
  /** Formüllü ek alanlar — değer girildikçe hesaplanır */
  React.useEffect(() => {
    if (readOnly || !formulaExtraFields(schema.tableName).length) return;
    const apply = (values: Record<string, unknown>) => {
      const all = {
        ...((values.standardFields as Record<string, unknown>) || {}),
        ...((values.additionalFields as Record<string, unknown>) || {}),
      };
      for (const [k, v] of Object.entries(computeFormulaValues(schema.tableName, all))) {
        setValue(`additionalFields.${k}`, v ?? '', { shouldDirty: true, shouldValidate: false });
      }
    };
    apply(getValues());
    const sub = watch((values, { type }) => {
      if (type === 'change') apply(values as Record<string, unknown>);
    });
    return () => sub.unsubscribe();
  }, [schema.tableName, readOnly, watch, setValue, getValues]);
  React.useEffect(() => {
    if (readOnly) return;
    if (prevDefaultCurrency.current === undefined) {
      prevDefaultCurrency.current = watchedDefaultCurrency;
      return;
    }
    if (
      watchedDefaultCurrency != null &&
      watchedDefaultCurrency !== '' &&
      prevDefaultCurrency.current !== watchedDefaultCurrency
    ) {
      setValue('standardFields.DefaultRate', getCurrencyRate(watchedDefaultCurrency as string), {
        shouldDirty: true,
      });
    }
    prevDefaultCurrency.current = watchedDefaultCurrency;
  }, [watchedDefaultCurrency, readOnly, setValue]);

  /** Hesap kartı: kodda '.' → üst hesap = son noktadan önceki kod (zorunlu) */
  const accountParentLocked =
    schema.tableName === 'AccountCard' && accountCodeHasParentDot(watchedAccountCode as string);
  React.useEffect(() => {
    if (readOnly || schema.tableName !== 'AccountCard') return;
    const parentCode = parentAccountCode(watchedAccountCode as string);
    if (!parentCode) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await listRecords('AccountCard', {
          pk: 'AccountCardID',
          filterColumn: 'Code',
          filterValue: parentCode,
          take: 5,
        });
        if (cancelled) return;
        const selfId = Number(initialData?.recordId) || 0;
        const row = (res.rows || []).find((r) => {
          const id = Number(r.AccountCardID ?? r.accountCardID ?? r.id);
          return Number.isFinite(id) && id > 0 && id !== selfId;
        });
        const parentId = row ? Number(row.AccountCardID ?? row.accountCardID ?? row.id) : NaN;
        if (Number.isFinite(parentId) && parentId > 0) {
          setValue('standardFields.MainAccountID', String(parentId), { shouldDirty: true });
          setValue('standardFields.MainAccount', false, { shouldDirty: true });
          const curType = String(watch('standardFields.Type_') ?? '').trim();
          if (!curType || curType === '1') {
            setValue('standardFields.Type_', '2', { shouldDirty: true });
          }
        } else {
          setValue('standardFields.MainAccountID', '', { shouldDirty: true });
        }
      } catch {
        /* lookup başarısız → kayıtta backend de dener */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    watchedAccountCode,
    readOnly,
    schema.tableName,
    setValue,
    watch,
    initialData?.recordId,
  ]);

  const { fields, append, remove } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'addresses',
  });

  const {
    fields: contactRows,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'contacts',
  });

  const {
    fields: accountRows,
    append: appendAccount,
    remove: removeAccount,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'accounts',
  });

  const {
    fields: barcodeRows,
    append: appendBarcode,
    remove: removeBarcode,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'barcodes',
  });

  const watchedDefaultUnitId = watch('standardFields.DefaultUnitID');
  const watchedProductCardId = watch('standardFields.ProductCardID');
  const watchedPriceType = watch('standardFields.Type_');
  const unitConvRowsWatch = watch('unitConvs') as { barcodes?: unknown[] }[] | undefined;
  const watchedProductSubs = watch('productSubs') as Record<string, unknown>[] | undefined;

  /** Kart formu: malzeme seçince Birim sadece o kartın birimleri */
  const linkUnitToProduct =
    schema.tableName !== 'ProductUnit' &&
    schema.fields.some((f) => f.fieldName === 'ProductCardID') &&
    schema.fields.some((f) => f.fieldName === 'UnitID');

  const cardUnitModule: UnitModuleFilter = React.useMemo(() => {
    const t = String(
      watchedPriceType ?? schema.fixedStandardFields?.Type_ ?? '',
    ).trim();
    if (t === PriceType.Alis) return 'purchase';
    if (t === PriceType.Satis) return 'sales';
    if ((schema.tableName || '').toLowerCase() === 'productbarcode') return 'all';
    return 'all';
  }, [schema.fixedStandardFields?.Type_, schema.tableName, watchedPriceType]);

  const [cardUnitInfo, setCardUnitInfo] = React.useState<ProductUnitsInfo | null>(null);
  const subUnitInfoRef = React.useRef<Record<number, ProductUnitsInfo>>({});
  const [subUnitTick, setSubUnitTick] = React.useState(0);

  React.useEffect(() => {
    if (!linkUnitToProduct) return;
    const pid = Number(watchedProductCardId);
    let cancelled = false;
    if (!Number.isFinite(pid) || pid <= 0) {
      setCardUnitInfo(emptyProductUnits(0));
      if (!readOnly) {
        const cur = String(watch('standardFields.UnitID') ?? '').trim();
        if (cur) setValue('standardFields.UnitID', '', { shouldDirty: true });
      }
      return;
    }
    void (async () => {
      const info = await fetchProductUnitOptions(pid, cardUnitModule);
      if (cancelled) return;
      setCardUnitInfo(info);
      if (!readOnly) {
        const cur = watch('standardFields.UnitID');
        const next = resolveLineUnitId(cur, info);
        if ((next ?? '') !== String(cur ?? '').trim()) {
          setValue('standardFields.UnitID', next ?? '', { shouldDirty: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    cardUnitModule,
    linkUnitToProduct,
    readOnly,
    setValue,
    watch,
    watchedProductCardId,
  ]);

  /** Reçete satırı: alt malzeme birimleri */
  React.useEffect(() => {
    if (!hasProductSubs) return;
    const rows = watchedProductSubs || [];
    let cancelled = false;
    void (async () => {
      let loaded = false;
      for (let i = 0; i < rows.length; i++) {
        if (cancelled) return;
        const pid = Number(rows[i]?.SubProductCardID);
        if (!Number.isFinite(pid) || pid <= 0) {
          if (!readOnly && rows[i]?.UnitID) {
            setValue(`productSubs.${i}.UnitID`, '', { shouldDirty: true });
          }
          continue;
        }
        let info = subUnitInfoRef.current[pid];
        if (!info) {
          info = await fetchProductUnitOptions(pid, 'material');
          if (cancelled) return;
          subUnitInfoRef.current[pid] = info;
          loaded = true;
        }
        if (!readOnly) {
          const next = resolveLineUnitId(rows[i]?.UnitID, info);
          if ((next ?? '') !== String(rows[i]?.UnitID ?? '').trim()) {
            setValue(`productSubs.${i}.UnitID`, next ?? '', { shouldDirty: true });
          }
        }
      }
      if (loaded) setSubUnitTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasProductSubs, readOnly, setValue, watchedProductSubs]);

  const {
    fields: productSubRows,
    append: appendProductSub,
    remove: removeProductSub,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'productSubs',
  });

  const {
    fields: customerAliasRows,
    append: appendCustomerAlias,
    remove: removeCustomerAlias,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'customerAliases',
  });

  const {
    fields: variantRows,
    append: appendVariant,
    remove: removeVariant,
    replace: replaceVariants,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'variants',
  });

  const {
    fields: accountLinkRows,
    append: appendAccountLink,
    remove: removeAccountLink,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'accountLinks',
  });

  const {
    fields: auxilCodeRows,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'auxilCodes',
  });

  const {
    fields: auxilValueRows,
    append: appendAuxilValue,
    remove: removeAuxilValue,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'auxilValues',
  });

  const {
    fields: workplaceRows,
    append: appendWorkplace,
    remove: removeWorkplace,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'workplaces',
  });

  const {
    fields: whouseRows,
    append: appendWhouse,
    remove: removeWhouse,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'whouses',
  });

  const watchedAddresses = watch('addresses') as Record<string, unknown>[] | undefined;
  const watchedAccountLinks = watch('accountLinks') as Record<string, unknown>[] | undefined;
  const watchedWorkplaces = watch('workplaces') as Record<string, unknown>[] | undefined;
  const watchedWhouses = watch('whouses') as Record<string, unknown>[] | undefined;
  const watchedCardTaxNr = watch('standardFields.TaxNr');
  const watchedCompanyTax = watch('standardFields.TaxNumber');
  const enableMukellef = watch('standardFields.EnableMukellefCheck');
  const enableSend = watch('standardFields.EnableInvoiceSend');
  const enableReceive = watch('standardFields.EnableInvoiceReceive');
  const watchedIntegratorName = watch('standardFields.IntegratorName');
  const watchedIntegratorWsUrl = watch('standardFields.IntegratorWsUrl');
  const watchedIntegratorUser = watch('standardFields.IntegratorUser');
  const watchedIntegratorPassword = watch('standardFields.IntegratorPassword');
  const watchedIntegratorVkN = watch('standardFields.IntegratorVkN');

  const companyIntegrator = React.useMemo(
    () => ({
      name: String(watchedIntegratorName || ''),
      wsUrl: String(watchedIntegratorWsUrl || ''),
      user: String(watchedIntegratorUser || ''),
      password: String(watchedIntegratorPassword || ''),
      vkn: String(watchedIntegratorVkN || ''),
    }),
    [
      watchedIntegratorName,
      watchedIntegratorWsUrl,
      watchedIntegratorUser,
      watchedIntegratorPassword,
      watchedIntegratorVkN,
    ],
  );

  const workplaceCodeOptionsJson = React.useMemo(() => {
    const rows = watchedWorkplaces || [];
    const opts: { label: string; value: string }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const code = String(r?.Code ?? '').trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const title = String(r?.Title ?? '').trim();
      opts.push({ label: title ? `${code} — ${title}` : code, value: code });
    }
    return JSON.stringify([{ label: '— İşyeri seçin —', value: '' }, ...opts]);
  }, [watchedWorkplaces]);

  const lastWorkplaceCode = React.useMemo(() => {
    const rows = watchedWorkplaces || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const code = String(rows[i]?.Code ?? '').trim();
      if (code) return code;
    }
    return '';
  }, [watchedWorkplaces]);

  const handleFormSubmit = (data: FieldValues) => {
    if (hasAddresses) {
      const addresses = (data.addresses as Record<string, unknown>[]) || [];
      if (!addresses.length) {
        setAddressError('En az bir adres ekleyin.');
        setTab('adresler');
        return;
      }
      const incomplete = addresses.some(
        (a) => !String(a?.AdressType || '').trim() || !String(a?.Adress || '').trim() || !String(a?.City || '').trim(),
      );
      if (incomplete) {
        setAddressError('Her adres için tip, il ve açık adres zorunludur.');
        setTab('adresler');
        return;
      }
      setAddressError(null);
    }

    const payload: DynamicFormDataDto = {
      recordId: initialData?.recordId ?? 0,
      standardFields: {
        ...((data.standardFields as Record<string, unknown>) || {}),
        ...(schema.fixedStandardFields || {}),
      },
      additionalFields: (data.additionalFields as Record<string, unknown>) || {},
      addresses: hasAddresses ? ((data.addresses as Record<string, unknown>[]) || []) : undefined,
      contacts: hasContacts ? ((data.contacts as Record<string, unknown>[]) || []) : undefined,
      accounts: hasAccounts ? ((data.accounts as Record<string, unknown>[]) || []) : undefined,
      barcodes: hasBarcodes && !hasUnitConvs
        ? ((data.barcodes as Record<string, unknown>[]) || [])
        : undefined,
      productSubs: hasProductSubs
        ? ((data.productSubs as Record<string, unknown>[]) || [])
        : undefined,
      customerAliases: hasCustomerAliases
        ? ((data.customerAliases as Record<string, unknown>[]) || [])
        : undefined,
      variants: hasVariants ? ((data.variants as Record<string, unknown>[]) || []) : undefined,
      accountLinks: hasAccountLinks
        ? ((data.accountLinks as Record<string, unknown>[]) || []).map((row) => ({
            ...row,
            Module: row.Module ?? linkModule,
          }))
        : undefined,
      auxilCodes: hasAuxilCodes
        ? ((data.auxilCodes as Record<string, unknown>[]) || [])
            .map((row, i) => ({
              ...row,
              LineNr: Number(row.LineNr) || i + 1,
            }))
            .filter(
              (row) =>
                String(row.AuxilCodesID || '').trim() !== '' ||
                String(row.AuxilCode || '').trim() !== '',
            )
        : undefined,
      auxilValues: hasAuxilValues
        ? ((data.auxilValues as Record<string, unknown>[]) || [])
            .map((row, i) => ({
              ...row,
              ValueKind: Number(row.ValueKind) || AUXIL_VALUE_KIND.Code,
              SortOrder: Number(row.SortOrder) || (i + 1) * 10,
            }))
            .filter((row) => String(row.Code || '').trim() !== '')
        : undefined,
      workplaces: hasWorkplaces ? ((data.workplaces as Record<string, unknown>[]) || []) : undefined,
      whouses: hasWhouses ? ((data.whouses as Record<string, unknown>[]) || []) : undefined,
    };
    if (hasUnitConvs) {
      const flat = flattenUnitConvPayload(data.unitConvs as Parameters<typeof flattenUnitConvPayload>[0]);
      payload.unitConvs = flat.unitConvs;
      payload.barcodes = flat.barcodes;
    }
    onSubmit(payload);
  };

  const watchedAll = watch();
  React.useEffect(() => {
    if (!onLiveChange || readOnly) return;
    const t = window.setTimeout(() => {
      const data = watchedAll;
      onLiveChange({
        recordId: initialData?.recordId ?? 0,
        standardFields: {
          ...((data.standardFields as Record<string, unknown>) || {}),
          ...(schema.fixedStandardFields || {}),
        },
        additionalFields: (data.additionalFields as Record<string, unknown>) || {},
        addresses: hasAddresses ? ((data.addresses as Record<string, unknown>[]) || []) : undefined,
        contacts: hasContacts ? ((data.contacts as Record<string, unknown>[]) || []) : undefined,
        accounts: hasAccounts ? ((data.accounts as Record<string, unknown>[]) || []) : undefined,
        barcodes: hasBarcodes && !hasUnitConvs
          ? ((data.barcodes as Record<string, unknown>[]) || [])
          : undefined,
        productSubs: hasProductSubs
          ? ((data.productSubs as Record<string, unknown>[]) || [])
          : undefined,
        customerAliases: hasCustomerAliases
          ? ((data.customerAliases as Record<string, unknown>[]) || [])
          : undefined,
        variants: hasVariants ? ((data.variants as Record<string, unknown>[]) || []) : undefined,
        accountLinks: hasAccountLinks
          ? ((data.accountLinks as Record<string, unknown>[]) || []).map((row) => ({
              ...row,
              Module: row.Module ?? linkModule,
            }))
          : undefined,
        auxilCodes: hasAuxilCodes
          ? ((data.auxilCodes as Record<string, unknown>[]) || [])
          : undefined,
        auxilValues: hasAuxilValues
          ? ((data.auxilValues as Record<string, unknown>[]) || [])
          : undefined,
        workplaces: hasWorkplaces ? ((data.workplaces as Record<string, unknown>[]) || []) : undefined,
        whouses: hasWhouses ? ((data.whouses as Record<string, unknown>[]) || []) : undefined,
        ...(hasUnitConvs
          ? (() => {
              const flat = flattenUnitConvPayload(
                data.unitConvs as Parameters<typeof flattenUnitConvPayload>[0],
              );
              return { unitConvs: flat.unitConvs, barcodes: flat.barcodes };
            })()
          : {}),
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [
    watchedAll,
    onLiveChange,
    readOnly,
    initialData?.recordId,
    schema.fixedStandardFields,
    hasAddresses,
    hasContacts,
    hasAccounts,
    hasBarcodes,
    hasUnitConvs,
    hasProductSubs,
    hasCustomerAliases,
    hasVariants,
    hasAccountLinks,
    hasAuxilCodes,
    hasAuxilValues,
    hasWorkplaces,
    hasWhouses,
    linkModule,
  ]);

  const getFieldError = (fieldName: string): FieldError | undefined => {
    const path = fieldName.startsWith('U_')
      ? `additionalFields.${fieldName}`
      : `standardFields.${fieldName}`;
    return get(errors, path) as FieldError | undefined;
  };

  const renderGrid = (fieldsList: FormFieldDto[], isCustom = false) => {
    const ungrouped = fieldsList.filter((f) => !f.group);
    const groupNames = [...new Set(fieldsList.filter((f) => f.group).map((f) => f.group!))];

    const renderField = (field: FormFieldDto) => {
      let patched = patchField(field);
      if (linkUnitToProduct && field.fieldName === 'UnitID') {
        const pid = Number(watchedProductCardId);
        const info =
          Number.isFinite(pid) && pid > 0
            ? cardUnitInfo ?? emptyProductUnits(pid)
            : emptyProductUnits(0);
        patched = { ...patched, optionsJson: info.optionsJson };
      }
      const fieldReadOnly =
        readOnly ||
        Boolean(field.isReadOnly) ||
        (isCustom && !canField(schema.tableName, field.fieldName, 'edit')) ||
        (linkUnitToProduct &&
          field.fieldName === 'UnitID' &&
          !(Number(watchedProductCardId) > 0)) ||
        (accountParentLocked && field.fieldName === 'MainAccountID');
      return (
        <FieldRenderer
          key={`${patched.fieldId}-${patched.fieldName}-${patched.optionsJson || ''}`}
          field={patched}
          register={register}
          error={getFieldError(field.fieldName)}
          disabled={fieldReadOnly}
          watermark
        />
      );
    };

    return (
      <div className="space-y-3">
        {ungrouped.length > 0 && (
          <InlineFieldGrid cols={formCols}>{ungrouped.map(renderField)}</InlineFieldGrid>
        )}
        {groupNames.map((g) => (
          <fieldset
            key={g}
            className="rounded-sm border border-slate-300 dark:border-slate-600 px-3 pt-1 pb-2.5"
          >
            <legend className="px-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
              {g}
            </legend>
            {g === 'Dönem / e-Belge Başlangıç' && schema.tableName === 'SYS_Companies' && (
              <p className="mb-2 text-[11px] text-slate-500 leading-snug">
                Firmanın mali dönem ve e-belge (e-Defter / e-Fatura) geçiş tarihleri — raporlama ve
                e-belge süreçlerinde hangi tarihten itibaren kuralların uygulanacağını belirler.
              </p>
            )}
            {(g === 'Posta Kutusu' || g === 'e-Devlet') && schema.tableName === 'SYS_Companies' && (
              <div className="mb-2 space-y-1.5">
                <EinvoiceMukellefCheck
                  taxNr={String(watchedCompanyTax || '')}
                  integrator={companyIntegrator}
                  disabled={readOnly || enableMukellef === false || enableMukellef === 'false' || enableMukellef === 0}
                  onApplied={({ postLabel, senderLabel, status }) => {
                    if (postLabel) {
                      setValue('standardFields.PostLabel', postLabel, { shouldDirty: true });
                    }
                    if (senderLabel) {
                      setValue('standardFields.SenderLabel', senderLabel, { shouldDirty: true });
                    }
                    setValue('standardFields.MukellefCheckStatus', status, { shouldDirty: true });
                    setValue('standardFields.MukellefCheckAt', new Date().toISOString(), {
                      shouldDirty: true,
                    });
                  }}
                />
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                  <span className={enableSend === false || enableSend === 'false' || enableSend === 0 ? 'text-slate-400 line-through' : 'text-emerald-700 font-semibold'}>
                    Fatura Gönder {enableSend === false || enableSend === 'false' || enableSend === 0 ? 'kapalı' : 'açık'}
                  </span>
                  <span className={enableReceive === false || enableReceive === 'false' || enableReceive === 0 ? 'text-slate-400 line-through' : 'text-emerald-700 font-semibold'}>
                    Fatura Al {enableReceive === false || enableReceive === 'false' || enableReceive === 0 ? 'kapalı' : 'açık'}
                  </span>
                </div>
              </div>
            )}
            <InlineFieldGrid cols={formCols}>
              {fieldsList.filter((f) => f.group === g).map(renderField)}
            </InlineFieldGrid>
          </fieldset>
        ))}
      </div>
    );
  };

  /** SAP tarzı başlık: ilk kimlik alanları (Kod, Ad, Tür…) sekmelerin üstünde */
  const identityFields = (() => {
    const plain = general.filter((f) => !f.group && f.fieldType !== 'checkbox' && f.fieldType !== 'textarea');
    if (general.length < 6 || plain.length < 2) return [] as FormFieldDto[];
    return [...plain].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).slice(0, 4);
  })();
  const generalRest = identityFields.length
    ? general.filter((f) => !identityFields.includes(f))
    : general;

  const tabs = [
    { id: 'genel', label: 'Genel' },
    ...(hasAddresses
      ? [{ id: 'adresler', label: 'Adresler', count: fields.length }]
      : []),
    ...(hasContacts
      ? [{ id: 'yetkililer', label: 'Yetkililer', count: contactRows.length }]
      : []),
    ...(hasAccounts
      ? [{ id: 'hesaplar', label: 'Hesaplar', count: accountRows.length }]
      : []),
    ...(hasBarcodes && !hasUnitConvs
      ? [{ id: 'barkodlar', label: 'Barkodlar', count: barcodeRows.length }]
      : []),
    ...(hasUnitConvs
      ? [
          {
            id: 'birim-cevirimi',
            label: 'Birim Çevirimi',
            count: (unitConvRowsWatch || []).reduce(
              (n, u) => n + (u.barcodes?.length || 0),
              0,
            ),
          },
        ]
      : []),
    ...(hasProductSubs
      ? [{ id: 'recete', label: 'Alt Malzeme / Reçete', count: productSubRows.length }]
      : []),
    ...(hasVariants
      ? [{ id: 'varyantlar', label: 'Varyantlar', count: variantRows.length }]
      : []),
    ...(hasCustomerAliases
      ? [{ id: 'cari-malzeme', label: 'Cari Malzeme', count: customerAliasRows.length }]
      : []),
    ...(hasAccountLinks
      ? [{ id: 'muhasebe', label: 'Muhasebe Hesapları', count: accountLinkRows.length }]
      : []),
    ...(hasAuxilCodes
      ? [{ id: 'ozel-kodlar', label: 'Özel Kodlar', count: auxilCodeRows.length }]
      : []),
    ...(hasAuxilValues
      ? [{ id: 'kod-degerleri', label: 'Kod / Açıklama Listesi', count: auxilValueRows.length }]
      : []),
    ...(hasWorkplaces
      ? [{ id: 'isyerleri', label: 'İşyerleri', count: workplaceRows.length }]
      : []),
    ...(hasWhouses && !whousesUnderWorkplace
      ? [{ id: 'ambarlar', label: 'Ambarlar', count: whouseRows.length }]
      : []),
    ...(showCustomTab
      ? [{ id: 'ozel', label: 'Ek Alanlar', count: custom.length }]
      : []),
  ];

  return (
    <FormFieldContext.Provider value={{ setValue, watch }}>
    <div
      className={`w-full ${formCols === 3 ? 'max-w-7xl' : 'max-w-5xl'} mx-auto p-3 bg-white dark:bg-slate-900 rounded-md border border-slate-300 dark:border-slate-700 shadow-sm`}
    >
      <div className="mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">{schema.title}</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {schema.tableName}
            {schema.fixedStandardFields?.ProductType != null && (
              <> · ProductType = {String(schema.fixedStandardFields.ProductType)}</>
            )}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          {schema.tableName === 'SYS_FormPostSave' && <PostSaveHelpButton />}
          {headerRight.length > 0 && (
            <div className="flex items-center gap-2 [&_.col-span-12]:!w-auto [&_.col-span-12]:col-span-1">
              {headerRight.map((field) => {
                const patched = patchField(field);
                return (
                <FieldRenderer
                  key={`hdr-${patched.fieldId}-${patched.optionsJson || ''}`}
                  field={{ ...patched, colSpan: 1 }}
                  register={register}
                  error={getFieldError(field.fieldName)}
                  disabled={readOnly}
                  watermark={false}
                />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-2.5">
        {identityFields.length > 0 && (
          <section className="rounded-sm border border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/30 px-3 py-2">
            {renderGrid(identityFields, false)}
          </section>
        )}

        <div>
        {tabs.length > 1 ? (
          <FormTabs active={tab} onChange={setTab} tabs={tabs} variant="folder" size="sm" />
        ) : null}
        <FormTabPanel className={`${tabs.length > 1 ? '' : 'border-t rounded-t-[4px]'} space-y-2`}>

        {(tabs.length === 1 || tab === 'genel') &&
          (generalRest.length > 0 ? (
            renderGrid(generalRest, false)
          ) : (
            <p className="py-3 text-center text-[11px] text-slate-400">Genel alanların tamamı başlıkta.</p>
          ))}

        {tab === 'adresler' && hasAddresses && schema.addressFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  Adresler
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Merkez, sevkiyat, fatura veya diğer — en az bir adres zorunlu
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    append({
                      ...defaultCustomerAddressRow(),
                      AdressType: '2',
                      Title: 'Sevkiyat',
                      IsDefault: false,
                    });
                    setSelectedAddr(fields.length);
                  }}
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adres Ekle
                </button>
              )}
            </div>

            {addressError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {addressError}
              </div>
            )}

            {(() => {
              const sel = Math.min(selectedAddr, Math.max(fields.length - 1, 0));
              const af = schema.addressFields!;
              const ungrouped = af.filter((f) => !f.group);
              const idFields = ADDR_ID_FIELDS.map((n) => ungrouped.find((f) => f.fieldName === n)).filter(
                (f): f is FormFieldDto => Boolean(f),
              );
              /** Birden çok alan tek satırda: «Adres Tipi / Kodu / Adı», «Ülke / İl / İlçe / Mahalle» */
              const renderAddrRow = (list: FormFieldDto[], index: number, rowId: string) =>
                list.length === 0 ? null : (
                  <div key={`${rowId}-row-${list[0].fieldName}`} className="md:col-span-2 flex items-center gap-2 min-w-0">
                    <label
                      className="w-[132px] shrink-0 text-[11.5px] leading-7 text-slate-600 dark:text-slate-300 truncate"
                      title={list.map((f) => f.label).join(' / ')}
                    >
                      {list.map((f) => f.label.replace(/^Adres\s+/i, '')).join(' / ')}
                      {list.some((f) => f.isRequired) && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <div className={`flex-1 min-w-0 grid gap-1.5 ${list.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                      {list.map((f) => (
                        <FieldRenderer
                          key={`${rowId}-${f.fieldId}`}
                          field={f}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`addresses.${index}.${f.fieldName}`}
                          hideLabel
                          disabled={readOnly}
                          error={get(errors, `addresses.${index}.${f.fieldName}`) as FieldError | undefined}
                        />
                      ))}
                    </div>
                  </div>
                );
              /** Ülke → İl → İlçe → Mahalle (açık adresin hemen üstünde tek satır) */
              const placeFields = PLACE_FIELDS.map((n) => ungrouped.find((f) => f.fieldName === n)).filter(
                (f): f is FormFieldDto => Boolean(f),
              );
              const groupNames = [...new Set(af.filter((f) => f.group).map((f) => f.group!))];
              const addrErrors = (errors as Record<string, unknown>).addresses as unknown[] | undefined;
              const addrText = (i: number) => {
                const a = (watchedAddresses?.[i] || {}) as Record<string, unknown>;
                const place = [a.Dictrict, a.Town, a.City].map((v) => String(v ?? '').trim()).filter(Boolean);
                return place.join(' / ') || String(a.Adress ?? '').trim();
              };
              return (
                <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-3">
                  {/* Sol: adres listesi */}
                  <div className="border border-slate-300 dark:border-slate-600 rounded-sm overflow-hidden self-start">
                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 border-b border-slate-300 dark:border-slate-600">
                      Adres listesi ({fields.length})
                    </div>
                    <ul className="max-h-[360px] overflow-y-auto">
                      {fields.map((row, index) => {
                        const a = (watchedAddresses?.[index] || {}) as Record<string, unknown>;
                        const isDefault = a.IsDefault === true || a.IsDefault === 'true' || a.IsDefault === 1;
                        const hasErr = Boolean(addrErrors?.[index]);
                        const active = index === sel;
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedAddr(index)}
                              className={`w-full text-left px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex items-start gap-1.5 ${
                                active
                                  ? 'bg-blue-50 dark:bg-blue-950/40 border-l-2 border-l-blue-600'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent'
                              }`}
                            >
                              <span className="mt-px w-4 h-4 shrink-0 rounded-sm bg-slate-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1 text-[11.5px] font-medium text-slate-800 dark:text-slate-100">
                                  <span className="truncate">
                                    {String(a.Title ?? '').trim() ||
                                      customerAddressTypeLabel(a.AdressType as string | number | undefined)}
                                  </span>
                                  {isDefault && (
                                    <span className="shrink-0 text-[9px] px-1 rounded-sm bg-emerald-100 text-emerald-700">
                                      Varsayılan
                                    </span>
                                  )}
                                  {hasErr && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" title="Eksik alan" />}
                                </span>
                                <span className="block text-[10.5px] text-slate-500 truncate">
                                  {customerAddressTypeLabel(a.AdressType as string | number | undefined)}
                                  {addrText(index) ? ` · ${addrText(index)}` : ''}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Sağ: seçili adresin bilgileri (diğerleri gizli ama formda kayıtlı kalır) */}
                  <div className="min-w-0">
                    {fields.map((row, index) => {
                      const renderAddr = (field: FormFieldDto) => (
                        <FieldRenderer
                          key={`${row.id}-${field.fieldId}`}
                          field={field}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`addresses.${index}.${field.fieldName}`}
                          disabled={readOnly}
                          error={
                            get(errors, `addresses.${index}.${field.fieldName}`) as
                              | FieldError
                              | undefined
                          }
                        />
                      );
                      return (
                        <div key={row.id} className={index === sel ? 'space-y-2' : 'hidden'}>
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-1">
                            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                              {index + 1}. {customerAddressTypeLabel(watchedAddresses?.[index]?.AdressType as string | number | undefined)}
                            </span>
                            {!readOnly && (
                              <button
                                type="button"
                                disabled={fields.length <= 1}
                                onClick={() => {
                                  remove(index);
                                  setSelectedAddr(Math.max(0, index - 1));
                                }}
                                className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3 h-3" />
                                Adresi sil
                              </button>
                            )}
                          </div>
                          {ungrouped.length > 0 && (
                            <InlineFieldGrid>
                              {renderAddrRow(idFields, index, row.id)}
                              {renderAddrRow(placeFields, index, row.id)}
                              {ungrouped
                                .filter((f) => !PLACE_FIELDS.includes(f.fieldName) && !ADDR_ID_FIELDS.includes(f.fieldName))
                                // açık adres (tam satır) önce; Varsayılan + Aktif alt satırda yan yana
                                .sort((x, y) => Number(y.fieldType === 'textarea') - Number(x.fieldType === 'textarea'))
                                .map(renderAddr)}
                            </InlineFieldGrid>
                          )}
                          {groupNames.map((g) => (
                            <fieldset
                              key={g}
                              className="rounded-sm border border-slate-300 dark:border-slate-600 px-3 pt-1 pb-2"
                            >
                              <legend className="px-1 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                                {g}
                              </legend>
                              {g === 'e-Fatura Posta Kutusu' && (
                                <div className="mb-1.5">
                                  <EinvoiceMukellefCheck
                                    taxNr={String(
                                      watchedAddresses?.[index]?.TaxNr ||
                                        watchedCardTaxNr ||
                                        '',
                                    )}
                                    disabled={readOnly}
                                    onApplied={({ postLabel, senderLabel, title, unitType, status, entryDate }) => {
                                      if (entryDate && hasEinvoiceEntryDate && !String(watch('standardFields.EinvoiceEntryDate') || '').trim()) {
                                        setValue('standardFields.EinvoiceEntryDate', entryDate.slice(0, 10), { shouldDirty: true });
                                      }
                                      if (postLabel) {
                                        setValue(`addresses.${index}.PostLabel`, postLabel, {
                                          shouldDirty: true,
                                        });
                                      }
                                      if (senderLabel) {
                                        setValue(`addresses.${index}.SenderLabel`, senderLabel, {
                                          shouldDirty: true,
                                        });
                                      }
                                      if (title && !String(watchedAddresses?.[index]?.Title || '').trim()) {
                                        setValue(`addresses.${index}.Title`, title, { shouldDirty: true });
                                      }
                                      setValue(`addresses.${index}.MukellefCheckStatus`, status, {
                                        shouldDirty: true,
                                      });
                                      setValue(
                                        `addresses.${index}.MukellefCheckAt`,
                                        new Date().toISOString(),
                                        { shouldDirty: true },
                                      );
                                      // Kart e-Fatura tipi ipucu
                                      if (unitType && /ar[sş]iv/i.test(unitType)) {
                                        setValue('standardFields.EinvoiceType', '2', { shouldDirty: true });
                                      } else if (unitType && /fatura/i.test(unitType)) {
                                        const cur = String(watch('standardFields.EinvoiceType') || '0');
                                        if (cur === '0' || cur === '') {
                                          setValue('standardFields.EinvoiceType', '1', { shouldDirty: true });
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              )}
                              <div className="grid grid-cols-12 gap-x-3 gap-y-1.5">
                                {af
                                  .filter((f) => f.group === g)
                                  .map((field) =>
                                    field.fieldName === 'MukellefCheckStatus' ? (
                                      <div key={`${row.id}-${field.fieldId}`} className="col-span-12 md:col-span-4 flex flex-col gap-0.5 min-w-0">
                                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-none">
                                          {field.label}
                                        </label>
                                        <input
                                          type="text"
                                          readOnly
                                          title={String(watchedAddresses?.[index]?.MukellefCheckStatus ?? '')}
                                          className="w-full h-7 px-2 text-[11px] border border-slate-200 rounded-sm bg-slate-50 text-slate-600 truncate"
                                          {...register(`addresses.${index}.MukellefCheckStatus`)}
                                        />
                                      </div>
                                    ) : (
                                      <FieldRenderer
                                        key={`${row.id}-${field.fieldId}`}
                                        field={{ ...field, colSpan: 4 }}
                                        register={register as UseFormRegister<FieldValues>}
                                        registerNameOverride={`addresses.${index}.${field.fieldName}`}
                                        compact
                                        watermark={false}
                                        disabled={readOnly}
                                        error={get(errors, `addresses.${index}.${field.fieldName}`) as FieldError | undefined}
                                      />
                                    ),
                                  )}
                                {g === 'e-Fatura Posta Kutusu' && hasEinvoiceEntryDate && index === sel && (
                                  <div className="col-span-12 md:col-span-4 flex flex-col gap-0.5 min-w-0">
                                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 leading-none">
                                      e-Faturaya Geçiş Tarihi
                                    </label>
                                    <DateField
                                      label="e-Faturaya Geçiş Tarihi"
                                      registerName="standardFields.EinvoiceEntryDate"
                                      register={register as UseFormRegister<FieldValues>}
                                      setValue={setValue}
                                      watch={watch}
                                      disabled={readOnly}
                                      inputClassName="w-full h-7 px-2 text-[12px] rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/60 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                                      title="Cari kart · GİB mükellef listesindeki kayıt tarihi"
                                    />
                                  </div>
                                )}
                              </div>
                            </fieldset>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'yetkililer' && hasContacts && schema.contactFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <UserRound className="w-3.5 h-3.5 text-slate-500" />
                  Yetkililer
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cariye bağlı iletişim kişileri (opsiyonel)
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => appendContact({})}
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Yetkili Ekle
                </button>
              )}
            </div>

            <SubListGrid
              rows={contactRows}
              fields={schema.contactFields!}
              prefix="contacts"
              register={register as UseFormRegister<FieldValues>}
              errors={errors}
              readOnly={readOnly}
              emptyText="Yetkili yok. «Yetkili Ekle» ile ekleyebilirsiniz."
              onRemove={removeContact}
            />
          </div>
        )}

        {tab === 'hesaplar' && hasAccounts && schema.accountFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-slate-500" />
                  Hesaplar
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bu bankaya bağlı hesaplar (BankAccountCard)
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    appendAccount({
                      Code: '',
                      Title: '',
                      IbanNO: '',
                      AccountNO: '',
                      Currency: LOCAL_CURRENCY_ID,
                      CurrencyRate: 1,
                      SwiftNO: '',
                      IsActive: true,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Hesap Ekle
                </button>
              )}
            </div>

            <SubListGrid
              rows={accountRows}
              fields={schema.accountFields!}
              prefix="accounts"
              register={register as UseFormRegister<FieldValues>}
              errors={errors}
              readOnly={readOnly}
              emptyText="Hesap yok."
              onRemove={removeAccount}
            />
          </div>
        )}

        {tab === 'barkodlar' && hasBarcodes && !hasUnitConvs && schema.barcodeFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-slate-500" />
                  Barkodlar
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bu malzemeye bağlı barkodlar (ProductBarcode)
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    appendBarcode({
                      Barcode: '',
                      Type: '1',
                      LineNr: barcodeRows.length + 1,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Barkod Ekle
                </button>
              )}
            </div>

            <SubListGrid
              rows={barcodeRows}
              fields={schema.barcodeFields!}
              prefix="barcodes"
              register={register as UseFormRegister<FieldValues>}
              errors={errors}
              readOnly={readOnly}
              emptyText="Barkod yok. «Barkod Ekle» ile ekleyebilirsiniz."
              onRemove={removeBarcode}
            />
          </div>
        )}

        {tab === 'birim-cevirimi' && hasUnitConvs && schema.unitConvFields && schema.barcodeFields && (
          <UnitConvTabPanel
            control={control as Control<FieldValues>}
            register={register as UseFormRegister<FieldValues>}
            setValue={setValue}
            watch={watch}
            errors={errors as FieldValues}
            readOnly={readOnly}
            unitConvFields={schema.unitConvFields}
            barcodeFields={schema.barcodeFields}
            defaultUnitId={watchedDefaultUnitId}
          />
        )}

        {tab === 'recete' && hasProductSubs && schema.productSubFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Alt Malzeme / Reçete
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bu malzemeye bağlı alt malzemeler ve reçete satırları (ProductSub)
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    appendProductSub({
                      Type: '1',
                      SubProductCardID: '',
                      Quantity: 1,
                      UnitID: '',
                      CostRate: '',
                      PriceRate: '',
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Satır Ekle
                </button>
              )}
            </div>

            <div className="space-y-2">
              {productSubRows.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-md">
                  Alt malzeme yok. «Satır Ekle» ile reçete veya karma koli satırı ekleyebilirsiniz.
                </div>
              ) : (
                productSubRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="relative grid grid-cols-12 gap-1.5 px-2 py-1.5 rounded-sm bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600"
                  >
                    <div className="col-span-12 flex items-center justify-between pl-0.5 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        Alt Malzeme
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeProductSub(index)}
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                          Sil
                        </button>
                      )}
                    </div>
                    <div className="col-span-12 grid grid-cols-12 gap-1.5">
                      {schema.productSubFields!.map((field) => {
                        void subUnitTick;
                        const subPid = Number(
                          (watchedProductSubs?.[index] as Record<string, unknown> | undefined)
                            ?.SubProductCardID,
                        );
                        const isSubUnit = field.fieldName === 'UnitID';
                        const subInfo =
                          isSubUnit && Number.isFinite(subPid) && subPid > 0
                            ? subUnitInfoRef.current[subPid] ?? emptyProductUnits(subPid)
                            : isSubUnit
                              ? emptyProductUnits(0)
                              : null;
                        const subField = subInfo
                          ? { ...field, optionsJson: subInfo.optionsJson }
                          : field;
                        return (
                        <FieldRenderer
                          key={`${row.id}-${field.fieldId}-${subField.optionsJson || ''}`}
                          field={subField}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`productSubs.${index}.${field.fieldName}`}
                          compact
                          disabled={readOnly || (isSubUnit && !(subPid > 0))}
                          error={
                            get(errors, `productSubs.${index}.${field.fieldName}`) as
                              | FieldError
                              | undefined
                          }
                        />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'varyantlar' && hasVariants && schema.variantFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Shapes className="w-3.5 h-3.5 text-slate-500" />
                  Varyantlar
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Şablondan kombinasyon üretin veya tek tek ekleyin (VariantCard)
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    appendVariant({
                      Code: '',
                      Title: '',
                      UnitID: '',
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Varyant Ekle
                </button>
              )}
            </div>

            {schema.variantTemplateField && (
              <div className="grid grid-cols-12 gap-2 p-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40">
                <div className="col-span-12 sm:col-span-7">
                  <FieldRenderer
                    field={schema.variantTemplateField}
                    register={register as UseFormRegister<FieldValues>}
                    registerNameOverride={`standardFields.${schema.variantTemplateField.fieldName}`}
                    compact
                    disabled={readOnly}
                    error={
                      get(errors, `standardFields.${schema.variantTemplateField.fieldName}`) as
                        | FieldError
                        | undefined
                    }
                  />
                </div>
                {!readOnly && (
                  <div className="col-span-12 sm:col-span-5 flex items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        const templateId = String(
                          watch(`standardFields.${schema.variantTemplateField!.fieldName}`) || '',
                        );
                        const template = findVariantTemplate(templateId);
                        if (!template) {
                          window.alert('Önce bir varyant şablonu seçin.');
                          return;
                        }
                        const productCode = String(watch('standardFields.Code') || '');
                        const productTitle = String(watch('standardFields.Title') || '');
                        const generated = generateVariantsFromTemplate(template, {
                          productCode,
                          productTitle,
                        });
                        if (!generated.length) {
                          window.alert('Şablonda üretilecek değer bulunamadı.');
                          return;
                        }
                        if (
                          variantRows.length > 0 &&
                          !await appConfirm(
                            `Mevcut ${variantRows.length} varyant satırı şablondan üretilen ${generated.length} satırla değiştirilsin mi?`,
                          )
                        ) {
                          return;
                        }
                        replaceVariants(generated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 w-full h-8 px-2.5 text-[12px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Şablondan Oluştur
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {variantRows.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-md">
                  Varyant yok. Şablon seçip «Şablondan Oluştur» veya «Varyant Ekle» kullanın.
                </div>
              ) : (
                variantRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="relative grid grid-cols-12 gap-1.5 px-2 py-1.5 rounded-sm bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600"
                  >
                    <div className="col-span-12 flex items-center justify-between pl-0.5 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        Varyant
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                          Sil
                        </button>
                      )}
                    </div>
                    <div className="col-span-12 grid grid-cols-12 gap-1.5">
                      {schema.variantFields!.map((field) => {
                        const variantUnitInfo =
                          field.fieldName === 'UnitID'
                            ? unitsFromFormConvs(
                                (watch('unitConvs') as Record<string, unknown>[] | undefined) ||
                                  [],
                                watchedDefaultUnitId,
                                'all',
                              )
                            : null;
                        const vField = variantUnitInfo
                          ? { ...field, optionsJson: variantUnitInfo.optionsJson }
                          : field;
                        return (
                        <FieldRenderer
                          key={`${row.id}-${field.fieldId}-${vField.optionsJson || ''}`}
                          field={vField}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`variants.${index}.${field.fieldName}`}
                          compact
                          disabled={
                            readOnly ||
                            (field.fieldName === 'UnitID' &&
                              !(variantUnitInfo?.options.length))
                          }
                          error={
                            get(errors, `variants.${index}.${field.fieldName}`) as
                              | FieldError
                              | undefined
                          }
                        />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'cari-malzeme' && hasCustomerAliases && schema.customerAliasFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Cari Malzeme
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Bu malzemenin cari hesabına özel kodu ve adı (ProductCustomerAlias)
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() =>
                    appendCustomerAlias({
                      CustomerCardID: '',
                      CustomerCode: '',
                      CustomerTitle: '',
                      Note: '',
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cari Ekle
                </button>
              )}
            </div>

            <SubListGrid
              rows={customerAliasRows}
              fields={schema.customerAliasFields!}
              prefix="customerAliases"
              register={register as UseFormRegister<FieldValues>}
              errors={errors}
              readOnly={readOnly}
              emptyText="Kayıt yok."
              onRemove={removeCustomerAlias}
            />
          </div>
        )}

        {hasWorkplaces && schema.workplaceFields && (
          <div className={tab === 'isyerleri' ? 'space-y-2' : 'hidden'} aria-hidden={tab !== 'isyerleri'}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  İşyerleri
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Firmaya bağlı işyerleri (SYS_Workplace)
                </p>
              </div>
              {!readOnly && tab === 'isyerleri' && (
                <button
                  type="button"
                  onClick={async () => {
                    const base: Record<string, unknown> = {
                      Code: '',
                      Title: '',
                      IsActive: true,
                      Country: 'TR',
                      CalendarType: 'Miladi',
                      FiscalYearStartMonth: 1,
                      CurrencyCode: 'TRY',
                      ReportCurrency: 'TRY',
                    };
                    const copy = await appConfirm(
                      'Firma e-Devlet / entegrasyon / adres bilgilerini bu işyerine kopyala?',
                      { title: 'Yeni işyeri', okLabel: 'Kopyala', cancelLabel: 'Boş başlat', danger: false },
                    );
                    if (copy) {
                      const sf = (watch('standardFields') as Record<string, unknown>) || {};
                      const keys = [
                        'TaxNumber',
                        'TaxOffice',
                        'TaxOfficeCode',
                        'NaceCode',
                        'SskNo',
                        'Street',
                        'Street2',
                        'DoorNo',
                        'PostalCode',
                        'Town',
                        'City',
                        'Country',
                        'AddressText',
                        'Phone',
                        'Phone2',
                        'Fax',
                        'Email',
                        'WebAddress',
                        'CalendarType',
                        'FiscalYearStartMonth',
                        'CurrencyCode',
                        'ReportCurrency',
                        'VatRounding',
                        'FxRateSource',
                        'PeriodStartDate',
                        'EDefterStartDate',
                        'EInvoiceStartDate',
                        'PostLabel',
                        'SenderLabel',
                        'EinvoiceEmail',
                        'IntegratorName',
                        'IntegratorWsUrl',
                        'IntegratorUser',
                        'IntegratorPassword',
                        'IntegratorVkN',
                        'IntegratorApiKey',
                        'OnlineSend',
                        'EnableMukellefCheck',
                        'EnableInvoiceSend',
                        'EnableInvoiceReceive',
                      ];
                      for (const k of keys) {
                        if (sf[k] != null && sf[k] !== '') base[k] = sf[k];
                      }
                    }
                    appendWorkplace(base);
                  }}
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  İşyeri Ekle
                </button>
              )}
            </div>
            <div className="space-y-2">
              {workplaceRows.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-md">
                  İşyeri yok. «İşyeri Ekle» ile ekleyin.
                </div>
              ) : (
                workplaceRows.map((row, index) => {
                  const wpCode = String(watchedWorkplaces?.[index]?.Code ?? '').trim();
                  const wpTitle = String(watchedWorkplaces?.[index]?.Title ?? '').trim();
                  const af = schema.workplaceFields!;
                  const ungrouped = af.filter((f) => !f.group);
                  const groupNames = [...new Set(af.filter((f) => f.group).map((f) => f.group!))];
                  const renderWpField = (field: FormFieldDto) => (
                    <FieldRenderer
                      key={`${row.id}-${field.fieldId}`}
                      field={field}
                      register={register as UseFormRegister<FieldValues>}
                      registerNameOverride={`workplaces.${index}.${field.fieldName}`}
                      compact
                      disabled={readOnly}
                      error={
                        get(errors, `workplaces.${index}.${field.fieldName}`) as
                          | FieldError
                          | undefined
                      }
                    />
                  );
                  const nestedWhouseIndexes = whousesUnderWorkplace
                    ? whouseRows
                        .map((_, wi) => wi)
                        .filter((wi) => {
                          const code = String(watchedWhouses?.[wi]?.WorkplaceCode ?? '').trim();
                          return wpCode ? code === wpCode : code === '';
                        })
                    : [];
                  return (
                  <div
                    key={row.id}
                    className="relative space-y-2 p-2.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between pl-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        İşyeri{wpCode ? ` — ${wpCode}` : ''}
                        {wpTitle ? ` / ${wpTitle}` : ''}
                      </span>
                      {!readOnly && tab === 'isyerleri' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (whousesUnderWorkplace && wpCode) {
                              // Bağlı ambarları da sil (sondan başa)
                              for (let wi = whouseRows.length - 1; wi >= 0; wi--) {
                                const code = String(watchedWhouses?.[wi]?.WorkplaceCode ?? '').trim();
                                if (code === wpCode) removeWhouse(wi);
                              }
                            }
                            removeWorkplace(index);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                          Sil
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {ungrouped.length > 0 && (
                        <div className="grid grid-cols-12 gap-2">{ungrouped.map(renderWpField)}</div>
                      )}
                      {groupNames.map((g) => (
                        <fieldset
                          key={g}
                          className="rounded-md border border-slate-200 dark:border-slate-600 px-2.5 pt-1.5 pb-2 bg-white/70 dark:bg-slate-900/40"
                        >
                          <legend className="px-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            {g}
                          </legend>
                          <div className="grid grid-cols-12 gap-2">
                            {af.filter((f) => f.group === g).map(renderWpField)}
                          </div>
                        </fieldset>
                      ))}
                    </div>

                    {whousesUnderWorkplace && schema.whouseFields && (
                      <div className="mt-1 rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50 p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-slate-500" />
                              Ambarlar
                              <span className="text-[10px] font-normal text-slate-400">
                                ({nestedWhouseIndexes.length})
                              </span>
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              Bu işyerine bağlı ambarlar (SYS_Whouse)
                              {!wpCode ? ' — önce işyeri kodu girin' : ''}
                            </p>
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              disabled={!wpCode}
                              onClick={() =>
                                appendWhouse({
                                  WhouseCode: '',
                                  Name: '',
                                  WorkplaceCode: wpCode,
                                  IsActive: true,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3 h-3" />
                              Ambar Ekle
                            </button>
                          )}
                        </div>
                        {nestedWhouseIndexes.length === 0 ? (
                          <div className="py-3 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded">
                            Ambar yok.
                          </div>
                        ) : (
                          nestedWhouseIndexes.map((wi, localIdx) => (
                            <div
                              key={whouseRows[wi].id}
                              className="grid grid-cols-12 gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40"
                            >
                              <div className="col-span-12 flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-slate-500">
                                  Ambar {localIdx + 1}
                                </span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => removeWhouse(wi)}
                                    className="inline-flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Sil
                                  </button>
                                )}
                              </div>
                              {schema.whouseFields!
                                .filter((f) => f.fieldName !== 'WorkplaceCode')
                                .map((field) => (
                                  <FieldRenderer
                                    key={`${whouseRows[wi].id}-${field.fieldId}`}
                                    field={field}
                                    register={register as UseFormRegister<FieldValues>}
                                    registerNameOverride={`whouses.${wi}.${field.fieldName}`}
                                    compact
                                    disabled={readOnly}
                                    error={
                                      get(errors, `whouses.${wi}.${field.fieldName}`) as
                                        | FieldError
                                        | undefined
                                    }
                                  />
                                ))}
                              {/* WorkplaceCode gizli tutulur; işyerine bağlı */}
                              <input
                                type="hidden"
                                {...register(`whouses.${wi}.WorkplaceCode` as const)}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'ambarlar' && hasWhouses && !whousesUnderWorkplace && schema.whouseFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Ambarlar
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Firmaya bağlı ambarlar — İşyeri listesi üstteki İşyerleri sekmesinden gelir
                  {lastWorkplaceCode ? ` (son: ${lastWorkplaceCode})` : ''}
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    appendWhouse({
                      WhouseCode: '',
                      Name: '',
                      WorkplaceCode: lastWorkplaceCode,
                      IsActive: true,
                    });
                  }}
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ambar Ekle
                </button>
              )}
            </div>
            <div className="space-y-2">
              {whouseRows.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-md">
                  Ambar yok. Önce işyeri ekleyip ardından ambar bağlayın.
                </div>
              ) : (
                whouseRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="relative grid grid-cols-12 gap-1.5 px-2 py-1.5 rounded-sm bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600"
                  >
                    <div className="col-span-12 flex items-center justify-between pl-0.5 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        Ambar
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeWhouse(index)}
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                          Sil
                        </button>
                      )}
                    </div>
                    <div className="col-span-12 grid grid-cols-12 gap-1.5">
                      {schema.whouseFields!.map((field) => {
                        const patched =
                          field.fieldName === 'WorkplaceCode'
                            ? {
                                ...field,
                                fieldType: 'select' as const,
                                optionsJson: workplaceCodeOptionsJson,
                                useLookup: false,
                              }
                            : field;
                        return (
                          <FieldRenderer
                            key={
                              field.fieldName === 'WorkplaceCode'
                                ? `${row.id}-${field.fieldId}-${workplaceCodeOptionsJson}`
                                : `${row.id}-${field.fieldId}`
                            }
                            field={patched}
                            register={register as UseFormRegister<FieldValues>}
                            registerNameOverride={`whouses.${index}.${field.fieldName}`}
                            compact
                            disabled={readOnly}
                            error={
                              get(errors, `whouses.${index}.${field.fieldName}`) as
                                | FieldError
                                | undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'muhasebe' && hasAccountLinks && schema.accountLinkFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  Muhasebe Hesapları
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {accountLinkFixed
                    ? 'Malzeme fiş türlerine göre muhasebe kodu (tek satır)'
                    : accountLinkSingle
                      ? 'Kart muhasebe kodu (AccountLinkDetail)'
                      : 'İşlem koşullarına göre muhasebe hesap bağlantıları'}
                </p>
              </div>
              {!readOnly && !accountLinkFixed && (
                <button
                  type="button"
                  onClick={() => appendAccountLink(defaultAccountLinkRow(linkModule))}
                  className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Bağlantı Ekle
                </button>
              )}
            </div>

            {accountLinkFixed ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {accountLinkRows.map((row, index) => {
                  const typeVal = watchedAccountLinks?.[index]?.Type;
                  const accountField = schema.accountLinkFields!.find(
                    (f) => f.fieldName === 'AccountID',
                  );
                  if (!accountField) return null;
                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-900/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <span className="w-5 h-5 shrink-0 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="w-36 shrink-0 text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate" title={accountLinkTypeLabel(typeVal as string | number | undefined, linkModule)}>
                        {accountLinkTypeLabel(
                          typeVal as string | number | undefined,
                          linkModule,
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <FieldRenderer
                          field={{ ...accountField, colSpan: 12, label: 'Hesap' }}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`accountLinks.${index}.AccountID`}
                          hideLabel
                          compact
                          disabled={readOnly}
                          error={
                            get(errors, `accountLinks.${index}.AccountID`) as
                              | FieldError
                              | undefined
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <SubListGrid
                rows={accountLinkRows}
                fields={schema.accountLinkFields!}
                prefix="accountLinks"
                register={register as UseFormRegister<FieldValues>}
                errors={errors}
                readOnly={readOnly}
                emptyText="Muhasebe bağlantısı yok. «Bağlantı Ekle» ile satır ekleyin."
                onRemove={removeAccountLink}
                isFieldDisabled={(name) => accountLinkSingle && name === 'Type'}
              />
            )}
          </div>
        )}

        {tab === 'ozel-kodlar' && hasAuxilCodes && (
          <AuxilCodeAssignmentEditor
            targetTable={schema.tableName}
            control={control as Control<FieldValues>}
            register={register as UseFormRegister<FieldValues>}
            setValue={setValue}
            watch={watch}
            readOnly={readOnly}
          />
        )}

        {tab === 'kod-degerleri' && hasAuxilValues && schema.auxilValueFields && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Tags className="w-3.5 h-3.5 text-slate-500" />
                  Kod / Açıklama Listesi (AUXIL değerleri)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kart/fişte seçilecek özel kodlar (örn. Mercedes, BMW) ve açıklama seçenekleri
                </p>
              </div>
              {!readOnly && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      appendAuxilValue(
                        defaultAuxilValueRow(AUXIL_VALUE_KIND.Code, (auxilValueRows.length + 1) * 10),
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Kod Değeri
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      appendAuxilValue(
                        defaultAuxilValueRow(
                          AUXIL_VALUE_KIND.Description,
                          (auxilValueRows.length + 1) * 10,
                        ),
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 h-7 text-[12px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Açıklama
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {auxilValueRows.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-md">
                  Liste boş. «Kod Değeri» veya «Açıklama» ile ekleyin.
                </div>
              ) : (
                auxilValueRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="relative grid grid-cols-12 gap-1.5 px-2 py-1.5 rounded-sm bg-white dark:bg-slate-900/40 border border-slate-300 dark:border-slate-600"
                  >
                    <div className="col-span-12 flex items-center justify-between pl-0.5 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        Liste satırı
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeAuxilValue(index)}
                          className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                          Sil
                        </button>
                      )}
                    </div>
                    <div className="col-span-12 grid grid-cols-12 gap-1.5">
                      {schema.auxilValueFields!.map((field) => (
                        <FieldRenderer
                          key={`${row.id}-${field.fieldId}`}
                          field={field}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`auxilValues.${index}.${field.fieldName}`}
                          compact
                          disabled={readOnly}
                          error={
                            get(errors, `auxilValues.${index}.${field.fieldName}`) as
                              | FieldError
                              | undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'ozel' && showCustomTab && (
          custom.length > 0 ? (
            renderGrid(custom, true)
          ) : (
            <div className="py-8 text-center text-[12px] text-slate-500 border border-dashed border-slate-200 rounded-md">
              Bu kart için tanımlı özel alan yok.
              <br />
              <span className="text-[11px] text-slate-400">
                Özel Alanlar modülünden sınırsız alan ekleyebilirsin.
              </span>
            </div>
          )
        )}
        </FormTabPanel>
        </div>

        {!readOnly && (
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className={`inline-flex items-center justify-center px-5 h-7 text-[12px] font-semibold text-white rounded-sm bg-blue-700 hover:bg-blue-600 transition-colors ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}
        {readOnly && (
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-right">
            İnceleme modu — değişiklik yapılamaz
          </div>
        )}
      </form>
    </div>
    </FormFieldContext.Provider>
  );
};
