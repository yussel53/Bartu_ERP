using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class EGovResponseDoc
{
    public int EGovDocumentID { get; set; }
    public byte DocKind { get; set; }
    public byte Direction { get; set; }
    public string? DocumentNo { get; set; }
    public string? UUID { get; set; }
    public string? ProfileId { get; set; }
    public DateTime? DocumentDate { get; set; }
    public DateTime? CreatedAt { get; set; }
    public string? Status { get; set; }
    public string? CustomerTitle { get; set; }
    public int? InvoiceID { get; set; }
    public string? ResponseCode { get; set; }
    public string? ResponseNote { get; set; }
    public DateTime? ResponseAt { get; set; }
    public string? ResponseStatus { get; set; }
    public string? ResponseError { get; set; }
}

public sealed class EGovObjectionRow
{
    public int EGovDocumentObjectionID { get; set; }
    public int EGovDocumentID { get; set; }
    public string Kind { get; set; } = "";
    public string Method { get; set; } = "";
    public DateTime ObjectionDate { get; set; }
    public string? ObjectionDocNo { get; set; }
    public string Description { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime? CancelledAt { get; set; }
}

/// <summary>Gelen TİCARİ faturaya KABUL / RED yanıtı ve harici itiraz / iptal kayıtları (EGovDocumentObjection)</summary>
public sealed class EGovResponseRepository
{
    private readonly IDbConnection _db;

    public EGovResponseRepository(IDbConnection db) => _db = db;

    private void Open()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
    }

    public static readonly string[] Methods = { "KEP", "NOTER", "TELGRAF", "TAAHHUTLU_MEKTUP", "GIB_PORTAL" };
    public static readonly string[] Kinds = { "ITIRAZ", "IPTAL" };

    public async Task<EGovResponseDoc?> GetAsync(int id, CancellationToken ct)
    {
        Open();
        return await _db.QueryFirstOrDefaultAsync<EGovResponseDoc>(new CommandDefinition("""
            SELECT EGovDocumentID, DocKind, Direction, DocumentNo, UUID, ProfileId, DocumentDate, CreatedAt, Status, CustomerTitle, InvoiceID,
                   ResponseCode, ResponseNote, ResponseAt, ResponseStatus, ResponseError
            FROM dbo.EGovDocument WHERE EGovDocumentID = @id
            """, new { id }, cancellationToken: ct));
    }

