import React from 'react';
import { UseFormRegister, FieldValues } from 'react-hook-form';
import { FormFieldDto } from '../types/formTypes';

interface FieldRendererProps {
  field: FormFieldDto;
  register: UseFormRegister<FieldValues>;
  error?: any;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({ field, register, error }) => {
  const isUdf = field.fieldName.startsWith('U_');
  const registerName = isUdf ? `additionalFields.${field.fieldName}` : `standardFields.${field.fieldName}`;

  // Parse options if it's a select field
  let options = [];
  if (field.fieldType === 'select' && field.optionsJson) {
    try {
      options = JSON.parse(field.optionsJson);
    } catch (e) {
      console.error("Invalid JSON in optionsJson for field", field.fieldName);
    }
  }

  const baseInputClass = `
    w-full px-4 py-2.5 rounded-xl border bg-white/5 backdrop-blur-sm
    focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300
    text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:bg-slate-800/50
    shadow-sm hover:shadow-md outline-none
    ${error ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-200 dark:border-gray-700'}
  `;

  return (
    <div className={`col-span-12 md:col-span-${field.colSpan} flex flex-col gap-1.5`}>
      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
        {field.label}
        {field.isRequired && <span className="text-red-500 text-xs">*</span>}
      </label>
      
      {field.fieldType === 'text' && (
        <input
          type="text"
          className={baseInputClass}
          placeholder={`Enter ${field.label}...`}
          {...register(registerName, { required: field.isRequired })}
        />
      )}

      {field.fieldType === 'number' && (
        <input
          type="number"
          className={baseInputClass}
          placeholder="0.00"
          {...register(registerName, { required: field.isRequired })}
        />
      )}

      {field.fieldType === 'date' && (
        <input
          type="date"
          className={baseInputClass}
          {...register(registerName, { required: field.isRequired })}
        />
      )}

      {field.fieldType === 'checkbox' && (
        <div className="flex items-center h-full px-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              {...register(registerName, { required: field.isRequired })}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Active</span>
          </label>
        </div>
      )}

      {field.fieldType === 'select' && (
        <select
          className={`${baseInputClass} appearance-none cursor-pointer`}
          {...register(registerName, { required: field.isRequired })}
        >
          <option value="">Select an option...</option>
          {options.map((opt: any, idx: number) => (
            <option key={idx} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {error && (
        <span className="text-xs text-red-500 animate-pulse">This field is required</span>
      )}
    </div>
  );
};
