using System.Collections.Generic;

namespace BartuERP.Backend.Models
{
    public class FormSchemaDto
    {
        public int FormId { get; set; }
        public string FormCode { get; set; }
        public string Title { get; set; }
        public string TableName { get; set; }
        public List<FormFieldDto> Fields { get; set; } = new List<FormFieldDto>();
    }

    public class FormFieldDto
    {
        public int FieldId { get; set; }
        public string FieldName { get; set; }
        public string Label { get; set; }
        public string FieldType { get; set; }
        public bool IsRequired { get; set; }
        public int ColSpan { get; set; }
        public int OrderIndex { get; set; }
        public string OptionsJson { get; set; }
        public string DefaultValue { get; set; }
    }

    // Dynamic veriyi kaydetmek için DTO
    public class DynamicFormDataDto
    {
        public int RecordId { get; set; } // Örn: ProductCardID
        public Dictionary<string, object> StandardFields { get; set; } = new Dictionary<string, object>();
        public Dictionary<string, object> AdditionalFields { get; set; } = new Dictionary<string, object>();
    }
}
