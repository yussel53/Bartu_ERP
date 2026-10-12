import React, { useEffect, useState } from 'react';
import { DynamicFormEngine } from '../components/DynamicFormEngine';
import { FormSchemaDto, DynamicFormDataDto } from '../types/formTypes';

// Mock Schema Data
const mockSchema: FormSchemaDto = {
  formId: 1,
  formCode: 'ProductCardForm',
  title: 'Yeni Ürün Kartı',
  tableName: 'ProductCard',
  fields: [
    { fieldId: 1, fieldName: 'Code', label: 'Ürün Kodu', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 1 },
    { fieldId: 2, fieldName: 'Title', label: 'Ürün Adı', fieldType: 'text', isRequired: true, colSpan: 6, orderIndex: 2 },
    { fieldId: 3, fieldName: 'ProductType', label: 'Ürün Tipi', fieldType: 'select', isRequired: true, colSpan: 4, orderIndex: 3, optionsJson: '[{"label":"Ticari Mal","value":"1"},{"label":"Hammadde","value":"2"}]' },
    { fieldId: 4, fieldName: 'IsActive', label: 'Aktif Durumu', fieldType: 'checkbox', isRequired: false, colSpan: 4, orderIndex: 4 },
    { fieldId: 5, fieldName: 'U_WarrantyPeriod', label: 'Garanti Süresi (Ay)', fieldType: 'number', isRequired: false, colSpan: 4, orderIndex: 5 },
    { fieldId: 6, fieldName: 'U_ManufactureDate', label: 'Üretim Tarihi', fieldType: 'date', isRequired: true, colSpan: 6, orderIndex: 6 },
    { fieldId: 7, fieldName: 'U_Color', label: 'Renk Seçeneği', fieldType: 'select', isRequired: false, colSpan: 6, orderIndex: 7, optionsJson: '[{"label":"Kırmızı","value":"red"},{"label":"Mavi","value":"blue"}]' }
  ]
};

export const ProductFormPage: React.FC = () => {
  const [schema, setSchema] = useState<FormSchemaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Cache-First Metadata Strategy
    const loadSchema = async () => {
      try {
        const cachedSchema = localStorage.getItem('formSchema_ProductCardForm');
        // In a real app, you would check version/ETag via a light HEAD/GET request
        if (cachedSchema) {
          setSchema(JSON.parse(cachedSchema));
          setLoading(false);
          // Optional: Fetch silently in background to update cache
        } else {
          // Simulate API Call
          setTimeout(() => {
            setSchema(mockSchema);
            localStorage.setItem('formSchema_ProductCardForm', JSON.stringify(mockSchema));
            setLoading(false);
          }, 800);
        }
      } catch (error) {
        console.error("Failed to load schema", error);
        setLoading(false);
      }
    };

    loadSchema();
  }, []);

  const handleSubmit = async (data: DynamicFormDataDto) => {
    setIsSubmitting(true);
    console.log("Submitting payload to API:", JSON.stringify(data, null, 2));
    
    // Simulate API save delay
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Kayıt Başarılı!\nKonsolu kontrol edin.');
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-500 font-medium">Form Şeması Yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!schema) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      
      <div className="relative z-10">
        <DynamicFormEngine 
          schema={schema} 
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        />
      </div>
    </div>
  );
};
