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
    'w-full h-7 px-2 text-[12px] border border-slate-300 dark:border-slate-600 rounded-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100';

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
            className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Satır Ekle
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

      <div
        className={`overflow-x-auto border border-slate-300 dark:border-slate-600 rounded-sm ${
          compact ? 'max-h-[280px] overflow-y-auto' : ''
        }`}
      >
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800">
              <th className="w-8 px-1.5 py-1 text-center font-medium text-slate-500 border-b border-r border-slate-300 dark:border-slate-600">
                #
              </th>
              <th className="px-1.5 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 dark:border-slate-600 min-w-[170px]">
                Özel Kod Tanımı
              </th>
              <th className="px-1.5 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 dark:border-slate-600 min-w-[160px]">
                Özel Kod
              </th>
              <th className="px-1.5 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 dark:border-slate-600 min-w-[200px]">
                Açıklama
              </th>
              <th className="px-1.5 py-1 text-left font-medium text-slate-600 border-b border-r border-slate-300 dark:border-slate-600 w-[130px]">
                Tarih
              </th>
              {!readOnly && <th className="w-8 border-b border-slate-300 dark:border-slate-600" />}
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-[11px] text-slate-400">
                  Özel kod yok. «Satır Ekle» ile satır satır ekleyin.
                </td>
              </tr>
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
                const cell = 'px-1 py-0.5 border-b border-r border-slate-200 dark:border-slate-700 align-middle';

                return (
                  <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                    <td className="px-1.5 py-0.5 text-center text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-b border-r border-slate-200 dark:border-slate-700">
                      {index + 1}
                      <input type="hidden" {...register(`auxilCodes.${index}.LineNr`)} />
                    </td>
                    <td className={cell}>
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
                        <option value="">— Tanım seçin —</option>
                        {defs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cell}>
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
                        <option value="">{noCodeList ? '— Kod listesi yok —' : '— Kod seçin —'}</option>
                        {codeOpts.map((v) => (
                          <option key={v.id || v.code} value={v.code}>
                            {v.title || v.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cell}>
                      <input
                        type="text"
                        className={selectCls}
                        disabled={readOnly || !showDetail}
                        title={showDetail ? undefined : 'Önce tanım ve kod seçin'}
                        {...register(`auxilCodes.${index}.Definition`)}
                      />
                    </td>
                    <td className={cell}>
                      <DateField
                        label="Tarih"
                        registerName={`auxilCodes.${index}.TransDate`}
                        register={register}
                        setValue={setValue}
                        watch={watch}
                        disabled={readOnly || !showDetail}
                        inputClassName={selectCls}
                      />
                    </td>
                    {!readOnly && (
                      <td className="px-1 text-center border-b border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          title="Satırı sil"
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
