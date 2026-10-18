using System.Text.Json;

namespace BartuERP.Backend.Services.EGovRules;

/// <summary>Şablon parametresi (ekran bu tanımdan form çizer)</summary>
public sealed class RuleParamDef
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    /// <summary>text · textarea · number · bool · select · template (yer tutuculu metin) · sql</summary>
    public string Type { get; set; } = "text";
    public bool Required { get; set; }
    public string? Default { get; set; }
    public string? Help { get; set; }
    public List<RuleOption>? Options { get; set; }
}

public sealed class RuleOption
{
    public string Value { get; set; } = "";
    public string Label { get; set; } = "";
}

/// <summary>Şablon kataloğu satırı</summary>
public sealed class RuleTemplateInfo
{
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    /// <summary>Logo kural örneği karşılığı (katalog için)</summary>
    public string? LogoEquivalent { get; set; }
    /// <summary>1 e-Fatura · 2 e-Arşiv · 3 e-İrsaliye</summary>
    public int[] DocKinds { get; set; } = [1, 2, 3];
    public bool AdminOnly { get; set; }
    public List<RuleParamDef> Params { get; set; } = new();
}

/// <summary>Kuralın çalışma koşulları (hepsi boşsa her belgede çalışır)</summary>
public sealed class RuleConditions
{
    /// <summary>Cari kodu desenleri (virgülle; * joker): 120.*, 320.01</summary>
    public string? CustomerCodes { get; set; }
    /// <summary>Alıcı / satıcı VKN-TCKN listesi (virgülle)</summary>
    public string? TaxNumbers { get; set; }
    /// <summary>Senaryo: TEMELFATURA, TICARIFATURA, EARSIVFATURA, IHRACAT…</summary>
    public string? Profiles { get; set; }
    /// <summary>Fatura tipi: SATIS, IADE, TEVKIFAT, ISTISNA…</summary>
    public string? TypeCodes { get; set; }
    /// <summary>Para birimi: TRY, USD… · "!TRY" = TL dışı</summary>
    public string? Currencies { get; set; }
    /// <summary>Firma (SYS_Companies) — boş: tüm firmalar</summary>
    public int? CompanyId { get; set; }
}

/// <summary>Kayıtlı kural (EGovTransformRule)</summary>
public sealed class TransformRule
{
    public int EGovTransformRuleID { get; set; }
    public string Name { get; set; } = "";
    public string TemplateCode { get; set; } = "";
    public string? DocKinds { get; set; }
    public byte Direction { get; set; } = 2;
    public string? ParamsJson { get; set; }
    public string? ConditionsJson { get; set; }
    public int Priority { get; set; } = 100;
    public bool StopAfter { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Description { get; set; }
    public int? CompanyID { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public RuleConditions Conditions() =>
        string.IsNullOrWhiteSpace(ConditionsJson)
            ? new RuleConditions()
            : JsonSerializer.Deserialize<RuleConditions>(ConditionsJson, Json) ?? new RuleConditions();

    public Dictionary<string, string> Params()
    {
        if (string.IsNullOrWhiteSpace(ParamsJson)) return new(StringComparer.OrdinalIgnoreCase);
        var raw = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(ParamsJson, Json) ?? new();
        return raw.ToDictionary(
            kv => kv.Key,
            kv => kv.Value.ValueKind == JsonValueKind.String ? kv.Value.GetString() ?? "" : kv.Value.ToString(),
            StringComparer.OrdinalIgnoreCase);
    }

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
}

/// <summary>Tek kuralın sonucu</summary>
public sealed class RuleStepResult
{
    public int RuleId { get; set; }
    public string RuleName { get; set; } = "";
    public string TemplateCode { get; set; } = "";
    /// <summary>applied · skipped · error</summary>
    public string Status { get; set; } = "skipped";
    public List<string> Changes { get; set; } = new();
    public string? Message { get; set; }
}

public sealed class RuleRunResult
{
    public bool Changed => Steps.Any(s => s.Changes.Count > 0);
    public List<RuleStepResult> Steps { get; set; } = new();
    public string? Xml { get; set; }
    public string? OriginalXml { get; set; }
    public Dictionary<string, string> Values { get; set; } = new();
}

/// <summary>Kural şablonu</summary>
public interface IRuleTemplate
{
    RuleTemplateInfo Info { get; }

    /// <summary>Belgeyi değiştirir; yapılan her değişikliği <paramref name="step"/>.Changes'e yazar</summary>
    Task ApplyAsync(UblDoc doc, RuleContext ctx, Dictionary<string, string> p, RuleStepResult step, CancellationToken ct);
}
