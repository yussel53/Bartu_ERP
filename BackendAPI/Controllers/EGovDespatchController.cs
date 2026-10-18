using BartuERP.Backend.Repositories;
using BartuERP.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>Gelen e-İrsaliye → alış irsaliyesi (E-05): eşleme önizlemesi ve kayıt.</summary>
[ApiController]
[Route("api/egov/despatch")]
public sealed class EGovDespatchController : ControllerBase
{
    private readonly EGovDespatchRepository _repo;
    private readonly PostSaveRepository _postSave;
    private readonly ProcessRepository _process;
    private readonly DataScopeService _scope;

    public EGovDespatchController(EGovDespatchRepository repo, PostSaveRepository postSave, ProcessRepository process, DataScopeService scope)
    {
        _repo = repo;
        _postSave = postSave;
        _process = process;
        _scope = scope;
    }

    [HttpGet("{id:int}/save-preview")]
    public async Task<IActionResult> SavePreview(int id, CancellationToken ct)
    {
        try
        {
            if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovDespatchRepository.MissingSetupMessage });
            var (preview, error) = await _repo.PreviewAsync(id, ct);
            return preview is null ? BadRequest(new { message = error }) : Ok(preview);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/save")]
    public async Task<IActionResult> Save(int id, [FromBody] EGovDespatchSaveRequest req, CancellationToken ct)
    {
        try
        {
            // Y-02: kayıt kullanıcının firma / ambar kapsamında olmalı (RecordsController ile aynı kural)
            var scope = await _scope.GetAsync(ct);
            if (!scope.Unrestricted && !_scope.CanSee(scope, "ProductVoucher", new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["CompanyID"] = req.CompanyId,
                    ["WhouseID"] = req.WhouseId,
                }))
                return StatusCode(403, new { message = "Seçilen firma / ambar yetki kapsamınızın dışında." });

            var (ok, voucherId, message, body) = await _repo.SaveAsync(id, req, ct);
            if (!ok) return BadRequest(new { message });

            // RecordsController.Save ile aynı kayıt sonrası adımlar (hata kaydı bozmaz)
            var warnings = new List<string>();
            try
            {
                var actions = await _postSave.LoadFromDbAsync(body!.FormCode!, ct);
                if (actions.Count > 0)
                {
                    var fields = new Dictionary<string, object?>(body.StandardFields!, StringComparer.OrdinalIgnoreCase) { ["recId"] = voucherId };
                    var results = await _postSave.RunAsync(actions, voucherId, fields, ct);
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
                    SourceTable = "ProductVoucher",
                    SourceId = voucherId,
                    StartedBy = User.UserId() > 0 ? User.UserId() : null,
                    Context = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["formCode"] = body!.FormCode,
                        ["typeFilter"] = body.StandardFields!["VoucherType"]?.ToString(),
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
                productVoucherId = voucherId,
                message = warnings.Count == 0 ? message : $"{message} · {string.Join(" · ", warnings)}",
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
