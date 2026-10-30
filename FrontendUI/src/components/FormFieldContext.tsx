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

/** Kurumsal ızgaranın sütun sayısı — FieldRenderer geniş alan / etiket genişliğini buna göre ayarlar */
export const InlineColsContext = React.createContext<2 | 3>(2);

/** Kurumsal form ızgarası: iki (veya üç) sütun, etiket solda */
export const InlineFieldGrid: React.FC<{ children: React.ReactNode; className?: string; cols?: 2 | 3 }> = ({
  children,
  className = '',
  cols = 2,
}) => (
  <FieldLayoutContext.Provider value="inline">
    <InlineColsContext.Provider value={cols}>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${cols === 3 ? 'xl:grid-cols-3 gap-x-6' : 'gap-x-8'} gap-y-[5px] ${className}`}
      >
        {children}
      </div>
    </InlineColsContext.Provider>
  </FieldLayoutContext.Provider>
);
