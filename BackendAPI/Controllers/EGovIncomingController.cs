using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

public sealed class EGovIncomingActionDto
{
    public int UserId { get; set; }
    public string? Comment { get; set; }
}

/// <summary>
/// Gelen e-Fatura onay akışı: Onaya Gönder → Onayla / Reddet → ERP'ye Kaydet (alış faturası).
/// Listeler: api/egov/documents?…&amp;stage=new|pending|approved|saved
/// </summary>
[ApiController]
[Route("api/egov/incoming")]
public sealed class EGovIncomingController : ControllerBase
{
    private readonly EGovIncomingRepository _repo;
    private readonly PostSaveRepository _postSave;
    private readonly ProcessRepository _process;

    public EGovIncomingController(EGovIncomingRepository repo, PostSaveRepository postSave, ProcessRepository process)
    {
        _repo = repo;
        _postSave = postSave;
        _process = process;
    }

    [HttpPost("{id:int}/send")]
    public async Task<IActionResult> Send(int id, [FromBody] EGovIncomingActionDto dto, CancellationToken ct)
    {
        try
        {
            var (ok, message) = await _repo.SendAsync(id, dto.UserId, dto.Comment, ct);
            return ok ? Ok(new { success = true, message }) : BadRequest(new { message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/approve")]
    public Task<IActionResult> Approve(int id, [FromBody] EGovIncomingActionDto dto, CancellationToken ct) => Decide(id, dto, true, ct);

    [HttpPost("{id:int}/reject")]
    public Task<IActionResult> Reject(int id, [FromBody] EGovIncomingActionDto dto, CancellationToken ct) => Decide(id, dto, false, ct);

    private async Task<IActionResult> Decide(int id, EGovIncomingActionDto dto, bool approve, CancellationToken ct)
    {
        try
        {
            if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovIncomingRepository.MissingSetupMessage });
            var (ok, status, message) = await _repo.DecideAsync(id, dto.UserId, approve, dto.Comment, ct);
            return ok ? Ok(new { success = true, message }) : StatusCode(status, new { message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    /// <summary>UBL'den satırlar + tedarikçi + malzeme–cari bağlantısından bulunan malzemeler.</summary>
    [HttpGet("{id:int}/save-preview")]
    public async Task<IActionResult> SavePreview(int id, CancellationToken ct)
    {
        try
        {
            if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovIncomingRepository.MissingSetupMessage });
            var state = await _repo.GetStateAsync(id, ct);
            if (state is null) return NotFound(new { message = $"e-Belge #{id} bulunamadı." });
            var (preview, error) = await _repo.PreviewAsync(id, ct);
            return preview is null
                ? BadRequest(new { message = error })
                : Ok(new { stage = state.Stage, invoiceId = state.InvoiceID, preview });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/save")]
    public async Task<IActionResult> Save(int id, [FromBody] EGovIncomingSaveRequest req, CancellationToken ct)
    {
        try
        {
            if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovIncomingRepository.MissingSetupMessage });
            var (ok, invoiceId, message, body) = await _repo.SaveAsync(id, req, ct);
            if (!ok) return BadRequest(new { message });

            // RecordsController.Save ile aynı kayıt sonrası adımlar (hata kaydı bozmaz)
            var warnings = new List<string>();
            try
            {
                var actions = await _postSave.LoadFromDbAsync(body!.FormCode!, ct);
                if (actions.Count > 0)
                {
                    var fields = new Dictionary<string, object?>(body.StandardFields!, StringComparer.OrdinalIgnoreCase)
                    {
                        ["recId"] = invoiceId,
                    };
                    var results = await _postSave.RunAsync(actions, invoiceId, fields, ct);
                    var failed = results.FirstOrDefault(r => !r.Success);
                    if (failed != null) warnings.Add($"PostSave hata: {failed.Message}");
                }
            }
            catch (Exception ex)
            {
                warnings.Add($"PostSave hata: {ex.Message}");
            }
            try
            {
                await _process.StartByTriggerAsync(new ProcessTriggerStartRequest
                {
                    TriggerType = 2, // OnVoucherSave
                    SourceTable = "Invoice",
                    SourceId = invoiceId,
                    StartedBy = req.UserId > 0 ? req.UserId : null,
                    Context = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["formCode"] = body!.FormCode,
                        ["typeFilter"] = body.StandardFields!["InvoiceType"]?.ToString(),
                    },
                }, ct);
            }
            catch
            {
                /* süreç başlatma kaydı etkilemez */
            }

            return Ok(new
            {
                success = true,
                invoiceId,
                message = warnings.Count == 0 ? message : $"{message} · {string.Join(" · ", warnings)}",
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
