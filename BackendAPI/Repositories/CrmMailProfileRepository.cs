using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Repositories;

/// <summary>Kapsam: 0 Genel · 1 Firma · 2 Bölüm · 3 Birim · 4 Kullanıcı</summary>
public sealed class CrmMailProfileDto
{
    public int MailProfileID { get; set; }
    public byte ScopeType { get; set; }
    public int? ScopeID { get; set; }
    public string? ScopeName { get; set; }
    public string? Title { get; set; }
    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public bool SmtpSsl { get; set; } = true;
    public string? SmtpUser { get; set; }
    public string? SmtpPassword { get; set; }
    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? ReplyTo { get; set; }
    public string? BccAddress { get; set; }
    public string? Signature { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? UpdateDate { get; set; }
}

public sealed class CrmOrgItem
{
    public int Id { get; set; }
    public string? Code { get; set; }
    public string? Title { get; set; }
    public byte? UnitKind { get; set; }
    public int? CompanyID { get; set; }
}

/// <summary>Kullanıcı için geçerli mail tanımı + hangi kapsamdan geldiği.</summary>
public sealed class CrmResolvedMailProfile
{
    public CrmMailProfileDto? Profile { get; set; }
    public string Source { get; set; } = "";
    public bool SmtpReady => !string.IsNullOrWhiteSpace(Profile?.SmtpHost);
    /// <summary>Çözümlemede bakılan kapsamlar (ekranda gösterim için)</summary>
    public List<string> Chain { get; set; } = new();
}

public sealed class CrmMailProfileRepository
{
    public static readonly string[] ScopeNames = { "Genel", "Firma", "Bölüm", "Birim", "Kullanıcı" };
    public const string PasswordMask = "********";

    private readonly IDbConnection _db;
    public CrmMailProfileRepository(IDbConnection db) => _db = db;

    private static async Task<T> Guard<T>(Func<Task<T>> fn)
    {
        try { return await fn(); }
        catch (SqlException ex) when (ex.Number == 208 && ex.Message.Contains("CRM_MailProfile", StringComparison.OrdinalIgnoreCase))
        {
            throw new CrmNeedsUpdateException();
        }
    }

    private const string ProfileSelect = @"
SELECT p.*,
  CASE p.ScopeType
    WHEN 0 THEN N'Genel'
    WHEN 1 THEN (SELECT TOP 1 ISNULL(c.CompanyCode + N' — ', N'') + c.Title FROM dbo.SYS_Companies c WHERE c.CompanyId = p.ScopeID)
    WHEN 2 THEN (SELECT TOP 1 ISNULL(o.Code + N' — ', N'') + o.Title FROM dbo.SYS_OrgUnit o WHERE o.OrgUnitID = p.ScopeID)
    WHEN 3 THEN (SELECT TOP 1 ISNULL(o.Code + N' — ', N'') + o.Title FROM dbo.SYS_OrgUnit o WHERE o.OrgUnitID = p.ScopeID)
    WHEN 4 THEN (SELECT TOP 1 LTRIM(RTRIM(ISNULL(u.Name,'') + ' ' + ISNULL(u.Surname,''))) FROM dbo.SystemUser u WHERE u.SystemUserID = p.ScopeID)
  END AS ScopeName
FROM dbo.CRM_MailProfile p";

    public Task<List<CrmMailProfileDto>> ListAsync(bool maskPasswords = true) => Guard(async () =>
    {
        var list = (await _db.QueryAsync<CrmMailProfileDto>(ProfileSelect + " ORDER BY p.ScopeType, p.ScopeID")).ToList();
        if (maskPasswords)
            foreach (var p in list.Where(p => !string.IsNullOrEmpty(p.SmtpPassword))) p.SmtpPassword = PasswordMask;
        return list;
    });

    public Task<CrmMailProfileDto?> GetAsync(int id) => Guard(async () =>
        await _db.QueryFirstOrDefaultAsync<CrmMailProfileDto>(ProfileSelect + " WHERE p.MailProfileID=@id", new { id }));

