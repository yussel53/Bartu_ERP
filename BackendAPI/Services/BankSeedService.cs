using System.Data;
using System.Text.Json;
using Dapper;

namespace BartuERP.Backend.Services;

public sealed class BankSeedResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int Banks { get; set; }
    public int Branches { get; set; }
}

/// <summary>tr-banks JSON → SYS_Bank / SYS_BankBranch</summary>
public sealed class BankSeedService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<BankSeedService> _log;

    public BankSeedService(IWebHostEnvironment env, ILogger<BankSeedService> log)
    {
        _env = env;
        _log = log;
    }

    private string ResolveDataDir()
    {
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, "Data", "tr-banks"),
            Path.Combine(_env.WebRootPath ?? "", "data", "tr-banks"),
            Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "FrontendUI", "public", "data", "tr-banks")),
            Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "..", "FrontendUI", "public", "data", "tr-banks")),
        };
        foreach (var c in candidates)
        {
            if (!string.IsNullOrWhiteSpace(c) && Directory.Exists(c) && File.Exists(Path.Combine(c, "banks.json")))
                return c;
        }
        throw new DirectoryNotFoundException(
            "tr-banks klasörü bulunamadı (wwwroot/data/tr-banks veya FrontendUI/public/data/tr-banks)");
    }

    public async Task<object> StatusAsync(IDbConnection db, CancellationToken ct = default)
    {
        var banks = 0;
        var branches = 0;
        if (await TableExistsAsync(db, "SYS_Bank", ct))
            banks = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.SYS_Bank", cancellationToken: ct));
        if (await TableExistsAsync(db, "SYS_BankBranch", ct))
            branches = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(1) FROM dbo.SYS_BankBranch", cancellationToken: ct));
        return new { seeded = banks > 0, banks, branches };
    }

    public async Task<BankSeedResult> SeedAsync(IDbConnection db, CancellationToken ct = default)
    {
        var result = new BankSeedResult();
        if (!await TableExistsAsync(db, "SYS_Bank", ct))
        {
            result.Message = "SYS_Bank yok — önce Veritabanı Güncelleme uygulayın.";
            return result;
        }

        var dir = ResolveDataDir();
        var banksJson = await File.ReadAllTextAsync(Path.Combine(dir, "banks.json"), ct);
        var banks = JsonSerializer.Deserialize<List<JsonBank>>(banksJson, JsonOpts()) ?? [];
        var branchesPath = Path.Combine(dir, "branches.json");
        var branches = File.Exists(branchesPath)
            ? JsonSerializer.Deserialize<List<JsonBranch>>(
                await File.ReadAllTextAsync(branchesPath, ct), JsonOpts()) ?? []
            : [];

        if (db.State != ConnectionState.Open) db.Open();
        using var tx = db.BeginTransaction();
        try
        {
            foreach (var b in banks)
            {
                var code = (b.Code ?? "").Trim();
                if (code.Length == 0) continue;
                var n = await db.ExecuteAsync(new CommandDefinition(@"
IF EXISTS (SELECT 1 FROM dbo.SYS_Bank WHERE Code = @Code)
  UPDATE dbo.SYS_Bank SET Title=@Title, ShortTitle=@ShortTitle, Swift=@Swift,
    IsActive=1, SortOrder=@SortOrder WHERE Code=@Code;
ELSE
  INSERT INTO dbo.SYS_Bank (Code, Title, ShortTitle, Swift, IsActive, SortOrder)
  VALUES (@Code, @Title, @ShortTitle, @Swift, 1, @SortOrder);",
                    new
                    {
                        Code = code,
                        Title = (b.Title ?? code).Trim(),
                        ShortTitle = string.IsNullOrWhiteSpace(b.ShortTitle) ? null : b.ShortTitle.Trim(),
                        Swift = string.IsNullOrWhiteSpace(b.Swift) ? null : b.Swift.Trim(),
                        SortOrder = b.SortOrder <= 0 ? 100 : b.SortOrder,
                    }, tx, cancellationToken: ct));
                result.Banks += n > 0 ? 1 : 0;
            }

            if (await TableExistsAsync(db, "SYS_BankBranch", ct))
            {
                foreach (var br in branches)
                {
                    var bankCode = (br.BankCode ?? "").Trim();
                    var code = (br.Code ?? "").Trim();
                    if (bankCode.Length == 0 || code.Length == 0) continue;
                    var bankId = await db.ExecuteScalarAsync<int?>(new CommandDefinition(
                        "SELECT SYS_BankID FROM dbo.SYS_Bank WHERE Code=@c",
                        new { c = bankCode }, tx, cancellationToken: ct));
                    if (bankId == null) continue;
                    var n = await db.ExecuteAsync(new CommandDefinition(@"
IF EXISTS (SELECT 1 FROM dbo.SYS_BankBranch WHERE SYS_BankID=@BankId AND Code=@Code)
  UPDATE dbo.SYS_BankBranch SET Title=@Title, City=@City, IsActive=1
  WHERE SYS_BankID=@BankId AND Code=@Code;
ELSE
  INSERT INTO dbo.SYS_BankBranch (SYS_BankID, Code, Title, City, IsActive)
  VALUES (@BankId, @Code, @Title, @City, 1);",
                        new
                        {
                            BankId = bankId.Value,
                            Code = code,
                            Title = (br.Title ?? code).Trim(),
                            City = string.IsNullOrWhiteSpace(br.City) ? null : br.City.Trim(),
                        }, tx, cancellationToken: ct));
                    result.Branches += n > 0 ? 1 : 0;
                }
            }

            tx.Commit();
            result.Success = true;
            result.Message = $"{result.Banks} banka, {result.Branches} şube yüklendi / güncellendi.";
            _log.LogInformation("Bank seed: {Msg}", result.Message);
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }

        return result;
    }

    private static JsonSerializerOptions JsonOpts() => new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static async Task<bool> TableExistsAsync(IDbConnection db, string name, CancellationToken ct)
    {
        var n = await db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT CASE WHEN OBJECT_ID(@t, N'U') IS NULL THEN 0 ELSE 1 END",
            new { t = "dbo." + name }, cancellationToken: ct));
        return n == 1;
    }

    private sealed class JsonBank
    {
        public string? Code { get; set; }
        public string? Title { get; set; }
        public string? ShortTitle { get; set; }
        public string? Swift { get; set; }
        public int SortOrder { get; set; }
    }

    private sealed class JsonBranch
    {
        public string? BankCode { get; set; }
        public string? Code { get; set; }
        public string? Title { get; set; }
        public string? City { get; set; }
    }
}
