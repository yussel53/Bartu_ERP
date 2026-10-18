using System.Data;
using BartuERP.Backend.Repositories;
using Dapper;

namespace BartuERP.Backend.Services.EGovRules;

public sealed class RuleRunRequest
{
    /// <summary>UBL (yoksa EGovDocumentId'den ya da örnek belgeden)</summary>
    public string? Xml { get; set; }
    public int? EGovDocumentId { get; set; }
    public int? InvoiceId { get; set; }
    /// <summary>1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye (boş: belgeden)</summary>
    public byte? DocKind { get; set; }
    /// <summary>1 gelen · 2 giden</summary>
    public byte Direction { get; set; } = 2;
    public int? CompanyId { get; set; }
    /// <summary>Kaydedilmemiş tek kural (ekranda «Dene»)</summary>
    public TransformRule? Rule { get; set; }
    /// <summary>Yalnız bu kurallar (boş: tüm etkin kurallar)</summary>
    public List<int>? RuleIds { get; set; }
    /// <summary>Tek kural denerken koşulları yok say</summary>
    public bool IgnoreConditions { get; set; }
    /// <summary>Örnek belge: invoice · earsiv · despatch</summary>
    public string? Sample { get; set; }
}

/// <summary>
/// e-Belge kural motoru: gönderim öncesi UBL'e etkin kuralları öncelik sırasıyla uygular.
/// Giden belge üretimi (E-03) imza/gönderim öncesi <see cref="ApplyForSendAsync"/> çağırır; ekran önizlemesi <see cref="RunAsync"/>.
/// </summary>
public sealed class EGovRuleEngine
{
    private readonly IDbConnection _db;
    private readonly CardStatementRepository _statement;
    private readonly ILogger<EGovRuleEngine> _log;

