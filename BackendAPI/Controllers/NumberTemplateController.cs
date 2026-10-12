using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/number-templates")]
public sealed class NumberTemplateController : ControllerBase
{
    private readonly NumberTemplateRepository _repo;

    public NumberTemplateController(NumberTemplateRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<ActionResult> List(CancellationToken ct)
    {
        if (!await _repo.TableReadyAsync(ct))
        {
            return Ok(new
            {
                ready = false,
                message = "SYS_NumberTemplate henüz yok — SqlUpdates/30_number_template.sql uygulayın",
                items = Array.Empty<object>(),
            });
        }
        var items = await _repo.ListAsync(ct);
        return Ok(new { ready = true, items });
    }

    [HttpPost("allocate")]
    public async Task<ActionResult<NumberAllocateResult>> Allocate(
        [FromBody] NumberAllocateRequest body,
        CancellationToken ct)
    {
        var result = await _repo.AllocateAsync(body ?? new NumberAllocateRequest(), ct);
        return Ok(result);
    }
}
