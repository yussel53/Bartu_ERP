import React from 'react';
import {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldValues,
  FieldError,
} from 'react-hook-form';
import { FormFieldDto } from '../types/formTypes';
import { ActiveToggleField, isActiveToggleField } from './ActiveToggle';
import { LookupField, isLookupField } from './LookupField';
import { AddressSuggestField, addressSuggestLevelForField } from './AddressSuggestField';
import { DateField } from './DateField';
import { FieldLayoutContext, useFormFieldContext } from './FormFieldContext';
import { attachNoMinusHandlers } from '../utils/noMinusInput';
import { getSystemDatePlaceholder } from '../utils/dateFormat';

interface FieldRendererProps {
  field: FormFieldDto;
  register: UseFormRegister<FieldValues>;
  error?: FieldError;
  registerNameOverride?: string;
  compact?: boolean;
  /** Tablo hücresi: etiket yok, sadece input */
  hideLabel?: boolean;
  disabled?: boolean;
  /**
   * true (varsayılan): etiket ayrı satırda değil, watermark / placeholder olarak alanda
   * hideLabel=true ise zaten etiket yok
   */
  watermark?: boolean;
  /** Lookup (… seçim) — yoksa FormFieldContext kullanılır */
  setValue?: UseFormSetValue<FieldValues>;
  watch?: UseFormWatch<FieldValues>;
  /** Metin alanının sağında ikon / buton (örn. numara al) */
  endAction?: React.ReactNode;
}

const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

