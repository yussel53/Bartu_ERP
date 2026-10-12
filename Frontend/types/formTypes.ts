export interface FormFieldDto {
  fieldId: number;
  fieldName: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  isRequired: boolean;
  colSpan: number;
  orderIndex: number;
  optionsJson?: string; // e.g. [{"label":"Yes","value":"1"}]
  defaultValue?: string;
}

export interface FormSchemaDto {
  formId: number;
  formCode: string;
  title: string;
  tableName: string;
  fields: FormFieldDto[];
}

export interface DynamicFormDataDto {
  recordId: number;
  standardFields: Record<string, any>;
  additionalFields: Record<string, any>;
}
