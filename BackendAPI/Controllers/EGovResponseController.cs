using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// Gelen TİCARİ faturaya KABUL / RED (e-Logo uygulama yanıtı — canlı adreste kilitli) ve
/// gelen / giden e-faturada harici itiraz / iptal kaydı (KEP · noter · telgraf · taahhütlü mektup · GİB portalı).
/// </summary>
[ApiController]
[Route("api/egov/response")]
public sealed class EGovResponseController : ControllerBase
{
    private readonly EGovResponseService _svc;

    public EGovResponseController(EGovResponseService svc) => _svc = svc;

    public sealed class RespondDto
    {
        /// <summary>KABUL · RED</summary>
        public string? Code { get; set; }
        public string? Note { get; set; }
    }

    public sealed class ObjectionDto
    {
        /// <summary>ITIRAZ · IPTAL</summary>
        public string? Kind { get; set; }
        /// <summary>KEP · NOTER · TELGRAF · TAAHHUTLU_MEKTUP · GIB_PORTAL</summary>
        public string? Method { get; set; }
        public DateTime? Date { get; set; }
        public string? DocNo { get; set; }
        public string? Description { get; set; }
    }

    private int? UserIdOrNull => User.UserId() > 0 ? User.UserId() : null;

    private async Task<IActionResult> Run(Func<Task<EGovResponseState>> f)
    {
        try { return Ok(await f()); }
        catch (EGovResponseBlockedException ex) { return Conflict(new { message = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (Exception ex) { return StatusCode(500, new { message = ex.Message }); }
    }

    [HttpGet("{id:int}")]
    public Task<IActionResult> State(int id, CancellationToken ct) => Run(() => _svc.StateAsync(id, ct));

    [HttpPost("{id:int}/respond")]
    public Task<IActionResult> Respond(int id, [FromBody] RespondDto dto, CancellationToken ct) =>
        Run(() => _svc.RespondAsync(id, dto.Code ?? "", dto.Note, UserIdOrNull, ct));

    [HttpPost("{id:int}/objection")]
    public Task<IActionResult> AddObjection(int id, [FromBody] ObjectionDto dto, CancellationToken ct) =>
        Run(() => _svc.AddObjectionAsync(id, dto.Kind, dto.Method, dto.Date, dto.DocNo, dto.Description, UserIdOrNull, ct));

    [HttpDelete("{id:int}/objection/{objectionId:int}")]
    public Task<IActionResult> CancelObjection(int id, int objectionId, CancellationToken ct) =>
        Run(() => _svc.CancelObjectionAsync(id, objectionId, UserIdOrNull, ct));
}
