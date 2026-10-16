import React from 'react';
import { UseFormSetValue, UseFormWatch, FieldValues } from 'react-hook-form';

export interface FormFieldContextValue {
  setValue: UseFormSetValue<FieldValues>;
  watch: UseFormWatch<FieldValues>;
}

export const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

export function useFormFieldContext(): FormFieldContextValue | null {
  return React.useContext(FormFieldContext);
}

/**
 * Alan yerleşimi:
 * - 'watermark' (varsayılan): etiket kutunun içinde yer tutucu (alt liste satırları, eski görünüm)
 * - 'inline': kurumsal form — solda sabit genişlikte etiket, sağda kutu (kart / belge başlığı)
 */
export type FieldLayout = 'watermark' | 'inline';

export const FieldLayoutContext = React.createContext<FieldLayout>('watermark');

/** Kurumsal form ızgarası: iki sütun, etiket solda */
export const InlineFieldGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <FieldLayoutContext.Provider value="inline">
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-[5px] ${className}`}>{children}</div>
  </FieldLayoutContext.Provider>
);