    public Task<int> SaveAsync(CrmMailProfileDto p) => Guard(async () =>
    {
        if (p.ScopeType > 4) throw new ArgumentException("Geçersiz kapsam.");
        if (p.ScopeType == 0) p.ScopeID = null;
        else if (p.ScopeID is null or <= 0) throw new ArgumentException($"{ScopeNames[p.ScopeType]} seçin.");
        if (string.IsNullOrWhiteSpace(p.SmtpHost) && string.IsNullOrWhiteSpace(p.FromAddress) && string.IsNullOrWhiteSpace(p.Signature))
            throw new ArgumentException("En azından SMTP sunucusu, gönderen adresi veya imza girin.");

        var dup = await _db.ExecuteScalarAsync<int?>(
            "SELECT MailProfileID FROM dbo.CRM_MailProfile WHERE ScopeType=@ScopeType AND ((ScopeID IS NULL AND @ScopeID IS NULL) OR ScopeID=@ScopeID)",
            new { p.ScopeType, p.ScopeID });
        if (dup is int d && d != p.MailProfileID)
            throw new ArgumentException($"Bu {ScopeNames[p.ScopeType].ToLowerInvariant()} için zaten bir mail tanımı var (#{d}). Onu düzenleyin.");

        var keepPassword = p.SmtpPassword == PasswordMask;
        if (p.MailProfileID > 0)
        {
            await _db.ExecuteAsync($@"UPDATE dbo.CRM_MailProfile SET ScopeType=@ScopeType, ScopeID=@ScopeID, Title=@Title, SmtpHost=@SmtpHost,
  SmtpPort=@SmtpPort, SmtpSsl=@SmtpSsl, SmtpUser=@SmtpUser, {(keepPassword ? "" : "SmtpPassword=@SmtpPassword,")}
  FromAddress=@FromAddress, FromName=@FromName, ReplyTo=@ReplyTo, BccAddress=@BccAddress, Signature=@Signature,
  IsActive=@IsActive, UpdateDate=SYSDATETIME()
WHERE MailProfileID=@MailProfileID", p);
            return p.MailProfileID;
        }
        if (keepPassword) p.SmtpPassword = null;
        return await _db.ExecuteScalarAsync<int>(@"INSERT INTO dbo.CRM_MailProfile
  (ScopeType, ScopeID, Title, SmtpHost, SmtpPort, SmtpSsl, SmtpUser, SmtpPassword, FromAddress, FromName, ReplyTo, BccAddress, Signature, IsActive)
OUTPUT INSERTED.MailProfileID
VALUES (@ScopeType, @ScopeID, @Title, @SmtpHost, @SmtpPort, @SmtpSsl, @SmtpUser, @SmtpPassword, @FromAddress, @FromName, @ReplyTo, @BccAddress, @Signature, @IsActive)", p);
    });

    public Task<int> DeleteAsync(int id) => Guard(async () =>
        await _db.ExecuteAsync("DELETE FROM dbo.CRM_MailProfile WHERE MailProfileID=@id", new { id }));

    public async Task<List<CrmOrgItem>> ListCompaniesAsync()
    {
        try
        {
            return (await _db.QueryAsync<CrmOrgItem>(
                "SELECT CompanyId AS Id, CompanyCode AS Code, Title FROM dbo.SYS_Companies WHERE ISNULL(IsActive,1)=1 ORDER BY CompanyCode")).ToList();
        }
        catch (SqlException) { return new(); }
    }

    public async Task<List<CrmOrgItem>> ListOrgUnitsAsync()
    {
        try
        {
            return (await _db.QueryAsync<CrmOrgItem>(
                "SELECT OrgUnitID AS Id, Code, Title, UnitKind, CompanyID FROM dbo.SYS_OrgUnit WHERE ISNULL(IsActive,1)=1 ORDER BY UnitKind, Code")).ToList();
        }
        catch (SqlException) { return new(); }
    }

    /// <summary>
    /// Kullanıcının geçerli mail tanımı: Kullanıcı → Birim → Bölüm → Firma → Genel.
    /// Kullanıcının birimi/bölümü SystemUser.DefaultOrgUnitID, firması DefaultCompanyID (yoksa birimin firması).
    /// </summary>
    public async Task<CrmResolvedMailProfile> ResolveAsync(int userId, int? companyIdOverride = null)
    {
        var r = new CrmResolvedMailProfile();
        List<CrmMailProfileDto> all;
        try
        {
            all = (await _db.QueryAsync<CrmMailProfileDto>(ProfileSelect + " WHERE p.IsActive=1")).ToList();
        }
        catch (SqlException) { return r; }

        int? companyId = null, unitId = null;
        byte? unitKind = null;
        int? unitCompany = null;
        if (userId > 0)
        {
            try
            {
                var u = await _db.QueryFirstOrDefaultAsync<(int? CompanyID, int? OrgUnitID)>(
                    "SELECT DefaultCompanyID, DefaultOrgUnitID FROM dbo.SystemUser WHERE SystemUserID=@userId", new { userId });
                companyId = u.CompanyID;
                unitId = u.OrgUnitID;
                if (unitId is int uid)
                {
                    var unit = await _db.QueryFirstOrDefaultAsync<(byte? Kind, int? CompanyID)>(
                        "SELECT UnitKind, CompanyID FROM dbo.SYS_OrgUnit WHERE OrgUnitID=@uid", new { uid });
                    unitKind = unit.Kind;
                    unitCompany = unit.CompanyID;
                }
            }
            catch (SqlException) { /* kolonlar yoksa genel'e düş */ }
        }
        companyId = companyIdOverride ?? companyId ?? unitCompany;

        var steps = new List<(byte Scope, int? Id)>();
        if (userId > 0) steps.Add((4, userId));
        if (unitId.HasValue && unitKind == 2) steps.Add((3, unitId));
        if (unitId.HasValue && unitKind == 1) steps.Add((2, unitId));
        if (companyId.HasValue) steps.Add((1, companyId));
        steps.Add((0, null));

        foreach (var (scope, id) in steps)
        {
            var p = all.FirstOrDefault(x => x.ScopeType == scope && x.ScopeID == id);
            r.Chain.Add($"{ScopeNames[scope]}{(p == null ? " (tanım yok)" : $": {p.ScopeName}")}");
            if (p == null) continue;
            if (r.Profile == null)
            {
                r.Profile = Clone(p);
                r.Source = $"{ScopeNames[scope]} — {p.ScopeName}";
            }
            else
            {
                // üst kapsamdaki boş alanları alt kapsamdan doldur (örn. kullanıcı sadece imza tanımlamış, SMTP firmadan gelir)
                var t = r.Profile;
                if (string.IsNullOrWhiteSpace(t.SmtpHost) && !string.IsNullOrWhiteSpace(p.SmtpHost))
                {
                    t.SmtpHost = p.SmtpHost; t.SmtpPort = p.SmtpPort; t.SmtpSsl = p.SmtpSsl;
                    t.SmtpUser = p.SmtpUser; t.SmtpPassword = p.SmtpPassword;
                    r.Source += $" · SMTP: {ScopeNames[scope]}";
                }
                t.FromAddress ??= N(p.FromAddress);
                t.FromName ??= N(p.FromName);
                t.ReplyTo ??= N(p.ReplyTo);
                t.BccAddress ??= N(p.BccAddress);
                t.Signature ??= N(p.Signature);
            }
        }
        return r;
    }

    private static string? N(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

    private static CrmMailProfileDto Clone(CrmMailProfileDto p) => new()
    {
        MailProfileID = p.MailProfileID, ScopeType = p.ScopeType, ScopeID = p.ScopeID, ScopeName = p.ScopeName, Title = p.Title,
        SmtpHost = N(p.SmtpHost), SmtpPort = p.SmtpPort, SmtpSsl = p.SmtpSsl, SmtpUser = N(p.SmtpUser), SmtpPassword = p.SmtpPassword,
        FromAddress = N(p.FromAddress), FromName = N(p.FromName), ReplyTo = N(p.ReplyTo),
        BccAddress = N(p.BccAddress), Signature = N(p.Signature), IsActive = p.IsActive, UpdateDate = p.UpdateDate
    };
}
