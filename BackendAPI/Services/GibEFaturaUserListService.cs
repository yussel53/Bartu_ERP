using System.Data;
using System.IO.Compression;
using System.Xml;
using BartuERP.Backend.Repositories;
using Dapper;
using Microsoft.Data.SqlClient;

namespace BartuERP.Backend.Services;

public sealed class GibEFaturaUserListOptions
{
    public const string SectionName = "GibEFatura";

    public string PkListUrl { get; set; } =
        "https://merkez.gib.gov.tr/EFaturaMerkez/newUserPkListxml.zip";

    public string GbListUrl { get; set; } =
        "https://merkez.gib.gov.tr/EFaturaMerkez/newUserGbListxml.zip";

    /** Birincil URL başarısız olursa denenecek yedekler (virgülle ayrılmış) */
    public string PkListFallbackUrls { get; set; } =
        "https://merkez.efatura.gov.tr/EFaturaMerkez/newUserPkListxml.zip";

    public string GbListFallbackUrls { get; set; } =
        "https://merkez.efatura.gov.tr/EFaturaMerkez/newUserGbListxml.zip";

    public string CacheDirectory { get; set; } = "App_Data/gib-user-lists";

    /** Önbellekteki zip bu süreden eskiyse yeniden indirilir */
    public int CacheMaxAgeHours { get; set; } = 24;

    public int DownloadTimeoutMinutes { get; set; } = 60;

    /** Yerel listede yoksa GİB zip içinde ara */
    public bool AutoExternalLookup { get; set; } = true;

    /**
     * Yerel kayıt sayısı bu eşiğin üstündeyse ve son sync taze ise
     * harici tarama atlanır (liste güncel kabul edilir).
     */
    public int MinSyncedLocalCount { get; set; } = 10_000;

    public int SyncFreshHours { get; set; } = 48;

    public int BulkBatchSize { get; set; } = 5000;
}

public sealed class GibLookupOutcome
{
    public bool Attempted { get; set; }
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int Matched { get; set; }
    public List<EFaturaMukellefRow> Rows { get; set; } = new();
}

public sealed class GibSyncOutcome
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int PkImported { get; set; }
    public int GbImported { get; set; }
    public int TotalLocal { get; set; }
}

