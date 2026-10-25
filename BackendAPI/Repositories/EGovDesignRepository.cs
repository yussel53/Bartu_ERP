using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

/// <summary>Belge türü ve şablon tipi kodları — SqlUpdates/75_egov_design_templates.sql ile aynı.</summary>
public static class EGovDesignCodes
{
    public static readonly IReadOnlyDictionary<short, string> DocTypes = new Dictionary<short, string>
    {
        [1] = "e-Fatura",
        [2] = "e-Fatura İade",
        [3] = "e-Arşiv",
        [4] = "e-Arşiv İnternet",
        [5] = "e-İrsaliye",
        [6] = "e-İrsaliye Yanıtı",
        [7] = "e-Müstahsil Makbuzu",
        [8] = "e-Serbest Meslek Makbuzu",
        [9] = "e-Fatura İhracat",
        [10] = "e-İrsaliye Ambar",
        [11] = "e-Fatura İhraç Kayıtlı",
        [12] = "e-Arşiv İhraç Kayıtlı",
        [13] = "e-Arşiv İade",
        [14] = "İlaç ve Tıbbi Cihaz",
    };

    public const byte RuleDefault = 1;

    public static readonly IReadOnlyDictionary<byte, string> RuleTypes = new Dictionary<byte, string>
    {
        [1] = "Öndeğer",
        [2] = "Alıcı Cari VKN/TCKN",
        [3] = "Fatura Özel Kodu",
        // 4 kullanılmıyor (portal tarafındaki «Parametre» tipi)
        [5] = "Cari Hesap Kodu",
        [6] = "İş Yeri Kodu",
        [7] = "Organizasyonel Birimler",
        [8] = "Ambar Kodu",
    };

    /// <summary>Tasarımın belge grubu: şablon eklenirken yalnız aynı gruptaki tasarımlar seçilebilir</summary>
    public static readonly IReadOnlyDictionary<string, string> DocGroups = new Dictionary<string, string>
    {
        ["EFATURA"] = "e-Fatura",
        ["EARSIV"] = "e-Arşiv",
        ["EIRSALIYE"] = "e-İrsaliye",
        ["EMM"] = "e-Müstahsil Makbuzu",
        ["ESMM"] = "e-Serbest Meslek Makbuzu",
    };

    /// <summary>Şablon belge türü → tasarım grubu</summary>
    public static string DocGroup(short docType) => docType switch
    {
        3 or 4 or 12 or 13 => "EARSIV",
        5 or 6 or 10 => "EIRSALIYE",
        7 => "EMM",
        8 => "ESMM",
        _ => "EFATURA",
    };

    /// <summary>Yüklenen tasarımın grubu (seçilmediyse): DespatchAdvice → e-İrsaliye; adında «arşiv» → e-Arşiv; yoksa e-Fatura</summary>
    public static string GuessDocGroup(string? name, string xslt)
    {
        if (xslt.Contains("schema:xsd:DespatchAdvice-2", StringComparison.Ordinal)) return "EIRSALIYE";
        var n = (name ?? "").ToLowerInvariant();
        if (n.Contains("arsiv") || n.Contains("arşiv")) return "EARSIV";
        if (n.Contains("irsaliye")) return "EIRSALIYE";
        if (n.Contains("mustahsil") || n.Contains("müstahsil")) return "EMM";
        if (n.Contains("smm") || n.Contains("serbest")) return "ESMM";
        return "EFATURA";
    }

    /// <summary>Önizleme örneği: irsaliye türleri DespatchAdvice, e-Arşiv türleri EARSIVFATURA, diğerleri Invoice.</summary>
    public static string SampleKind(short docType) => docType switch
    {
        5 or 6 or 10 => "despatch",
        3 or 4 or 12 or 13 => "earsiv",
        _ => "invoice",
    };
}

