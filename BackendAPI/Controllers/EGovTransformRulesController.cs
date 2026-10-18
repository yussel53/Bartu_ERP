using System.Data;
using System.Text.Json;
using BartuERP.Backend.Services;
using BartuERP.Backend.Services.EGovRules;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BartuERP.Backend.Controllers;

/// <summary>
/// e-Belge kuralları (gönderim öncesi UBL değişiklikleri): şablon kataloğu, hazır kurallar, kural kaydı, önizleme.
/// Kayıt / silme yalnız yönetici; «Gelişmiş» (SQL) şablonlar zaten yönetici işidir.
/// </summary>
[ApiController]
[Route("api/egov/transform-rules")]
public sealed class EGovTransformRulesController : ControllerBase
{
    private readonly IDbConnection _db;
    private readonly EGovRuleEngine _engine;

    public EGovTransformRulesController(IDbConnection db, EGovRuleEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    /// <summary>Şablonlar + hazır kurallar + yer tutucular</summary>
    [HttpGet("catalog")]
    public IActionResult Catalog() => Ok(new
    {
        templates = RuleTemplates.All.Select(t => t.Info),
        presets = RulePresets.All,
        placeholders = RuleContext.Placeholders.Select(p => new { key = p.Key, label = p.Label, line = p.Line }),
    });

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        try
        {
            Open();
            var rules = await _db.QueryAsync<TransformRule>(new CommandDefinition(
                "SELECT * FROM dbo.EGovTransformRule ORDER BY Priority, EGovTransformRuleID", cancellationToken: ct));
            return Ok(rules);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpPost]
    public async Task<IActionResult> Save([FromBody] TransformRule rule, CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(rule.Name)) return BadRequest(new { message = "Kural adı boş olamaz." });
            var template = RuleTemplates.Find(rule.TemplateCode);
            if (template == null) return BadRequest(new { message = $"Bilinmeyen şablon: {rule.TemplateCode}" });
            var p = rule.Params();
            var missing = template.Info.Params.Where(x => x.Required && (!p.TryGetValue(x.Key, out var v) || string.IsNullOrWhiteSpace(v)))
                .Select(x => x.Label).ToList();
            if (missing.Count > 0) return BadRequest(new { message = "Zorunlu: " + string.Join(", ", missing) });
            try
            {
                rule.Conditions();
            }
            catch (JsonException)
            {
                return BadRequest(new { message = "Koşullar okunamadı." });
            }

            Open();
            var args = new
            {
                rule.EGovTransformRuleID, rule.Name, rule.TemplateCode, rule.DocKinds, rule.Direction, rule.ParamsJson,
                rule.ConditionsJson, rule.Priority, rule.StopAfter, rule.IsActive, rule.Description, rule.CompanyID,
                CreatedBy = User.UserId(),
            };
            int id;
            if (rule.EGovTransformRuleID > 0)
            {
                await _db.ExecuteAsync(new CommandDefinition(@"
UPDATE dbo.EGovTransformRule SET Name = @Name, TemplateCode = @TemplateCode, DocKinds = @DocKinds, Direction = @Direction,
       ParamsJson = @ParamsJson, ConditionsJson = @ConditionsJson, Priority = @Priority, StopAfter = @StopAfter,
       IsActive = @IsActive, Description = @Description, CompanyID = @CompanyID, UpdatedAt = SYSDATETIME()
WHERE EGovTransformRuleID = @EGovTransformRuleID", args, cancellationToken: ct));
                id = rule.EGovTransformRuleID;
            }
            else
            {
                id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(@"
INSERT INTO dbo.EGovTransformRule (Name, TemplateCode, DocKinds, Direction, ParamsJson, ConditionsJson, Priority, StopAfter,
                                   IsActive, Description, CompanyID, CreatedBy)
OUTPUT INSERTED.EGovTransformRuleID
VALUES (@Name, @TemplateCode, @DocKinds, @Direction, @ParamsJson, @ConditionsJson, @Priority, @StopAfter,
        @IsActive, @Description, @CompanyID, @CreatedBy)", args, cancellationToken: ct));
            }
            return Ok(new { success = true, id });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    [Authorize(Policy = AuthClaims.AdminPolicy)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        Open();
        await _db.ExecuteAsync(new CommandDefinition("DELETE FROM dbo.EGovTransformRule WHERE EGovTransformRuleID = @id", new { id }, cancellationToken: ct));
        return Ok(new { success = true });
    }

    /// <summary>Önizleme (kalıcı değişiklik yok): kaydedilmemiş tek kural ya da etkin kural seti, örnek veya seçilen belge üzerinde</summary>
    [HttpPost("preview")]
    public async Task<IActionResult> Preview([FromBody] RuleRunRequest req, CancellationToken ct)
    {
        try
        {
            if (req.Rule != null && RuleTemplates.Find(req.Rule.TemplateCode)?.Info.AdminOnly == true && !User.IsAdmin())
                return StatusCode(403, new { message = "SQL şablonlarını yalnız yönetici deneyebilir." });
            return Ok(await _engine.RunAsync(req, ct));
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Son uygulama günlüğü</summary>
    [HttpGet("log")]
    public async Task<IActionResult> Log([FromQuery] int take = 100, CancellationToken ct = default)
    {
        Open();
        var rows = await _db.QueryAsync(new CommandDefinition($@"
SELECT TOP {Math.Clamp(take, 1, 500)} l.*, r.Name AS RuleName
FROM dbo.EGovTransformRuleLog l LEFT JOIN dbo.EGovTransformRule r ON r.EGovTransformRuleID = l.EGovTransformRuleID
ORDER BY l.Id DESC", cancellationToken: ct));
        return Ok(rows);
    }
}