interface SelectOption {
  label: string;
  value: string;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  register,
  error,
  registerNameOverride,
  compact = false,
  hideLabel = false,
  disabled = false,
  watermark = true,
  setValue,
  watch,
  endAction,
}) => {
  const formCtx = useFormFieldContext();
  /** Kurumsal görünüm: etiket solda (InlineFieldGrid içinde, tablo hücresi değilse) */
  const inline = React.useContext(FieldLayoutContext) === 'inline' && !hideLabel;
  const setValueFn = setValue ?? formCtx?.setValue;
  const watchFn = watch ?? formCtx?.watch;
  const isUdf = field.fieldName.startsWith('U_');
  const registerName =
    registerNameOverride ??
    (isUdf ? `additionalFields.${field.fieldName}` : `standardFields.${field.fieldName}`);
  const colSpanClass = hideLabel ? '' : (COL_SPAN_CLASSES[field.colSpan] ?? 'md:col-span-6');
  /** İki sütunlu kurumsal ızgarada tam satır kaplayan alanlar */
  const inlineWide =
    (field.colSpan ?? 6) >= 9 || (field.fieldType === 'textarea' && (field.colSpan ?? 6) >= 6);

  let options: SelectOption[] = [];
  if (
    (field.fieldType === 'select' || field.fieldType === 'lookup') &&
    field.optionsJson
  ) {
    try {
      options = JSON.parse(field.optionsJson) as SelectOption[];
    } catch {
      console.error('Invalid JSON in optionsJson for field', field.fieldName);
    }
  }

  const useActiveToggle =
    field.fieldType === 'checkbox' && isActiveToggleField(field.fieldName, field.label);

  const asLookup =
    field.useLookup !== false &&
    isLookupField(field.fieldName, field.fieldType, field.useLookup === true);

  const addressSuggestLevel =
    field.fieldType === 'text' ? addressSuggestLevelForField(field.fieldName) : null;

  const useWatermark = watermark && !inline && !hideLabel && !useActiveToggle && field.fieldType !== 'checkbox';
  /** Kurumsal görünümde kutu içi etiket yok (form: etiket solda · tablo: sütun başlığında) */
  const ph =
    inline || (hideLabel && compact) || (!watermark && !hideLabel)
      ? ''
      : field.isRequired
        ? `${field.label} *`
        : field.label;

  const baseInputClass = `
    w-full px-2 py-1 text-[12px] leading-tight rounded border bg-white
    focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-colors
    text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:bg-slate-900/60
    outline-none ${inline ? 'h-7 rounded-sm' : hideLabel ? 'h-7' : 'h-8'}
    ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : inline && field.isRequired ? 'bg-amber-50/80 dark:bg-amber-900/10' : ''}
    ${error ? 'border-red-400 focus:ring-red-400/40' : 'border-slate-300 dark:border-slate-600'}
  `;

  const isNumberField = field.fieldType === 'number';
  const textLike =
    field.fieldType === 'text' ||
    field.fieldType === 'password' ||
    field.fieldType === 'textarea';
  const fieldReg =
    isNumberField || textLike
      ? register(registerName, {
          required: field.isRequired && !disabled,
          ...(isNumberField
            ? {
                valueAsNumber: true,
                min: { value: 0, message: 'Negatif olamaz' },
              }
            : {}),
        })
      : null;
  const noMinus = fieldReg
    ? attachNoMinusHandlers({
        onKeyDown: fieldReg.onKeyDown as never,
        onChange: fieldReg.onChange as never,
      })
    : null;

  const labelText = useActiveToggle ? field.label.replace(/\s*durumu$/i, '') : field.label;

  return (
    <div
      className={
        inline
          ? `${inlineWide ? 'md:col-span-2' : ''} flex ${field.fieldType === 'textarea' ? 'items-start' : 'items-center'} gap-2 min-w-0`
          : `${hideLabel ? 'w-full min-w-0' : `col-span-12 ${colSpanClass}`} flex flex-col gap-0.5`
      }
    >
      {inline && (
        <label
          className="w-[132px] shrink-0 text-[11.5px] leading-7 text-slate-600 dark:text-slate-300 truncate"
          title={labelText}
        >
          {labelText}
          {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className={inline ? 'flex-1 min-w-0 flex flex-col gap-0.5' : 'contents'}>
      {/* Harici etiket: sadece watermark kapalıysa veya aktif toggle */}
      {!inline && !hideLabel && !useWatermark && (
        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-0.5 leading-none">
          {useActiveToggle ? field.label.replace(/\s*durumu$/i, '') : field.label}
          {field.isRequired && <span className="text-red-500">*</span>}
        </label>
      )}

      {field.fieldType === 'text' && addressSuggestLevel && (
        <AddressSuggestField
          label={field.label}
          registerName={registerName}
          level={addressSuggestLevel}
          register={register}
          setValue={setValueFn}
          watch={watchFn}
          required={field.isRequired}
          disabled={disabled}
          placeholder={ph}
          inputClassName={baseInputClass}
        />
      )}

      {field.fieldType === 'text' && !addressSuggestLevel && fieldReg && noMinus && (
        <div className="relative w-full">
          <input
            type="text"
            className={`${baseInputClass}${endAction ? ' pr-8' : ''}`}
            placeholder={ph}
            title={field.label}
            disabled={disabled}
            {...fieldReg}
            {...noMinus}
          />
          {endAction ? (
            <div className="absolute inset-y-0 right-0.5 flex items-center">{endAction}</div>
          ) : null}
        </div>
      )}

      {field.fieldType === 'password' && fieldReg && noMinus && (
        <input
          type="password"
          autoComplete="new-password"
          className={baseInputClass}
          placeholder={ph}
          title={field.label}
          disabled={disabled}
          {...fieldReg}
          {...noMinus}
        />
      )}

      {field.fieldType === 'textarea' && fieldReg && noMinus && (
        <textarea
          className={`${baseInputClass} h-auto ${hideLabel || compact ? 'min-h-[28px]' : 'min-h-[44px]'} py-1.5 resize-y`}
          placeholder={ph}
          title={field.label}
          rows={hideLabel ? 1 : compact ? 2 : 2}
          disabled={disabled}
          {...fieldReg}
          {...noMinus}
        />
      )}

      {field.fieldType === 'number' && fieldReg && noMinus && (
        <input
          type="number"
          step={field.decimals != null ? 1 / 10 ** field.decimals : 'any'}
          min={0}
          inputMode="decimal"
          className={baseInputClass}
          placeholder={ph}
          title={field.label}
          disabled={disabled}
          {...fieldReg}
          {...noMinus}
          onBlur={(e) => {
            void fieldReg.onBlur(e);
            if (field.decimals == null || !setValueFn) return;
            const raw = e.target.value;
            if (raw === '') return;
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            const f = 10 ** field.decimals;
            const rounded = Math.round((n + Number.EPSILON) * f) / f;
            if (rounded !== n) {
              setValueFn(registerName, rounded, { shouldDirty: true, shouldValidate: true });
            }
            e.target.value = rounded.toFixed(field.decimals);
          }}
        />
      )}

      {field.fieldType === 'date' && (
        <DateField
          label={field.label}
          registerName={registerName}
          register={register}
          setValue={setValueFn}
          watch={watchFn}
          required={field.isRequired}
          disabled={disabled}
          placeholder={useWatermark && !inline ? `${ph} (${getSystemDatePlaceholder()})` : getSystemDatePlaceholder()}
          inputClassName={baseInputClass}
          title={field.label}
        />
      )}

      {field.fieldType === 'checkbox' && useActiveToggle && (
        <div className={`flex items-center ${inline ? 'h-7' : 'h-8'} gap-2 px-0.5`}>
          {!inline && (
            <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
              {field.label.replace(/\s*durumu$/i, '')}
            </span>
          )}
          <ActiveToggleField
            disabled={disabled}
            size="sm"
            defaultOn={
              field.defaultValue == null || field.defaultValue === ''
                ? true
                : !['false', '0', 'pasif'].includes(String(field.defaultValue).toLowerCase())
            }
            registerReturn={register(registerName)}
          />
        </div>
      )}

      {field.fieldType === 'checkbox' && !useActiveToggle && (
        <div className={`flex items-center ${inline ? 'h-7' : 'h-8'} px-0.5`}>
          <label
            className={`inline-flex items-center gap-1.5 text-[12px] ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              disabled={disabled}
              {...register(registerName)}
            />
            {!inline && <span className="font-medium text-slate-700 dark:text-slate-300">{field.label}</span>}
          </label>
        </div>
      )}

      {asLookup && (
        <LookupField
          label={field.label}
          fieldName={field.fieldName}
          registerName={registerName}
          options={options}
          register={register}
          setValue={setValueFn}
          watch={watchFn}
          required={field.isRequired}
          disabled={disabled}
          placeholder={ph}
          inputClassName={baseInputClass}
        />
      )}

      {(field.fieldType === 'select' || field.fieldType === 'lookup') && !asLookup && (
        <select
          key={field.optionsJson || field.fieldName}
          className={`${baseInputClass} appearance-none cursor-pointer pr-7 text-slate-700 empty:text-slate-400`}
          disabled={disabled}
          title={field.label}
          aria-label={field.label}
          {...register(registerName, { required: field.isRequired && !disabled })}
        >
          {/* Satır Birim: boş "—" / alan adı yok; malzeme seçilince ana birim doğrudan gelir */}
          {field.fieldName !== 'UnitID' &&
            !options.some((o) => o.value === '') && (
              <option value="">{hideLabel || compact || inline ? '' : ph}</option>
            )}
          {options.map((opt, idx) => (
            <option key={`${opt.value}-${idx}`} value={opt.value}>
              {opt.label || opt.value || (hideLabel || compact ? '—' : ph)}
            </option>
          ))}
        </select>
      )}

      {error && (
        <span className="text-[9px] text-red-500 leading-none">{field.label} zorunlu</span>
      )}
      {!error && field.helpText && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug block mt-0.5">
          {field.helpText}
        </span>
      )}
      </div>
    </div>
  );
};
