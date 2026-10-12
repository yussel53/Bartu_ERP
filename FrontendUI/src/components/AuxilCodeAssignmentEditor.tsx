import React from 'react';
import {
  Control,
  FieldValues,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  useFieldArray,
} from 'react-hook-form';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { listRecords } from '../api/recordsApi';
import { AUXIL_VALUE_KIND, defaultAuxilCodeRow } from '../data/auxilCodes';
import { DateField } from './DateField';

type DefRow = {
  id: string;
  title: string;
  hasDate: boolean;
};

type ValueRow = {
  id: string;
  code: string;
  title: string;
  kind: number;
};

interface AuxilCodeAssignmentEditorProps {
  targetTable: string;
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
  readOnly?: boolean;
  /** trade alt sekme: daha kompakt */
  compact?: boolean;
}

function activeFlag(v: unknown): boolean {
  return v !== false && v !== 0 && v !== '0' && v !== 'false';
}

/**
 * Kart / fiş → AuxilTrans (1..N)
 * Auxil (tanım) seç → Özel Kod seç → Açıklama + Tarih
 */
export const AuxilCodeAssignmentEditor: React.FC<AuxilCodeAssignmentEditorProps> = ({
  targetTable,
  control,
  register,
  setValue,
  watch,
  readOnly = false,
  compact = false,
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'auxilCodes',
  });

  const [defs, setDefs] = React.useState<DefRow[]>([]);
  const [valuesByDef, setValuesByDef] = React.useState<Record<string, ValueRow[]>>({});
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listRecords('AuxilCodes', { take: 500 });
        if (cancelled) return;
        const rows = (res.rows || [])
          .filter((r) => {
            const t = String(r.TargetTable ?? '').trim();
            return t === targetTable && activeFlag(r.IsActive ?? r.status);
          })
          .map((r) => {
            const id = String(r.AuxilCodesID ?? r.id ?? '');
            const code = String(r.Code ?? '').trim();
            const title = String(r.Title ?? '').trim();
            return {
              id,
              title: title ? `${code ? code + ' — ' : ''}${title}` : code || id,
              hasDate: activeFlag(r.HasDate),
            };
          })
          .filter((d) => d.id);
        setDefs(rows);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Tanımlar yüklenemedi');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetTable]);

  const loadValues = React.useCallback(
    async (defId: string) => {
      if (!defId || valuesByDef[defId]) return;
      try {
        const res = await listRecords('AuxilCodeValue', {
          filterColumn: 'AuxilCodesID',
          filterValue: Number(defId),
          take: 500,
        });
        const rows: ValueRow[] = (res.rows || [])
          .filter((r) => activeFlag(r.IsActive ?? true))
          .map((r) => ({
            id: String(r.AuxilCodeValueID ?? r.id ?? ''),
            code: String(r.Code ?? '').trim(),
            title: String(r.Title ?? r.Code ?? '').trim(),
            kind: Number(r.ValueKind ?? 1),
          }))
          .filter((v) => v.id || v.code)
          .sort((a, b) => a.title.localeCompare(b.title, 'tr'));
        setValuesByDef((prev) => ({ ...prev, [defId]: rows }));
      } catch {
        setValuesByDef((prev) => ({ ...prev, [defId]: [] }));
      }
    },
    [valuesByDef],
  );

  const watched = watch('auxilCodes') as Record<string, unknown>[] | undefined;
  React.useEffect(() => {
    for (const row of watched || []) {
      const defId = String(row?.AuxilCodesID ?? '').trim();
      if (defId) void loadValues(defId);
    }
  }, [watched, loadValues]);

  const selectCls =
    'w-full h-8 px-2 text-[12px] border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3
            className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5`}
          >
            <Tags className="w-3.5 h-3.5 text-slate-500" />
            AuxilTrans — Özel Kodlar
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Auxil tanımı → özel kod → açıklama (elle) + tarih · kart/fişe 1…N satır
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => append(defaultAuxilCodeRow(fields.length + 1))}
            className="inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
          >
            <Plus className="w-3.5 h-3.5" />
            AuxilTrans Ekle
          </button>
        )}
      </div>

      {loadError && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          {loadError}
        </div>
      )}

      {defs.length === 0 && !loadError && (
        <div className="text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-md px-2 py-3 text-center">
          Bu bölüm için Auxil tanımı yok. Sistem → Özel Kodlar (AUXIL) ekranından ekleyin.
        </div>
      )}

      <div className={`space-y-2 ${compact ? 'max-h-[280px] overflow-y-auto pr-0.5' : ''}`}>
        {fields.length === 0 ? (
          <div className="py-5 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-md">
            Henüz AuxilTrans yok. «AuxilTrans Ekle» ile 1…N satır ekleyin.
          </div>
        ) : (
          fields.map((row, index) => {
            const defId = String(watched?.[index]?.AuxilCodesID ?? '').trim();
            const selectedCode = String(watched?.[index]?.AuxilCode ?? '').trim();
            const allVals = valuesByDef[defId] || [];
            const codeOpts = allVals.filter((v) => v.kind === AUXIL_VALUE_KIND.Code);
            const valuesLoaded = Boolean(defId && valuesByDef[defId] != null);
            const noCodeList = valuesLoaded && codeOpts.length === 0;
            /** Tanım (+ varsa kod) seçilince açıklama/tarih açılır */
            const showDetail =
              Boolean(defId) && valuesLoaded && (noCodeList || selectedCode !== '');

            return (
              <div
                key={row.id}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                    <span className="w-5 h-5 rounded bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    AuxilTrans
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

                <input type="hidden" {...register(`auxilCodes.${index}.LineNr`)} />

                {/* 1) Auxil tanımı + 2) Özel kod */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-6">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      1 · Özel Kod Tanımı (AUXIL)
                    </label>
                    <select
                      className={selectCls}
                      disabled={readOnly}
                      value={defId}
                      onChange={(e) => {
                        const next = e.target.value;
                        setValue(`auxilCodes.${index}.AuxilCodesID`, next, { shouldDirty: true });
                        setValue(`auxilCodes.${index}.AuxilCode`, '', { shouldDirty: true });
                        setValue(`auxilCodes.${index}.AuxilCodeValueID`, '', { shouldDirty: true });
                        setValue(`auxilCodes.${index}.Definition`, '', { shouldDirty: true });
                        void loadValues(next);
                      }}
                    >
                      <option value="">— Auxil tanımı seçin —</option>
                      {defs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-12 sm:col-span-6">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      2 · Özel Kod
                    </label>
                    <select
                      className={selectCls}
                      disabled={readOnly || !defId || noCodeList}
                      value={selectedCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const match = codeOpts.find((v) => v.code === code);
                        setValue(`auxilCodes.${index}.AuxilCode`, code, { shouldDirty: true });
                        setValue(`auxilCodes.${index}.AuxilCodeValueID`, match?.id || '', {
                          shouldDirty: true,
                        });
                      }}
                    >
                      <option value="">
                        {noCodeList ? '— Bu tanımda kod listesi yok —' : '— Özel kod seçin —'}
                      </option>
                      {codeOpts.map((v) => (
                        <option key={v.id || v.code} value={v.code}>
                          {v.title || v.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3) Açıklama + Tarih — AuxilTrans detayı */}
                {showDetail && (
                  <div className="grid grid-cols-12 gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                    <div className="col-span-12 sm:col-span-8">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        3 · Açıklama
                      </label>
                      <input
                        type="text"
                        className={selectCls}
                        disabled={readOnly}
                        placeholder="Açıklama yazın"
                        {...register(`auxilCodes.${index}.Definition`)}
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        4 · Tarih
                      </label>
                      <DateField
                        label="Tarih"
                        registerName={`auxilCodes.${index}.TransDate`}
                        register={register}
                        setValue={setValue}
                        watch={watch}
                        disabled={readOnly}
                        inputClassName={selectCls}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
