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
import { FormFieldContext } from './FormFieldContext';
import {
  ACCOUNT_LINK_MODULE_OPTIONS,
  getAccountLinkTypeOptions,
  defaultAccountLinkDetailRow,
  accountLinkModuleLabel,
  accountLinkTypeLabel,
  sampleAccountOptionsJson,
} from '../data/cardAccountLinks';
import { Plus, Trash2, BookOpen, Filter } from 'lucide-react';

interface AccountLinkFormEngineProps {
  schema: FormSchemaDto;
  initialData?: DynamicFormDataDto;
  onSubmit: (data: DynamicFormDataDto) => void;
  isLoading?: boolean;
  readOnly?: boolean;
  onLiveChange?: (data: DynamicFormDataDto) => void;
}

/** Muhasebe Bağlantıları — modül + fiş türü + hesap + koşul */
export const AccountLinkFormEngine: React.FC<AccountLinkFormEngineProps> = ({
  schema,
  initialData,
  onSubmit,
  isLoading = false,
  readOnly = false,
  onLiveChange,
}) => {
  const headerFields = schema.fields.filter((f) => !f.fieldName.startsWith('U_'));

  const fieldDefaults: Record<string, unknown> = {};
  for (const f of headerFields) {
    if (f.defaultValue != null && f.defaultValue !== '') {
      fieldDefaults[f.fieldName] = f.defaultValue;
    }
  }

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<FieldValues>({
      defaultValues: {
        standardFields: {
          ...fieldDefaults,
          ...(schema.fixedStandardFields || {}),
          ...(initialData?.standardFields || {}),
        },
        additionalFields: initialData?.additionalFields || {},
        lines: initialData?.lines?.length
          ? initialData.lines
          : [defaultAccountLinkDetailRow()],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control: control as Control<FieldValues>,
    name: 'lines',
  });

  const watchedLines = watch('lines') as Record<string, unknown>[] | undefined;

  const handleFormSubmit = (data: FieldValues) => {
    const payload: DynamicFormDataDto = {
      recordId: initialData?.recordId ?? 0,
      standardFields: {
        ...((data.standardFields as Record<string, unknown>) || {}),
        ...(schema.fixedStandardFields || {}),
      },
      additionalFields: (data.additionalFields as Record<string, unknown>) || {},
      lines: ((data.lines as Record<string, unknown>[]) || []).map((row) => ({
        ...row,
        Module: Number(row.Module) || 0,
        Type: Number(row.Type) || row.Type,
      })),
    };
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
        lines: ((data.lines as Record<string, unknown>[]) || []).map((row) => ({
          ...row,
          Module: Number(row.Module) || 0,
          Type: Number(row.Type) || row.Type,
        })),
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [watchedAll, onLiveChange, readOnly, initialData?.recordId, schema.fixedStandardFields]);

  const getHeaderError = (fieldName: string): FieldError | undefined =>
    get(errors, `standardFields.${fieldName}`) as FieldError | undefined;

  const moduleField: FormFieldDto = {
    fieldId: 9401,
    fieldName: 'Module',
    label: 'Modül',
    fieldType: 'select',
    isRequired: true,
    colSpan: 3,
    orderIndex: 1,
    optionsJson: JSON.stringify(ACCOUNT_LINK_MODULE_OPTIONS),
  };

  const accountField: FormFieldDto = {
    fieldId: 9403,
    fieldName: 'AccountID',
    label: 'Muhasebe Hesabı',
    fieldType: 'select',
    isRequired: true,
    colSpan: 4,
    orderIndex: 3,
    optionsJson: sampleAccountOptionsJson(),
  };

  const conditionTitleField: FormFieldDto = {
    fieldId: 9404,
    fieldName: 'ConditionTitle',
    label: 'Koşul Özeti',
    fieldType: 'text',
    isRequired: false,
    colSpan: 6,
    orderIndex: 4,
  };

  const conditionDetailField: FormFieldDto = {
    fieldId: 9405,
    fieldName: 'ConditionJson',
    label: 'Koşul Detayı (ör. depo=Merkez; cari grubu=…)',
    fieldType: 'textarea',
    isRequired: false,
    colSpan: 12,
    orderIndex: 5,
  };

  return (
    <FormFieldContext.Provider value={{ setValue, watch }}>
      <div className="w-full max-w-6xl mx-auto p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-[14px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            {schema.title}
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {schema.tableName} · Modül / fiş türü / hesap / koşul
          </p>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
          <div>
            <h3 className="text-[12px] font-semibold text-slate-600 mb-1.5">Başlık</h3>
            <div className="grid grid-cols-12 gap-x-2 gap-y-1.5">
              {headerFields.map((field) => (
                <FieldRenderer
                  key={field.fieldId}
                  field={field}
                  register={register}
                  error={getHeaderError(field.fieldName)}
                  disabled={readOnly}
                  watermark
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                  Bağlantı Satırları
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Malzeme / KDV / banka / çek-senet — fiş türüne göre hesap ve koşul
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => append(defaultAccountLinkDetailRow())}
                  className="inline-flex items-center gap-1 px-2.5 h-7 text-[12px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Satır Ekle
                </button>
              )}
            </div>

            <div className="space-y-2">
              {fields.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-400 border border-dashed border-slate-200 rounded-md">
                  Satır yok. «Satır Ekle» ile modül ve fiş türü seçin.
                </div>
              ) : (
                fields.map((row, index) => {
                  const moduleVal = String(watchedLines?.[index]?.Module ?? '');
                  const typeVal = watchedLines?.[index]?.Type;
                  const typeOptions = getAccountLinkTypeOptions(moduleVal);
                  const typeField: FormFieldDto = {
                    fieldId: 9402,
                    fieldName: 'Type',
                    label: 'Fiş / İşlem Türü',
                    fieldType: 'select',
                    isRequired: true,
                    colSpan: 5,
                    orderIndex: 2,
                    optionsJson: JSON.stringify(typeOptions),
                  };

                  return (
                    <div
                      key={row.id}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                          <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          {accountLinkModuleLabel(moduleVal)}
                          {' · '}
                          {accountLinkTypeLabel(
                            typeVal as string | number | undefined,
                            Number(moduleVal) || undefined,
                          )}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                            Sil
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-12 gap-2">
                        <FieldRenderer
                          field={moduleField}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`lines.${index}.Module`}
                          compact
                          disabled={readOnly}
                          error={
                            get(errors, `lines.${index}.Module`) as FieldError | undefined
                          }
                        />
                        <FieldRenderer
                          key={`${row.id}-type-${moduleVal}`}
                          field={typeField}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`lines.${index}.Type`}
                          compact
                          disabled={readOnly}
                          error={
                            get(errors, `lines.${index}.Type`) as FieldError | undefined
                          }
                        />
                        <FieldRenderer
                          field={accountField}
                          register={register as UseFormRegister<FieldValues>}
                          registerNameOverride={`lines.${index}.AccountID`}
                          compact
                          disabled={readOnly}
                          error={
                            get(errors, `lines.${index}.AccountID`) as
                              | FieldError
                              | undefined
                          }
                        />
                      </div>

                      <div className="rounded border border-dashed border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 p-2 space-y-1.5">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <Filter className="w-3 h-3" />
                          Koşul
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <FieldRenderer
                            field={conditionTitleField}
                            register={register as UseFormRegister<FieldValues>}
                            registerNameOverride={`lines.${index}.ConditionTitle`}
                            compact
                            disabled={readOnly}
                          />
                          <FieldRenderer
                            field={conditionDetailField}
                            register={register as UseFormRegister<FieldValues>}
                            registerNameOverride={`lines.${index}.ConditionJson`}
                            compact
                            disabled={readOnly}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Örnek: yalnızca belirli depo / cari grubu / işyeri için bu hesap
                          kullanılsın.
                        </p>
                      </div>

                      {/* Modül değişince tip listesi uyumsuzsa ilk seçeneğe çek */}
                      <ModuleTypeSync
                        index={index}
                        moduleVal={moduleVal}
                        typeVal={String(typeVal ?? '')}
                        typeOptions={typeOptions}
                        setValue={setValue}
                        readOnly={readOnly}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {!readOnly ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className={`inline-flex items-center justify-center px-4 h-8 text-[13px] font-semibold text-white rounded-md bg-blue-600 hover:bg-blue-500 transition-colors ${
                  isLoading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-right">
              İnceleme modu — değişiklik yapılamaz
            </div>
          )}
        </form>
      </div>
    </FormFieldContext.Provider>
  );
};

/** Modül değişince geçersiz Type değerini düzelt */
function ModuleTypeSync({
  index,
  moduleVal,
  typeVal,
  typeOptions,
  setValue,
  readOnly,
}: {
  index: number;
  moduleVal: string;
  typeVal: string;
  typeOptions: { label: string; value: string }[];
  setValue: (name: string, value: unknown, opts?: { shouldDirty?: boolean }) => void;
  readOnly: boolean;
}) {
  React.useEffect(() => {
    if (readOnly || !moduleVal || !typeOptions.length) return;
    const ok = typeOptions.some((o) => o.value === typeVal);
    if (!ok) {
      setValue(`lines.${index}.Type`, typeOptions[0].value, { shouldDirty: true });
    }
  }, [moduleVal, typeVal, typeOptions, index, setValue, readOnly]);
  return null;
}
