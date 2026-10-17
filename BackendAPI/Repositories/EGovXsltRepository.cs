using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EGovXsltRow
{
    public int EGovXsltTemplateID { get; set; }
    public byte DocKind { get; set; }
    public int? CompanyId { get; set; }
    public string? CompanyTitle { get; set; }
    public string Title { get; set; } = "";
    public string? FileName { get; set; }
    public int ContentLength { get; set; }
    public string? ContentHash { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public sealed class EGovXsltContent
{
    public int EGovXsltTemplateID { get; set; }
    public byte DocKind { get; set; }
    public string Title { get; set; } = "";
    public string? FileName { get; set; }
    public string XsltContent { get; set; } = "";
}

/// <summary>
/// E-Devlet XSLT tasarımları — EGovXsltTemplate (SqlUpdates/75_egov_xslt_templates.sql).
/// Belge türü + firma başına tek varsayılan; firmaya özel yoksa genel (CompanyId NULL) varsayılan.
/// </summary>
public sealed class EGovXsltRepository
{
    public const string MissingTableMessage =
        "EGovXsltTemplate tablosu yok — Veritabanı Güncelleme ekranından 75_egov_xslt_templates.sql uygulayın.";

    private readonly IDbConnection _db;

    public EGovXsltRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<bool> ReadyAsync(CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.EGovXsltTemplate', N'U') IS NULL THEN 0 ELSE 1 END",
            cancellationToken: ct)) == 1;
    }

    public async Task<List<EGovXsltRow>> ListAsync(byte docKind, CancellationToken ct = default)
    {
        Open();
        var idCol = await CompanyIdColumnAsync(ct);
        var companyJoin = idCol == null
            ? "CAST(NULL AS nvarchar(200)) AS CompanyTitle"
            : $"(SELECT ISNULL(c.Title, c.CompanyCode) FROM dbo.SYS_Companies c WHERE c.[{idCol}] = t.CompanyId) AS CompanyTitle";
        return (await _db.QueryAsync<EGovXsltRow>(new CommandDefinition(
            $@"SELECT t.EGovXsltTemplateID, t.DocKind, t.CompanyId, {companyJoin},
                      t.Title, t.FileName, LEN(t.XsltContent) AS ContentLength, t.ContentHash,
                      t.IsDefault, t.IsActive, t.Notes, t.CreatedAt, t.UpdatedAt
               FROM dbo.EGovXsltTemplate t
               WHERE t.DocKind = @docKind
               ORDER BY t.IsDefault DESC, t.IsActive DESC, t.Title",
            new { docKind }, cancellationToken: ct))).ToList();
    }

    public async Task<EGovXsltContent?> GetContentAsync(int id, CancellationToken ct = default)
    {
        Open();
        return await _db.QuerySingleOrDefaultAsync<EGovXsltContent>(new CommandDefinition(
            @"SELECT EGovXsltTemplateID, DocKind, Title, FileName, XsltContent
              FROM dbo.EGovXsltTemplate WHERE EGovXsltTemplateID = @id",
            new { id }, cancellationToken: ct));
    }

    public async Task<int> CreateAsync(
        byte docKind, int? companyId, string title, string? fileName, string content, string hash,
        bool isDefault, string? notes, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        if (isDefault) await ClearDefaultAsync(docKind, companyId, tx, ct);
        var id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.EGovXsltTemplate (DocKind, CompanyId, Title, FileName, XsltContent, ContentHash, IsDefault, Notes)
              VALUES (@docKind, @companyId, @title, @fileName, @content, @hash, @isDefault, @notes);
              SELECT CAST(SCOPE_IDENTITY() AS int);",
            new { docKind, companyId, title, fileName, content, hash, isDefault, notes }, tx, cancellationToken: ct));
        tx.Commit();
        return id;
    }

    /// <summary>Başlık / firma / aktiflik / not. Pasife alınan şablon varsayılanlıktan çıkar.</summary>
    public async Task<bool> UpdateAsync(
        int id, string title, int? companyId, bool isActive, string? notes, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        var cur = await GetScopeAsync(id, tx, ct);
        if (cur is null) return false;
        var keepDefault = cur.IsDefault && isActive;
        // Varsayılan şablon başka firmaya taşınırsa oradaki varsayılanı devralır
        if (keepDefault) await ClearDefaultAsync(cur.DocKind, companyId, tx, ct, exceptId: id);
        await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.EGovXsltTemplate
              SET Title = @title, CompanyId = @companyId, IsActive = @isActive, Notes = @notes,
                  IsDefault = @keepDefault, UpdatedAt = SYSDATETIME()
              WHERE EGovXsltTemplateID = @id",
            new { id, title, companyId, isActive, notes, keepDefault }, tx, cancellationToken: ct));
        tx.Commit();
        return true;
    }

    public async Task<bool> ReplaceContentAsync(int id, string? fileName, string content, string hash, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.EGovXsltTemplate
              SET FileName = @fileName, XsltContent = @content, ContentHash = @hash, UpdatedAt = SYSDATETIME()
              WHERE EGovXsltTemplateID = @id",
            new { id, fileName, content, hash }, cancellationToken: ct)) > 0;
    }

    /// <summary>true: şablonu kendi kapsamında (tür + firma) varsayılan yapar; false: varsayılanlığı kaldırır.</summary>
    public async Task<(bool Ok, string Message)> SetDefaultAsync(int id, bool isDefault, CancellationToken ct = default)
    {
        Open();
        using var tx = _db.BeginTransaction();
        var cur = await GetScopeAsync(id, tx, ct);
        if (cur is null) return (false, $"Şablon #{id} bulunamadı.");
        if (isDefault && !cur.IsActive) return (false, "Pasif şablon varsayılan yapılamaz.");
        if (isDefault) await ClearDefaultAsync(cur.DocKind, cur.CompanyId, tx, ct, exceptId: id);
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.EGovXsltTemplate SET IsDefault = @isDefault, UpdatedAt = SYSDATETIME() WHERE EGovXsltTemplateID = @id",
            new { id, isDefault }, tx, cancellationToken: ct));
        tx.Commit();
        return (true, isDefault ? "Varsayılan tasarım ayarlandı." : "Varsayılan kaldırıldı — e-Logo varsayılan tasarımı kullanılır.");
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.EGovXsltTemplate WHERE EGovXsltTemplateID = @id",
            new { id }, cancellationToken: ct)) > 0;
    }

    /// <summary>Gönderimde kullanılacak tasarım: firmaya özel varsayılan → genel varsayılan → null (e-Logo varsayılanı).</summary>
    public async Task<EGovXsltContent?> ResolveAsync(byte docKind, int? companyId, CancellationToken ct = default)
    {
        Open();
        return await _db.QueryFirstOrDefaultAsync<EGovXsltContent>(new CommandDefinition(
            @"SELECT TOP 1 EGovXsltTemplateID, DocKind, Title, FileName, XsltContent
              FROM dbo.EGovXsltTemplate
              WHERE DocKind = @docKind AND IsDefault = 1 AND IsActive = 1
                AND (CompanyId = @companyId OR CompanyId IS NULL)
              ORDER BY CASE WHEN CompanyId IS NULL THEN 1 ELSE 0 END",
            new { docKind, companyId }, cancellationToken: ct));
    }

    public async Task<string?> GetSampleXmlAsync(int egovDocumentId, CancellationToken ct = default)
    {
        Open();
        return await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT XmlContent FROM dbo.EGovDocument WHERE EGovDocumentID = @egovDocumentId",
            new { egovDocumentId }, cancellationToken: ct));
    }

    private sealed class TemplateScope
    {
        public byte DocKind { get; set; }
        public int? CompanyId { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; }
    }

    private Task<TemplateScope?> GetScopeAsync(int id, IDbTransaction tx, CancellationToken ct) =>
        _db.QuerySingleOrDefaultAsync<TemplateScope?>(new CommandDefinition(
            @"SELECT DocKind, CompanyId, IsDefault, IsActive
              FROM dbo.EGovXsltTemplate WITH (UPDLOCK) WHERE EGovXsltTemplateID = @id",
            new { id }, tx, cancellationToken: ct));

    private async Task ClearDefaultAsync(byte docKind, int? companyId, IDbTransaction tx, CancellationToken ct, int exceptId = 0)
    {
        await _db.ExecuteAsync(new CommandDefinition(
            @"UPDATE dbo.EGovXsltTemplate SET IsDefault = 0, UpdatedAt = SYSDATETIME()
              WHERE DocKind = @docKind AND IsDefault = 1 AND EGovXsltTemplateID <> @exceptId
                AND ((@companyId IS NULL AND CompanyId IS NULL) OR CompanyId = @companyId)",
            new { docKind, companyId, exceptId }, tx, cancellationToken: ct));
    }

    private async Task<string?> CompanyIdColumnAsync(CancellationToken ct) =>
        await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            @"SELECT TOP 1 name FROM sys.columns
              WHERE object_id = OBJECT_ID(N'dbo.SYS_Companies') AND name IN (N'CompanyId', N'CompanyID')
              ORDER BY CASE WHEN name = N'CompanyId' THEN 0 ELSE 1 END",
            cancellationToken: ct));

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }
}
