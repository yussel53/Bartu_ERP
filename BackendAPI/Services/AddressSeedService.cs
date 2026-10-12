using System.Data;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

public sealed class AddressSeedResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int Countries { get; set; }
    public int Provinces { get; set; }
    public int Districts { get; set; }
    public int Neighborhoods { get; set; }
}

/// <summary>
/// TurkiyeAPI JSON (FrontendUI/public/data/tr-address) → SYS_Country / Province / District / Neighborhood
/// </summary>
public sealed class AddressSeedService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AddressSeedService> _log;

    public AddressSeedService(IWebHostEnvironment env, ILogger<AddressSeedService> log)
    {
        _env = env;
        _log = log;
    }

    public string ResolveDataDir()
    {
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, "Data", "tr-address"),
            Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "FrontendUI", "public", "data", "tr-address")),
            Path.GetFullPath(Path.Combine(_env.ContentRootPath, "..", "..", "FrontendUI", "public", "data", "tr-address")),
        };
        foreach (var c in candidates)
        {
            if (Directory.Exists(c) && File.Exists(Path.Combine(c, "iller.json")))
                return c;
        }
        throw new DirectoryNotFoundException(
            "tr-address klasörü bulunamadı (BackendAPI/Data/tr-address veya FrontendUI/public/data/tr-address)");
    }

    public async Task<AddressSeedResult> SeedAsync(IDbConnection db, CancellationToken ct = default)
    {
        var result = new AddressSeedResult();
        var dir = ResolveDataDir();
        _log.LogInformation("Adres seed kaynağı: {Dir}", dir);

        if (db.State != ConnectionState.Open) db.Open();
        EnsureTables(db);

        var countries = await ReadJsonAsync<List<JsonCountry>>(Path.Combine(dir, "countries.json"), ct)
                        ?? new List<JsonCountry>();
        var provinces = await ReadJsonAsync<List<JsonProvince>>(Path.Combine(dir, "iller.json"), ct)
                        ?? new List<JsonProvince>();
        var districts = await ReadJsonAsync<List<JsonDistrict>>(Path.Combine(dir, "ilceler.json"), ct)
                        ?? new List<JsonDistrict>();
        var neighborhoods = await ReadJsonAsync<List<JsonNeighborhood>>(Path.Combine(dir, "mahalleler.json"), ct)
                        ?? new List<JsonNeighborhood>();

        var sql = db as SqlConnection
            ?? throw new InvalidOperationException("SqlConnection gerekli");

        await using var tx = sql.BeginTransaction();
        try
        {
            await sql.ExecuteAsync(new CommandDefinition(
                "DELETE FROM dbo.SYS_Neighborhood; DELETE FROM dbo.SYS_District; DELETE FROM dbo.SYS_Province; DELETE FROM dbo.SYS_Country;",
                transaction: tx,
                cancellationToken: ct));

            result.Countries = await BulkInsertAsync(sql, tx, "dbo.SYS_Country", BuildCountries(countries), ct);
            result.Provinces = await BulkInsertAsync(sql, tx, "dbo.SYS_Province", BuildProvinces(provinces), ct);
            result.Districts = await BulkInsertAsync(sql, tx, "dbo.SYS_District", BuildDistricts(districts), ct);
            result.Neighborhoods = await BulkInsertAsync(sql, tx, "dbo.SYS_Neighborhood", BuildNeighborhoods(neighborhoods), ct);

            tx.Commit();
            result.Success = true;
            result.Message =
                $"Adres verisi yüklendi: {result.Countries} ülke, {result.Provinces} il, {result.Districts} ilçe, {result.Neighborhoods:N0} mahalle";
            return result;
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task<object> StatusAsync(IDbConnection db, CancellationToken ct = default)
    {
        if (db.State != ConnectionState.Open) db.Open();
        var exists = await db.ExecuteScalarAsync<int>(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_Province', N'U') IS NULL THEN 0 ELSE 1 END");
        if (exists == 0)
            return new { seeded = false, provinces = 0, districts = 0, neighborhoods = 0, dataDir = ResolveDataDirSafe() };

        var p = await db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.SYS_Province", cancellationToken: ct));
        var d = await db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.SYS_District", cancellationToken: ct));
        var n = await db.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.SYS_Neighborhood", cancellationToken: ct));
        return new
        {
            seeded = p >= 81,
            provinces = p,
            districts = d,
            neighborhoods = n,
            dataDir = ResolveDataDirSafe(),
        };
    }

    private string ResolveDataDirSafe()
    {
        try { return ResolveDataDir(); }
        catch (Exception ex) { return ex.Message; }
    }

    private static void EnsureTables(IDbConnection db)
    {
        db.Execute(@"
IF OBJECT_ID(N'dbo.SYS_Country', N'U') IS NULL
  CREATE TABLE dbo.SYS_Country (
    CountryID INT NOT NULL PRIMARY KEY,
    Code NVARCHAR(10) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT (1)
  );
IF OBJECT_ID(N'dbo.SYS_Province', N'U') IS NULL
  CREATE TABLE dbo.SYS_Province (
    ProvinceID INT NOT NULL PRIMARY KEY,
    CountryID INT NOT NULL,
    Code NVARCHAR(10) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT (1)
  );
IF OBJECT_ID(N'dbo.SYS_District', N'U') IS NULL
  CREATE TABLE dbo.SYS_District (
    DistrictID INT NOT NULL PRIMARY KEY,
    ProvinceID INT NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    IsActive BIT NOT NULL DEFAULT (1)
  );
IF OBJECT_ID(N'dbo.SYS_Neighborhood', N'U') IS NULL
  CREATE TABLE dbo.SYS_Neighborhood (
    NeighborhoodID INT NOT NULL PRIMARY KEY,
    ProvinceID INT NOT NULL,
    DistrictID INT NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    PostalCode NVARCHAR(10) NULL,
    IsActive BIT NOT NULL DEFAULT (1)
  );");
    }

    private static DataTable BuildCountries(List<JsonCountry> rows)
    {
        var t = new DataTable();
        t.Columns.Add("CountryID", typeof(int));
        t.Columns.Add("Code", typeof(string));
        t.Columns.Add("Name", typeof(string));
        t.Columns.Add("IsActive", typeof(bool));
        if (rows.Count == 0)
            t.Rows.Add(1, "TR", "Türkiye", true);
        else
            foreach (var r in rows)
                t.Rows.Add(r.Id, r.Code ?? "", r.Name ?? "", r.IsActive);
        return t;
    }

    private static DataTable BuildProvinces(List<JsonProvince> rows)
    {
        var t = new DataTable();
        t.Columns.Add("ProvinceID", typeof(int));
        t.Columns.Add("CountryID", typeof(int));
        t.Columns.Add("Code", typeof(string));
        t.Columns.Add("Name", typeof(string));
        t.Columns.Add("IsActive", typeof(bool));
        foreach (var r in rows)
            t.Rows.Add(r.Id, r.CountryId <= 0 ? 1 : r.CountryId, r.Code ?? "", r.Name ?? "", r.IsActive);
        return t;
    }

    private static DataTable BuildDistricts(List<JsonDistrict> rows)
    {
        var t = new DataTable();
        t.Columns.Add("DistrictID", typeof(int));
        t.Columns.Add("ProvinceID", typeof(int));
        t.Columns.Add("Name", typeof(string));
        t.Columns.Add("IsActive", typeof(bool));
        foreach (var r in rows)
            t.Rows.Add(r.Id, r.ProvinceId, r.Name ?? "", r.IsActive);
        return t;
    }

    private static DataTable BuildNeighborhoods(List<JsonNeighborhood> rows)
    {
        var t = new DataTable();
        t.Columns.Add("NeighborhoodID", typeof(int));
        t.Columns.Add("ProvinceID", typeof(int));
        t.Columns.Add("DistrictID", typeof(int));
        t.Columns.Add("Name", typeof(string));
        t.Columns.Add("PostalCode", typeof(string));
        t.Columns.Add("IsActive", typeof(bool));
        foreach (var r in rows)
            t.Rows.Add(r.Id, r.ProvinceId, r.DistrictId, r.Name ?? "", (object?)r.PostalCode ?? DBNull.Value, r.IsActive);
        return t;
    }

    private static async Task<int> BulkInsertAsync(
        SqlConnection conn,
        SqlTransaction tx,
        string table,
        DataTable data,
        CancellationToken ct)
    {
        using var bulk = new SqlBulkCopy(conn, SqlBulkCopyOptions.KeepIdentity, tx)
        {
            DestinationTableName = table,
            BatchSize = 5000,
            BulkCopyTimeout = 0,
        };
        foreach (DataColumn col in data.Columns)
            bulk.ColumnMappings.Add(col.ColumnName, col.ColumnName);
        await bulk.WriteToServerAsync(data, ct);
        return data.Rows.Count;
    }

    private static async Task<T?> ReadJsonAsync<T>(string path, CancellationToken ct)
    {
        if (!File.Exists(path)) return default;
        await using var fs = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(fs, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        }, ct);
    }

    private sealed class JsonCountry
    {
        public int Id { get; set; }
        public string? Code { get; set; }
        public string? Name { get; set; }
        public bool IsActive { get; set; } = true;
    }

    private sealed class JsonProvince
    {
        public int Id { get; set; }
        public int CountryId { get; set; }
        public string? Code { get; set; }
        public string? Name { get; set; }
        public bool IsActive { get; set; } = true;
    }

    private sealed class JsonDistrict
    {
        public int Id { get; set; }
        public int ProvinceId { get; set; }
        public string? Name { get; set; }
        public bool IsActive { get; set; } = true;
    }

    private sealed class JsonNeighborhood
    {
        public int Id { get; set; }
        public int ProvinceId { get; set; }
        public int DistrictId { get; set; }
        public string? Name { get; set; }
        public string? PostalCode { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
