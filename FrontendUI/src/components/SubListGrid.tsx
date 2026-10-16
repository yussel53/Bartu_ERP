import React from 'react';
import { FieldError, FieldErrors, FieldValues, UseFormRegister, get } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { FormFieldDto } from '../types/formTypes';
import { FieldRenderer } from './FieldRenderer';

interface SubListGridProps {
  /** Başlık (örn. Yetkililer) — boşsa başlık satırı çizilmez */
  title?: string;
  icon?: React.ReactNode;
  hint?: string;
  rows: { id: string }[];
  fields: FormFieldDto[];
  /** react-hook-form dizi adı: contacts → contacts.{i}.{FieldName} */
  prefix: string;
  register: UseFormRegister<FieldValues>;
  errors: FieldErrors;
  readOnly?: boolean;
  addLabel?: string;
  emptyText?: string;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
}

/** Kart içi alt liste (yetkili, hesap, barkod…) — kurumsal ızgara: başlıklı sütunlar, satır başına tek satır */
export const SubListGrid: React.FC<SubListGridProps> = ({
  title,
  icon,
  hint,
  rows,
  fields,
  prefix,
  register,
  errors,
  readOnly = false,
  addLabel = 'Satır Ekle',
  emptyText = 'Kayıt yok.',
  onAdd,
  onRemove,
}) => (
  <div className="space-y-1.5">
    {(title || (!readOnly && onAdd)) && (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {title && (
            <h3 className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              {icon}
              {title}
            </h3>
          )}
          {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
        </div>
        {!readOnly && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-sm"
          >
            <Plus className="w-3 h-3" />
            {addLabel}
          </button>
        )}
      </div>
    )}

    <div className="overflow-x-auto border border-slate-300 dark:border-slate-600 rounded-sm">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="w-8 px-1.5 py-1 text-center font-medium text-slate-500 border-b border-r border-slate-300 dark:border-slate-600">
              #
            </th>
            {fields.map((f) => (
              <th
                key={f.fieldName}
                className="px-1.5 py-1 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap border-b border-r border-slate-300 dark:border-slate-600"
                style={{ minWidth: Math.max(90, (f.colSpan || 3) * 34) }}
              >
                {f.label}
                {f.isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </th>
            ))}
            {!readOnly && onRemove && <th className="w-8 border-b border-slate-300 dark:border-slate-600" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={fields.length + 2}
                className="px-3 py-4 text-center text-[11px] text-slate-400"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                <td className="px-1.5 py-0.5 text-center text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-b border-r border-slate-200 dark:border-slate-700">
                  {index + 1}
                </td>
                {fields.map((field) => (
                  <td
                    key={`${row.id}-${field.fieldId}`}
                    className="px-1 py-0.5 border-b border-r border-slate-200 dark:border-slate-700 align-middle"
                  >
                    <FieldRenderer
                      field={field}
                      register={register}
                      registerNameOverride={`${prefix}.${index}.${field.fieldName}`}
                      hideLabel
                      compact
                      disabled={readOnly}
                      error={get(errors, `${prefix}.${index}.${field.fieldName}`) as FieldError | undefined}
                    />
                  </td>
                ))}
                {!readOnly && onRemove && (
                  <td className="px-1 text-center border-b border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      title="Satırı sil"
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);