public sealed class EGovDesignRow
{
    public int EGovXsltDesignID { get; set; }
    public string Title { get; set; } = "";
    public string? FileName { get; set; }
    public int ContentLength { get; set; }
    public string? ContentHash { get; set; }
    public bool IsActive { get; set; }
    public string? Notes { get; set; }
    /// <summary>EFATURA · EARSIV · EIRSALIYE · EMM · ESMM</summary>
    public string? DocGroup { get; set; }
    public int RuleCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class EGovDesignContent
{
    public int EGovXsltDesignID { get; set; }
    public string Title { get; set; } = "";
    public string? FileName { get; set; }
    public string XsltContent { get; set; } = "";
}

public sealed class EGovDesignRuleRow
{
    public int EGovDesignRuleID { get; set; }
    public short DocType { get; set; }
    public byte RuleType { get; set; }
    public string? RuleValue { get; set; }
    public int Priority { get; set; }
    public int EGovXsltDesignID { get; set; }
    public string? DesignTitle { get; set; }
    public bool DesignActive { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class EGovDesignRuleInput
{
    public short DocType { get; set; }
    public byte RuleType { get; set; }
    public string? RuleValue { get; set; }
    public int Priority { get; set; } = 1;
    public int EGovXsltDesignID { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Tasarım seçimi için belgenin bilgileri (boş olanlar eşleşmez).</summary>
public sealed class EGovDesignContext
{
    public string? ReceiverTaxNr { get; set; }
    public string? SpecialCode { get; set; }
    public string? CustomerCode { get; set; }
    public string? WorkplaceCode { get; set; }
    public string? OrgUnitCode { get; set; }
    public string? WarehouseCode { get; set; }
}

public sealed class EGovDesignResolveResult
{
    public int EGovDesignRuleID { get; set; }
    public byte RuleType { get; set; }
    public string? RuleValue { get; set; }
    public int Priority { get; set; }
    public int EGovXsltDesignID { get; set; }
    public string DesignTitle { get; set; } = "";
}

/// <summary>
/// E-Devlet tasarım şablonları — EGovXsltDesign (XSLT kütüphanesi) + EGovDesignRule (şablon kuralları).
/// SqlUpdates/75_egov_design_templates.sql
/// </summary>
public sealed class EGovDesignRepository
{
    public const string MissingTableMessage =
        "Tasarım şablonu tabloları yok — Veritabanı Güncelleme ekranından 75_egov_design_templates.sql uygulayın.";

    private readonly IDbConnection _db;

    public EGovDesignRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.EGovXsltDesign', N'U') IS NULL
                        OR OBJECT_ID(N'dbo.EGovDesignRule', N'U') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct)) == 1;
    }

    // ─── Tasarımlar (XSLT kütüphanesi) ───────────────────────────────────────

    public async Task<List<EGovDesignRow>> ListDesignsAsync(CancellationToken ct = default)
    {
        Open();
        return (await _db.QueryAsync<EGovDesignRow>(new CommandDefinition(
            @"SELECT d.EGovXsltDesignID, d.Title, d.FileName, LEN(d.XsltContent) AS ContentLength, d.ContentHash,
                     d.IsActive, d.Notes, d.DocGroup, d.CreatedAt, d.UpdatedAt,
                     (SELECT COUNT(*) FROM dbo.EGovDesignRule r WHERE r.EGovXsltDesignID = d.EGovXsltDesignID) AS RuleCount
              FROM dbo.EGovXsltDesign d
              ORDER BY d.IsActive DESC, d.Title",
            cancellationToken: ct))).ToList();
    }

    public async Task<EGovDesignContent?> GetDesignAsync(int id, CancellationToken ct = default)
    {
        Open();
        return await _db.QuerySingleOrDefaultAsync<EGovDesignContent>(new CommandDefinition(
            @"SELECT EGovXsltDesignID, Title, FileName, XsltContent
              FROM dbo.EGovXsltDesign WHERE EGovXsltDesignID = @id",
            new { id }, cancellationToken: ct));
    }

    public async Task<int> CreateDesignAsync(string title, string? fileName, string content, string hash, string? notes, string docGroup,
        CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.EGovXsltDesign (Title, FileName, XsltContent, ContentHash, Notes, DocGroup)
              VALUES (@title, @fileName, @content, @hash, @notes, @docGroup);
              SELECT CAST(SCOPE_IDENTITY() AS int);",
            new { title, fileName, content, hash, notes, docGroup }, cancellationToken: ct));
    }

