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
