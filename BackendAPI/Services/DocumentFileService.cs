using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class DocumentFileDto
{
    public int DocumentFileID { get; set; }
    public string SourceTable { get; set; } = "";
    public int SourceID { get; set; }
    public string FileName { get; set; } = "";
    public string? ContentType { get; set; }
    public string? Extension { get; set; }
    public long? SizeBytes { get; set; }
    public string? Title { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? CreatedBy { get; set; }
}

/// <summary>Kart / fiş doküman ekleri — dosya diskte, meta SYS_DocumentFile.</summary>
public sealed class DocumentFileService
{
    private static readonly HashSet<string> AllowedExt = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".rtf",
        ".odt", ".ods", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip",
        ".msg", ".eml",
    };

    public const long MaxBytes = 32_000_000;

    private readonly IDbConnection _db;
    private readonly IWebHostEnvironment _env;

    public DocumentFileService(IDbConnection db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public bool TableReady()
    {
        Open();
        return _db.ExecuteScalar<int?>(
            "SELECT OBJECT_ID(N'dbo.SYS_DocumentFile', N'U')") is > 0;
    }

    private string RootDir => Path.Combine(_env.ContentRootPath, "App_Data", "doc-files");

    private static string SafeTable(string table)
    {
        var t = (table ?? "").Trim();
        if (t.Length is < 1 or > 64) throw new InvalidOperationException("Geçersiz kaynak tablo.");
        if (t.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-')))
            throw new InvalidOperationException("Geçersiz kaynak tablo adı.");
        return t;
    }

    private string FolderFor(string table, int id) =>
        Path.Combine(RootDir, SafeTable(table), id.ToString());

    public async Task<IReadOnlyList<DocumentFileDto>> ListAsync(string table, int sourceId, CancellationToken ct = default)
    {
        Open();
        if (!TableReady()) return [];
        if (sourceId <= 0) return [];
        var t = SafeTable(table);
        var rows = await _db.QueryAsync<DocumentFileDto>(new CommandDefinition(
            @"SELECT DocumentFileID, SourceTable, SourceID, FileName, ContentType, Extension, SizeBytes,
       Title, Note, CreatedAt, CreatedBy
FROM dbo.SYS_DocumentFile
WHERE SourceTable = @t AND SourceID = @sourceId
ORDER BY DocumentFileID DESC",
            new { t, sourceId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<DocumentFileDto> UploadAsync(
        string table,
        int sourceId,
        IFormFile file,
        int? userId,
        string? title,
        string? note,
        CancellationToken ct = default)
    {
        Open();
        if (!TableReady())
            throw new InvalidOperationException("SYS_DocumentFile yok — Veritabanı Güncelleme uygulayın.");
        if (sourceId <= 0) throw new InvalidOperationException("Önce kaydı kaydedin.");
        if (file is null || file.Length == 0) throw new InvalidOperationException("Dosya boş.");
        if (file.Length > MaxBytes) throw new InvalidOperationException($"Dosya en fazla {MaxBytes / 1_000_000} MB olabilir.");

        var t = SafeTable(table);
        var original = Path.GetFileName(file.FileName ?? "dosya");
        if (string.IsNullOrWhiteSpace(original)) original = "dosya";
        var ext = Path.GetExtension(original);
        if (string.IsNullOrEmpty(ext) || !AllowedExt.Contains(ext))
            throw new InvalidOperationException(
                $"İzin verilmeyen tür: {(string.IsNullOrEmpty(ext) ? "(yok)" : ext)}. PDF, Word, Excel, txt, görsel, zip…");

        var stored = $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var dir = FolderFor(t, sourceId);
        Directory.CreateDirectory(dir);
        var full = Path.Combine(dir, stored);
        await using (var fs = new FileStream(full, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            await file.CopyToAsync(fs, ct);

        var ctType = string.IsNullOrWhiteSpace(file.ContentType) ? GuessContentType(ext) : file.ContentType;
        var id = await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            @"INSERT INTO dbo.SYS_DocumentFile
  (SourceTable, SourceID, FileName, StoredName, ContentType, Extension, SizeBytes, Title, Note, CreatedBy)
OUTPUT INSERTED.DocumentFileID
VALUES (@t, @sourceId, @original, @stored, @ctType, @ext, @size, @title, @note, @userId)",
            new
            {
                t,
                sourceId,
                original,
                stored,
                ctType,
                ext = ext.ToLowerInvariant(),
                size = file.Length,
                title = string.IsNullOrWhiteSpace(title) ? null : title.Trim(),
                note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                userId,
            },
            cancellationToken: ct));

        return (await GetMetaAsync(id, ct))!;
    }

    public async Task<(byte[] Content, string FileName, string ContentType)?> OpenAsync(int documentFileId, CancellationToken ct = default)
    {
        Open();
        if (!TableReady()) return null;
        var row = await _db.QueryFirstOrDefaultAsync<(string Table, int Sid, string FileName, string Stored, string? Ct)>(
            new CommandDefinition(
                @"SELECT SourceTable AS [Table], SourceID AS Sid, FileName, StoredName AS Stored, ContentType AS Ct
FROM dbo.SYS_DocumentFile WHERE DocumentFileID = @id",
                new { id = documentFileId }, cancellationToken: ct));
        if (row.Sid <= 0 || string.IsNullOrWhiteSpace(row.Stored)) return null;
        var path = Path.Combine(FolderFor(row.Table, row.Sid), row.Stored);
        if (!File.Exists(path)) return null;
        var bytes = await File.ReadAllBytesAsync(path, ct);
        var ctype = string.IsNullOrWhiteSpace(row.Ct) ? "application/octet-stream" : row.Ct!;
        return (bytes, row.FileName, ctype);
    }

    public async Task<bool> DeleteAsync(int documentFileId, CancellationToken ct = default)
    {
        Open();
        if (!TableReady()) return false;
        var row = await _db.QueryFirstOrDefaultAsync<(string Table, int Sid, string Stored)?>(
            new CommandDefinition(
                @"SELECT SourceTable AS [Table], SourceID AS Sid, StoredName AS Stored
FROM dbo.SYS_DocumentFile WHERE DocumentFileID = @id",
                new { id = documentFileId }, cancellationToken: ct));
        if (row is null) return false;
        var r = row.Value;
        await _db.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.SYS_DocumentFile WHERE DocumentFileID = @id",
            new { id = documentFileId }, cancellationToken: ct));
        try
        {
            var path = Path.Combine(FolderFor(r.Table, r.Sid), r.Stored);
            if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
            /* disk silinemezse meta yine silindi */
        }
        return true;
    }

    private async Task<DocumentFileDto?> GetMetaAsync(int id, CancellationToken ct) =>
        await _db.QueryFirstOrDefaultAsync<DocumentFileDto>(new CommandDefinition(
            @"SELECT DocumentFileID, SourceTable, SourceID, FileName, ContentType, Extension, SizeBytes,
       Title, Note, CreatedAt, CreatedBy
FROM dbo.SYS_DocumentFile WHERE DocumentFileID = @id",
            new { id }, cancellationToken: ct));

    private static string GuessContentType(string ext) => ext.ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".doc" => "application/msword",
        ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls" => "application/vnd.ms-excel",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".txt" => "text/plain",
        ".csv" => "text/csv",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".zip" => "application/zip",
        _ => "application/octet-stream",
    };
}
