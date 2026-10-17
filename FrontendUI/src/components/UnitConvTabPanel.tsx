import React from 'react';
import {
  Control,
  FieldError,
  FieldValues,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  get,
  useFieldArray,
} from 'react-hook-form';
import { ArrowLeftRight, Barcode, MapPinned, Plus, Ruler, Trash2 } from 'lucide-react';
import { FormFieldDto } from '../types/formTypes';
import { FieldRenderer } from './FieldRenderer';
import { parseUnitSelectOptions, unitLabel } from '../data/productUnitConvs';
import { BarcodeConflict, checkBarcodes } from '../api/barcodesApi';

interface UnitConvTabPanelProps {
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
  errors: FieldValues;
  readOnly?: boolean;
  unitConvFields: FormFieldDto[];
  barcodeFields: FormFieldDto[];
  defaultUnitId: unknown;
  /** Kaydedilen malzeme (yeni kartta 0) — barkod benzersizlik kontrolünde kendi barkodları hariç tutulur */
  productId?: number;
}

const CONV_FIELDS = new Set(['UnitID', 'MainQty', 'UnitQty']);
const DIM_FIELDS = new Set(['Weight', 'Length', 'Width', 'Height']);
const VALID_FIELDS = new Set(['UseInMaterial', 'UseInSales', 'UseInPurchase']);

