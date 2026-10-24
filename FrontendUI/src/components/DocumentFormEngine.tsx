import React from 'react';
import { BudgetBar } from './BudgetBar';
import { EGovSendPanel } from './EGovSendPanel';
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
import { FormTabs } from './FormTabs';
import { canField } from '../data/permissions';
import { getCurrency, getCurrencyRate, LOCAL_CURRENCY_ID, CURRENCIES } from '../data/currencies';
import { Plus, Minus, RefreshCw, ClipboardPaste } from 'lucide-react';
import { FieldLayoutContext, FormFieldContext, InlineColsContext, InlineFieldGrid } from './FormFieldContext';
import { useOrgFieldCascade } from '../hooks/useOrgFieldCascade';
import { allocateDocumentNumber } from '../api/numberTemplateApi';
import { getRecord, listRecords } from '../api/recordsApi';
import {
  createLookupResolver,
  matchHeaderRow,
  matchSelectOption,
  parseClipboardGrid,
  parseLocaleNumber,
  parsePastedDate,
} from '../utils/linePaste';
import { lookupSourceForField } from '../api/lookupApi';
import { resolveBarcode } from '../api/barcodesApi';
import { getCurrentProfile, getCurrentUserId } from '../data/permissions';
import { ORG_COMPANIES, ORG_WORKPLACES, ORG_WAREHOUSES } from '../data/orgUnits';
import { attachNoMinusHandlers } from '../utils/noMinusInput';
import { DateField } from './DateField';
import { getSystemDatePlaceholder } from '../utils/dateFormat';
import { AuxilCodeAssignmentEditor } from './AuxilCodeAssignmentEditor';
import { UnitPricePicker } from './UnitPricePicker';
import { LineDistributionPanel } from './LineDistributionPanel';
import { SerialLotLineCell, invoiceSerialDirection, serialLotDirection } from './SerialLotLineCell';
import { fetchPriceSuggestions } from '../api/productPricesApi';
import { DispatchType, InvoiceType, OrderType } from '../data/documentTypes';
import { computeFormulaValues, formulaExtraFields, lineTableFor } from '../data/extraFields';
import {
  emptyProductUnits,
  fetchProductUnitOptions,
  resolveLineUnitId,
  type ProductUnitsInfo,
  type UnitModuleFilter,
} from '../data/productLineUnits';

function resolvePriceDirection(schema: FormSchemaDto, sf: Record<string, unknown>): 'sales' | 'purchase' {
  const code = (schema.formCode || '').toLowerCase();
  if (code.includes('purchase') || code.includes('alis') || code.includes('alınan') || code.includes('alinan')) {
    return 'purchase';
  }
  if (code.includes('sales') || code.includes('satis') || code.includes('satış') || code.includes('verilen')) {
    return 'sales';
  }
  const typeVal = String(
    sf.Type_ ?? sf.VoucherType ?? sf.InvoiceType ?? schema.fixedStandardFields?.Type_ ??
      schema.fixedStandardFields?.VoucherType ??
      schema.fixedStandardFields?.InvoiceType ??
      '',
  ).trim();
  if (
    typeVal === OrderType.Alis ||
    typeVal === OrderType.AlisIade ||
    typeVal === DispatchType.Alis ||
    typeVal === DispatchType.AlisIade ||
    typeVal === InvoiceType.Alis ||
    typeVal === InvoiceType.AlisIade
  ) {
    return 'purchase';
  }
  return 'sales';
}