    public EGovRuleEngine(IDbConnection db, CardStatementRepository statement, ILogger<EGovRuleEngine> log)
    {
        _db = db;
        _statement = statement;
        _log = log;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public async Task<List<TransformRule>> ActiveRulesAsync(CancellationToken ct)
    {
        Open();
        if (await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(N'dbo.EGovTransformRule', N'U') IS NULL THEN 0 ELSE 1 END") == 0)
            return new();
        return (await _db.QueryAsync<TransformRule>(new CommandDefinition(
            "SELECT * FROM dbo.EGovTransformRule WHERE IsActive = 1 ORDER BY Priority, EGovTransformRuleID", cancellationToken: ct))).ToList();
    }

    /// <summary>Gönderim: etkin kurallar uygulanır (SQL_EXEC kalıcıdır), günlük yazılır; değişen UBL döner</summary>
    public async Task<RuleRunResult> ApplyForSendAsync(string xml, byte docKind, int? invoiceId, int? egovDocumentId, int? companyId, CancellationToken ct)
    {
        var r = await ExecuteAsync(new RuleRunRequest
        {
            Xml = xml, DocKind = docKind, Direction = 2, InvoiceId = invoiceId, EGovDocumentId = egovDocumentId, CompanyId = companyId,
        }, preview: false, ct);
        await LogAsync(r, invoiceId, egovDocumentId, ct);
        return r;
    }

    /// <summary>Önizleme: hiçbir şey kalıcı olmaz</summary>
    public Task<RuleRunResult> RunAsync(RuleRunRequest req, CancellationToken ct) => ExecuteAsync(req, preview: true, ct);

    private async Task<RuleRunResult> ExecuteAsync(RuleRunRequest req, bool preview, CancellationToken ct)
    {
        Open();
        var xml = req.Xml;
        byte direction = req.Direction;
        if (string.IsNullOrWhiteSpace(xml) && req.EGovDocumentId is int egid)
        {
            var d = await _db.QueryFirstOrDefaultAsync(new CommandDefinition(
                "SELECT XmlContent, DocKind, Direction FROM dbo.EGovDocument WHERE EGovDocumentID = @egid", new { egid }, cancellationToken: ct));
            xml = (string?)d?.XmlContent;
            req.DocKind ??= d?.DocKind == null ? null : Convert.ToByte(d.DocKind);
            if (d?.Direction != null) direction = Convert.ToByte(d.Direction);
            if (string.IsNullOrWhiteSpace(xml)) throw new InvalidOperationException("Belgenin UBL/XML içeriği yok.");
        }
        if (string.IsNullOrWhiteSpace(xml)) xml = EGovXsltService.SampleXml(req.Sample ?? (req.DocKind == 3 ? "despatch" : req.DocKind == 2 ? "earsiv" : "invoice"));

        var ubl = UblDoc.Parse(xml);
        var docKind = req.DocKind ?? (byte)(ubl.IsDespatch ? 3 : string.Equals(ubl.ProfileId, "EARSIVFATURA", StringComparison.OrdinalIgnoreCase) ? 2 : 1);
        var result = new RuleRunResult { OriginalXml = xml };
        var ctx = new RuleContext(_db, _statement, ubl, docKind, direction, preview, req.InvoiceId, req.EGovDocumentId) { CompanyId = req.CompanyId };

        var single = req.Rule != null;
        var rules = single ? new List<TransformRule> { req.Rule! } : await ActiveRulesAsync(ct);
        if (req.RuleIds is { Count: > 0 } ids) rules = rules.Where(r => ids.Contains(r.EGovTransformRuleID)).ToList();

        foreach (var rule in rules)
        {
            var step = new RuleStepResult { RuleId = rule.EGovTransformRuleID, RuleName = rule.Name, TemplateCode = rule.TemplateCode };
            result.Steps.Add(step);
            try
            {
                var template = RuleTemplates.Find(rule.TemplateCode) ?? throw new InvalidOperationException($"Bilinmeyen şablon: {rule.TemplateCode}");
                if (!(single && req.IgnoreConditions))
                {
                    var why = await SkipReasonAsync(rule, template, ctx, docKind, direction, ct);
                    if (why != null)
                    {
                        step.Message = why;
                        continue;
                    }
                }
                await template.ApplyAsync(ubl, ctx, rule.Params(), step, ct);
                step.Status = step.Changes.Count > 0 ? "applied" : "skipped";
                step.Message ??= step.Changes.Count == 0 ? "Değişiklik yok" : null;
                if (rule.StopAfter && step.Changes.Count > 0) break;
            }
            catch (Exception ex)
            {
                step.Status = "error";
                step.Message = ex.Message;
                _log.LogWarning(ex, "e-Belge kuralı hata verdi: {Rule}", rule.Name);
            }
        }

        result.Xml = ubl.ToString();
        result.Values = new Dictionary<string, string>(await ctx.HeaderAsync(ct));
        return result;
    }

    private static async Task<string?> SkipReasonAsync(TransformRule rule, IRuleTemplate template, RuleContext ctx, byte docKind, byte direction, CancellationToken ct)
    {
        if (rule.Direction != 0 && rule.Direction != direction) return direction == 1 ? "Gelen belge (kural giden için)" : "Giden belge (kural gelen için)";
        var kinds = (rule.DocKinds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (kinds.Length > 0 && !kinds.Contains(docKind.ToString())) return "Belge türü kapsam dışı";
        if (!template.Info.DocKinds.Contains(docKind)) return "Şablon bu belge türünde çalışmaz";

        var c = rule.Conditions();
        if (rule.CompanyID is int rc && ctx.CompanyId is int dc && rc != dc) return "Firma koşulu tutmadı";
        if (c.CompanyId is int cc && ctx.CompanyId is int dc2 && cc != dc2) return "Firma koşulu tutmadı";
        var u = ctx.Ubl;
        if (!RuleTemplates.MatchAny(u.ProfileId, c.Profiles)) return $"Senaryo {u.ProfileId} koşula uymuyor";
        if (!RuleTemplates.MatchAny(u.TypeCode, c.TypeCodes)) return $"Tip {u.TypeCode} koşula uymuyor";
        if (!string.IsNullOrWhiteSpace(c.Currencies))
        {
            var cur = u.Currency ?? "TRY";
            var list = c.Currencies.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var neg = list.Where(x => x.StartsWith('!')).Select(x => x[1..]).ToList();
            var pos = list.Where(x => !x.StartsWith('!')).ToList();
            if (neg.Contains(cur, StringComparer.OrdinalIgnoreCase) || (pos.Count > 0 && !pos.Contains(cur, StringComparer.OrdinalIgnoreCase)))
                return $"Para birimi {cur} koşula uymuyor";
        }
        if (!string.IsNullOrWhiteSpace(c.TaxNumbers) || !string.IsNullOrWhiteSpace(c.CustomerCodes))
        {
            var h = await ctx.HeaderAsync(ct);
            if (!RuleTemplates.MatchAny(h["Cari.VKN"], c.TaxNumbers)) return "VKN koşulu tutmadı";
            if (!RuleTemplates.MatchAny(h["Cari.Kod"], c.CustomerCodes)) return $"Cari kodu «{h["Cari.Kod"]}» koşula uymuyor";
        }
        return null;
    }

    private async Task LogAsync(RuleRunResult r, int? invoiceId, int? egovDocumentId, CancellationToken ct)
    {
        try
        {
            foreach (var s in r.Steps.Where(s => s.Status != "skipped" || s.Message != null))
                await _db.ExecuteAsync(new CommandDefinition(@"
INSERT INTO dbo.EGovTransformRuleLog (EGovTransformRuleID, EGovDocumentID, InvoiceID, DocumentNo, Changed, Message)
VALUES (@rule, @egov, @inv, @no, @changed, @msg)", new
                {
                    rule = s.RuleId == 0 ? (int?)null : s.RuleId,
                    egov = egovDocumentId,
                    inv = invoiceId,
                    no = r.Values.TryGetValue("Belge.No", out var no) ? no : null,
                    changed = s.Changes.Count > 0,
                    msg = (s.Message ?? string.Join(" | ", s.Changes)) is { Length: > 1000 } m ? m[..1000] : s.Message ?? string.Join(" | ", s.Changes),
                }, cancellationToken: ct));
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Kural günlüğü yazılamadı");
        }
    }
}