    public async Task<List<EGovObjectionRow>> ListObjectionsAsync(int docId, CancellationToken ct)
    {
        Open();
        // Oturum kullanıcıları dbo.SystemUser (SqlUpdates/79)
        var hasUsers = await _db.ExecuteScalarAsync<int>("SELECT CASE WHEN OBJECT_ID(N'dbo.SystemUser', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
        var userName = hasUsers
            ? "(SELECT TOP 1 COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.Name, N' ', u.Surname))), N''), u.NickName) FROM dbo.SystemUser u WHERE u.SystemUserID = o.CreatedBy)"
            : "CAST(NULL AS nvarchar(100))";
        return (await _db.QueryAsync<EGovObjectionRow>(new CommandDefinition($"""
            SELECT o.EGovDocumentObjectionID, o.EGovDocumentID, o.Kind, o.Method, o.ObjectionDate, o.ObjectionDocNo, o.Description,
                   o.IsActive, o.CreatedAt, {userName} AS CreatedByName, o.CancelledAt
            FROM dbo.EGovDocumentObjection o WHERE o.EGovDocumentID = @docId
            ORDER BY o.IsActive DESC, o.CreatedAt DESC
            """, new { docId }, cancellationToken: ct))).ToList();
    }

    public async Task<bool> HasActiveObjectionAsync(int docId, CancellationToken ct)
    {
        Open();
        return await _db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.EGovDocumentObjection WHERE EGovDocumentID = @docId AND IsActive = 1", new { docId }, cancellationToken: ct)) > 0;
    }

    /// <summary>Kayıt eklenir; belge durumu «İtiraz edildi» / «İptal edildi» olur (önceki durum kayıtta saklanır)</summary>
    public async Task<int> AddObjectionAsync(int docId, string kind, string method, DateTime date, string? docNo, string description, int? userId, CancellationToken ct)
    {
        Open();
        using var tx = _db.BeginTransaction();
        var prev = await _db.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT Status FROM dbo.EGovDocument WITH (UPDLOCK) WHERE EGovDocumentID = @docId", new { docId }, tx, cancellationToken: ct));
        var id = await _db.ExecuteScalarAsync<int>(new CommandDefinition("""
            INSERT dbo.EGovDocumentObjection (EGovDocumentID, Kind, Method, ObjectionDate, ObjectionDocNo, Description, PrevStatus, CreatedBy)
            VALUES (@docId, @kind, @method, @date, @docNo, @description, @prev, @userId);
            SELECT CAST(SCOPE_IDENTITY() AS int);
            """, new { docId, kind, method, date = date.Date, docNo, description, prev, userId }, tx, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.EGovDocument SET Status = @s WHERE EGovDocumentID = @docId",
            new { docId, s = kind == "IPTAL" ? "İptal edildi" : "İtiraz edildi" }, tx, cancellationToken: ct));
        tx.Commit();
        return id;
    }

    /// <summary>Kayıt geri alınır (silinmez); başka etkin kayıt kalmazsa belgenin önceki durumu geri yüklenir</summary>
    public async Task<bool> CancelObjectionAsync(int docId, int objectionId, int? userId, CancellationToken ct)
    {
        Open();
        using var tx = _db.BeginTransaction();
        var row = await _db.QueryFirstOrDefaultAsync<(int Id, string? PrevStatus)>(new CommandDefinition("""
            SELECT EGovDocumentObjectionID, PrevStatus FROM dbo.EGovDocumentObjection WITH (UPDLOCK)
            WHERE EGovDocumentObjectionID = @objectionId AND EGovDocumentID = @docId AND IsActive = 1
            """, new { docId, objectionId }, tx, cancellationToken: ct));
        if (row.Id == 0) { tx.Rollback(); return false; }
        var prev = row.PrevStatus;
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.EGovDocumentObjection SET IsActive = 0, CancelledAt = SYSDATETIME(), CancelledBy = @userId WHERE EGovDocumentObjectionID = @objectionId",
            new { objectionId, userId }, tx, cancellationToken: ct));
        var latest = await _db.QueryFirstOrDefaultAsync<string?>(new CommandDefinition("""
            SELECT TOP 1 CASE Kind WHEN N'IPTAL' THEN N'İptal edildi' ELSE N'İtiraz edildi' END
            FROM dbo.EGovDocumentObjection WHERE EGovDocumentID = @docId AND IsActive = 1 ORDER BY CreatedAt DESC
            """, new { docId }, tx, cancellationToken: ct));
        await _db.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.EGovDocument SET Status = @s WHERE EGovDocumentID = @docId",
            new { docId, s = latest ?? prev }, tx, cancellationToken: ct));
        tx.Commit();
        return true;
    }

    /// <summary>KABUL / RED yanıtının sonucu; başarılıysa belge durumu da güncellenir</summary>
    public async Task MarkResponseAsync(int docId, string code, string? note, bool ok, string? error, int? userId, CancellationToken ct)
    {
        Open();
        await _db.ExecuteAsync(new CommandDefinition("""
            UPDATE dbo.EGovDocument
            SET ResponseCode = @code, ResponseNote = @note, ResponseAt = SYSDATETIME(), ResponseBy = @userId,
                ResponseStatus = CASE WHEN @ok = 1 THEN N'Gönderildi' ELSE N'Hata' END, ResponseError = @error,
                Status = CASE WHEN @ok = 1 THEN CASE @code WHEN N'RED' THEN N'Reddedildi' ELSE N'Kabul edildi' END ELSE Status END
            WHERE EGovDocumentID = @docId
            """, new { docId, code, note, ok, error, userId }, cancellationToken: ct));
    }
}
