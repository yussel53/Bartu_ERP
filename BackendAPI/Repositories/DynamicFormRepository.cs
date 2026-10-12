using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using BartuERP.Backend.Models;
using Dapper;

namespace BartuERP.Backend.Repositories
{
    public class DynamicFormRepository
    {
        private readonly IDbConnection _dbConnection;

        public DynamicFormRepository(IDbConnection dbConnection)
        {
            _dbConnection = dbConnection;
        }

        public async Task<FormSchemaDto> GetFormSchemaAsync(string formCode)
        {
            var sqlForm = @"
                SELECT FormId, FormCode, Title, TableName 
                FROM SYS_Forms 
                WHERE FormCode = @FormCode AND IsActive = 1";
            
            var form = await _dbConnection.QuerySingleOrDefaultAsync<FormSchemaDto>(sqlForm, new { FormCode = formCode });
            
            if (form == null) return null;

            var sqlFields = @"
                SELECT FieldId, FieldName, Label, FieldType, IsRequired, ColSpan, OrderIndex, OptionsJson, DefaultValue 
                FROM SYS_FormFields 
                WHERE FormId = @FormId AND IsActive = 1
                ORDER BY OrderIndex";

            var fields = await _dbConnection.QueryAsync<FormFieldDto>(sqlFields, new { FormId = form.FormId });
            form.Fields = fields.ToList();

            return form;
        }

        // Generic Save Method using Dapper
        public async Task<int> SaveDynamicRecordAsync(string tableName, string primaryKeyColumn, DynamicFormDataDto formData)
        {
            // Prepare standard fields
            var columnNames = new List<string>();
            var paramNames = new List<string>();
            var parameters = new DynamicParameters();

            foreach (var kvp in formData.StandardFields)
            {
                columnNames.Add($"[{kvp.Key}]");
                paramNames.Add($"@{kvp.Key}");
                parameters.Add($"@{kvp.Key}", kvp.Value);
            }

            // Prepare UDF JSON field
            var additionalFieldsJson = JsonSerializer.Serialize(formData.AdditionalFields);
            columnNames.Add("[AdditionalFields]");
            paramNames.Add("@AdditionalFields");
            parameters.Add("@AdditionalFields", additionalFieldsJson);

            string sql;
            if (formData.RecordId == 0) // INSERT
            {
                sql = $@"
                    INSERT INTO [{tableName}] ({string.Join(", ", columnNames)}) 
                    VALUES ({string.Join(", ", paramNames)});
                    SELECT CAST(SCOPE_IDENTITY() as int);";

                return await _dbConnection.ExecuteScalarAsync<int>(sql, parameters);
            }
            else // UPDATE
            {
                var updateSets = new List<string>();
                for (int i = 0; i < columnNames.Count; i++)
                {
                    updateSets.Add($"{columnNames[i]} = {paramNames[i]}");
                }

                parameters.Add($"@{primaryKeyColumn}", formData.RecordId);

                sql = $@"
                    UPDATE [{tableName}] 
                    SET {string.Join(", ", updateSets)} 
                    WHERE [{primaryKeyColumn}] = @{primaryKeyColumn}";

                await _dbConnection.ExecuteAsync(sql, parameters);
                return formData.RecordId;
            }
        }
    }
}
