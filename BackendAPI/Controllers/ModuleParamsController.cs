using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/module-params")]
public sealed class ModuleParamsController : ControllerBase
{
    private readonly ModuleParamsService _svc;

    public ModuleParamsController(ModuleParamsService svc)
    {
        _svc = svc;
    }

    /// <summary>Kart öndeğeri: STK_KDV_* oranından TaxCardID (malzeme kartı Vergi Kartı).</summary>
    [HttpGet("tax-card/{settingCode}")]
    public async Task<IActionResult> TaxCardForSetting(string settingCode)
    {
        var (id, rate) = await _svc.ResolveTaxCardForSettingAsync(settingCode);
        return Ok(new { taxCardId = id, rate });
    }

    [HttpGet("{moduleKey}")]
    public async Task<IActionResult> List(string moduleKey) => Ok(await _svc.ListAsync(moduleKey));

    public sealed class SaveBody
    {
        public List<ModuleParamItem>? Items { get; set; }
    }

    [HttpPut("{moduleKey}")]
    public async Task<IActionResult> Save(string moduleKey, [FromBody] SaveBody body)
    {
        await _svc.SaveAsync(moduleKey, body.Items ?? new());
        return Ok(await _svc.ListAsync(moduleKey));
    }
}
