using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/safe-params")]
public sealed class SafeParamsController : ControllerBase
{
    private readonly SafeParamsService _svc;

    public SafeParamsController(SafeParamsService svc)
    {
        _svc = svc;
    }

    [HttpGet]
    public async Task<IActionResult> List() => Ok(await _svc.ListAsync());

    public sealed class SaveBody
    {
        public List<SafeParamItem>? Items { get; set; }
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] SaveBody body)
    {
        await _svc.SaveAsync(body.Items ?? new());
        return Ok(await _svc.ListAsync());
    }
}
