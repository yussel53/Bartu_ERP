using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Kayıt kuralları — koşul + zorunlu alan. Kaydet bunları sağlamadan yazmaz.</summary>
[ApiController]
[Route("api/save-rules")]
public sealed class SaveRulesController : ControllerBase
{
    private readonly SaveRuleService _rules;

    public SaveRulesController(SaveRuleService rules) => _rules = rules;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await _rules.ListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveRuleDto body, CancellationToken ct)
    {
        try
        {
            var id = await _rules.SaveAsync(body, ct);
            return Ok(new { id });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _rules.DeleteAsync(id, ct);
        return Ok(new { ok = true });
    }
}
