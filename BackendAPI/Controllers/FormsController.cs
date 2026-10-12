using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using BartuERP.Backend.Models;
using BartuERP.Backend.Repositories;

namespace BartuERP.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FormsController : ControllerBase
    {
        private readonly DynamicFormRepository _repository;

        public FormsController(DynamicFormRepository repository)
        {
            _repository = repository;
        }

        [HttpGet("{formCode}/schema")]
        public async Task<IActionResult> GetFormSchema(string formCode)
        {
            var schema = await _repository.GetFormSchemaAsync(formCode);
            
            if (schema == null)
            {
                return NotFound($"Form schema for '{formCode}' not found.");
            }

            return Ok(schema);
        }

        [HttpPost("{tableName}/{primaryKeyColumn}")]
        public async Task<IActionResult> SaveFormData(string tableName, string primaryKeyColumn, [FromBody] DynamicFormDataDto formData)
        {
            // İsteğe bağlı olarak yetki kontrolü ve tablo adı whitelist doğrulaması yapılmalıdır.
            try
            {
                var recordId = await _repository.SaveDynamicRecordAsync(tableName, primaryKeyColumn, formData);
                return Ok(new { success = true, recordId });
            }
            catch (System.Exception ex)
            {
                // TODO: Log exception
                return BadRequest(new { success = false, message = ex.Message });
            }
        }
    }
}
