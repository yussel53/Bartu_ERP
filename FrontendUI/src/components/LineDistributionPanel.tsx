import React from 'react';
import {
  useFieldArray,
  Control,
  FieldValues,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { Plus, Minus, Split } from 'lucide-react';
import type { FormFieldDto } from '../types/formTypes';
import { FieldRenderer } from './FieldRenderer';

interface LineDistributionPanelProps {
  lineIndex: number;
  fields: FormFieldDto[];
  amountFields: string[];
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
  readOnly?: boolean;
  /** Satır başlığı (ör. hesap kodu) */
  lineCaption?: string;
  /** true: detay sekmesi içinde — kendi çerçevesi yok */
  embedded?: boolean;
}

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

const fmt = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function lineDistributionAmount(
  line: Record<string, unknown> | undefined,
  amountFields: string[],
): number {
  if (!line) return 0;
  for (const f of amountFields) {
    const v = num(line[f]);
    if (v !== 0) return Math.abs(v);
  }
  return 0;
}

export const LineDistributionPanel: React.FC<LineDistributionPanelProps> = ({
  lineIndex,
  fields,
  amountFields,
  control,
  register,
  setValue,
  watch,
  readOnly = false,
  lineCaption,
  embedded = false,
}) => {
  const base = `lines.${lineIndex}.distributions`;
  const { fields: rows, append, remove } = useFieldArray({ control, name: base });

  const line = watch(`lines.${lineIndex}`) as Record<string, unknown> | undefined;
  const dist = (watch(base) as Record<string, unknown>[] | undefined) || [];
  const lineAmount = lineDistributionAmount(line, amountFields);
  const distTotal = round(dist.reduce((a, r) => a + num(r?.Amount), 0));
  const remaining = round(lineAmount - distTotal);

  const hasRate = fields.some((f) => f.fieldName === 'RatePercent');
  const hasAmount = fields.some((f) => f.fieldName === 'Amount');

  const addRow = () => {
    const amt = remaining > 0 ? remaining : 0;
    append({
      RatePercent: lineAmount > 0 && amt > 0 ? round((amt / lineAmount) * 100, 4) : '',
      Amount: amt || '',
    });
  };

  const renderNumber = (field: FormFieldDto, index: number) => {
    const name = `${base}.${index}.${field.fieldName}`;
    const reg = register(name, {
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (lineAmount <= 0) return;
        const v = num(e.target.value);
        if (field.fieldName === 'RatePercent' && hasAmount) {
          setValue(`${base}.${index}.Amount`, round((lineAmount * v) / 100), { shouldDirty: true });
        } else if (field.fieldName === 'Amount' && hasRate) {
          setValue(`${base}.${index}.RatePercent`, round((v / lineAmount) * 100, 4), {
            shouldDirty: true,
          });
        }
      },
    });
    return (
      <input
        type="number"
        step="any"
        min={0}
        inputMode="decimal"
        disabled={readOnly}
        placeholder={field.label}
        className="w-full h-8 px-2 text-[12px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 tabular-nums"
        {...reg}
      />
    );
  };

  return (
    <section
      className={
        embedded
          ? 'space-y-2'
          : 'rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-2 space-y-2 shrink-0'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Split className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 truncate">
            Dağıtım Detayı — {lineIndex + 1}. satır
            {lineCaption ? <span className="ml-1 font-normal text-slate-500">· {lineCaption}</span> : null}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-500">
            Satır tutarı <b className="tabular-nums text-slate-800 dark:text-slate-100">{fmt(lineAmount)}</b>
          </span>
          <span className="text-slate-500">
            Dağıtılan <b className="tabular-nums text-slate-800 dark:text-slate-100">{fmt(distTotal)}</b>
          </span>
          <span className={remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}>
            Kalan <b className="tabular-nums">{fmt(remaining)}</b>
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 px-2.5 h-7 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Dağıtım Ekle
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="w-8 px-1 py-1.5 text-center text-[10px] font-semibold text-slate-500">#</th>
              {fields.map((f) => (
                <th
                  key={f.fieldId}
                  className={`px-1.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap ${
                    f.fieldType === 'number' ? 'w-[110px]' : 'min-w-[160px]'
                  }`}
                >
                  {f.label}
                </th>
              ))}
              {!readOnly && <th className="w-8 px-1 py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={fields.length + (readOnly ? 1 : 2)}
                  className="px-3 py-3 text-[11px] text-slate-400 text-center"
                >
                  Bu satır için dağıtım yok. «Dağıtım Ekle» ile 5 boyuta (işyeri, kişiler, araçlar…) göre bölün.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                  <td className="w-8 px-1 py-1 text-center text-[11px] text-slate-400">{index + 1}</td>
                  {fields.map((f) => (
                    <td key={`${row.id}-${f.fieldId}`} className="px-1 py-1 align-middle">
                      {f.fieldType === 'number' ? (
                        renderNumber(f, index)
                      ) : (
                        <FieldRenderer
                          field={f}
                          register={register}
                          registerNameOverride={`${base}.${index}.${f.fieldName}`}
                          hideLabel
                          compact
                          disabled={readOnly}
                        />
                      )}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="w-8 px-0.5 py-1 text-center">
                      <button
                        type="button"
                        title="Dağıtımı çıkar"
                        onClick={() => remove(index)}
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
    </section>
  );
};
