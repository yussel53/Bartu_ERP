import React from 'react';
import {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldValues,
} from 'react-hook-form';
import { Info, MoreHorizontal } from 'lucide-react';
import { LookupModal, LookupOption } from './LookupModal';
import { QuickCreateModal, useLookupCreateDepth } from './QuickCreateModal';
import {
  DEPENDENT_LOOKUPS,
  loadDependentLookupOptions,
  loadLookupOptions,
  lookupSourceForField,
  reloadLookupOptions,
  resolveLookupOption,
  type DependentLookupDef,
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
  /** Şemadan gelen bağlı lookup (masraf boyutları) */
  dependentLookup?: DependentLookupDef;
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
  dependentLookup,
}) => {
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [cardOpen, setCardOpen] = React.useState(false);
  const [options, setOptions] = React.useState<LookupOption[]>(optionsProp);
  const createDepth = useLookupCreateDepth();

  /** Bağlı liste: üst alan (örn. Cari) aynı satırda / başlıkta — `standardFields.CustomerID`, `lines.3.CustomerID` */
  const dep =
    dependentLookup || (fieldName ? DEPENDENT_LOOKUPS[fieldName] : undefined);
  const parentName = dep ? registerName.replace(/[^.]+$/, dep.parentField) : '';
  const parentRaw = dep && watch ? watch(parentName) : undefined;
  const parentId = parentRaw == null || parentRaw === '' ? '' : String(parentRaw);

  React.useEffect(() => {
    if (dep) return;
    // optionsProp her render’da yeni dizi olabilir — seçili Code etiketini silme
    setOptions((prev) => {
      const byVal = new Map(optionsProp.map((o) => [o.value, o]));
      for (const o of prev) {
        if (byVal.has(o.value)) continue;
        const bare = !o.label || o.label === o.value || /^#?\d+$/.test(o.label.trim());
        if (!bare) byVal.set(o.value, o);
      }
      return Array.from(byVal.values());
    });
  }, [optionsProp, dep]);

  React.useEffect(() => {
    if (!dep) return;
    if (!parentId || parentId === '0') {
      setOptions([]);
      return;
    }
    let cancelled = false;
    void loadDependentLookupOptions(fieldName!, parentId, dependentLookup).then((next) => {
      if (!cancelled) setOptions(next);
    });
    return () => {
      cancelled = true;
    };
  }, [dep, parentId, fieldName, dependentLookup]);

  const raw = watch ? watch(registerName) : undefined;
  const value = raw == null || raw === '' ? '' : String(raw);
  // Süzülmüş listede yoksa (yüklenirken / eski kayıt) etiketi tam listeden göster
  const selected = options.find((o) => o.value === value) ?? optionsProp.find((o) => o.value === value);
  const display = selected?.label ?? (value ? value : '');

  const src = fieldName ? lookupSourceForField(fieldName) : null;

  /** Üst hesap (120.01→120): seçili ID yalnız sayıysa Code — Ad getir */
  React.useEffect(() => {
    if (!fieldName || !src || !value || value === '0') return;
    const lbl = selected?.label?.trim() ?? '';
    const looksLikeBareId = !lbl || lbl === value || /^#?\d+$/.test(lbl);
    if (!looksLikeBareId) return;
    let cancelled = false;
    void (async () => {
      const cached = await loadLookupOptions(fieldName);
      const hit = cached?.find((o) => o.value === value);
      if (cancelled) return;
      if (hit?.label && hit.label !== value && !/^#?\d+$/.test(hit.label.trim())) {
        setOptions((prev) => [hit, ...prev.filter((p) => p.value !== hit.value)]);
        return;
      }
      const opt = await resolveLookupOption(fieldName, value);
      if (cancelled || !opt) return;
      setOptions((prev) => [opt, ...prev.filter((p) => p.value !== opt.value)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldName, src, value, selected?.label]);
  const canCreate =
    !disabled &&
    Boolean(src?.createFormCode) &&
    createDepth < 2;
  /** SAP altın ok benzeri: seçili kartı (i) ile aç */
  const canOpenCard =
    Boolean(src?.createFormCode) &&
    Boolean(value) &&
    value !== '0' &&
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
        {canOpenCard && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCardOpen(true);
            }}
            title={`${label} kartını aç`}
            aria-label={`${label} kartını aç`}
            className={`shrink-0 ${inputClassName.includes('h-7') ? 'w-7 h-7' : 'w-8 h-8'} inline-flex items-center justify-center rounded border text-sky-700
              bg-sky-50 hover:bg-sky-100 border-sky-200 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 dark:border-sky-800 dark:text-sky-300`}
          >
            <Info className="w-3.5 h-3.5" strokeWidth={2.25} />
          </button>
        )}
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

      {cardOpen && src?.createFormCode && value && (
        <QuickCreateModal
          formCode={src.createFormCode}
          title={src.createTitle?.replace(/^Yeni\s+/i, '') || label}
          mode="edit"
          recordId={value}
          onClose={() => setCardOpen(false)}
          onSaved={async (info) => {
            if (!fieldName) return;
            try {
              const next = await reloadLookupOptions(fieldName);
              setOptions(next);
              const found = next.find((o) => o.value === String(info.recordId));
              if (found) {
                /* etiket güncellendi — değer aynı */
              }
            } catch {
              /* ignore */
            }
          }}
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
  'CostDimID',
  'CostDimCardID',
  'LinkedCostDimCardID',
  'CostDimCardID1',
  'CostDimCardID2',
  'CostDimCardID3',
  'CostDimCardID4',
  'CostDimCardID5',
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
