using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

[ApiController]
[Route("api/document-links")]
public sealed class DocumentLinksController : ControllerBase
{
    private readonly DocumentLinksService _svc;

    public DocumentLinksController(DocumentLinksService svc) => _svc = svc;

    [HttpGet("{table}/{id:int}")]
    public async Task<IActionResult> List(string table, int id, CancellationToken ct) =>
        Ok(await _svc.ListAsync(table, id, ct));
}