function lineProductId(row: Record<string, unknown> | undefined): number | null {
  if (!row) return null;
  const raw = row.ProductCardID ?? row.ItemsID;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveUnitModule(
  schema: FormSchemaDto,
  priceDirection: 'sales' | 'purchase',
): UnitModuleFilter {
  const code = (schema.formCode || '').toLowerCase();
  const table = (schema.tableName || '').toLowerCase();
  if (
    code.includes('material') ||
    code.includes('stock') ||
    code.includes('cost') ||
    code.includes('devir') ||
    code.includes('sayim') ||
    code.includes('transfer')
  ) {
    return 'material';
  }
  if (table === 'productvoucher') {
    const vt = String(schema.fixedStandardFields?.VoucherType ?? '').trim();
    if (
      vt === DispatchType.Devir ||
      vt === DispatchType.Transfer ||
      vt === DispatchType.Sayim ||
      vt === DispatchType.Sarf ||
      vt === DispatchType.UretimdenGiris ||
      vt === DispatchType.Fire ||
      vt === DispatchType.MaliyetDagitim
    ) {
      return 'material';
    }
  }
  return priceDirection === 'purchase' ? 'purchase' : 'sales';
}

interface DocumentFormEngineProps {
  schema: FormSchemaDto;
  initialData?: DynamicFormDataDto;
  onSubmit: (data: DynamicFormDataDto) => void;
  isLoading?: boolean;
  readOnly?: boolean;
  /** Açık fiş tray — form değiştikçe taslak güncelle */
  onLiveChange?: (data: DynamicFormDataDto) => void;
}

const DOC_NUMBER_FIELDS = ['DocumentNumber', 'OrderSlipNo', 'VoucherNo'] as const;

const HEADER_DOC_NUMBER = new Set(['DocumentNumber', 'OrderSlipNo', 'VoucherNo']);
const HEADER_DOC_DATE = new Set([
  'OrderDate',
  'VoucherDate',
  'InvoiceDate',
  'TransDate',
  'SourceSlipDate',
  'ProcessDate',
  'CreditDate',
  'DocumentDate',
  'VoucherTime',
]);
const HEADER_AUTH = new Set(['AuthCode']);
const HEADER_PARTY = new Set(['CustomerID', 'CustomerAdressID']);
/** Cari yoksa / ek bilgi — fiş tipi, yevmiye, banka hesabı */
const HEADER_DOC_META = new Set([
  'Type',
  'Type_',
  'VoucherType',
  'journalNO',
  'AccountVoucherType',
  'BankAccountCardID',
  'BankAccountID',
  'CheckID',
]);
const HEADER_PAYMENT_TEMPLATE = new Set(['PaidPlanID']);
const HEADER_ORG_MAIN = new Set([
  'CompanyID',
  'DepartmentID',
  'WorkplaceID',
  'WhouseID',
  'AimWhouseID',
]);
const HEADER_ORG_SIDE = new Set(['OrgUnitID', 'UnitID']);
const HEADER_STATUS = new Set(['Status_', 'Status']);
const CURRENCY_FIELD_NAMES = new Set([
  'Currency',
  'CurrencyRate',
  'DefaultCurrency',
  'DefaultRate',
]);

function splitFields(schema: FormSchemaDto): { general: FormFieldDto[]; custom: FormFieldDto[] } {
  const registryCustom = schema.customFields || [];
  const fromSchemaCustom = schema.fields.filter((f) => f.fieldName.startsWith('U_'));
  const general = schema.fields.filter((f) => !f.fieldName.startsWith('U_'));
  const seen = new Set(registryCustom.map((f) => f.fieldName));
  const custom = [
    ...registryCustom,
    ...fromSchemaCustom.filter((f) => !seen.has(f.fieldName)),
  ];
  return { general, custom };
}

const DETAIL_TOTAL_FIELD_NAMES = new Set([
  'Description',
  'Description1',
  'Description2',
  'Notes',
  'Note',
  'Aciklama',
]);

function partitionTradeFields(general: FormFieldDto[]) {
  const headerDocNumber: FormFieldDto[] = [];
  const headerDocDate: FormFieldDto[] = [];
  const headerAuth: FormFieldDto[] = [];
  const headerParty: FormFieldDto[] = [];
  const headerDocMeta: FormFieldDto[] = [];
  const headerOrgMain: FormFieldDto[] = [];
  const headerOrgSide: FormFieldDto[] = [];
  const headerStatus: FormFieldDto[] = [];
  const headerPaymentTemplate: FormFieldDto[] = [];
  const currency: FormFieldDto[] = [];
  const detailTotal: FormFieldDto[] = [];
  const detail: FormFieldDto[] = [];
  for (const f of general) {
    if (HEADER_DOC_NUMBER.has(f.fieldName)) headerDocNumber.push(f);
    else if (HEADER_DOC_DATE.has(f.fieldName)) headerDocDate.push(f);
    else if (HEADER_AUTH.has(f.fieldName)) headerAuth.push(f);
    else if (HEADER_PARTY.has(f.fieldName)) headerParty.push(f);
    else if (HEADER_DOC_META.has(f.fieldName)) headerDocMeta.push(f);
    else if (HEADER_PAYMENT_TEMPLATE.has(f.fieldName)) headerPaymentTemplate.push(f);
    else if (HEADER_ORG_MAIN.has(f.fieldName)) headerOrgMain.push(f);
    else if (HEADER_ORG_SIDE.has(f.fieldName)) headerOrgSide.push(f);
    else if (HEADER_STATUS.has(f.fieldName)) headerStatus.push(f);
    else if (CURRENCY_FIELD_NAMES.has(f.fieldName)) currency.push(f);
    else if (DETAIL_TOTAL_FIELD_NAMES.has(f.fieldName)) detailTotal.push(f);
    else detail.push(f);
  }
  const byOrder = (a: FormFieldDto, b: FormFieldDto) => a.orderIndex - b.orderIndex;
  const partyOrder = (a: FormFieldDto, b: FormFieldDto) => {
    const rank = (n: string) =>
      n === 'CustomerID' ? 0 : n === 'CustomerAdressID' ? 1 : 9;
    return rank(a.fieldName) - rank(b.fieldName) || byOrder(a, b);
  };
  const orgMainOrder = (a: FormFieldDto, b: FormFieldDto) => {
    const rank = (n: string) =>
      n === 'CompanyID'
        ? 0
        : n === 'DepartmentID' || n === 'WorkplaceID'
          ? 1
          : n === 'WhouseID'
            ? 2
            : n === 'AimWhouseID'
              ? 3
              : 9;
    return rank(a.fieldName) - rank(b.fieldName) || byOrder(a, b);
  };
  const orgSideOrder = (a: FormFieldDto, b: FormFieldDto) => {
    const rank = (n: string) => (n === 'OrgUnitID' ? 0 : n === 'UnitID' ? 1 : 9);
    return rank(a.fieldName) - rank(b.fieldName) || byOrder(a, b);
  };
  const metaOrder = (a: FormFieldDto, b: FormFieldDto) => {
    const rank = (n: string) =>
      n === 'Type' || n === 'Type_' || n === 'VoucherType' || n === 'AccountVoucherType'
        ? 0
        : n === 'journalNO'
          ? 1
          : n === 'BankAccountCardID' || n === 'BankAccountID'
            ? 2
            : n === 'CheckID'
              ? 3
              : 9;
    return rank(a.fieldName) - rank(b.fieldName) || byOrder(a, b);
  };
  return {
    headerDocNumber: headerDocNumber.sort(byOrder),
    headerDocDate: headerDocDate.sort(byOrder),
    headerAuth: headerAuth.sort(byOrder),
    headerParty: headerParty.sort(partyOrder),
    headerDocMeta: headerDocMeta.sort(metaOrder),
    headerOrgMain: headerOrgMain.sort(orgMainOrder),
    headerOrgSide: headerOrgSide.sort(orgSideOrder),
    headerStatus: headerStatus.sort(byOrder),
    headerPaymentTemplate: headerPaymentTemplate.sort(byOrder),
    currency: currency.sort(byOrder),
    detailTotal: detailTotal.sort(byOrder),
    detail: detail.sort(byOrder),
  };
}

const TOTAL_NAME_RE = /(amount|total|tutar|expense|masraf|tax|kdv|net|qty|quantity|adet|localamount)/i;

function formatTrNumber(n: number, fractionDigits = 2): string {
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function sumLineField(lines: Record<string, unknown>[], fieldName: string): number {
  return lines.reduce((acc, row) => {
    const raw = row?.[fieldName];
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function parseLineNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Seri/lot satırlarındaki miktar toplamı. Fiş satırı bu toplama yazılır. */
function serialLotIssuedQty(raw: unknown): number | null {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('[')) return null;
  try {
    const arr = JSON.parse(text) as { q?: unknown }[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const sum = arr.reduce((acc, row) => acc + parseLineNum(row?.q), 0);
    return sum > 0 ? sum : null;
  } catch {
    return null;
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Kayıttan gelen satırlar + düz dağıtım listesi → satır içi `distributions` (TransLineNo eşleşmesi) */
function attachLineDistributions(
  lines: Record<string, unknown>[],
  distributions: Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  const lineNoOf = (r: Record<string, unknown>, i: number) =>
    Number(r.TransLineNo ?? r.LineNo) || i + 1;
  const sorted = [...lines].sort((a, b) => lineNoOf(a, 0) - lineNoOf(b, 0));
  if (!distributions) return sorted;
  return sorted.map((row, i) => {
    const no = lineNoOf(row, i);
    return {
      ...row,
      LineNo: no,
      distributions: distributions.filter((d) => Number(d.TransLineNo) === no),
    };
  });
}

/** Kuruş (2 hane) — kayan nokta hatası olmadan */
function toCents(v: unknown): number {
  return Math.round((parseLineNum(v) + Number.EPSILON) * 100);
}

/**
 * Muhasebe fişi kuralları: satırda tek taraf, tutarlar kuruşa yuvarlı, borç = alacak,
 * dağıtım varsa toplamı satır tutarına eşit. Hata mesajı veya null döner.
 */
function validateBalancedVoucher(
  lines: Record<string, unknown>[],
  debitField: string,
  creditField: string,
): string | null {
  if (lines.length < 2) return 'Muhasebe fişinde en az bir borç ve bir alacak satırı olmalı';
  let debit = 0;
  let credit = 0;
  for (let i = 0; i < lines.length; i++) {
    const d = toCents(lines[i][debitField]);
    const c = toCents(lines[i][creditField]);
    const no = i + 1;
    if (d < 0 || c < 0) return `${no}. satırda negatif tutar olamaz`;
    if (d > 0 && c > 0) return `${no}. satırda borç ve alacak birlikte girilemez`;
    if (d === 0 && c === 0) return `${no}. satırda borç veya alacak tutarı girilmeli`;
    debit += d;
    credit += c;
    const dist = (lines[i].distributions as Record<string, unknown>[] | undefined)?.filter(
      isFilledDistribution,
    );
    if (dist?.length) {
      const distTotal = dist.reduce((a, r) => a + toCents(r.Amount), 0);
      if (distTotal !== d + c) {
        return `${no}. satırın dağıtım toplamı (${formatTrNumber(distTotal / 100)}) satır tutarına (${formatTrNumber((d + c) / 100)}) eşit değil`;
      }
    }
  }
  if (debit !== credit) {
    return `Fiş dengede değil: Borç ${formatTrNumber(debit / 100)} · Alacak ${formatTrNumber(credit / 100)} · Fark ${formatTrNumber(Math.abs(debit - credit) / 100)}`;
  }
  return null;
}

function isFilledDistribution(row: Record<string, unknown>): boolean {
  return (
    String(row.CostCenterID ?? '').trim() !== '' ||
    String(row.ProjectCardID ?? '').trim() !== '' ||
    parseLineNum(row.Amount) !== 0
  );
}

export const DocumentFormEngine: React.FC<DocumentFormEngineProps> = ({
  schema,
  initialData,
  onSubmit,
  isLoading = false,
  readOnly = false,
  onLiveChange,
}) => {
  const hasLines = Boolean(schema.lineFields?.length);
  const tradeLayout = schema.documentLayout === 'trade';
  /** İndirim / KDV / Net özeti yalnızca malzeme (veya hizmet) satırı içeren fişlerde */
  const hasMaterialLineTotals = Boolean(
    schema.lineFields?.some(
      (f) => f.fieldName === 'ProductCardID' || f.fieldName === 'ItemsID',
    ),
  );
  const hasDistribution = hasLines && Boolean(schema.lineDistributionFields?.length);
  const showPaymentPlan = tradeLayout && !schema.hidePaymentPlan;
  const [selectedLine, setSelectedLine] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const { general, custom: allCustom } = splitFields(schema);
  const custom = allCustom.filter((f) => canField(schema.tableName, f.fieldName, 'view'));
  const showCustomTab = custom.length > 0;
  const hasAuxilCodes = Boolean(schema.enableAuxilCodesTab && schema.auxilCodeFields?.length);
  const tradeParts = React.useMemo(
    () => (tradeLayout ? partitionTradeFields(general) : null),
    [tradeLayout, general],
  );
  const [tab, setTab] = React.useState(tradeLayout ? 'detaylar' : 'belge');
  const [detailTab, setDetailTab] = React.useState('detaylar');

  const fieldDefaults: Record<string, unknown> = {};
  for (const f of schema.fields) {
    if (f.defaultValue != null && f.defaultValue !== '' && !f.fieldName.startsWith('U_')) {
      fieldDefaults[f.fieldName] = f.defaultValue;
    }
  }
  if (!initialData?.recordId && schema.fields.some((f) => f.fieldName === 'VoucherTime')) {
    const now = new Date();
    fieldDefaults.VoucherTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  const eLedgerFields = schema.eLedgerFields || [];
  const hasELedger = tradeLayout && eLedgerFields.length > 0;

  const { register, control, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<FieldValues>({
    defaultValues: {
      standardFields: {
        ...fieldDefaults,
        ...(schema.fixedStandardFields || {}),
        ...(initialData?.standardFields || {}),
      },
      additionalFields: initialData?.additionalFields || {},
      lines: initialData?.lines?.length
        ? hasDistribution
          ? attachLineDistributions(initialData.lines, initialData.distributions)
          : initialData.lines
        : hasLines
          ? [{}]
          : [],
      paymentPlans: initialData?.paymentPlans?.length ? initialData.paymentPlans : [],
      auxilCodes: initialData?.auxilCodes?.length ? initialData.auxilCodes : [],
    },
  });

  const watchedCurrency = watch('standardFields.Currency');
  const watchedCurrencyRate = watch('standardFields.CurrencyRate');
  const watchedDefaultCurrency = watch('standardFields.DefaultCurrency');
  const watchedCustomerId = watch('standardFields.CustomerID');
  const watchedLines = watch('lines') as Record<string, unknown>[] | undefined;
  const watchedType_ = watch('standardFields.Type_');
  const watchedVoucherType = watch('standardFields.VoucherType');
  const watchedInvoiceType = watch('standardFields.InvoiceType');
  const priceDirection = React.useMemo(() => {
    const sf: Record<string, unknown> = {
      ...(schema.fixedStandardFields || {}),
      Type_: watchedType_,
      VoucherType: watchedVoucherType,
      InvoiceType: watchedInvoiceType,
    };
    return resolvePriceDirection(schema, sf);
  }, [schema, watchedType_, watchedVoucherType, watchedInvoiceType]);
  const headerCustomerId = React.useMemo(() => {
    const n = Number(watchedCustomerId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [watchedCustomerId]);
  /** Cari seçilince varsayılan (yoksa ilk aktif) adres otomatik gelir — kullanıcı sonra değiştirebilir */
  const hasPartyAddress = schema.fields.some((f) => f.fieldName === 'CustomerAdressID');
  const prevAddrCustomer = React.useRef<number | null | undefined>(undefined);
  React.useEffect(() => {
    if (!hasPartyAddress || readOnly) return;
    const first = prevAddrCustomer.current === undefined;
    const changed = prevAddrCustomer.current !== headerCustomerId;
    prevAddrCustomer.current = headerCustomerId;
    if (!headerCustomerId) {
      if (!first && changed) setValue('standardFields.CustomerAdressID', '', { shouldDirty: true });
      return;
    }
    // Açılışta kayıtlı adres korunur; sadece boşsa ya da cari değiştiyse doldur
    const current = String(getValues('standardFields.CustomerAdressID') ?? '').trim();
    if (first && current) return;
    if (!changed && current) return;
    let cancelled = false;
    void listRecords('CustomerAdress', {
      pk: 'CustomerAdressID',
      filterColumn: 'CustomerCardID',
      filterValue: headerCustomerId,
      take: 50,
    })
      .then((res) => {
        if (cancelled) return;
        const all = res.rows as Record<string, unknown>[];
        // Seçili adres zaten bu cariye aitse (kayıtlı fiş açılışı vb.) dokunma
        const now = String(getValues('standardFields.CustomerAdressID') ?? '').trim();
        if (now && all.some((r) => String(r.CustomerAdressID ?? '') === now)) return;
        const rows = all.filter(
          (r) => !['0', 'false'].includes(String(r.Active ?? 'true').toLowerCase()),
        );
        const isTrue = (v: unknown) => v === true || v === 1 || String(v).toLowerCase() === 'true';
        const pick = rows.find((r) => isTrue(r.IsDefault)) ?? rows[0];
        setValue('standardFields.CustomerAdressID', pick ? String(pick.CustomerAdressID ?? '') : '', {
          shouldDirty: true,
        });
      })
      .catch(() => {
        /* adres okunamazsa kullanıcı elle seçer */
      });
    return () => {
      cancelled = true;
    };
  }, [headerCustomerId, hasPartyAddress, readOnly, setValue, getValues]);

  const hasLinePrice = Boolean(schema.lineFields?.some((f) => f.fieldName === 'Price'));
  const hasLineUnit = Boolean(schema.lineFields?.some((f) => f.fieldName === 'UnitID'));
  const unitModule = React.useMemo(
    () => resolveUnitModule(schema, priceDirection),
    [schema, priceDirection],
  );
  /** Satır index → son otomatik fiyat uygulanan ürün */
  const autoPriceProductRef = React.useRef<Record<number, number>>({});
  /** Satır index → son birim senkronu yapılan ürün */
  const autoUnitProductRef = React.useRef<Record<number, number>>({});
  /** productCardId → malzeme kartının birim seti */
  const unitInfoRef = React.useRef<Record<number, ProductUnitsInfo>>({});
  const [unitByProduct, setUnitByProduct] = React.useState<Record<number, ProductUnitsInfo>>({});
  const [unitOptionsTick, setUnitOptionsTick] = React.useState(0);
  React.useEffect(() => {
    unitInfoRef.current = {};
    autoUnitProductRef.current = {};
    setUnitByProduct({});
    setUnitOptionsTick((t) => t + 1);
  }, [unitModule]);
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
  /** Muhasebe satırı: ya borç ya alacak — bir tarafa tutar girilince karşı taraf silinir */
  React.useEffect(() => {
    const bal = schema.balanceFields;
    if (readOnly || !bal) return;
    const re = new RegExp(`^lines\\.(\\d+)\\.(${bal.debit}|${bal.credit})$`);
    const sub = watch((values, { name, type }) => {
      if (type !== 'change' || !name) return;
      const m = re.exec(name);
      if (!m) return;
      const row = (values.lines as Record<string, unknown>[] | undefined)?.[Number(m[1])];
      const amount = Number(String(row?.[m[2]] ?? '').replace(',', '.'));
      if (!Number.isFinite(amount) || amount === 0) return;
      const other = m[2] === bal.debit ? bal.credit : bal.debit;
      const otherVal = row?.[other];
      if (otherVal === undefined || otherVal === null || otherVal === '' || Number(otherVal) === 0) return;
      setValue(`lines.${m[1]}.${other}`, '', { shouldDirty: true });
    });
    return () => sub.unsubscribe();
  }, [schema.balanceFields, readOnly, watch, setValue]);
  /** Formüllü ek alanlar — değer girildikçe hesaplanır */
  const lineTable = React.useMemo(
    () => (schema.lineFields?.length ? lineTableFor(schema.tableName) : undefined),
    [schema.lineFields, schema.tableName],
  );
  React.useEffect(() => {
    if (readOnly) return;
    if (!formulaExtraFields(schema.tableName).length && !(lineTable && formulaExtraFields(lineTable).length)) {
      return;
    }
    const apply = (values: Record<string, unknown>) => {
      const header = {
        ...((values.standardFields as Record<string, unknown>) || {}),
        ...((values.additionalFields as Record<string, unknown>) || {}),
      };
      for (const [k, v] of Object.entries(computeFormulaValues(schema.tableName, header))) {
        setValue(`additionalFields.${k}`, v ?? '', { shouldDirty: true, shouldValidate: false });
      }
      if (!lineTable) return;
      const rows = (values.lines as Record<string, unknown>[] | undefined) || [];
      rows.forEach((row, i) => {
        for (const [k, v] of Object.entries(computeFormulaValues(lineTable, row || {}))) {
          setValue(`lines.${i}.${k}`, v ?? '', { shouldDirty: true, shouldValidate: false });
        }
      });
    };
    apply(getValues());
    const sub = watch((values, { type }) => {
      if (type !== 'change') return;
      apply(values as Record<string, unknown>);
    });
    return () => sub.unsubscribe();
  }, [schema.tableName, lineTable, readOnly, watch, setValue, getValues]);
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

  const { fields, append, remove } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'lines',
  });

  // ── Barkod okutma: malzeme satıra, birim barkodunda miktar barkoddan ──
  const [scanText, setScanText] = React.useState('');
  const scanProductField = (schema.lineFields || []).find((f) =>
    ['ItemsID', 'ProductCardID'].includes(f.fieldName),
  )?.fieldName;
  const handleScan = React.useCallback(async () => {
    const code = scanText.trim();
    if (!code || !scanProductField) return;
    setScanText('');
    try {
      const r = await resolveBarcode(code);
      if (!r.found) {
        setPasteMsg({ kind: 'warn', text: `Barkod bulunamadı: ${code}` });
        return;
      }
      const lines = (getValues('lines') as Record<string, unknown>[] | undefined) || [];
      let idx = lines.findIndex((l) => !String((l || {})[scanProductField] ?? '').trim());
      if (idx === -1) {
        idx = lines.length;
        append({});
        await new Promise((res) => window.setTimeout(res, 0));
      }
      setValue(`lines.${idx}.${scanProductField}`, String(r.productCardID), { shouldDirty: true });
      // Malzeme seçimi birim / fiyat varsayılanını doldurduktan sonra miktarı yaz
      await new Promise((res) => window.setTimeout(res, 500));
      setValue(`lines.${idx}.Quantity`, r.quantity ?? 1, { shouldDirty: true });
      setPasteMsg({
        kind: 'ok',
        text: `${code} → ${r.productCode ?? ''} ${r.productTitle ?? ''}`.trim() +
          (r.quantity != null ? ` · miktar ${r.quantity.toLocaleString('tr-TR')} (birim barkodu)` : ''),
      });
    } catch (e) {
      setPasteMsg({ kind: 'warn', text: e instanceof Error ? e.message : 'Barkod okunamadı' });
    }
  }, [scanText, scanProductField, getValues, append, setValue]);

  // ── Excel'den kalem yapıştırma ─────────────────────────────────────
  const [pasteMsg, setPasteMsg] = React.useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const [pasteText, setPasteText] = React.useState('');
  /** Hesaplanan sütunlar yapıştırmada atlanır */
  const PASTE_SKIP = React.useMemo(() => new Set(['TotalTax', 'TotalPrice', 'NetTotal']), []);
  /** Malzeme seçimi birim / fiyatı doldurduktan sonra yazılacak alanlar */
  const PASTE_LATE = React.useMemo(() => new Set(['UnitID', 'Price', 'TotalDiscount', 'TaxRate', 'TaxCardID']), []);

  const applyLinePaste = React.useCallback(
    async (text: string, start: { row: number; col: number } | null) => {
      const cols = schema.lineFields || [];
      if (!cols.length) return;
      let grid = parseClipboardGrid(text);
      if (!grid.length) return;
      const editable = cols.filter((f) => !f.isReadOnly && !PASTE_SKIP.has(f.fieldName));
      const header = matchHeaderRow(grid[0], editable);
      if (header) grid = grid.slice(1);
      if (!grid.length) return;

      const lines = (getValues('lines') as Record<string, unknown>[] | undefined) || [];
      const firstCol = cols[0]?.fieldName;
      const firstEmpty = (() => {
        const i = lines.findIndex((l) => !String((l || {})[firstCol] ?? '').trim());
        return i === -1 ? lines.length : i;
      })();
      const startRow = start && !header ? start.row : start ? start.row : firstEmpty;
      const startCol = header ? 0 : start ? start.col : 0;

      const need = startRow + grid.length - lines.length;
      if (need > 0) append(Array.from({ length: need }, () => ({})));
      await new Promise((r) => window.setTimeout(r, 0));

      const resolve = createLookupResolver();
      const notFound = new Set<string>();
      const late: { path: string; value: unknown }[] = [];
      let written = 0;
      const qtyField = cols.find((f) => f.fieldName === 'Quantity');

      for (let r = 0; r < grid.length; r++) {
        const rowIdx = startRow + r;
        const rowFields = grid[r].map((_, c) => (header ? header[c] : cols[startCol + c])?.fieldName);
        const qtyPasted = rowFields.includes('Quantity') && grid[r][rowFields.indexOf('Quantity')] !== '';
        for (let c = 0; c < grid[r].length; c++) {
          const field = header ? header[c] : cols[startCol + c];
          if (!field || field.isReadOnly || PASTE_SKIP.has(field.fieldName)) continue;
          const raw = grid[r][c];
          if (raw === '') continue;
          let value: unknown = raw;
          const isLookup =
            Boolean(lookupSourceForField(field.fieldName)) &&
            (field.fieldType === 'select' || field.fieldType === 'lookup');
          if (isLookup) {
            const id = await resolve(field.fieldName, raw);
            if (!id) {
              notFound.add(`${field.label}: ${raw}`);
              continue;
            }
            value = id;
            // Birim barkodu: miktar barkodun içinde (satırda ayrıca miktar yoksa)
            const bq = resolve.barcodeQty.get(raw.trim());
            if (bq != null && qtyField && !qtyPasted) {
              late.push({ path: `lines.${rowIdx}.Quantity`, value: bq });
            }
          } else if (field.fieldType === 'number') {
            const n = parseLocaleNumber(raw);
            if (n == null) continue;
            value = n;
          } else if (field.fieldType === 'date') {
            const d = parsePastedDate(raw);
            if (!d) continue;
            value = d;
          } else if (field.fieldType === 'select') {
            const v = matchSelectOption(field, raw);
            if (v == null) {
              notFound.add(`${field.label}: ${raw}`);
              continue;
            }
            value = v;
          } else if (field.fieldType === 'checkbox') {
            value = /^(1|evet|e|true|x|var)$/i.test(raw);
          }
          const path = `lines.${rowIdx}.${field.fieldName}`;
          if (PASTE_LATE.has(field.fieldName)) late.push({ path, value });
          else setValue(path, value, { shouldDirty: true });
          written++;
        }
      }
      if (late.length) {
        // Malzeme değişimi efektleri (birim / fiyat varsayılanı) bittikten sonra kullanıcının değerlerini yaz
        await new Promise((r) => window.setTimeout(r, 700));
        for (const l of late) setValue(l.path, l.value, { shouldDirty: true });
      }
      const miss = [...notFound];
      setPasteMsg({
        kind: miss.length ? 'warn' : 'ok',
        text:
          `${grid.length} satır aktarıldı (${written} hücre)` +
          (header ? ' · sütunlar başlığa göre eşlendi' : '') +
          (miss.length
            ? ` · bulunamayan ${miss.length}: ${miss.slice(0, 8).join(', ')}${miss.length > 8 ? '…' : ''}`
            : ''),
      });
    },
    [schema.lineFields, PASTE_SKIP, PASTE_LATE, getValues, append, setValue],
  );
  const activeLine = Math.min(selectedLine, Math.max(fields.length - 1, 0));

  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
    replace: replacePayment,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'paymentPlans',
  });

  const {
    fields: auxilCodeRows,
  } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'auxilCodes',
  });

  const watchedPaymentPlans = watch('paymentPlans') as Record<string, unknown>[] | undefined;
  const paymentTotal = sumLineField(watchedPaymentPlans || [], 'Amount');

  const totalFields = React.useMemo(() => {
    if (!schema.lineFields?.length) return [];
    return schema.lineFields.filter(
      (f) => f.fieldType === 'number' && TOTAL_NAME_RE.test(f.fieldName),
    );
  }, [schema.lineFields]);

  const lineTotals = React.useMemo(() => {
    const rows = watchedLines || [];
    return totalFields.map((f) => ({
      fieldName: f.fieldName,
      label: f.label,
      value: sumLineField(rows, f.fieldName),
    }));
  }, [watchedLines, totalFields]);

  const grandTotal =
    lineTotals.find((t) => /^amount$/i.test(t.fieldName) || /tutar/i.test(t.fieldName))?.value ??
    lineTotals.find((t) => /total/i.test(t.fieldName))?.value ??
    lineTotals[0]?.value ??
    0;

  const [lineMoney, setLineMoney] = React.useState<{
    discount: number;
    tax: number;
    total: number;
    net: number;
    qty: number;
  } | null>(null);
  const productTaxCache = React.useRef<Record<number, string>>({});
  const appliedProductTax = React.useRef<Record<number, number>>({});
  const payableTotal = lineMoney?.net ?? grandTotal;

  React.useEffect(() => {
    if (!hasLines || readOnly) return;
    if (schema.fields.some((f) => f.fieldName === 'Amount')) {
      setValue('standardFields.Amount', payableTotal, { shouldDirty: false });
    }
  }, [payableTotal, hasLines, readOnly, schema.fields, setValue]);

  /**
   * Satır malzeme kimliği. watch('lines') iç içe alanı kaçırabiliyor;
   * lookup `lines.n.ProductCardID` yazdığı için alanın kendisi izlenir.
   */
  const watchedLineProducts = fields.map((_, index) =>
    lineProductId({
      ProductCardID: watch(`lines.${index}.ProductCardID`),
      ItemsID: watch(`lines.${index}.ItemsID`),
    }),
  );
  const lineProductKey = watchedLineProducts.map((id, i) => `${i}:${id ?? ''}`).join('|');
  /** watch('lines') iç içe yazmayı kaçırır; miktar / fiyat / vergi ayrı izlenir */
  const lineCalcKey = fields
    .map((_, index) =>
      [
        watch(`lines.${index}.Quantity`),
        watch(`lines.${index}.Price`),
        watch(`lines.${index}.TotalDiscount`),
        watch(`lines.${index}.TaxCardID`),
        watch(`lines.${index}.TaxRate`),
        watch(`lines.${index}.ProductCardID`),
        watch(`lines.${index}.ItemsID`),
      ].join('\u001f'),
    )
    .join('|');

  React.useEffect(() => {
    if (!hasLines || !hasLineUnit) return;
    let alive = true;

    const run = async () => {
      const rowsSnap = (getValues('lines') as Record<string, unknown>[]) || [];
      const needed = new Set<number>();
      for (const row of rowsSnap) {
        const pid = lineProductId(row);
        if (pid) needed.add(pid);
      }

      let loadedNew = false;
      for (const pid of needed) {
        if (unitInfoRef.current[pid]?.options.length) continue;
        const info = await fetchProductUnitOptions(pid, unitModule);
        if (info.options.length) {
          unitInfoRef.current[pid] = info;
          loadedNew = true;
        }
      }
      if (loadedNew) {
        setUnitByProduct({ ...unitInfoRef.current });
        setUnitOptionsTick((t) => t + 1);
      }
      if (!alive || readOnly) return;

      // Güncel satırları tekrar oku (fetch sırasında form değişmiş olabilir)
      const rows = (getValues('lines') as Record<string, unknown>[]) || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || {};
        const pid = lineProductId(row);
        if (!pid) {
          if (row.UnitID != null && row.UnitID !== '') {
            setValue(`lines.${i}.UnitID`, '', { shouldDirty: true, shouldValidate: false });
          }
          delete autoUnitProductRef.current[i];
          continue;
        }
        let info = unitInfoRef.current[pid];
        if (!info?.options.length) {
          info = await fetchProductUnitOptions(pid, unitModule);
          if (info.options.length) {
            unitInfoRef.current[pid] = info;
            setUnitByProduct({ ...unitInfoRef.current });
            setUnitOptionsTick((t) => t + 1);
          }
        }
        if (!alive) return;
        const productChanged = autoUnitProductRef.current[i] !== pid;
        // Malzeme seçilir seçilmez ana birim; alt birim kullanıcı seçerse korunur
        const nextUnit = productChanged
          ? info.defaultUnitId
          : resolveLineUnitId(row.UnitID, info);
        const cur = String(row.UnitID ?? '').trim();
        if (productChanged || nextUnit !== cur) {
          if ((nextUnit ?? '') !== cur) {
            setValue(`lines.${i}.UnitID`, nextUnit ?? '', {
              shouldDirty: true,
              shouldValidate: false,
            });
          }
          autoUnitProductRef.current[i] = pid;
        }
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [hasLineUnit, hasLines, readOnly, setValue, getValues, unitModule, lineProductKey]);

  /** Malzeme değişince (veya boş fiyat) önerilen birim fiyatı yaz */
  React.useEffect(() => {
    if (readOnly || !hasLines || !hasLinePrice) return;
    const rows = watchedLines || [];
    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < rows.length; i++) {
        if (cancelled) return;
        const row = rows[i] || {};
        const pid = lineProductId(row);
        if (!pid) {
          delete autoPriceProductRef.current[i];
          continue;
        }
        const productChanged = autoPriceProductRef.current[i] !== pid;
        const priceEmpty = row.Price == null || row.Price === '';
        if (!productChanged && !priceEmpty) continue;
        if (!productChanged && priceEmpty && autoPriceProductRef.current[i] === pid) continue;
        try {
          const res = await fetchPriceSuggestions({
            productCardId: pid,
            customerId: headerCustomerId,
            direction: priceDirection,
          });
          if (cancelled) return;
          const pref = res.suggestions.find((s) => s.isPreferred && s.price != null);
          const fallback = res.suggestions.find((s) => s.price != null);
          const pick = pref ?? fallback;
          autoPriceProductRef.current[i] = pid;
          if (pick?.price != null && (productChanged || priceEmpty)) {
            setValue(`lines.${i}.Price`, pick.price, { shouldDirty: true, shouldValidate: false });
          }
        } catch {
          autoPriceProductRef.current[i] = pid;
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    hasLinePrice,
    hasLines,
    headerCustomerId,
    priceDirection,
    readOnly,
    setValue,
    watchedLines,
  ]);

  /**
   * Miktar × fiyat − iskonto = tutar.
   * Malzemenin vergi kartı satıra yazılır; oran karttan, KDV ve net aynı turda.
   */
  const taxRateCache = React.useRef<Record<string, number>>({});
  React.useEffect(() => {
    if (readOnly || !hasLines || !schema.lineFields?.length) return;
    const lf = schema.lineFields;
    const hasQty = lf.some((f) => f.fieldName === 'Quantity');
    const hasPrice = lf.some((f) => f.fieldName === 'Price');
    const hasTotal = lf.some((f) => f.fieldName === 'TotalPrice');
    const hasDiscount = lf.some((f) => f.fieldName === 'TotalDiscount');
    const hasTaxCard = lf.some((f) => f.fieldName === 'TaxCardID');
    const hasTaxRate = lf.some((f) => f.fieldName === 'TaxRate');
    const hasTotalTax = lf.some((f) => f.fieldName === 'TotalTax');
    const hasNet = lf.some((f) => f.fieldName === 'NetTotal');
    if (!hasQty || !hasPrice || !hasTotal) return;

    let cancelled = false;
    const write = (path: string, value: number) =>
      setValue(path, value, { shouldDirty: true, shouldValidate: false });

    const run = async () => {
      const rows = (getValues('lines') as Record<string, unknown>[]) || [];
      if (hasTaxCard) {
        for (let i = 0; i < rows.length; i++) {
          if (cancelled) return;
          const row = rows[i] || {};
          const pid = lineProductId(row);
          if (!pid) {
            delete appliedProductTax.current[i];
            continue;
          }
          if (appliedProductTax.current[i] === pid) continue;
          if (productTaxCache.current[pid] == null) {
            try {
              const rec = await getRecord('ProductCard', pid, 'ProductCardID');
              const raw = rec.standardFields?.TaxCardID ?? rec.standardFields?.taxCardID;
              productTaxCache.current[pid] = raw == null || raw === '' ? '' : String(raw);
            } catch {
              productTaxCache.current[pid] = '';
            }
          }
          if (cancelled) return;
          appliedProductTax.current[i] = pid;
          const fromProduct = productTaxCache.current[pid];
          if (fromProduct && String(row.TaxCardID ?? '') !== fromProduct) {
            setValue(`lines.${i}.TaxCardID`, fromProduct, { shouldDirty: true, shouldValidate: false });
            row.TaxCardID = fromProduct;
          }
        }
      }

      const fresh = (getValues('lines') as Record<string, unknown>[]) || [];
      let discountSum = 0;
      let taxSum = 0;
      let totalSum = 0;
      let netSum = 0;
      let qtySum = 0;
      for (let i = 0; i < fresh.length; i++) {
        if (cancelled) return;
        const row = fresh[i] || {};
        const qty = parseLineNum(row.Quantity);
        const price = parseLineNum(row.Price);
        const discount = hasDiscount ? parseLineNum(row.TotalDiscount) : 0;
        const base = roundMoney(qty * price - discount);
        qtySum += qty;
        discountSum += discount;
        totalSum += base;
        if (row.TotalPrice == null || row.TotalPrice === '' || Math.abs(parseLineNum(row.TotalPrice) - base) > 0.0005) {
          write(`lines.${i}.TotalPrice`, base);
        }

        const taxId = String(row.TaxCardID ?? '').trim();
        let rate = parseLineNum(row.TaxRate);
        if (hasTaxCard && taxId) {
          if (taxRateCache.current[taxId] == null) {
            try {
              const rec = await getRecord('TaxCard', Number(taxId), 'TaxCardID');
              const r = parseLineNum(rec.standardFields?.Rate ?? rec.standardFields?.rate);
              taxRateCache.current[taxId] = Number.isFinite(r) ? r : 0;
            } catch {
              taxRateCache.current[taxId] = rate;
            }
          }
          if (cancelled) return;
          const fromCard = taxRateCache.current[taxId];
          if (fromCard != null && Math.abs(rate - fromCard) > 0.0005) {
            rate = fromCard;
            if (hasTaxRate) write(`lines.${i}.TaxRate`, rate);
          }
        }

        const tax = hasTotalTax ? roundMoney((base * rate) / 100) : 0;
        const net = roundMoney(base + tax);
        taxSum += tax;
        netSum += net;
        if (hasTotalTax && (row.TotalTax == null || row.TotalTax === '' || Math.abs(parseLineNum(row.TotalTax) - tax) > 0.0005)) {
          write(`lines.${i}.TotalTax`, tax);
        }
        if (hasNet && (row.NetTotal == null || row.NetTotal === '' || Math.abs(parseLineNum(row.NetTotal) - net) > 0.0005)) {
          write(`lines.${i}.NetTotal`, net);
        }
      }
      if (!cancelled) {
        setLineMoney({
          discount: roundMoney(discountSum),
          tax: roundMoney(taxSum),
          total: roundMoney(totalSum),
          net: roundMoney(netSum),
          qty: qtySum,
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [hasLines, readOnly, schema.lineFields, setValue, getValues, lineCalcKey]);

  const docNumberField = React.useMemo(
    () => DOC_NUMBER_FIELDS.find((n) => schema.fields.some((f) => f.fieldName === n)) || null,
    [schema.fields],
  );
  const watchedCompanyId = String(watch('standardFields.CompanyID') ?? '').trim();
  const watchedWorkplaceId = String(
    watch('standardFields.DepartmentID') ?? watch('standardFields.WorkplaceID') ?? '',
  ).trim();
  const watchedWhouseId = String(watch('standardFields.WhouseID') ?? '').trim();
  const numberManual = React.useRef(false);
  const numberAllocated = React.useRef(false);
  const [numberHint, setNumberHint] = React.useState<string | null>(null);
  const [numberBusy, setNumberBusy] = React.useState(false);

  const buildAllocateBody = React.useCallback(() => {
    const profile = getCurrentProfile();
    const co = ORG_COMPANIES.find((c) => c.id === watchedCompanyId);
    const wp = ORG_WORKPLACES.find((w) => w.id === watchedWorkplaceId);
    const wh = ORG_WAREHOUSES.find((w) => w.id === watchedWhouseId);
    const sf = (watch('standardFields') as Record<string, unknown>) || {};
    const documentDate = String(
      sf.InvoiceDate ||
        sf.VoucherDate ||
        sf.OrderDate ||
        sf.TransDate ||
        sf.SourceSlipDate ||
        sf.ProcessDate ||
        sf.CreditDate ||
        sf.DocumentDate ||
        '',
    ).trim();
    return {
      formCode: schema.formCode,
      tableName: schema.tableName,
      companyId: watchedCompanyId || undefined,
      workplaceId: watchedWorkplaceId || undefined,
      whouseId: watchedWhouseId || undefined,
      userId: getCurrentUserId(),
      companyCode: co?.code,
      workplaceCode: wp?.code,
      whouseCode: wh?.code,
      userName: profile.userName,
      documentDate: documentDate || undefined,
    };
  }, [schema.formCode, schema.tableName, watch, watchedCompanyId, watchedWorkplaceId, watchedWhouseId]);

  const requestNumber = React.useCallback(
    async (force = false) => {
      if (readOnly || !docNumberField) return;
      if (!force && numberManual.current) return;
      setNumberBusy(true);
      setNumberHint(null);
      try {
        // Y-05: yalnız önizleme — sayaç kayıtta artar (açılıp vazgeçilen fiş numara tüketmez)
        const res = await allocateDocumentNumber({ ...buildAllocateBody(), peek: true });
        if (res.success && res.number) {
          if (force) setValue(`standardFields.${docNumberField}`, '', { shouldDirty: true });
          numberAllocated.current = true;
          numberManual.current = false;
          setNumberHint(`Otomatik: ${res.number} — numara kayıtta verilir`);
        } else {
          setNumberHint(res.message || 'Şablon bulunamadı');
        }
      } catch (e) {
        setNumberHint(e instanceof Error ? e.message : 'Numara alınamadı');
      } finally {
        setNumberBusy(false);
      }
    },
    [buildAllocateBody, docNumberField, readOnly, setValue],
  );

  React.useEffect(() => {
    if (!isNewRecord || readOnly || !docNumberField) return;
    const cur = String(watch(`standardFields.${docNumberField}`) ?? '').trim();
    if (cur || numberAllocated.current || numberManual.current) return;
    const t = window.setTimeout(() => {
      void requestNumber(false);
    }, 350);
    return () => window.clearTimeout(t);
  }, [
    docNumberField,
    isNewRecord,
    readOnly,
    requestNumber,
    watch,
    watchedCompanyId,
    watchedWorkplaceId,
    watchedWhouseId,
  ]);

  const applySerialLotQty = (index: number, q: number) => {
    setValue(`lines.${index}.Quantity`, q, { shouldDirty: true, shouldValidate: true });
    const input = document.querySelector<HTMLInputElement>(`input[name="lines.${index}.Quantity"]`);
    if (input && !input.disabled) input.value = String(q);
    if (schema.lineFields?.some((f) => f.fieldName === 'MainUnitQuantity')) {
      setValue(`lines.${index}.MainUnitQuantity`, q, { shouldDirty: true });
    }
  };

  const handleFormSubmit = (data: FieldValues) => {
    if (readOnly) return;
    const rawLines = hasLines ? ((data.lines as Record<string, unknown>[]) || []) : undefined;
    const lines = rawLines
      ?.map((row, i): Record<string, unknown> => {
        const next: Record<string, unknown> = {
          ...row,
          LineNo: hasDistribution ? i + 1 : Number(row.LineNo) || i + 1,
        };
        const lotSum = serialLotIssuedQty(next.SerialLotNo);
        if (lotSum != null) {
          const prevQty = parseLineNum(next.Quantity);
          const prevMain = parseLineNum(next.MainUnitQuantity);
          next.Quantity = lotSum;
          if (
            next.MainUnitQuantity == null ||
            next.MainUnitQuantity === '' ||
            Math.abs(prevMain - prevQty) < 0.0001
          ) {
            next.MainUnitQuantity = lotSum;
          }
        }
        return next;
      })
      .filter((row) => {
        // Boş satırları kaydetme
        const keys = Object.keys(row).filter(
          (k) =>
            ![
              'LineNo',
              'id',
              'PaidPlanLineID',
              'ProductTransID',
              'OrderTransID',
              'distributions',
            ].includes(k),
        );
        return keys.some((k) => {
          const v = row[k];
          if (v == null || v === '') return false;
          if (typeof v === 'number') return !Number.isNaN(v);
          return String(v).trim() !== '';
        });
      });
    const bal = schema.balanceFields;
    if (bal && lines) {
      for (const row of lines) {
        for (const f of [bal.debit, bal.credit]) {
          if (row[f] !== '' && row[f] != null) row[f] = toCents(row[f]) / 100;
        }
        const dist = row.distributions as Record<string, unknown>[] | undefined;
        if (dist) {
          row.distributions = dist.map((d) =>
            d.Amount !== '' && d.Amount != null ? { ...d, Amount: toCents(d.Amount) / 100 } : { ...d },
          );
        }
      }
      const err = validateBalancedVoucher(lines, bal.debit, bal.credit);
      setSubmitError(err);
      if (err) return;
    }
    let distributions: Record<string, unknown>[] | undefined;
    let savedLines = lines;
    if (hasDistribution && lines) {
      const distOut: Record<string, unknown>[] = [];
      distributions = distOut;
      savedLines = lines.map((row, i) => {
        const { distributions: dist, ...rest } = row as Record<string, unknown> & {
          distributions?: Record<string, unknown>[];
        };
        const lineNo = i + 1;
        const totalType = parseLineNum(rest.Credit) > 0 && !(parseLineNum(rest.Debit) > 0) ? -1 : 1;
        for (const d of dist || []) {
          if (!isFilledDistribution(d)) continue;
          const { AccountTransDetailID: _pk, AccountVoucherID: _fk, ...dRest } = d;
          void _pk;
          void _fk;
          distOut.push({ ...dRest, TransLineNo: lineNo, TotalType_: totalType });
        }
        return { ...rest, LineNo: lineNo, TransLineNo: lineNo };
      });
    }
    const paymentPlans = ((data.paymentPlans as Record<string, unknown>[]) || [])
      .map((row, i): Record<string, unknown> => ({
        ...row,
        LineNo: Number(row.LineNo) || i + 1,
      }))
      .filter(
        (row) =>
          String(row.DueDate || '').trim() !== '' ||
          parseLineNum(row.Amount) > 0 ||
          String(row.Description || '').trim() !== '',
      );
    const auxilCodes = hasAuxilCodes
      ? ((data.auxilCodes as Record<string, unknown>[]) || [])
          .map((row, i): Record<string, unknown> => ({
            ...row,
            LineNr: Number(row.LineNr) || i + 1,
          }))
          .filter(
            (row) =>
              String(row.AuxilCodesID || '').trim() !== '' ||
              String(row.AuxilCode || '').trim() !== '',
          )
      : undefined;
    const amountTotal = lines
      ? sumLineField(lines, 'Amount') ||
        sumLineField(lines, 'LocalAmount') ||
        sumLineField(lines, 'Total')
      : undefined;
    const standardFields: Record<string, unknown> = {
      ...((data.standardFields as Record<string, unknown>) || {}),
      ...(schema.fixedStandardFields || {}),
      ...(amountTotal != null && schema.fields.some((f) => f.fieldName === 'Amount')
        ? { Amount: amountTotal }
        : {}),
    };
    // Tür tanımındaki harf kodu (AF, TSF…) tinyint kolona yazılmaz
    const letterType: Record<string, string> = {
      AF: '2', AIF: '4', TSF: '1', PSF: '1', SIF: '3',
      SS: '1', ST: '6', AS: '2', AT: '5', SI: '3', AI: '2',
    };
    for (const key of ['InvoiceType', 'VoucherType', 'Type_']) {
      const raw = String(standardFields[key] ?? '').trim();
      if (raw && !/^\d+$/.test(raw) && letterType[raw]) standardFields[key] = letterType[raw];
    }
    const payload: DynamicFormDataDto = {
      recordId: initialData?.recordId ?? 0,
      standardFields,
      additionalFields: (data.additionalFields as Record<string, unknown>) || {},
      lines: savedLines,
      paymentPlans: showPaymentPlan ? paymentPlans : undefined,
      distributions,
      auxilCodes,
      // Y-05: numara alanı boşsa sunucu kaydetmeden hemen önce şablondan numara verir
      autoNumber:
        isNewRecord && docNumberField && !String((data.standardFields as Record<string, unknown>)?.[docNumberField] ?? '').trim()
          ? { field: docNumberField, request: buildAllocateBody() }
          : undefined,
    };
    onSubmit(payload);
  };

  const watchedAll = watch();
  React.useEffect(() => {
    if (!onLiveChange || readOnly) return;
    const t = window.setTimeout(() => {
      const lines = hasLines
        ? ((watchedAll.lines as Record<string, unknown>[]) || [])
        : undefined;
      const paymentPlans = ((watchedAll.paymentPlans as Record<string, unknown>[]) || []).map(
        (row, i) => ({
          ...row,
          LineNo: Number(row.LineNo) || i + 1,
        }),
      );
      const auxilCodes = hasAuxilCodes
        ? ((watchedAll.auxilCodes as Record<string, unknown>[]) || [])
        : undefined;
      onLiveChange({
        recordId: initialData?.recordId ?? 0,
        standardFields: {
          ...((watchedAll.standardFields as Record<string, unknown>) || {}),
          ...(schema.fixedStandardFields || {}),
        },
        additionalFields: (watchedAll.additionalFields as Record<string, unknown>) || {},
        lines,
        paymentPlans: showPaymentPlan ? paymentPlans : undefined,
        auxilCodes,
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [
    watchedAll,
    onLiveChange,
    readOnly,
    hasLines,
    showPaymentPlan,
    initialData?.recordId,
    schema.fixedStandardFields,
  ]);

  const getFieldError = (fieldName: string): FieldError | undefined => {
    const path = fieldName.startsWith('U_')
      ? `additionalFields.${fieldName}`
      : `standardFields.${fieldName}`;
    return get(errors, path) as FieldError | undefined;
  };

  const renderGrid = (fieldList: FormFieldDto[], isCustom = false) => (
    <InlineFieldGrid cols={3} className="max-w-[1320px]">
      {fieldList.map((field) => {
        const patched = patchField(field);
        const fieldReadOnly =
          readOnly ||
          Boolean(field.isReadOnly) ||
          (isCustom && !canField(schema.tableName, field.fieldName, 'edit'));
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
      })}
    </InlineFieldGrid>
  );

  const renderTradeField = (
    field: FormFieldDto,
    opts?: { endAction?: React.ReactNode },
  ) => {
    const patched = patchField({ ...field, colSpan: 12 });
    return (
      <FieldRenderer
        key={`${patched.fieldId}-${patched.fieldName}-${patched.optionsJson || ''}`}
        field={patched}
        register={register}
        error={getFieldError(field.fieldName)}
        disabled={readOnly || Boolean(field.isReadOnly)}
        watermark
        endAction={opts?.endAction}
      />
    );
  };

  /** Başlıkta iki alan tek satırda: «Bölüm / Birim», «Ambar / Hedef Depo» */
  const renderTradePair = (pair: FormFieldDto[]) => (
    <div key={`pair-${pair.map((f) => f.fieldName).join('-')}`} className="flex items-center gap-2 min-w-0">
      <label
        className="w-[124px] shrink-0 text-[11.5px] leading-7 text-slate-600 dark:text-slate-300 truncate"
        title={pair.map((f) => f.label).join(' / ')}
      >
        {pair.map((f) => f.label).join(' / ')}
        {pair.some((f) => f.isRequired) && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
        {pair.map((field) => {
          const patched = patchField({ ...field, colSpan: 12 });
          return (
            <FieldRenderer
              key={`${patched.fieldId}-${patched.fieldName}-${patched.optionsJson || ''}`}
              field={patched}
              register={register}
              error={getFieldError(field.fieldName)}
              disabled={readOnly || Boolean(field.isReadOnly)}
              hideLabel
            />
          );
        })}
      </div>
    </div>
  );

  /** Muhasebe fişi: Yetki Kodu + Yevmiye No aynı satırda (Fiş sütunu) */
  const authBesideJournal = Boolean(
    tradeParts?.headerAuth.length && tradeParts.headerDocMeta.some((f) => f.fieldName === 'journalNO'),
  );
  const renderDocMeta = (meta: FormFieldDto[], auth: FormFieldDto[]) => {
    if (!authBesideJournal) return meta.map((f) => renderTradeField(f));
    return meta.map((f) =>
      f.fieldName === 'journalNO' ? (
        <div key={`auth-journal-${f.fieldId}`} className="space-y-[5px]">
          {[...auth, f].map((x) => (
            <React.Fragment key={x.fieldName}>{renderTradeField(x)}</React.Fragment>
          ))}
        </div>
      ) : (
        renderTradeField(f)
      ),
    );
  };

  const numberAllocateBtn =
    !readOnly && docNumberField ? (
      <button
        type="button"
        title="Sıradaki fiş no (önizleme — numara kayıtta verilir)"
        disabled={numberBusy}
        onClick={() => {
          numberManual.current = false;
          void requestNumber(true);
        }}
        className="inline-flex items-center justify-center w-7 h-7 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${numberBusy ? 'animate-spin' : ''}`} />
      </button>
    ) : null;

  const renderLinesTable = (opts?: { fill?: boolean }) =>
    hasLines && schema.lineFields ? (
      <section
        className={
          opts?.fill
            ? 'flex-1 min-h-[220px] flex flex-col gap-2 min-w-0'
            : 'space-y-2'
        }
      >
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            Kalemler
            <span className="ml-1.5 text-[11px] font-normal text-slate-400">({fields.length})</span>
          </h3>
          {!readOnly && (
            <div className="flex items-center gap-1.5">
              {scanProductField && (
                <input
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleScan();
                    }
                  }}
                  placeholder="Barkod okut + Enter"
                  title="Barkod okutun: malzeme satıra eklenir; birim barkodunda (27000000500) miktar barkoddan okunur"
                  className="w-40 h-6 px-1.5 text-[11px] rounded-sm border border-slate-300 bg-white dark:bg-slate-900 outline-none focus:border-blue-500"
                />
              )}
              <span className="hidden xl:inline text-[10px] text-slate-400">
                İpucu: Excel'den kopyalayıp bir hücreye tıklayıp Ctrl+V
              </span>
              <button
                type="button"
                onClick={() => {
                  setPasteText('');
                  setPasteOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-sm transition-colors"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Excel'den Yapıştır
              </button>
              <button
                type="button"
                onClick={() => append({})}
                className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Satır Ekle
              </button>
            </div>
          )}
        </div>
        {pasteMsg && (
          <div
            className={`flex items-start justify-between gap-2 rounded-sm border px-2 py-1 text-[11px] shrink-0 ${
              pasteMsg.kind === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <span>{pasteMsg.text}</span>
            <button type="button" onClick={() => setPasteMsg(null)} className="shrink-0 opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}
        {pasteOpen && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/40"
            onMouseDown={() => setPasteOpen(false)}
          >
            <div
              className="w-full max-w-2xl rounded-md border border-slate-300 bg-white dark:bg-slate-900 shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                <h3 className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Excel'den kalem yapıştır</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Excel'de satırları seçip kopyalayın (Ctrl+C), aşağıya yapıştırın (Ctrl+V). İlk satır başlıksa
                  (Malzeme Kodu, Miktar, Birim Fiyat…) sütunlar başlığa göre eşlenir; değilse sütun sırası:{' '}
                  <b>{(schema.lineFields || []).filter((f) => !PASTE_SKIP.has(f.fieldName)).slice(0, 6).map((f) => f.label).join(' · ')}</b>
                </p>
              </div>
              <div className="p-3">
                <textarea
                  autoFocus
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'Malzeme Kodu\tMiktar\tBirim Fiyat\nURN-001\t5\t12,50'}
                  className="w-full h-48 p-2 text-[12px] font-mono rounded-sm border border-slate-300 bg-white dark:bg-slate-950 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasteOpen(false)}
                  className="px-3 h-7 text-[12px] rounded-sm border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!pasteText.trim()}
                  onClick={() => {
                    setPasteOpen(false);
                    void applyLinePaste(pasteText, null);
                  }}
                  className="px-3 h-7 text-[12px] font-semibold rounded-sm text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-50"
                >
                  Kalemlere aktar
                </button>
              </div>
            </div>
          </div>
        )}
        <div
          className={`${
            opts?.fill ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'
          } rounded-sm border border-slate-300 dark:border-slate-600`}
          onPaste={(e) => {
            if (readOnly) return;
            const text = e.clipboardData.getData('text/plain');
            // Tek hücre → normal yapıştırma; çok hücre / satır → kalemlere dağıt
            if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
            const cell = (e.target as HTMLElement).closest('[data-line-field]') as HTMLElement | null;
            e.preventDefault();
            void applyLinePaste(
              text,
              cell
                ? { row: Number(cell.dataset.lineIndex), col: Number(cell.dataset.lineCol) }
                : null,
            );
          }}
        >
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-[1]">
                <th className="w-8 px-1 py-1 text-center text-[10px] font-semibold text-slate-500 border-r border-b border-slate-300 dark:border-slate-600">#</th>
                {schema.lineFields.map((field) => {
                  const name = field.fieldName.toLowerCase();
                  const isPrice = field.fieldName === 'Price';
                  const isNum = field.fieldType === 'number';
                  const isCode =
                    name.includes('items') ||
                    name.includes('product') ||
                    name === 'code' ||
                    name.includes('taxcard');
                  const isDesc = name.includes('desc') || name.includes('aciklama');
                  const colClass = isPrice
                    ? 'min-w-[148px] w-[148px]'
                    : isNum
                      ? 'min-w-[112px] w-[112px]'
                      : isDesc
                        ? 'min-w-[180px]'
                        : isCode
                          ? 'min-w-[200px]'
                          : 'min-w-[140px]';
                  return (
                  <th
                    key={field.fieldId}
                    className={`px-1.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap border-r border-b border-slate-300 dark:border-slate-600 ${colClass}`}
                  >
                    {field.label}
                    {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                  );
                })}
                {!readOnly && <th className="w-8 px-1 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {fields.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={hasDistribution ? () => setSelectedLine(index) : undefined}
                  onFocusCapture={hasDistribution ? () => setSelectedLine(index) : undefined}
                  className={`border-b border-slate-200 dark:border-slate-700 ${
                    hasDistribution && index === activeLine
                      ? 'bg-blue-50/70 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                  } ${hasDistribution ? 'cursor-pointer' : ''}`}
                >
                  <td className="w-8 px-1 py-0.5 align-middle text-center text-[11px] text-slate-500 font-medium bg-slate-50 dark:bg-slate-800/60 border-r border-slate-200 dark:border-slate-700">
                    {index + 1}
                  </td>
                  {schema.lineFields!.map((field, colIdx) => {
                    const isPrice = field.fieldName === 'Price';
                    const isUnit = field.fieldName === 'UnitID';
                    const productId =
                      watchedLineProducts[index] ??
                      lineProductId(
                        (watchedLines?.[index] as Record<string, unknown>) || undefined,
                      );
                    // unitOptionsTick: yeni malzeme birimleri yüklenince select yenilensin
                    void unitOptionsTick;
                    const unitField =
                      isUnit
                        ? {
                            ...field,
                            optionsJson: productId
                              ? (unitByProduct[productId]?.optionsJson ??
                                unitInfoRef.current[productId]?.optionsJson ??
                                emptyProductUnits(productId).optionsJson)
                              : emptyProductUnits(0).optionsJson,
                          }
                        : field;
                    return (
                    <td
                      key={`${row.id}-${field.fieldId}`}
                      data-line-index={index}
                      data-line-col={colIdx}
                      data-line-field={field.fieldName}
                      className="px-1 py-0.5 align-middle border-r border-slate-200 dark:border-slate-700"
                    >
                      {isPrice ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <FieldRenderer
                              field={unitField}
                              register={register as UseFormRegister<FieldValues>}
                              registerNameOverride={`lines.${index}.${field.fieldName}`}
                              hideLabel
                              compact
                              disabled={readOnly}
                              error={
                                get(errors, `lines.${index}.${field.fieldName}`) as
                                  | FieldError
                                  | undefined
                              }
                            />
                          </div>
                          {!readOnly && productId ? (
                            <UnitPricePicker
                              compact
                              inline
                              productCardId={productId}
                              customerId={headerCustomerId}
                              direction={priceDirection}
                              disabled={readOnly}
                              onApply={(price) => {
                                setValue(`lines.${index}.Price`, price, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }}
                            />
                          ) : null}
                        </div>
                      ) : field.fieldName === 'Quantity' &&
                        schema.lineFields?.some((f) => f.fieldName === 'SerialLotNo') ? (
                        <div className="flex items-center gap-0.5">
                          <div className="flex-1 min-w-0">
                            <FieldRenderer
                              field={unitField}
                              register={register as UseFormRegister<FieldValues>}
                              registerNameOverride={`lines.${index}.${field.fieldName}`}
                              hideLabel
                              compact
                              disabled={readOnly || Boolean(field.isReadOnly)}
                              error={
                                get(errors, `lines.${index}.${field.fieldName}`) as
                                  | FieldError
                                  | undefined
                              }
                            />
                          </div>
                          <SerialLotLineCell
                            trigger="icon"
                            productId={productId}
                            voucherType={Number(watchedVoucherType || schema.fixedStandardFields?.VoucherType || 0)}
                            direction={
                              schema.tableName === 'Invoice'
                                ? invoiceSerialDirection(Number(watchedInvoiceType || schema.fixedStandardFields?.InvoiceType || 0))
                                : serialLotDirection(Number(watchedVoucherType || schema.fixedStandardFields?.VoucherType || 0))
                            }
                            whouseId={Number(watch('standardFields.WhouseID')) || null}
                            quantity={Number(((watchedLines?.[index] as Record<string, unknown> | undefined)?.Quantity) ?? 0)}
                            value={String(((watchedLines?.[index] as Record<string, unknown> | undefined)?.SerialLotNo) ?? '')}
                            readOnly={readOnly}
                            onChange={(v) => setValue(`lines.${index}.SerialLotNo`, v, { shouldDirty: true })}
                            onQuantity={(q) => applySerialLotQty(index, q)}
                          />
                        </div>
                      ) : field.fieldName === 'SerialLotNo' ? (
                        <SerialLotLineCell
                          trigger="text"
                          autoOpen
                          productId={productId}
                          voucherType={Number(watchedVoucherType || schema.fixedStandardFields?.VoucherType || 0)}
                          direction={
                            schema.tableName === 'Invoice'
                              ? invoiceSerialDirection(Number(watchedInvoiceType || schema.fixedStandardFields?.InvoiceType || 0))
                              : serialLotDirection(Number(watchedVoucherType || schema.fixedStandardFields?.VoucherType || 0))
                          }
                          whouseId={Number(watch('standardFields.WhouseID')) || null}
                          quantity={Number(((watchedLines?.[index] as Record<string, unknown> | undefined)?.Quantity) ?? 0)}
                          value={String(((watchedLines?.[index] as Record<string, unknown> | undefined)?.SerialLotNo) ?? '')}
                          readOnly={readOnly}
                          onChange={(v) => setValue(`lines.${index}.SerialLotNo`, v, { shouldDirty: true })}
                          onQuantity={(q) => applySerialLotQty(index, q)}
                        />
                      ) : (
                        <FieldRenderer
                          field={unitField}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`lines.${index}.${field.fieldName}`}
                          hideLabel
                          compact
                          disabled={readOnly || Boolean(field.isReadOnly) || (isUnit && !productId)}
                          error={
                            get(errors, `lines.${index}.${field.fieldName}`) as
                              | FieldError
                              | undefined
                          }
                        />
                      )}
                    </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="w-8 px-0.5 py-1 align-middle text-center">
                      <button
                        type="button"
                        title="Satırı çıkar"
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : null;

  const renderBalanceBar = () => {
    const bal = schema.balanceFields;
    if (!bal) return null;
    const rows = watchedLines || [];
    const d = rows.reduce((a, r) => a + toCents(r?.[bal.debit]), 0);
    const c = rows.reduce((a, r) => a + toCents(r?.[bal.credit]), 0);
    const diff = d - c;
    const ok = diff === 0 && d > 0;
    return (
      <div
        className={`flex flex-wrap items-center justify-end gap-x-5 gap-y-1 rounded-md border px-3 py-1.5 text-[12px] shrink-0 ${
          ok
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
        }`}
      >
        <span className="text-slate-600">
          Borç <b className="tabular-nums text-slate-900 dark:text-white">{formatTrNumber(d / 100)}</b>
        </span>
        <span className="text-slate-600">
          Alacak <b className="tabular-nums text-slate-900 dark:text-white">{formatTrNumber(c / 100)}</b>
        </span>
        <span className={ok ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
          {ok
            ? 'Fiş dengede'
            : `Fark ${formatTrNumber(Math.abs(diff) / 100)} ${diff > 0 ? '(alacak eksik)' : diff < 0 ? '(borç eksik)' : ''}`}
        </span>
      </div>
    );
  };

  const renderDistributionPanel = (embedded = false) => {
    if (!hasDistribution || fields.length === 0) return null;
    const line = (watchedLines?.[activeLine] as Record<string, unknown>) || {};
    const caption = [line.Description].filter((v) => String(v ?? '').trim()).join(' · ');
    return (
      <LineDistributionPanel
        key={fields[activeLine]?.id ?? activeLine}
        lineIndex={activeLine}
        fields={schema.lineDistributionFields!}
        amountFields={schema.lineDistributionAmountFields ?? ['Amount']}
        control={control as Control<FieldValues>}
        register={register as UseFormRegister<FieldValues>}
        setValue={setValue}
        watch={watch}
        readOnly={readOnly}
        lineCaption={caption || undefined}
        embedded={embedded}
      />
    );
  };

  const renderELedgerTab = () => {
    const sf = (watch('standardFields') as Record<string, unknown>) || {};
    const debit = roundMoney(sumLineField(watchedLines || [], 'Debit'));
    const credit = roundMoney(sumLineField(watchedLines || [], 'Credit'));
    const docType = String(sf.EDocumentType ?? '').trim();
    const excluded = sf.ELedgerExclude === true || sf.ELedgerExclude === 'true' || sf.ELedgerExclude === 1;
    const warnings: string[] = [];
    if (!excluded) {
      if (!String(sf.journalNO ?? '').trim()) warnings.push('Yevmiye no verilmemiş');
      if (!docType) warnings.push('Belge türü seçilmemiş');
      if (docType === 'other' && !String(sf.EDocumentTypeDesc ?? '').trim())
        warnings.push('«Diğer» belge türü için açıklama zorunlu');
      if (docType && !String(sf.EDocumentNumber ?? '').trim()) warnings.push('Belge no boş');
      if (docType && !String(sf.EDocumentDate ?? '').trim()) warnings.push('Belge tarihi boş');
      if (Math.abs(debit - credit) > 0.009) warnings.push('Borç ve alacak toplamı eşit değil');
    }
    const info: [string, string][] = [
      ['Yevmiye No', String(sf.journalNO ?? '').trim() || '—'],
      ['Yevmiye Tarihi', String(sf.VoucherDate ?? '').slice(0, 10).split('-').reverse().join('.') || '—'],
      ['Saat', String(sf.VoucherTime ?? '').slice(0, 5) || '—'],
      ['Borç Toplamı', formatTrNumber(debit)],
      ['Alacak Toplamı', formatTrNumber(credit)],
    ];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] text-slate-400">
            e-Defter yevmiye kaydına (XBRL-GL) aktarılacak belge bilgileri — her yevmiye maddesi için belge türü, no ve tarihi.
          </p>
          {renderGrid(eLedgerFields)}
        </div>
        <aside className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">e-Defter Özeti</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            {info.map(([k, v]) => (
              <React.Fragment key={k}>
                <div className="text-slate-500">{k}</div>
                <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{v}</div>
              </React.Fragment>
            ))}
          </div>
          <div className="border-t border-slate-200 dark:border-slate-600 pt-2 text-[11px]">
            {excluded ? (
              <span className="text-slate-500">Bu fiş e-Deftere gönderilmeyecek.</span>
            ) : warnings.length === 0 ? (
              <span className="text-emerald-600 font-medium">e-Defter için hazır</span>
            ) : (
              <ul className="space-y-0.5 text-amber-700">
                {warnings.map((w) => (
                  <li key={w}>• {w}</li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    );
  };

  const sumDiscount = lineMoney?.discount ?? sumLineField(watchedLines || [], 'TotalDiscount');
  const sumTax = lineMoney?.tax ?? sumLineField(watchedLines || [], 'TotalTax');
  const sumLineTotal = lineMoney?.total ?? sumLineField(watchedLines || [], 'TotalPrice');
  const sumQty = lineMoney?.qty ?? sumLineField(watchedLines || [], 'Quantity');
  const footerNet = lineMoney?.net ?? roundMoney(sumLineTotal + sumTax);

  const currencyChoices = React.useMemo(() => {
    const local = CURRENCIES.find((c) => c.isLocal);
    const eur = CURRENCIES.find((c) => c.code === 'EUR');
    const usd = CURRENCIES.find((c) => c.code === 'USD');
    return [local, usd, eur].filter(Boolean) as typeof CURRENCIES;
  }, []);

  const detailCurrencyTotals = React.useMemo(() => {
    const docCur = getCurrency(watchedCurrency as string) ?? CURRENCIES.find((c) => c.isLocal);
    const formRate = parseLineNum(watchedCurrencyRate);
    const rate =
      formRate > 0 ? formRate : getCurrencyRate(watchedCurrency as string) || 1;
    const inLocal = !docCur || docCur.isLocal ? sumLineTotal : roundMoney(sumLineTotal * rate);
    return currencyChoices.map((c) => {
      const value = c.isLocal
        ? inLocal
        : c.rate > 0
          ? roundMoney(inLocal / c.rate)
          : 0;
      const isDoc =
        docCur != null && (c.id === docCur.id || c.code === docCur.code);
      return {
        code: c.isLocal ? 'TL' : c.code,
        label: c.isLocal ? 'Yerel (TL)' : `${c.code}`,
        value,
        isDoc,
      };
    });
  }, [currencyChoices, sumLineTotal, watchedCurrency, watchedCurrencyRate]);

  const effectiveDetailTabs = tradeLayout
    ? [
        { id: 'detaylar', label: 'Detaylar' },
        { id: 'detaylar-toplam', label: 'Detaylar Toplam' },
        ...(showCustomTab ? [{ id: 'detaylar2', label: 'Detaylar II', count: custom.length }] : []),
        ...(hasDistribution
          ? [
              {
                id: 'masraf-dagitim',
                label: 'Masraf Dağıtımı',
                count:
                  (watchedLines || []).reduce(
                    (a, r) =>
                      a +
                      (((r?.distributions as Record<string, unknown>[] | undefined) || []).filter(
                        isFilledDistribution,
                      ).length),
                    0,
                  ) || undefined,
              },
            ]
          : []),
        ...(hasELedger ? [{ id: 'e-defter', label: 'e-Defter' }] : []),
        ...(showPaymentPlan
          ? [
              {
                id: 'odeme-planı',
                label: 'Ödeme Planı',
                count: paymentFields.length || undefined,
              },
            ]
          : []),
        ...(hasAuxilCodes
          ? [{ id: 'ozel-kodlar', label: 'Özel Kodlar', count: auxilCodeRows.length || undefined }]
          : []),
      ]
    : [];

  const docDueDateDefault = () => {
    const sf = (watch('standardFields') as Record<string, unknown>) || {};
    const d = String(
      sf.InvoiceDate || sf.VoucherDate || sf.OrderDate || sf.TransDate || sf.DocumentDate || '',
    ).trim();
    if (d) return d.slice(0, 10);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const applySinglePayment = () => {
    const amount = roundMoney(footerNet > 0 ? footerNet : sumLineTotal);
    replacePayment([
      {
        LineNo: 1,
        DueDate: docDueDateDefault(),
        Amount: amount,
        RatePercent: 100,
        Description: 'Tek seferde ödeme',
      },
    ]);
  };

  const addPaymentRow = () => {
    const n = paymentFields.length + 1;
    appendPayment({
      LineNo: n,
      DueDate: docDueDateDefault(),
      Amount: '',
      RatePercent: '',
      Description: '',
    });
  };

  const classicTabs = [
    { id: 'belge', label: 'Belge', count: hasLines ? fields.length : undefined },
    ...(showCustomTab ? [{ id: 'ozel', label: 'Ek Alanlar', count: custom.length }] : []),
    ...(hasAuxilCodes
      ? [{ id: 'ozel-kodlar', label: 'Özel Kodlar', count: auxilCodeRows.length }]
      : []),
  ];

  const saveBar = !readOnly ? (
    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
      {submitError && (
        <span className="text-[12px] font-medium text-red-600">{submitError}</span>
      )}
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
  ) : (
    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-right shrink-0">
      İnceleme modu — değişiklik yapılamaz
    </div>
  );

  return (
    <FormFieldContext.Provider value={{ setValue, watch }}>
      <div
        className={`w-full max-w-none mx-auto p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm ${
          tradeLayout ? 'min-h-[calc(100vh-5rem)] flex flex-col' : ''
        }`}
      >
        <div className="mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800 flex items-baseline justify-between gap-2 shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              {schema.title}
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {schema.tableName}
              {schema.fixedStandardFields &&
                Object.entries(schema.fixedStandardFields).map(([k, v]) => (
                  <span key={k}>
                    {' '}
                    · {k}={String(v)}
                  </span>
                ))}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className={tradeLayout ? 'flex-1 flex flex-col gap-3 min-h-0' : 'space-y-3'}
        >
          {tradeLayout && tradeParts ? (
            <>
              {/* 1) Başlık — 3 sütun: Sol belge (no/tarih/durum/yetki) · Orta cari/adres/ödeme planı/fiş tipi · Sağ firma/işyeri/ambar/bölüm */}
              <FieldLayoutContext.Provider value="inline">
              <InlineColsContext.Provider value={3}>
              <section className="rounded-sm border border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-800/30 px-3 py-2 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-[5px] max-w-[1320px]">
                  {/* Sol: Fiş No → Tarih → Durum → Yetki */}
                  <div className="space-y-[5px] min-w-0">
                    {tradeParts.headerDocNumber.map((f) =>
                      renderTradeField(f, { endAction: numberAllocateBtn }),
                    )}
                    {tradeParts.headerDocDate.map((f) => renderTradeField(f))}
                    {tradeParts.headerStatus.map((f) => renderTradeField(f))}
                    {!authBesideJournal && tradeParts.headerAuth.map((f) => renderTradeField(f))}
                    {numberHint && (
                      <p className="text-[10px] text-slate-500 leading-snug pl-[132px]">{numberHint}</p>
                    )}
                  </div>

                  {/* Orta: Cari → Adres (varsayılan otomatik) → Ödeme planı → Fiş tipi / banka hesabı / çek… */}
                  <div className="space-y-[5px] min-w-0">
                    {tradeParts.headerParty.map((f) => renderTradeField(f))}
                    {tradeParts.headerPaymentTemplate.map((f) => renderTradeField(f))}
                    {renderDocMeta(tradeParts.headerDocMeta, tradeParts.headerAuth)}
                  </div>

                  {/* Sağ: Firma → İşyeri → Ambar (→ Hedef) → Bölüm / Birim — en fazla 4 satır */}
                  <div className="space-y-[5px] min-w-0">
                    {(() => {
                      const main = tradeParts.headerOrgMain;
                      const side = tradeParts.headerOrgSide;
                      const rows: React.ReactNode[] = [];
                      const whouse = main.filter((f) => f.fieldName === 'WhouseID' || f.fieldName === 'AimWhouseID');
                      const pairWhouse = whouse.length === 2 && main.length + (side.length > 1 ? 1 : side.length) > 4;
                      for (const f of main) {
                        if (pairWhouse && whouse.includes(f)) {
                          if (f === whouse[0]) rows.push(renderTradePair(whouse));
                        } else rows.push(renderTradeField(f));
                      }
                      if (side.length > 1 && rows.length + side.length > 4) rows.push(renderTradePair(side));
                      else side.forEach((f) => rows.push(renderTradeField(f)));
                      return rows;
                    })()}
                  </div>
                </div>
              </section>
              </InlineColsContext.Provider>
              </FieldLayoutContext.Provider>

              {/* 2) Satırlar — ortadaki boşluğu doldurur */}
              {renderLinesTable({ fill: true })}
              {renderBalanceBar()}

              {/* 3) Detay sekmeleri — para birimi/toplam sadece Detaylar'da */}
              <section className="space-y-2 shrink-0 mt-auto">
                {effectiveDetailTabs.length > 0 && (
                  <FormTabs
                    tabs={effectiveDetailTabs}
                    active={detailTab}
                    onChange={setDetailTab}
                    variant="folder"
                    size="sm"
                  />
                )}
                <div
                  className={`border border-slate-300 dark:border-slate-600 p-2.5 space-y-3 ${
                    effectiveDetailTabs.length > 0 ? '-mt-2 border-t-0 rounded-b-[4px]' : 'rounded-sm'
                  }`}
                >
                  {detailTab === 'detaylar' && (
                    <>
                      {tradeParts.detail.length > 0 ? renderGrid(tradeParts.detail) : null}
                      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
                        <div
                          className={`grid grid-cols-1 gap-4 ${
                            hasMaterialLineTotals ? 'lg:grid-cols-2' : ''
                          }`}
                        >
                          <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Kullanılacak Para Birimi
                            </h3>
                            <div className="flex flex-wrap gap-3">
                              {currencyChoices.map((c) => {
                                const checked =
                                  String(watchedCurrency || LOCAL_CURRENCY_ID) === c.id ||
                                  String(watchedCurrency || '') === c.code;
                                return (
                                  <label
                                    key={c.id}
                                    className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 dark:text-slate-200 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name="trade-currency"
                                      className="accent-blue-600"
                                      disabled={readOnly}
                                      checked={checked}
                                      onChange={() => {
                                        setValue('standardFields.Currency', c.id, {
                                          shouldDirty: true,
                                        });
                                        setValue(
                                          'standardFields.CurrencyRate',
                                          getCurrencyRate(c.id),
                                          { shouldDirty: true },
                                        );
                                      }}
                                    />
                                    {c.isLocal ? 'Yerel Para Birimi (TL)' : c.code}
                                  </label>
                                );
                              })}
                            </div>
                            {tradeParts.currency
                              .filter((f) => f.fieldName === 'CurrencyRate')
                              .map((f) => (
                                <div key={f.fieldId} className="max-w-[160px]">
                                  {renderGrid([{ ...f, colSpan: 12, label: 'Kur' }])}
                                </div>
                              ))}
                          </div>

                          {hasMaterialLineTotals ? (
                            <div>
                              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                                Toplam
                              </h3>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                                <div className="text-slate-500">Toplam İndirim</div>
                                <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                  {formatTrNumber(sumDiscount)}
                                </div>
                                <div className="text-slate-500">Toplam</div>
                                <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                  {formatTrNumber(sumLineTotal)}
                                </div>
                                <div className="text-slate-500">Toplam KDV</div>
                                <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                  {formatTrNumber(sumTax)}
                                </div>
                                <div className="text-slate-700 font-semibold border-t border-slate-200 dark:border-slate-600 pt-1.5">
                                  Net
                                </div>
                                <div className="text-right font-bold tabular-nums text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-600 pt-1.5 text-[14px]">
                                  {formatTrNumber(footerNet)}
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                  {detailTab === 'detaylar-toplam' && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
                      <div className="min-w-0">
                        {tradeParts.detailTotal.length > 0
                          ? renderGrid(
                              tradeParts.detailTotal.map((f) => ({ ...f, colSpan: 12 })),
                            )
                          : null}
                      </div>
                      <aside className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2.5">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Detay Toplam
                        </h3>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                          <div className="text-slate-500">Satır</div>
                          <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                            {fields.length}
                          </div>
                          {schema.balanceFields ? (
                            <>
                              <div className="text-slate-500">Toplam Borç</div>
                              <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                {formatTrNumber(
                                  (watchedLines || []).reduce((a, r) => a + toCents(r?.[schema.balanceFields!.debit]), 0) / 100,
                                )}
                              </div>
                              <div className="text-slate-500">Toplam Alacak</div>
                              <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                {formatTrNumber(
                                  (watchedLines || []).reduce((a, r) => a + toCents(r?.[schema.balanceFields!.credit]), 0) / 100,
                                )}
                              </div>
                            </>
                          ) : hasMaterialLineTotals ? (
                            <>
                              <div className="text-slate-500">Miktar Toplamı</div>
                              <div className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                {formatTrNumber(sumQty, 3)}
                              </div>
                            </>
                          ) : null}
                        </div>
                        {hasMaterialLineTotals && (
                        <div className="border-t border-slate-200 dark:border-slate-600 pt-2 space-y-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                            Para Birimi Toplamları
                          </div>
                          {detailCurrencyTotals.map((row) => (
                            <div
                              key={row.code}
                              className={`flex items-baseline justify-between gap-2 text-[12px] ${
                                row.isDoc
                                  ? 'font-semibold text-slate-900 dark:text-white'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>
                                {row.label}
                                {row.isDoc ? (
                                  <span className="ml-1 text-[9px] font-medium text-blue-600">
                                    işlem
                                  </span>
                                ) : null}
                              </span>
                              <span className="tabular-nums">{formatTrNumber(row.value)}</span>
                            </div>
                          ))}
                        </div>
                        )}
                        {hasMaterialLineTotals && (sumDiscount > 0 || sumTax > 0) && (
                          <div className="border-t border-slate-200 dark:border-slate-600 pt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                            {sumDiscount > 0 && (
                              <>
                                <div className="text-slate-500">İskonto</div>
                                <div className="text-right tabular-nums font-medium">
                                  {formatTrNumber(sumDiscount)}
                                </div>
                              </>
                            )}
                            {sumTax > 0 && (
                              <>
                                <div className="text-slate-500">KDV</div>
                                <div className="text-right tabular-nums font-medium">
                                  {formatTrNumber(sumTax)}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </aside>
                    </div>
                  )}
                  {detailTab === 'detaylar2' && showCustomTab && renderGrid(custom, true)}
                  {detailTab === 'masraf-dagitim' && hasDistribution && renderDistributionPanel(true)}
                  {detailTab === 'e-defter' && hasELedger && renderELedgerTab()}
                  {detailTab === 'odeme-planı' && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                            Ödeme Planı
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Tek seferde veya birden fazla vadede tutar girin
                          </p>
                        </div>
                        {!readOnly && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={applySinglePayment}
                              className="inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md"
                            >
                              Tek seferde
                            </button>
                            <button
                              type="button"
                              onClick={addPaymentRow}
                              className="inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Satır Ekle
                            </button>
                          </div>
                        )}
                      </div>

                      {tradeParts.headerPaymentTemplate.length > 0 && (
                        <p className="text-[10px] text-slate-400">
                          Ödeme planı şablonu başlıkta seçilir — satırları aşağıda elle düzenleyebilirsiniz.
                        </p>
                      )}

                      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                        <table className="w-full min-w-[520px] border-collapse text-left">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                              <th className="w-8 px-1 py-1.5 text-center text-[10px] font-semibold text-slate-500">
                                #
                              </th>
                              <th className="px-1.5 py-1.5 text-[11px] font-semibold text-slate-600 w-[130px]">
                                Vade Tarihi
                              </th>
                              <th className="px-1.5 py-1.5 text-[11px] font-semibold text-slate-600 w-[110px]">
                                Tutar
                              </th>
                              <th className="px-1.5 py-1.5 text-[11px] font-semibold text-slate-600 w-[80px]">
                                Oran %
                              </th>
                              <th className="px-1.5 py-1.5 text-[11px] font-semibold text-slate-600">
                                Açıklama
                              </th>
                              {!readOnly && <th className="w-8 px-1 py-1.5" />}
                            </tr>
                          </thead>
                          <tbody>
                            {paymentFields.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={readOnly ? 5 : 6}
                                  className="px-3 py-4 text-[11px] text-slate-400 text-center"
                                >
                                  Henüz satır yok. «Tek seferde» veya «Satır Ekle» ile başlayın.
                                </td>
                              </tr>
                            ) : (
                              paymentFields.map((row, index) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                                >
                                  <td className="w-8 px-1 py-1 text-center text-[11px] text-slate-400">
                                    {index + 1}
                                  </td>
                                  <td className="px-1 py-1">
                                    <DateField
                                      label="Vade Tarihi"
                                      registerName={`paymentPlans.${index}.DueDate`}
                                      register={register}
                                      setValue={setValue}
                                      watch={watch}
                                      disabled={readOnly}
                                      placeholder={getSystemDatePlaceholder()}
                                      inputClassName="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                    />
                                  </td>
                                  <td className="px-1 py-1">
                                    {(() => {
                                      const reg = register(`paymentPlans.${index}.Amount`, {
                                        valueAsNumber: true,
                                        min: { value: 0, message: 'Negatif olamaz' },
                                      });
                                      const nm = attachNoMinusHandlers({
                                        onChange: reg.onChange as never,
                                      });
                                      return (
                                        <input
                                          type="number"
                                          step="any"
                                          min={0}
                                          inputMode="decimal"
                                          disabled={readOnly}
                                          placeholder="Tutar"
                                          className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 tabular-nums"
                                          {...reg}
                                          {...nm}
                                        />
                                      );
                                    })()}
                                  </td>
                                  <td className="px-1 py-1">
                                    {(() => {
                                      const reg = register(`paymentPlans.${index}.RatePercent`, {
                                        valueAsNumber: true,
                                        min: { value: 0, message: 'Negatif olamaz' },
                                      });
                                      const nm = attachNoMinusHandlers({
                                        onChange: reg.onChange as never,
                                      });
                                      return (
                                        <input
                                          type="number"
                                          step="any"
                                          min={0}
                                          inputMode="decimal"
                                          disabled={readOnly}
                                          placeholder="%"
                                          className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 tabular-nums"
                                          {...reg}
                                          {...nm}
                                        />
                                      );
                                    })()}
                                  </td>
                                  <td className="px-1 py-1">
                                    {(() => {
                                      const reg = register(`paymentPlans.${index}.Description`);
                                      const nm = attachNoMinusHandlers({
                                        onChange: reg.onChange as never,
                                      });
                                      return (
                                        <input
                                          type="text"
                                          disabled={readOnly}
                                          placeholder="Açıklama"
                                          className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                          {...reg}
                                          {...nm}
                                        />
                                      );
                                    })()}
                                  </td>
                                  {!readOnly && (
                                    <td className="w-8 px-0.5 py-1 text-center">
                                      <button
                                        type="button"
                                        title="Satırı çıkar"
                                        onClick={() => removePayment(index)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-red-600 hover:bg-red-50"
                                      >
                                        <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] px-0.5">
                        <span className="text-slate-500">
                          {paymentFields.length} vade · Belge net {formatTrNumber(footerNet)}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          Plan toplamı: {formatTrNumber(paymentTotal)}
                          {footerNet > 0 && Math.abs(paymentTotal - footerNet) > 0.05 ? (
                            <span className="ml-2 text-[11px] font-medium text-amber-600">
                              (fark {formatTrNumber(paymentTotal - footerNet)})
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  )}
                  {detailTab === 'ozel-kodlar' && hasAuxilCodes && (
                    <AuxilCodeAssignmentEditor
                      targetTable={schema.tableName}
                      control={control as Control<FieldValues>}
                      register={register as UseFormRegister<FieldValues>}
                      setValue={setValue}
                      watch={watch}
                      readOnly={readOnly}
                      compact
                    />
                  )}
                </div>
                {/* Döviz değeri her sekmede formda kalsın */}
                {tradeParts.currency
                  .filter((f) => f.fieldName === 'Currency')
                  .map((f) => (
                    <input key={f.fieldId} type="hidden" {...register('standardFields.Currency')} />
                  ))}
              </section>

              {/* Y-17: faturada satırların düştüğü bütçelerin kullanım çubuğu — ekranın altında */}
              {(schema.tableName || '').toLowerCase() === 'invoice' && (
                <BudgetBar
                  invoiceType={watchedInvoiceType}
                  date={watch('standardFields.InvoiceDate')}
                  lines={watchedLines}
                  invoiceId={initialData?.recordId}
                />
              )}
              {/* E-03: kayıtlı satış / iade faturasında e-belge önizleme ve gönderim */}
              {(schema.tableName || '').toLowerCase() === 'invoice' && (
                <EGovSendPanel invoiceId={initialData?.recordId} invoiceType={watchedInvoiceType} />
              )}

              {saveBar}
            </>
          ) : (
            <>
              {classicTabs.length > 1 ? (
                <FormTabs tabs={classicTabs} active={tab} onChange={setTab} />
              ) : null}

              {tab === 'ozel' && showCustomTab ? (
                renderGrid(custom, true)
              ) : tab === 'ozel-kodlar' && hasAuxilCodes ? (
                <AuxilCodeAssignmentEditor
                  targetTable={schema.tableName}
                  control={control as Control<FieldValues>}
                  register={register as UseFormRegister<FieldValues>}
                  setValue={setValue}
                  watch={watch}
                  readOnly={readOnly}
                />
              ) : (
                <>
                  <section className="space-y-1.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Başlık
                    </h3>
                    {renderGrid(general, false)}
                  </section>
                  {renderLinesTable()}
                  {renderBalanceBar()}
                  {renderDistributionPanel()}
                  {hasLines && (
                    <section className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2.5">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Dip Toplamlar
                          </h3>
                          <p className="text-[11px] text-slate-400 mt-0.5">{fields.length} satır</p>
                        </div>
                        <div className="flex flex-wrap items-end gap-x-5 gap-y-1 justify-end">
                          {lineTotals.length > 0 ? (
                            lineTotals.map((t) => (
                              <div key={t.fieldName} className="text-right min-w-[88px]">
                                <div className="text-[10px] font-medium text-slate-500">{t.label}</div>
                                <div className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                  {formatTrNumber(t.value)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-right min-w-[88px]">
                              <div className="text-[10px] font-medium text-slate-500">Genel Toplam</div>
                              <div className="text-[13px] font-semibold tabular-nums">
                                {formatTrNumber(0)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}
              {saveBar}
            </>
          )}
        </form>
      </div>
    </FormFieldContext.Provider>
  );
};