function UnitBarcodesGrid({
  control,
  register,
  errors,
  readOnly,
  unitIndex,
  barcodeFields,
}: {
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  errors: FieldValues;
  readOnly?: boolean;
  unitIndex: number;
  barcodeFields: FormFieldDto[];
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `unitConvs.${unitIndex}.barcodes`,
  });

  const cols = barcodeFields.filter((f) => f.fieldName !== 'LineNr');

  return (
    <fieldset className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 space-y-2">
      <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
        <Barcode className="w-3 h-3" />
        Barkodlar
      </legend>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-400">Bu birime ait barkodlar (N adet)</p>
        {!readOnly && (
          <button
            type="button"
            onClick={() =>
              append({
                Barcode: '',
                Type: '1',
                LineNr: fields.length + 1,
              })
            }
            className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
          >
            <Plus className="w-3 h-3" />
            Barkod Ekle
          </button>
        )}
      </div>

      <div className="overflow-auto rounded border border-slate-200 dark:border-slate-700 max-h-52">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600">
            <tr>
              <th className="w-8 px-1.5 py-1.5 text-left font-semibold">#</th>
              {cols.map((f) => (
                <th key={f.fieldId} className="px-1.5 py-1.5 text-left font-semibold">
                  {f.label}
                </th>
              ))}
              {!readOnly && <th className="w-10 px-1 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length + 2}
                  className="px-2 py-4 text-center text-slate-400"
                >
                  Barkod yok. «Barkod Ekle» ile ekleyin.
                </td>
              </tr>
            ) : (
              fields.map((row, bi) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 dark:border-slate-800 align-top"
                >
                  <td className="px-1.5 py-1 text-slate-400 font-semibold">{bi + 1}</td>
                  {cols.map((field) => (
                    <td key={field.fieldId} className="px-1 py-0.5">
                      <FieldRenderer
                        field={{ ...field, colSpan: 12, label: '' }}
                        register={register}
                        registerNameOverride={`unitConvs.${unitIndex}.barcodes.${bi}.${field.fieldName}`}
                        compact
                        disabled={readOnly}
                        error={
                          get(
                            errors,
                            `unitConvs.${unitIndex}.barcodes.${bi}.${field.fieldName}`,
                          ) as FieldError | undefined
                        }
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => remove(bi)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Sil"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </fieldset>
  );
}

export const UnitConvTabPanel: React.FC<UnitConvTabPanelProps> = ({
  control,
  register,
  setValue,
  watch,
  errors,
  readOnly,
  unitConvFields,
  barcodeFields,
  defaultUnitId,
  productId = 0,
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'unitConvs',
  });

  // Barkod benzersizdir: girilen barkodları kaydetmeden kontrol et (başka malzemede / bu kartta tekrar)
  const allBarcodes = ((watch('unitConvs') as { barcodes?: Record<string, unknown>[] }[] | undefined) || [])
    .flatMap((u) => u.barcodes || [])
    .filter((b) => String(b?.Barcode ?? '').trim() !== '');
  const barcodeKey = JSON.stringify(
    allBarcodes.map((b) => [String(b.Barcode).trim(), b.Type, b.QtyDigits, b.HasCheckDigit]),
  );
  const [conflicts, setConflicts] = React.useState<BarcodeConflict[]>([]);
  React.useEffect(() => {
    if (readOnly || allBarcodes.length === 0) {
      setConflicts([]);
      return;
    }
    const t = window.setTimeout(() => {
      void checkBarcodes(productId, allBarcodes)
        .then(setConflicts)
        .catch(() => setConflicts([]));
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeKey, productId, readOnly]);

  const [selected, setSelected] = React.useState(0);
  const mainId = String(defaultUnitId ?? '').trim();
  const unitOpts = React.useMemo(() => {
    const unitField = unitConvFields.find((f) => f.fieldName === 'UnitID');
    return parseUnitSelectOptions(unitField?.optionsJson);
  }, [unitConvFields]);

  const convFields = unitConvFields.filter((f) => CONV_FIELDS.has(f.fieldName));
  const dimFields = unitConvFields.filter((f) => DIM_FIELDS.has(f.fieldName));
  const validFields = unitConvFields.filter((f) => VALID_FIELDS.has(f.fieldName));

  React.useEffect(() => {
    if (fields.length === 0) {
      setSelected(0);
      return;
    }
    if (selected >= fields.length) setSelected(fields.length - 1);
  }, [fields.length, selected]);

  React.useEffect(() => {
    if (readOnly || !mainId) return;
    const rows = (watch('unitConvs') as Record<string, unknown>[]) || [];
    const mainIdx = rows.findIndex(
      (r) => r?.IsMain === true || r?.IsMain === 1 || r?.IsMain === '1',
    );
    if (mainIdx >= 0 && String(rows[mainIdx]?.UnitID ?? '') !== mainId) {
      setValue(`unitConvs.${mainIdx}.UnitID`, mainId, { shouldDirty: true });
      setValue(`unitConvs.${mainIdx}.MainQty`, 1, { shouldDirty: true });
      setValue(`unitConvs.${mainIdx}.UnitQty`, 1, { shouldDirty: true });
    }
  }, [mainId, readOnly, setValue, watch]);

  const addUnit = () => {
    const next = fields.length;
    append({
      UnitID: '',
      MainQty: 12,
      UnitQty: 1,
      Weight: '',
      Length: '',
      Width: '',
      Height: '',
      UseInMaterial: true,
      UseInSales: true,
      UseInPurchase: true,
      IsMain: false,
      LineNr: next + 1,
      barcodes: [],
    });
    setSelected(next);
  };

  const removeSelected = () => {
    if (selected < 0 || selected >= fields.length) return;
    const isMain = Boolean(
      watch(`unitConvs.${selected}.IsMain`) === true ||
        watch(`unitConvs.${selected}.IsMain`) === 1 ||
        watch(`unitConvs.${selected}.IsMain`) === '1',
    );
    if (isMain) return;
    remove(selected);
    setSelected((s) => Math.max(0, s - 1));
  };

  const activeIsMain =
    fields.length > 0 &&
    Boolean(
      watch(`unitConvs.${selected}.IsMain`) === true ||
        watch(`unitConvs.${selected}.IsMain`) === 1 ||
        watch(`unitConvs.${selected}.IsMain`) === '1',
    );

  const mainQty = watch(`unitConvs.${selected}.MainQty`);
  const unitQty = watch(`unitConvs.${selected}.UnitQty`);
  const activeUnitId = watch(`unitConvs.${selected}.UnitID`);

  return (
    <div className="space-y-2">
      {conflicts.length > 0 && (
        <div className="rounded-sm border border-red-300 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          <b>Barkod benzersiz olmalı — bu kart kaydedilemez:</b>
          <ul className="mt-0.5 list-disc pl-4">
            {conflicts.map((c, i) => (
              <li key={i}>
                <b>{c.barcode}</b> · {c.reason}
                {c.productCode ? ` (${c.productCode} ${c.productTitle ?? ''})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
            Birimler
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Soldan birim seçin. Sağda çevrim, ölçü ve barkodları düzenleyin.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 min-h-[320px]">
        {/* Sol: birim listesi */}
        <div className="lg:col-span-4 flex flex-col rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 overflow-hidden">
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Birim listesi
            </span>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={addUnit}
                  className="inline-flex items-center gap-0.5 px-1.5 h-6 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                >
                  <Plus className="w-3 h-3" />
                  Ekle
                </button>
                <button
                  type="button"
                  onClick={removeSelected}
                  disabled={activeIsMain || fields.length === 0}
                  className="inline-flex items-center gap-0.5 px-1.5 h-6 text-[10px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                  Sil
                </button>
              </div>
            )}
          </div>
          <div className="overflow-auto flex-1 max-h-[420px]">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 z-[1]">
                <tr>
                  <th className="w-7 px-1.5 py-1.5 text-left font-semibold">#</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold">Birim</th>
                  <th className="px-1.5 py-1.5 text-left font-semibold">Çevrim</th>
                  <th className="w-10 px-1 py-1.5 text-center font-semibold" title="Barkod">
                    Brk
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-slate-400">
                      Birim yok
                    </td>
                  </tr>
                ) : (
                  fields.map((row, index) => {
                    const uid = watch(`unitConvs.${index}.UnitID`);
                    const mq = watch(`unitConvs.${index}.MainQty`);
                    const uq = watch(`unitConvs.${index}.UnitQty`);
                    const isMain = Boolean(
                      watch(`unitConvs.${index}.IsMain`) === true ||
                        watch(`unitConvs.${index}.IsMain`) === 1 ||
                        watch(`unitConvs.${index}.IsMain`) === '1',
                    );
                    const bars =
                      (watch(`unitConvs.${index}.barcodes`) as unknown[] | undefined)?.length || 0;
                    const active = index === selected;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelected(index)}
                        className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 transition-colors ${
                          active
                            ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-200'
                            : 'hover:bg-white dark:hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="px-1.5 py-2 text-slate-400 font-semibold">{index + 1}</td>
                        <td className="px-1.5 py-2">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {unitLabel(uid, unitOpts) || '—'}
                          </div>
                          {isMain && (
                            <span className="text-[9px] font-bold uppercase text-emerald-700">
                              Ana
                            </span>
                          )}
                        </td>
                        <td className="px-1.5 py-2 text-slate-500 whitespace-nowrap">
                          {isMain ? '1 = 1' : `${mq || '?'} = ${uq || '?'}`}
                        </td>
                        <td className="px-1 py-2 text-center text-slate-500">{bars}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sağ: seçili birim detayı */}
        <div className="lg:col-span-8 space-y-2.5">
          {fields.length === 0 || selected < 0 || selected >= fields.length ? (
            <div className="h-full min-h-[280px] flex items-center justify-center rounded-md border border-dashed border-slate-200 text-[12px] text-slate-400">
              Birim seçin veya «Ekle» ile yeni birim oluşturun.
            </div>
          ) : (
            <>
              <fieldset className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 space-y-2">
                <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                  <ArrowLeftRight className="w-3 h-3" />
                  Çevrim
                  <span className="normal-case font-medium text-slate-400 ml-1">
                    · {unitLabel(activeUnitId, unitOpts)}
                  </span>
                </legend>
                <div className="grid grid-cols-12 gap-2">
                  {convFields.map((field) => {
                    const qtyField = field.fieldName === 'MainQty' || field.fieldName === 'UnitQty';
                    const locked =
                      activeIsMain && (field.fieldName === 'UnitID' || qtyField);
                    return (
                      <FieldRenderer
                        key={`conv-${selected}-${field.fieldId}`}
                        field={field}
                        register={register}
                        registerNameOverride={`unitConvs.${selected}.${field.fieldName}`}
                        compact
                        disabled={readOnly || locked}
                        error={
                          get(errors, `unitConvs.${selected}.${field.fieldName}`) as
                            | FieldError
                            | undefined
                        }
                      />
                    );
                  })}
                </div>
                {activeIsMain ? (
                  <p className="text-[10px] text-slate-400">
                    Ana birim genel sekmeden gelir; oran her zaman 1 = 1’dir. Ölçü ve barkod
                    girebilirsiniz.
                  </p>
                ) : (
                  <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5 inline-block">
                    {mainQty || '?'} ana birim = {unitQty || '?'}{' '}
                    {unitLabel(activeUnitId, unitOpts) || 'çevrim'}
                  </p>
                )}
              </fieldset>

              <fieldset className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 space-y-2">
                <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  Ölçü / Ağırlık
                </legend>
                <p className="text-[10px] text-slate-400 -mt-1">
                  Bu birime özel en, boy, yükseklik ve ağırlık
                </p>
                <div className="grid grid-cols-12 gap-2">
                  {dimFields.map((field) => (
                    <FieldRenderer
                      key={`dim-${selected}-${field.fieldId}`}
                      field={field}
                      register={register}
                      registerNameOverride={`unitConvs.${selected}.${field.fieldName}`}
                      compact
                      disabled={readOnly}
                      error={
                        get(errors, `unitConvs.${selected}.${field.fieldName}`) as
                          | FieldError
                          | undefined
                      }
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 space-y-2">
                <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                  <MapPinned className="w-3 h-3" />
                  Geçerli Olduğu Yerler
                </legend>
                <div className="grid grid-cols-12 gap-2">
                  {validFields.map((field) => (
                    <FieldRenderer
                      key={`valid-${selected}-${field.fieldId}`}
                      field={field}
                      register={register}
                      registerNameOverride={`unitConvs.${selected}.${field.fieldName}`}
                      compact
                      disabled={readOnly}
                      error={
                        get(errors, `unitConvs.${selected}.${field.fieldName}`) as
                          | FieldError
                          | undefined
                      }
                    />
                  ))}
                </div>
              </fieldset>

              <UnitBarcodesGrid
                key={`bars-${selected}-${fields[selected]?.id}`}
                control={control}
                register={register}
                errors={errors}
                readOnly={readOnly}
                unitIndex={selected}
                barcodeFields={barcodeFields}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
