using BartuERP.Backend.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>E-Devlet → Tanımlar → Tasarım Şablonları → Şablonlar (hangi belgede hangi tasarım).</summary>
[ApiController]
[Route("api/egov/design-rules")]
public sealed class EGovDesignRulesController : ControllerBase
{
    private readonly EGovDesignRepository _repo;

    public EGovDesignRulesController(EGovDesignRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] short? docType, CancellationToken ct)
    {
        if (!await _repo.ReadyAsync(ct))
            return Ok(new { ready = false, message = EGovDesignRepository.MissingTableMessage, rows = Array.Empty<object>() });
        return Ok(new { ready = true, rows = await _repo.ListRulesAsync(docType is > 0 ? docType : null, ct) });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EGovDesignRuleInput dto, CancellationToken ct)
    {
        if (!await _repo.ReadyAsync(ct)) return BadRequest(new { message = EGovDesignRepository.MissingTableMessage });
        var error = await _repo.ValidateRuleAsync(dto, 0, ct);
        if (error != null) return BadRequest(new { message = error });
        var id = await _repo.CreateRuleAsync(dto, ct);
        return Ok(new { success = true, id, message = "Şablon eklendi." });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] EGovDesignRuleInput dto, CancellationToken ct)
    {
        var error = await _repo.ValidateRuleAsync(dto, id, ct);
        if (error != null) return BadRequest(new { message = error });
        var ok = await _repo.UpdateRuleAsync(id, dto, ct);
        return ok ? Ok(new { success = true, message = "Şablon güncellendi." }) : NotFound(new { message = $"Şablon #{id} bulunamadı." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var ok = await _repo.DeleteRuleAsync(id, ct);
        return ok ? Ok(new { success = true, message = "Şablon silindi." }) : NotFound(new { message = $"Şablon #{id} bulunamadı." });
    }

    /// <summary>
    /// Gönderimde kullanılacak tasarım. Örn: ?docType=1&amp;receiverTaxNr=1234567890&amp;specialCode=IHRACAT
    /// Eşleşen şablon yoksa found=false → e-Logo varsayılan tasarımı.
    /// </summary>
    [HttpGet("resolve")]
    public async Task<IActionResult> Resolve([FromQuery] short docType, [FromQuery] EGovDesignContext context, CancellationToken ct)
    {
        if (!EGovDesignCodes.DocTypes.ContainsKey(docType)) return BadRequest(new { message = "Geçersiz belge türü." });
        if (!await _repo.ReadyAsync(ct)) return Ok(new { found = false, message = EGovDesignRepository.MissingTableMessage });
        var r = await _repo.ResolveAsync(docType, context, ct);
        if (r is null)
            return Ok(new { found = false, message = "Eşleşen şablon yok — e-Logo varsayılan tasarımı kullanılır." });
        return Ok(new
        {
            found = true,
            ruleId = r.EGovDesignRuleID,
            ruleType = r.RuleType,
            ruleTypeName = EGovDesignCodes.RuleTypes[r.RuleType],
            ruleValue = r.RuleValue,
            priority = r.Priority,
            designId = r.EGovXsltDesignID,
            designTitle = r.DesignTitle,
        });
    }
}