/// <summary>
/// GİB e-Fatura kayıtlı kullanıcı PK/GB XML zip listelerini indirir,
/// önbellekler, VKN ile tarar ve yerel EFaturaMukellef tablosuna yazar.
/// </summary>
public sealed class GibEFaturaUserListService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<GibEFaturaUserListService> _log;
    private readonly GibEFaturaUserListOptions _opt;
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public GibEFaturaUserListService(
        IHttpClientFactory httpFactory,
        IConfiguration config,
        IWebHostEnvironment env,
        ILogger<GibEFaturaUserListService> log)
    {
        _httpFactory = httpFactory;
        _config = config;
        _env = env;
        _log = log;
        _opt = config.GetSection(GibEFaturaUserListOptions.SectionName).Get<GibEFaturaUserListOptions>()
               ?? new GibEFaturaUserListOptions();
    }

    public GibEFaturaUserListOptions Options => _opt;

    public string ResolveCacheDir()
    {
        var dir = _opt.CacheDirectory;
        if (!Path.IsPathRooted(dir))
            dir = Path.Combine(_env.ContentRootPath, dir);
        Directory.CreateDirectory(dir);
        return dir;
    }

    public async Task<GibLookupOutcome> LookupAndCacheByTaxNrAsync(
        string taxNr,
        IDbConnection db,
        CancellationToken ct = default)
    {
        var outcome = new GibLookupOutcome { Attempted = true };
        var tax = NormalizeTax(taxNr);
        if (tax.Length < 10)
        {
            outcome.Message = "Geçersiz VKN";
            return outcome;
        }

        await Gate.WaitAsync(ct);
        try
        {
            var pkPath = await EnsureZipAsync(
                "pk",
                PrimaryAndFallbacks(_opt.PkListUrl, _opt.PkListFallbackUrls),
                ct,
                forceRefresh: false,
                timeoutMinutes: 3,
                maxAgeHoursOverride: 24 * 7);
            var gbPath = await EnsureZipAsync(
                "gb",
                PrimaryAndFallbacks(_opt.GbListUrl, _opt.GbListFallbackUrls),
                ct,
                forceRefresh: false,
                timeoutMinutes: 3,
                maxAgeHoursOverride: 24 * 7);

            var found = new List<EFaturaMukellefRow>();
            found.AddRange(await SearchZipForTaxAsync(pkPath, tax, "PK", ct));
            found.AddRange(await SearchZipForTaxAsync(gbPath, tax, "GB", ct));

            outcome.Matched = found.Count;
            outcome.Rows = found;
            if (found.Count == 0)
            {
                outcome.Success = true;
                outcome.Message = $"GİB listesinde VKN {tax} bulunamadı (PK+GB tarandı)";
                return outcome;
            }

            if (db.State != ConnectionState.Open) db.Open();
            foreach (var row in found)
            {
                await UpsertLocalAsync(db, row, ct);
            }

            outcome.Success = true;
            outcome.Message = $"GİB listesinden {found.Count} alias bulundu ve yerel tabloya yazıldı";
            return outcome;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "GİB mükellef harici sorgu başarısız");
            outcome.Success = false;
            outcome.Message =
                "GİB kayıtlı kullanıcı listesine erişilemedi: " + ex.Message +
                " (merkez.gib.gov.tr erişimi / IP yetkisi gerekir; Listeyi Güncelle ile tekrar deneyin)";
            return outcome;
        }
        finally
        {
            Gate.Release();
        }
    }

    public async Task<GibSyncOutcome> SyncFullAsync(IDbConnection db, CancellationToken ct = default)
    {
        var outcome = new GibSyncOutcome();
        await Gate.WaitAsync(ct);
        int? syncId = null;
        try
        {
            if (db.State != ConnectionState.Open) db.Open();
            EnsureSyncObjects(db);

            syncId = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"INSERT INTO dbo.SYS_EFaturaMukellefSync (Status, Mode, SourceUrl)
                  VALUES (N'Running', N'FullZip', @url);
                  SELECT CAST(SCOPE_IDENTITY() AS INT);",
                new { url = _opt.PkListUrl },
                cancellationToken: ct));

            var pkPath = await EnsureZipAsync(
                "pk",
                PrimaryAndFallbacks(_opt.PkListUrl, _opt.PkListFallbackUrls),
                ct,
                forceRefresh: true,
                timeoutMinutes: _opt.DownloadTimeoutMinutes);
            var gbPath = await EnsureZipAsync(
                "gb",
                PrimaryAndFallbacks(_opt.GbListUrl, _opt.GbListFallbackUrls),
                ct,
                forceRefresh: true,
                timeoutMinutes: _opt.DownloadTimeoutMinutes);

            await db.ExecuteAsync(new CommandDefinition(
                "TRUNCATE TABLE dbo.EFaturaMukellef_Import",
                cancellationToken: ct));

            outcome.PkImported = await ImportZipToStagingAsync(db, pkPath, "PK", ct);
            outcome.GbImported = await ImportZipToStagingAsync(db, gbPath, "GB", ct);

            await MergeStagingAsync(db, ct);

            outcome.TotalLocal = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1",
                cancellationToken: ct));

            outcome.Success = true;
            outcome.Message =
                $"GİB senkron tamam: PK {outcome.PkImported:N0}, GB {outcome.GbImported:N0}, yerel toplam {outcome.TotalLocal:N0}";

            await db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.SYS_EFaturaMukellefSync
                  SET FinishedAt = GETDATE(), Status = N'Ok',
                      PkImported = @pk, GbImported = @gb, TotalLocal = @tot, Message = @msg
                  WHERE SyncID = @id",
                new
                {
                    id = syncId,
                    pk = outcome.PkImported,
                    gb = outcome.GbImported,
                    tot = outcome.TotalLocal,
                    msg = outcome.Message,
                },
                cancellationToken: ct));

            return outcome;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "GİB mükellef full sync başarısız");
            outcome.Success = false;
            outcome.Message = ex.Message;
            if (syncId is > 0 && db.State == ConnectionState.Open)
            {
                try
                {
                    await db.ExecuteAsync(
                        @"UPDATE dbo.SYS_EFaturaMukellefSync
                          SET FinishedAt = GETDATE(), Status = N'Fail', Message = @msg
                          WHERE SyncID = @id",
                        new { id = syncId, msg = ex.Message.Length > 900 ? ex.Message[..900] : ex.Message });
                }
                catch { /* ignore */ }
            }
            return outcome;
        }
        finally
        {
            Gate.Release();
        }
    }

    public async Task<(DateTime? LastOk, int? TotalLocal, string? Message)> GetLastSyncAsync(
        IDbConnection db,
        CancellationToken ct = default)
    {
        if (db.State != ConnectionState.Open) db.Open();
        var exists = await db.ExecuteScalarAsync<int>(
            @"SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_EFaturaMukellefSync', N'U') IS NULL THEN 0 ELSE 1 END");
        if (exists == 0) return (null, null, null);

        var row = await db.QueryFirstOrDefaultAsync<(DateTime? FinishedAt, int? TotalLocal, string? Message)>(
            new CommandDefinition(
                @"SELECT TOP 1 FinishedAt, TotalLocal, Message
                  FROM dbo.SYS_EFaturaMukellefSync
                  WHERE Status = N'Ok'
                  ORDER BY SyncID DESC",
                cancellationToken: ct));
        return (row.FinishedAt, row.TotalLocal, row.Message);
    }

    public bool IsLocalListAuthoritative(int localCount, DateTime? lastOkSync)
    {
        if (localCount < _opt.MinSyncedLocalCount) return false;
        if (lastOkSync is null) return false;
        return DateTime.Now - lastOkSync.Value <= TimeSpan.FromHours(_opt.SyncFreshHours);
    }

    private async Task<string> EnsureZipAsync(
        string role,
        IReadOnlyList<string> urls,
        CancellationToken ct,
        bool forceRefresh = false,
        int? timeoutMinutes = null,
        int? maxAgeHoursOverride = null)
    {
        var dir = ResolveCacheDir();
        var path = Path.Combine(dir, $"efatura_{role}_list.xml.zip");
        var meta = path + ".url.txt";

        var maxAge = Math.Max(1, maxAgeHoursOverride ?? _opt.CacheMaxAgeHours);
        var fresh = File.Exists(path)
                    && DateTime.UtcNow - File.GetLastWriteTimeUtc(path)
                    <= TimeSpan.FromHours(maxAge);

        if (!forceRefresh && fresh)
            return path;

        Exception? last = null;
        foreach (var url in urls.Where(u => !string.IsNullOrWhiteSpace(u)))
        {
            try
            {
                _log.LogInformation("GİB zip indiriliyor: {Url}", url);
                var client = _httpFactory.CreateClient("GibEFatura");
                var minutes = Math.Clamp(timeoutMinutes ?? _opt.DownloadTimeoutMinutes, 1, 180);
                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeoutCts.CancelAfter(TimeSpan.FromMinutes(minutes));

                using var resp = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeoutCts.Token);
                resp.EnsureSuccessStatusCode();

                var tmp = path + ".tmp";
                await using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await resp.Content.CopyToAsync(fs, timeoutCts.Token);
                }

                if (File.Exists(path)) File.Delete(path);
                File.Move(tmp, path);
                await File.WriteAllTextAsync(meta, url + Environment.NewLine + DateTime.UtcNow.ToString("o"), ct);
                return path;
            }
            catch (Exception ex)
            {
                last = ex;
                _log.LogWarning(ex, "GİB zip indirilemedi: {Url}", url);
            }
        }

        if (!forceRefresh && File.Exists(path))
        {
            _log.LogWarning("GİB zip yenilenemedi, mevcut önbellek kullanılacak: {Path}", path);
            return path;
        }

        throw last ?? new InvalidOperationException("GİB zip URL listesi boş");
    }

    private static IReadOnlyList<string> PrimaryAndFallbacks(string primary, string? fallbacksCsv)
    {
        var list = new List<string>();
        if (!string.IsNullOrWhiteSpace(primary)) list.Add(primary.Trim());
        if (!string.IsNullOrWhiteSpace(fallbacksCsv))
        {
            foreach (var part in fallbacksCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!list.Contains(part, StringComparer.OrdinalIgnoreCase))
                    list.Add(part);
            }
        }
        return list;
    }

    private static async Task<List<EFaturaMukellefRow>> SearchZipForTaxAsync(
        string zipPath,
        string taxNr,
        string defaultType,
        CancellationToken ct)
    {
        var list = new List<EFaturaMukellefRow>();
        await using var fs = new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        using var zip = new ZipArchive(fs, ZipArchiveMode.Read);
        var entry = zip.Entries.FirstOrDefault(e =>
            e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            ?? zip.Entries.FirstOrDefault();
        if (entry is null) return list;

        await using var entryStream = entry.Open();
        using var reader = XmlReader.Create(entryStream, new XmlReaderSettings
        {
            IgnoreComments = true,
            IgnoreWhitespace = true,
            Async = true,
            DtdProcessing = DtdProcessing.Ignore,
        });

        while (await reader.ReadAsync())
        {
            ct.ThrowIfCancellationRequested();
            if (reader.NodeType != XmlNodeType.Element) continue;
            if (!reader.Name.Equals("User", StringComparison.OrdinalIgnoreCase)
                && !reader.LocalName.Equals("User", StringComparison.OrdinalIgnoreCase))
                continue;

            var user = await ReadUserAsync(reader, defaultType);
            if (user is null) continue;
            if (string.Equals(user.TaxNr, taxNr, StringComparison.Ordinal))
                list.Add(user);
        }

        return list;
    }

    private async Task<int> ImportZipToStagingAsync(
        IDbConnection db,
        string zipPath,
        string defaultType,
        CancellationToken ct)
    {
        var sqlConn = db as SqlConnection
            ?? throw new InvalidOperationException("SqlConnection gerekli (bulk import)");

        await using var fs = new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        using var zip = new ZipArchive(fs, ZipArchiveMode.Read);
        var entry = zip.Entries.FirstOrDefault(e =>
            e.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            ?? zip.Entries.FirstOrDefault()
            ?? throw new InvalidOperationException("Zip içinde XML yok: " + zipPath);

        await using var entryStream = entry.Open();
        using var reader = XmlReader.Create(entryStream, new XmlReaderSettings
        {
            IgnoreComments = true,
            IgnoreWhitespace = true,
            Async = true,
            DtdProcessing = DtdProcessing.Ignore,
        });

        var table = CreateImportTable();
        var imported = 0;
        var batch = Math.Max(500, _opt.BulkBatchSize);

        while (await reader.ReadAsync())
        {
            ct.ThrowIfCancellationRequested();
            if (reader.NodeType != XmlNodeType.Element) continue;
            if (!reader.LocalName.Equals("User", StringComparison.OrdinalIgnoreCase)) continue;

            var user = await ReadUserAsync(reader, defaultType);
            if (user is null || string.IsNullOrWhiteSpace(user.TaxNr) || string.IsNullOrWhiteSpace(user.Alias))
                continue;

            table.Rows.Add(
                user.TaxNr,
                user.Title,
                user.Alias,
                user.AliasType,
                user.UnitType,
                user.FirstCreateDate.HasValue ? user.FirstCreateDate.Value : DBNull.Value);
            imported++;

            if (table.Rows.Count >= batch)
            {
                await BulkCopyAsync(sqlConn, table, ct);
                table.Rows.Clear();
            }
        }

        if (table.Rows.Count > 0)
            await BulkCopyAsync(sqlConn, table, ct);

        return imported;
    }

    private static DataTable CreateImportTable()
    {
        var t = new DataTable();
        t.Columns.Add("TaxNr", typeof(string));
        t.Columns.Add("Title", typeof(string));
        t.Columns.Add("Alias", typeof(string));
        t.Columns.Add("AliasType", typeof(string));
        t.Columns.Add("UnitType", typeof(string));
        t.Columns.Add("FirstCreateDate", typeof(DateTime));
        return t;
    }

    private static async Task BulkCopyAsync(SqlConnection conn, DataTable table, CancellationToken ct)
    {
        using var bulk = new SqlBulkCopy(conn)
        {
            DestinationTableName = "dbo.EFaturaMukellef_Import",
            BatchSize = table.Rows.Count,
            BulkCopyTimeout = 0,
        };
        foreach (DataColumn col in table.Columns)
            bulk.ColumnMappings.Add(col.ColumnName, col.ColumnName);
        await bulk.WriteToServerAsync(table, ct);
    }

    private static async Task MergeStagingAsync(IDbConnection db, CancellationToken ct)
    {
        await db.ExecuteAsync(new CommandDefinition(
            @"MERGE dbo.EFaturaMukellef AS t
              USING (
                SELECT TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate
                FROM (
                  SELECT *, ROW_NUMBER() OVER (PARTITION BY TaxNr, Alias ORDER BY (SELECT 1)) AS rn
                  FROM dbo.EFaturaMukellef_Import
                ) x
                WHERE rn = 1
              ) AS s
              ON t.TaxNr = s.TaxNr AND t.Alias = s.Alias
              WHEN MATCHED THEN UPDATE SET
                Title = s.Title,
                AliasType = s.AliasType,
                UnitType = s.UnitType,
                FirstCreateDate = COALESCE(s.FirstCreateDate, t.FirstCreateDate),
                IsActive = 1
              WHEN NOT MATCHED THEN INSERT (TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive)
                VALUES (s.TaxNr, s.Title, s.Alias, s.AliasType, s.UnitType, COALESCE(s.FirstCreateDate, GETDATE()), 1);",
            cancellationToken: ct,
            commandTimeout: 0));
    }

    private static async Task UpsertLocalAsync(IDbConnection db, EFaturaMukellefRow row, CancellationToken ct)
    {
        var id = await db.ExecuteScalarAsync<int?>(new CommandDefinition(
            @"SELECT TOP 1 EFaturaMukellefID FROM dbo.EFaturaMukellef WHERE TaxNr = @tax AND Alias = @alias",
            new { tax = row.TaxNr, alias = row.Alias },
            cancellationToken: ct));

        if (id is > 0)
        {
            await db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.EFaturaMukellef
                  SET Title = @Title, AliasType = @AliasType, UnitType = @UnitType, IsActive = 1
                  WHERE EFaturaMukellefID = @id",
                new { id = id.Value, row.Title, row.AliasType, row.UnitType },
                cancellationToken: ct));
            return;
        }

        await db.ExecuteAsync(new CommandDefinition(
            @"INSERT INTO dbo.EFaturaMukellef (TaxNr, Title, Alias, AliasType, UnitType, FirstCreateDate, IsActive)
              VALUES (@TaxNr, @Title, @Alias, @AliasType, @UnitType, @FirstCreateDate, 1)",
            new
            {
                row.TaxNr,
                row.Title,
                row.Alias,
                row.AliasType,
                row.UnitType,
                FirstCreateDate = row.FirstCreateDate ?? DateTime.Now,
            },
            cancellationToken: ct));
    }

    private static async Task<EFaturaMukellefRow?> ReadUserAsync(XmlReader reader, string defaultType)
    {
        string? identifier = null, alias = null, title = null, type = null;
        DateTime? first = null;

        if (reader.IsEmptyElement) return null;

        var depth = reader.Depth;
        while (await reader.ReadAsync())
        {
            if (reader.NodeType == XmlNodeType.EndElement && reader.Depth == depth)
                break;
            if (reader.NodeType != XmlNodeType.Element) continue;

            var name = reader.LocalName;
            var val = await reader.ReadElementContentAsStringAsync();
            if (name.Equals("Identifier", StringComparison.OrdinalIgnoreCase)
                || name.Equals("VKN", StringComparison.OrdinalIgnoreCase)
                || name.Equals("TaxNr", StringComparison.OrdinalIgnoreCase))
                identifier = NormalizeTax(val);
            else if (name.Equals("Alias", StringComparison.OrdinalIgnoreCase))
                alias = val?.Trim();
            else if (name.Equals("Title", StringComparison.OrdinalIgnoreCase)
                     || name.Equals("Unvan", StringComparison.OrdinalIgnoreCase))
                title = val?.Trim();
            else if (name.Equals("Type", StringComparison.OrdinalIgnoreCase)
                     || name.Equals("AliasType", StringComparison.OrdinalIgnoreCase))
                type = val?.Trim();
            else if (name.Equals("FirstCreationTime", StringComparison.OrdinalIgnoreCase)
                     || name.Equals("FirstCreateDate", StringComparison.OrdinalIgnoreCase)
                     || name.Equals("RegisterTime", StringComparison.OrdinalIgnoreCase))
            {
                if (DateTime.TryParse(val, out var dt)) first = dt;
            }
        }

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(alias))
            return null;

        var aliasType = string.IsNullOrWhiteSpace(type) ? defaultType : type.Trim().ToUpperInvariant();
        if (aliasType.Contains("PK", StringComparison.OrdinalIgnoreCase)) aliasType = "PK";
        else if (aliasType.Contains("GB", StringComparison.OrdinalIgnoreCase)) aliasType = "GB";

        return new EFaturaMukellefRow
        {
            TaxNr = identifier,
            Alias = alias,
            Title = title,
            AliasType = aliasType,
            UnitType = "e-Fatura",
            FirstCreateDate = first,
            IsActive = true,
        };
    }

    private static void EnsureSyncObjects(IDbConnection db)
    {
        db.Execute(@"
IF OBJECT_ID(N'dbo.SYS_EFaturaMukellefSync', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.SYS_EFaturaMukellefSync (
    SyncID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    StartedAt DATETIME NOT NULL DEFAULT (GETDATE()),
    FinishedAt DATETIME NULL,
    Status NVARCHAR(20) NOT NULL,
    Mode NVARCHAR(30) NULL,
    PkImported INT NULL,
    GbImported INT NULL,
    TotalLocal INT NULL,
    Message NVARCHAR(1000) NULL,
    SourceUrl NVARCHAR(500) NULL
  );
END
IF OBJECT_ID(N'dbo.EFaturaMukellef_Import', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.EFaturaMukellef_Import (
    TaxNr NVARCHAR(11) NOT NULL,
    Title NVARCHAR(500) NULL,
    Alias NVARCHAR(250) NOT NULL,
    AliasType NVARCHAR(10) NULL,
    UnitType NVARCHAR(50) NULL,
    FirstCreateDate DATETIME NULL
  );
END");
    }

    private static string NormalizeTax(string? taxNr)
    {
        if (string.IsNullOrWhiteSpace(taxNr)) return "";
        return new string(taxNr.Where(char.IsDigit).ToArray());
    }
}
