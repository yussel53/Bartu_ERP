import React from 'react';
import { useForm, FieldValues } from 'react-hook-form';
import { FormSchemaDto, DynamicFormDataDto } from '../types/formTypes';
import { FieldRenderer } from './FieldRenderer';

interface DynamicFormEngineProps {
  schema: FormSchemaDto;
  initialData?: DynamicFormDataDto;
  onSubmit: (data: DynamicFormDataDto) => void;
  isLoading?: boolean;
}

export const DynamicFormEngine: React.FC<DynamicFormEngineProps> = ({ 
  schema, 
  initialData, 
  onSubmit,
  isLoading = false
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm<FieldValues>({
    defaultValues: {
      standardFields: initialData?.standardFields || {},
      additionalFields: initialData?.additionalFields || {}
    }
  });

  const handleFormSubmit = (data: FieldValues) => {
    // Transform react-hook-form data to DTO
    const payload: DynamicFormDataDto = {
      recordId: initialData?.recordId || 0,
      standardFields: data.standardFields || {},
      additionalFields: data.additionalFields || {}
    };
    onSubmit(payload);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-6 md:p-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 dark:border-slate-700/50">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
          {schema.title}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm font-medium">
          Dinamik Form Altyapısı • {schema.tableName}
        </p>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="grid grid-cols-12 gap-x-6 gap-y-6">
          {schema.fields.map((field) => (
            <FieldRenderer 
              key={field.fieldId} 
              field={field} 
              register={register} 
              error={
                field.fieldName.startsWith('U_') 
                  ? errors?.additionalFields?.[field.fieldName] 
                  : errors?.standardFields?.[field.fieldName]
              } 
            />
          ))}
        </div>

        <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50 flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className={`
              relative inline-flex items-center justify-center px-8 py-3.5 
              text-base font-bold text-white transition-all duration-200 
              bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent 
              rounded-xl shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600
              ${isLoading ? 'opacity-75 cursor-not-allowed' : 'hover:from-blue-500 hover:to-indigo-500'}
            `}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Kaydediliyor...
              </span>
            ) : (
              'Kaydet'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
