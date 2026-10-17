using System.Data;
using Dapper;

namespace BartuERP.Backend.Repositories;

public sealed class FormLayoutAssignDto
{
    /// <summary>1 kullanıcı · 2 rol</summary>
    public byte ScopeType { get; set; }
    public string ScopeKey { get; set; } = "";
}

public sealed class FormLayoutDto
{
    public int LayoutID { get; set; }
    public string FormCode { get; set; } = "";
    public string Name { get; set; } = "";
    public string LayoutJson { get; set; } = "{}";
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public string? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<FormLayoutAssignDto> Assigns { get; set; } = new();
}

public sealed class FormLayoutResolveResult
{
    public bool Ready { get; set; }
    public List<FormLayoutDto> Layouts { get; set; } = new();
    /// <summary>Kullanıcıya önerilen tasarım: kullanıcı ataması &gt; rol ataması &gt; varsayılan; yoksa null (standart ekran)</summary>
    public int? PreferredId { get; set; }
}

/// <summary>
/// Ekran tasarımları (SqlUpdates/73_form_layouts.sql). Tasarımı yönetici yapar; kullanıcı yalnız
/// kendisine (veya rolüne) atananlar + varsayılan arasında seçer.
/// </summary>
public sealed class FormLayoutRepository
{
    private readonly IDbConnection _db;

    public FormLayoutRepository(IDbConnection db)
    {
        _db = db;
    }

    public async Task<bool> ReadyAsync()
    {
        if (_db.State != ConnectionState.Open) _db.Open();
        return await _db.ExecuteScalarAsync<int>(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_FormLayout', N'U') IS NULL OR OBJECT_ID(N'dbo.SYS_FormLayoutAssign', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
    }

    private void EnsureReady(bool ready)
    {
        if (!ready)
            throw new InvalidOperationException(
                "Ekran tasarımı tabloları yok — Sistem → Veritabanı Güncelleme ekranından 73_form_layouts.sql uygulayın.");
    }

    private async Task AttachAssignsAsync(List<FormLayoutDto> list)
    {
        if (list.Count == 0) return;
        var ids = list.Select(l => l.LayoutID).ToArray();
        var rows = await _db.QueryAsync<(int LayoutID, byte ScopeType, string ScopeKey)>(
            "SELECT LayoutID, ScopeType, ScopeKey FROM dbo.SYS_FormLayoutAssign WHERE LayoutID IN @ids", new { ids });
        foreach (var l in list)
            l.Assigns = rows.Where(r => r.LayoutID == l.LayoutID)
                .Select(r => new FormLayoutAssignDto { ScopeType = r.ScopeType, ScopeKey = r.ScopeKey }).ToList();
    }

    public async Task<List<FormLayoutDto>> ListAsync(string formCode)
    {
        EnsureReady(await ReadyAsync());
        var list = (await _db.QueryAsync<FormLayoutDto>(
            @"SELECT LayoutID, FormCode, Name, LayoutJson, IsDefault, IsActive, CreatedBy, UpdatedAt
              FROM dbo.SYS_FormLayout WHERE FormCode = @formCode AND IsActive = 1
              ORDER BY IsDefault DESC, Name", new { formCode })).ToList();
        await AttachAssignsAsync(list);
        return list;
    }

    public async Task<FormLayoutResolveResult> ResolveAsync(string formCode, string? userId, IEnumerable<string> roleIds, bool isAdmin)
    {
        var res = new FormLayoutResolveResult { Ready = await ReadyAsync() };
        if (!res.Ready) return res;
        var all = await ListAsync(formCode);
        var roles = roleIds.Where(r => !string.IsNullOrWhiteSpace(r)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        bool ForUser(FormLayoutDto l) => l.Assigns.Any(a => a.ScopeType == 1 && string.Equals(a.ScopeKey, userId, StringComparison.OrdinalIgnoreCase));
        bool ForRole(FormLayoutDto l) => l.Assigns.Any(a => a.ScopeType == 2 && roles.Contains(a.ScopeKey));

        // Yönetici tüm tasarımları görür (tasarlamak / denemek için); kullanıcı yalnız atanan + varsayılan
        res.Layouts = isAdmin ? all : all.Where(l => l.IsDefault || ForUser(l) || ForRole(l)).ToList();
        res.PreferredId =
            all.FirstOrDefault(ForUser)?.LayoutID
            ?? all.FirstOrDefault(ForRole)?.LayoutID
            ?? all.FirstOrDefault(l => l.IsDefault)?.LayoutID;
        return res;
    }

    public async Task<int> SaveAsync(FormLayoutDto dto, string? userId)
    {
        EnsureReady(await ReadyAsync());
        if (string.IsNullOrWhiteSpace(dto.FormCode)) throw new ArgumentException("FormCode gerekli.");
        if (string.IsNullOrWhiteSpace(dto.Name)) throw new ArgumentException("Tasarım adı gerekli.");
        if (_db.State != ConnectionState.Open) _db.Open();
        using var tx = _db.BeginTransaction();
        try
        {
            if (dto.IsDefault)
                await _db.ExecuteAsync(
                    "UPDATE dbo.SYS_FormLayout SET IsDefault = 0 WHERE FormCode = @FormCode AND LayoutID <> @LayoutID",
                    new { dto.FormCode, dto.LayoutID }, tx);

            int id;
            if (dto.LayoutID > 0)
            {
                await _db.ExecuteAsync(
                    @"UPDATE dbo.SYS_FormLayout
                      SET Name = @Name, LayoutJson = @LayoutJson, IsDefault = @IsDefault, UpdatedAt = SYSDATETIME()
                      WHERE LayoutID = @LayoutID", dto, tx);
                id = dto.LayoutID;
            }
            else
            {
                id = await _db.ExecuteScalarAsync<int>(
                    @"INSERT INTO dbo.SYS_FormLayout (FormCode, Name, LayoutJson, IsDefault, CreatedBy)
                      OUTPUT INSERTED.LayoutID
                      VALUES (@FormCode, @Name, @LayoutJson, @IsDefault, @userId)",
                    new { dto.FormCode, dto.Name, dto.LayoutJson, dto.IsDefault, userId }, tx);
            }

            await _db.ExecuteAsync("DELETE FROM dbo.SYS_FormLayoutAssign WHERE LayoutID = @id", new { id }, tx);
            foreach (var a in dto.Assigns.Where(a => (a.ScopeType == 1 || a.ScopeType == 2) && !string.IsNullOrWhiteSpace(a.ScopeKey))
                         .DistinctBy(a => (a.ScopeType, a.ScopeKey)))
            {
                await _db.ExecuteAsync(
                    "INSERT INTO dbo.SYS_FormLayoutAssign (LayoutID, ScopeType, ScopeKey) VALUES (@id, @ScopeType, @ScopeKey)",
                    new { id, a.ScopeType, ScopeKey = a.ScopeKey.Trim() }, tx);
            }
            tx.Commit();
            return id;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        EnsureReady(await ReadyAsync());
        return await _db.ExecuteAsync("DELETE FROM dbo.SYS_FormLayout WHERE LayoutID = @id", new { id }) > 0;
    }
}
