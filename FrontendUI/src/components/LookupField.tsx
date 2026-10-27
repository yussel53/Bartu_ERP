import React from 'react';
import {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldValues,
} from 'react-hook-form';
import { MoreHorizontal } from 'lucide-react';
import { LookupModal, LookupOption } from './LookupModal';
import { QuickCreateModal, useLookupCreateDepth } from './QuickCreateModal';
import {
  DEPENDENT_LOOKUPS,
  loadDependentLookupOptions,
  lookupSourceForField,
  reloadLookupOptions,
} from '../api/lookupApi';

interface LookupFieldProps {
  label: string;
  registerName: string;
  /** Şema alan adı (CustomerID, AccountID…) — yeni ekle eşlemesi için */
  fieldName?: string;
  options: LookupOption[];
  register: UseFormRegister<FieldValues>;
  setValue?: UseFormSetValue<FieldValues>;
  watch?: UseFormWatch<FieldValues>;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
}

/**
 * ERP tarzı seçim: salt okunur metin + «…» ile listeden seçim.
 * Değer formda ID olarak tutulur; ekranda etiket gösterilir.
 * Desteklenen kartlarda listeden «Yeni ekle» ile gömülü form açılır.
 */
export const LookupField: React.FC<LookupFieldProps> = ({
  label,
  registerName,
  fieldName,
  options: optionsProp,
  register,
  setValue,
  watch,
  required = false,
  disabled = false,
  placeholder,
  inputClassName = '',
}) => {
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [options, setOptions] = React.useState<LookupOption[]>(optionsProp);
  const createDepth = useLookupCreateDepth();

  /** Bağlı liste: üst alan (örn. Cari) aynı satırda / başlıkta — `standardFields.CustomerID`, `lines.3.CustomerID` */
  const dep = fieldName ? DEPENDENT_LOOKUPS[fieldName] : undefined;
  const parentName = dep ? registerName.replace(/[^.]+$/, dep.parentField) : '';
  const parentRaw = dep && watch ? watch(parentName) : undefined;
  const parentId = parentRaw == null || parentRaw === '' ? '' : String(parentRaw);

  React.useEffect(() => {
    if (!dep) setOptions(optionsProp);
  }, [optionsProp, dep]);

  React.useEffect(() => {
    if (!dep) return;
    if (!parentId || parentId === '0') {
      setOptions([]);
      return;
    }
    let cancelled = false;
    void loadDependentLookupOptions(fieldName!, parentId).then((next) => {
      if (!cancelled) setOptions(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dep, parentId, fieldName]);

  const raw = watch ? watch(registerName) : undefined;
  const value = raw == null || raw === '' ? '' : String(raw);
  // Süzülmüş listede yoksa (yüklenirken / eski kayıt) etiketi tam listeden göster
  const selected = options.find((o) => o.value === value) ?? optionsProp.find((o) => o.value === value);
  const display = selected?.label ?? (value ? value : '');

  const src = fieldName ? lookupSourceForField(fieldName) : null;
  const canCreate =
    !disabled &&
    Boolean(src?.createFormCode) &&
    createDepth < 2;

  const openPicker = () => {
    if (disabled) return;
    setOpen(true);
    // Malzeme stok / cari bakiye güncel gelsin
    if (fieldName && (src?.productStats || src?.customerStats)) {
      void reloadLookupOptions(fieldName).then((next) => {
        if (next.length) setOptions(next);
      });
    }
  };

  const applyCreated = async (info: { recordId: number; label?: string }) => {
    const id = String(info.recordId);
    let next = options;
    if (fieldName) {
      try {
        next = await reloadLookupOptions(fieldName);
        setOptions(next);
      } catch {
        /* ignore */
      }
    }
    const found = next.find((o) => o.value === id);
    const labelText =
      found?.label ||
      info.label ||
      (info.label ? info.label : `#${id}`);
    if (!found) {
      setOptions((prev) => [{ value: id, label: labelText }, ...prev.filter((p) => p.value !== id)]);
    }
    setValue?.(registerName, id, { shouldDirty: true, shouldValidate: true });
    setOpen(false);
    setCreateOpen(false);
  };

  return (
    <>
      <input
        type="hidden"
        {...register(registerName, { required: required && !disabled })}
      />
      <div className="flex items-stretch gap-0.5 w-full min-w-0">
        <input
          type="text"
          readOnly
          value={display}
          placeholder={placeholder ?? label}
          title={display || label}
          disabled={disabled}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'F4' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          className={`${inputClassName} flex-1 min-w-0 cursor-pointer`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          title={`${label} listesinden seç`}
          aria-label={`${label} seç`}
          className={`shrink-0 ${inputClassName.includes('h-7') ? 'w-7 h-7' : 'w-8 h-8'} inline-flex items-center justify-center rounded border text-slate-600
            ${
              disabled
                ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600'
            }`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <LookupModal
          title={label}
          options={options}
          value={value}
          onClose={() => setOpen(false)}
          createLabel={src?.createTitle || 'Yeni ekle'}
          emptyText={dep && !parentId ? dep.emptyText : undefined}
          onCreateNew={
            canCreate
              ? () => {
                  setOpen(false);
                  setCreateOpen(true);
                }
              : undefined
          }
          onSelect={(opt) => {
            setValue?.(registerName, opt.value, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setOpen(false);
          }}
        />
      )}

      {createOpen && src?.createFormCode && (
        <QuickCreateModal
          formCode={src.createFormCode}
          title={src.createTitle || `Yeni ${label}`}
          onClose={() => setCreateOpen(false)}
          onCreated={(info) => void applyCreated(info)}
        />
      )}
    </>
  );
};

/** Kart / belge referans alanları — tip/durum select kalır */
const LOOKUP_FIELD_NAMES = new Set([
  'CustomerID',
  'CustomerCardID',
  'ProductCardID',
  'ItemsID',
  'MainProductCardID',
  'SubProductCardID',
  'BankCardID',
  'BankAccountCardID',
  'BankAccountID',
  'AccountCardID',
  'AccountID',
  'SafeCardID',
  'BoundCardID',
  'CheckID',
  'TaxCardID',
  'TaxCalcID',
  'VariantTemplateID',
  'RiskGroupID',
  'PaidPlanCardID',
  'PaidPlanID',
  'CustomerAdressID',
  'InvoiceID',
  'SourceCardID',
  'CrossAccountID',
  'MainAccountID',
  'CostCenterID',
  'ProjectCardID',
  'AccountGroupID',
]);

/** Tip / durum / döviz vb. kısa listeler → klasik select */
const SELECT_KEEP_RE =
  /^(Type_?|VoucherType|InvoiceType|ProductType|Status_?|Currency|DefaultCurrency|UnitID|WhouseID|AimWhouseID|CompanyID|DepartmentID|WorkplaceID|OrgUnitID|Module|ModuleKey|Kind|DocKind|Direction|AdressType|EinvoiceType|TaxType|PlanType|LedgerType|ProfileId|SortOrder|AuthCode|CostGroup|CostProjectGroup|PeriodYear|PeriodMonth)$/i;

export function isLookupField(
  fieldName: string,
  fieldType: string,
  forceLookup?: boolean,
): boolean {
  if (forceLookup || fieldType === 'lookup') return true;
  if (fieldType !== 'select' && fieldType !== 'lookup') return false;
  if (SELECT_KEEP_RE.test(fieldName)) return false;
  if (LOOKUP_FIELD_NAMES.has(fieldName)) return true;
  if (/CardID$/i.test(fieldName)) return true;
  if (
    /(Customer|Product|Bank|Account|Safe|Bound|Check|Invoice|Items|Tax).*(ID)$/i.test(
      fieldName,
    ) &&
    !/Type/i.test(fieldName)
  ) {
    return true;
  }
  return false;
}