    /// <summary>Aynı içerik (SHA-256) aynı grupta zaten var mı — standart tasarımlar ikinci kez eklenmesin</summary>
    public async Task<bool> ExistsAsync(string hash, string docGroup, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.EGovXsltDesign WHERE ContentHash = @hash AND DocGroup = @docGroup",
            new { hash, docGroup }, cancellationToken: ct)) > 0;
    }

    /// <summary>Grup değişince tasarımı kullanan başka gruptaki şablon varsa engel mesajı</summary>
    public async Task<string?> DocGroupConflictAsync(int id, string docGroup, CancellationToken ct = default)
    {
        Open();
        var types = await _db.QueryAsync<short>(new CommandDefinition(
            "SELECT DISTINCT DocType FROM dbo.EGovDesignRule WHERE EGovXsltDesignID = @id", new { id }, cancellationToken: ct));
        var bad = types.Where(t => EGovDesignCodes.DocGroup(t) != docGroup).ToList();
        if (bad.Count == 0) return null;
        var names = string.Join(", ", bad.Select(t => EGovDesignCodes.DocTypes.TryGetValue(t, out var n) ? n : t.ToString()));
        return $"Tasarım {names} şablonlarında kullanılıyor; belge grubu {EGovDesignCodes.DocGroups[docGroup]} yapılamaz.";
    }

    public async Task<bool> UpdateDesignAsync(int id, string title, bool isActive, string? notes, string? docGroup, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.EGovXsltDesign
              SET Title = @title, IsActive = @isActive, Notes = @notes, DocGroup = COALESCE(@docGroup, DocGroup), UpdatedAt = SYSDATETIME()
              WHERE EGovXsltDesignID = @id",
            new { id, title, isActive, notes, docGroup }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> ReplaceContentAsync(int id, string? fileName, string content, string hash, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.EGovXsltDesign
              SET FileName = @fileName, XsltContent = @content, ContentHash = @hash, UpdatedAt = SYSDATETIME()
              WHERE EGovXsltDesignID = @id",
            new { id, fileName, content, hash }, cancellationToken: ct)) > 0;
    }

    /// <summary>Şablonlarda kullanılan tasarım silinmez.</summary>
    public async Task<(bool Ok, string Message)> DeleteDesignAsync(int id, CancellationToken ct = default)
    {
        Open();
        var used = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.EGovDesignRule WHERE EGovXsltDesignID = @id",
            new { id }, cancellationToken: ct));
        if (used > 0) return (false, $"Bu tasarım {used} şablonda kullanılıyor — önce şablonları değiştirin ya da silin.");
        var n = await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.EGovXsltDesign WHERE EGovXsltDesignID = @id",
            new { id }, cancellationToken: ct));
        return n > 0 ? (true, "Tasarım silindi.") : (false, $"Tasarım #{id} bulunamadı.");
    }

    public async Task<string?> GetEgovXmlAsync(int egovDocumentId, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT XmlContent FROM dbo.EGovDocument WHERE EGovDocumentID = @egovDocumentId",
            new { egovDocumentId }, cancellationToken: ct));
    }

    // ─── Şablonlar (kurallar) ────────────────────────────────────────────────

    public async Task<List<EGovDesignRuleRow>> ListRulesAsync(short? docType, CancellationToken ct = default)
    {
        Open();
        return (await _db.QueryAsync<EGovDesignRuleRow>(new CommandDefinition(
            @"SELECT r.EGovDesignRuleID, r.DocType, r.RuleType, r.RuleValue, r.Priority, r.EGovXsltDesignID,
                     d.Title AS DesignTitle, d.IsActive AS DesignActive, r.Description, r.IsActive, r.CreatedAt, r.UpdatedAt
              FROM dbo.EGovDesignRule r
              JOIN dbo.EGovXsltDesign d ON d.EGovXsltDesignID = r.EGovXsltDesignID
              WHERE @docType IS NULL OR r.DocType = @docType
              ORDER BY r.DocType, CASE WHEN r.RuleType = 1 THEN 1 ELSE 0 END, r.Priority, r.RuleType, r.RuleValue",
            new { docType }, cancellationToken: ct))).ToList();
    }

    /// <summary>Girdiyi doğrular; hata varsa mesaj döner. Öndeğer'de değer NULL'a çekilir.</summary>
    public async Task<string?> ValidateRuleAsync(EGovDesignRuleInput r, int exceptId, CancellationToken ct = default)
    {
        if (!EGovDesignCodes.DocTypes.ContainsKey(r.DocType)) return "Geçersiz belge türü.";
        if (!EGovDesignCodes.RuleTypes.ContainsKey(r.RuleType)) return "Geçersiz şablon tipi.";
        r.RuleValue = r.RuleType == EGovDesignCodes.RuleDefault ? null : r.RuleValue?.Trim();
        if (r.RuleType != EGovDesignCodes.RuleDefault && string.IsNullOrEmpty(r.RuleValue)) return "Değer zorunlu.";
        if (r.RuleValue is { Length: > 100 }) return "Değer en fazla 100 karakter olabilir.";
        if (r.Priority is < 1 or > 99) return "Öncelik 1-99 arasında olmalı.";

        Open();
        var design = await _db.QueryFirstOrDefaultAsync<(int Id, string? DocGroup, string Title)>(new CommandDefinition(
            "SELECT EGovXsltDesignID, DocGroup, Title FROM dbo.EGovXsltDesign WHERE EGovXsltDesignID = @id",
            new { id = r.EGovXsltDesignID }, cancellationToken: ct));
        if (design.Id == 0) return "Tasarım seçin.";
        // Yalnız şablonun belge türüne ait tasarım (ör. e-Fatura şablonunda e-İrsaliye tasarımı seçilemez)
        var want = EGovDesignCodes.DocGroup(r.DocType);
        if (design.DocGroup != null && design.DocGroup != want)
            return $"«{design.Title}» bir {EGovDesignCodes.DocGroups.GetValueOrDefault(design.DocGroup, design.DocGroup)} tasarımı; "
                   + $"{EGovDesignCodes.DocTypes[r.DocType]} şablonunda yalnız {EGovDesignCodes.DocGroups[want]} tasarımları seçilebilir.";

        var dup = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"SELECT COUNT(*) FROM dbo.EGovDesignRule
              WHERE DocType = @DocType AND RuleType = @RuleType AND ISNULL(RuleValue, N'') = ISNULL(@RuleValue, N'')
                AND EGovDesignRuleID <> @exceptId",
            new { r.DocType, r.RuleType, r.RuleValue, exceptId }, cancellationToken: ct));
        if (dup > 0)
        {
            var what = r.RuleType == EGovDesignCodes.RuleDefault
                ? "Öndeğer şablonu"
                : $"«{EGovDesignCodes.RuleTypes[r.RuleType]} = {r.RuleValue}» şablonu";
            return $"{EGovDesignCodes.DocTypes[r.DocType]} için {what} zaten var.";
        }
        return null;
    }

    public async Task<int> CreateRuleAsync(EGovDesignRuleInput r, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.EGovDesignRule (DocType, RuleType, RuleValue, Priority, EGovXsltDesignID, Description, IsActive)
              VALUES (@DocType, @RuleType, @RuleValue, @Priority, @EGovXsltDesignID, @Description, @IsActive);
              SELECT CAST(SCOPE_IDENTITY() AS int);",
            new { r.DocType, r.RuleType, r.RuleValue, r.Priority, r.EGovXsltDesignID, Description = r.Description?.Trim(), r.IsActive },
            cancellationToken: ct));
    }

    public async Task<bool> UpdateRuleAsync(int id, EGovDesignRuleInput r, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.EGovDesignRule
              SET DocType = @DocType, RuleType = @RuleType, RuleValue = @RuleValue, Priority = @Priority,
                  EGovXsltDesignID = @EGovXsltDesignID, Description = @Description, IsActive = @IsActive,
                  UpdatedAt = SYSDATETIME()
              WHERE EGovDesignRuleID = @id",
            new { id, r.DocType, r.RuleType, r.RuleValue, r.Priority, r.EGovXsltDesignID, Description = r.Description?.Trim(), r.IsActive },
            cancellationToken: ct)) > 0;
    }

    public async Task<bool> DeleteRuleAsync(int id, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.EGovDesignRule WHERE EGovDesignRuleID = @id",
            new { id }, cancellationToken: ct)) > 0;
    }

    /// <summary>
    /// Gönderimde kullanılacak tasarım: belge türünün aktif şablonlarından değeri belgeyle eşleşenler
    /// (Öncelik küçükten büyüğe), yoksa Öndeğer. null = e-Logo varsayılan tasarımı.
    /// </summary>
    public async Task<EGovDesignResolveResult?> ResolveAsync(short docType, EGovDesignContext c, CancellationToken ct = default)
    {
        Open();
        static string? N(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        return await _db.QueryFirstOrDefaultAsync<EGovDesignResolveResult>(new CommandDefinition(
            @"SELECT TOP 1 r.EGovDesignRuleID, r.RuleType, r.RuleValue, r.Priority, r.EGovXsltDesignID, d.Title AS DesignTitle
              FROM dbo.EGovDesignRule r
              JOIN dbo.EGovXsltDesign d ON d.EGovXsltDesignID = r.EGovXsltDesignID
              WHERE r.DocType = @docType AND r.IsActive = 1 AND d.IsActive = 1
                AND (   r.RuleType = 1
                     OR (r.RuleType = 2 AND r.RuleValue = @taxNr)
                     OR (r.RuleType = 3 AND r.RuleValue = @specialCode)
                     OR (r.RuleType = 5 AND r.RuleValue = @customerCode)
                     OR (r.RuleType = 6 AND r.RuleValue = @workplaceCode)
                     OR (r.RuleType = 7 AND r.RuleValue = @orgUnitCode)
                     OR (r.RuleType = 8 AND r.RuleValue = @warehouseCode))
              ORDER BY CASE WHEN r.RuleType = 1 THEN 1 ELSE 0 END, r.Priority, r.EGovDesignRuleID",
            new
            {
                docType,
                taxNr = N(c.ReceiverTaxNr),
                specialCode = N(c.SpecialCode),
                customerCode = N(c.CustomerCode),
                workplaceCode = N(c.WorkplaceCode),
                orgUnitCode = N(c.OrgUnitCode),
                warehouseCode = N(c.WarehouseCode),
            },
            cancellationToken: ct));
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
