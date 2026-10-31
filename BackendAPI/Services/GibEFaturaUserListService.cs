using System.Data;
using System.IO.Compression;
using System.Xml;
using System.Xml.Linq;
using BartuERP.Backend.Repositories;
using Dapper;

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

    /** Yerel tabloda olmayan / kontrolü eski VKN e-Logo'dan (CheckGibUser) anlık sorgulanır */
    public bool AutoExternalLookup { get; set; } = true;

    /** Senkronda okunan etiket sayısı bunun altındaysa liste eksik sayılır, yerel kayıtlar değiştirilmez */
    public int MinSyncedLocalCount { get; set; } = 10_000;

    /** VKN kontrolü (gece listesi ya da e-Logo) bu kadar saat geçerli; sonra yeniden sorulur */
    public int SyncFreshHours { get; set; } = 48;

    public int BulkBatchSize { get; set; } = 5000;

    /** Gece tam senkronu (EFaturaMukellefSyncJob) — her veritabanında günde bir */
    public bool NightlySyncEnabled { get; set; } = false;

    /** Gece senkronunun başlayacağı saat (Türkiye saati, 0-23) */
    public int NightlySyncHour { get; set; } = 3;

    /// <summary>
    /// true ise GİB PK/GB zip tamamı EFaturaMukellef (+ Import) tablolarına yazılır (GB mertebesinde).
    /// Kapalıyken mükellef sorgusu entegratör / zip içinde VKN taraması ile yapılır.
    /// </summary>
    public bool FullLocalSyncEnabled { get; set; } = false;
}

public sealed class GibSyncOutcome
{
    public bool Success { get; set; }
    public string Message { get; set; } = "";
    public int PkImported { get; set; }
    public int GbImported { get; set; }
    public int TotalLocal { get; set; }
    /** GİB listesinde artık olmayan, pasife alınan etiket sayısı */
    public int Deactivated { get; set; }
    /** Listenin alındığı yer: GİB zip adresi ya da «e-Logo getUserListNew» */
    public string? Source { get; set; }
}

/// <summary>
/// GİB e-Fatura kayıtlı kullanıcı PK/GB XML zip listelerini indirir ve yalnız carilerin VKN/TCKN'lerine ait
/// etiketleri yerel EFaturaMukellef tablosuna yazar (tam liste tutulmaz; listede olmayan VKN e-Logo'dan sorulur).
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

    /// <summary>
    /// Gece / elle senkron: PK ve GB listeleri geçici dosyaya indirilir, akış olarak okunur ve yalnız carilerin
    /// (CustomerCard, CustomerAdress) ve firmaların VKN/TCKN'lerine ait etiketler yazılır. Tam liste veritabanında tutulmaz.
    /// </summary>
    /// <param name="elogo">GİB zip adresine erişilemezse liste bu e-Logo hesabından (getUserListNew) alınır</param>
    /// <param name="mode">SYS_EFaturaMukellefSync.Mode — FullZip (elle) · Nightly (gece görevi)</param>
    /// <param name="reuseCacheHours">&gt; 0: önbellekteki zip bu kadar saatten yeniyse yeniden indirilmez
    /// (gece görevinde birden çok veritabanı aynı indirmeyi paylaşır)</param>
    public async Task<GibSyncOutcome> SyncFullAsync(
        IDbConnection db,
        CancellationToken ct = default,
        ELogoCompanyCredentials? elogo = null,
        string mode = "FullZip",
        int reuseCacheHours = 0)
    {
        var outcome = new GibSyncOutcome();
        if (!_opt.FullLocalSyncEnabled)
        {
            outcome.Success = false;
            outcome.Message =
                "Tam GİB listesi yerel tabloya yazılmıyor (EFaturaMukellef / Import GB büyütüyor). " +
                "Mükellef kontrolü için entegratör sorgusu kullanın. Açmak: GibEFatura:FullLocalSyncEnabled=true";
            return outcome;
        }

        await Gate.WaitAsync(ct);
        int? syncId = null;
        try
        {
            if (db.State != ConnectionState.Open) db.Open();
            EnsureSyncObjects(db);

            syncId = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                @"INSERT INTO dbo.SYS_EFaturaMukellefSync (Status, Mode, SourceUrl)
                  VALUES (N'Running', @mode, @url);
                  SELECT CAST(SCOPE_IDENTITY() AS INT);",
                new { url = _opt.PkListUrl, mode },
                cancellationToken: ct));

            var targets = await LoadTargetTaxesAsync(db, ct);

            var (pkPath, pkSource) = await AcquireZipAsync("pk", elogo, reuseCacheHours, ct);
            var (gbPath, _) = await AcquireZipAsync("gb", elogo, reuseCacheHours, ct);
            outcome.Source = pkSource;

            var found = targets.ToDictionary(t => t, _ => new List<EFaturaMukellefRow>());
            outcome.PkImported = await ScanZipAsync(pkPath, "PK", found, ct);
            outcome.GbImported = await ScanZipAsync(gbPath, "GB", found, ct);

            // Yarım indirilmiş liste «mükellef değil» kararı yazdırmasın
            if (outcome.PkImported + outcome.GbImported < _opt.MinSyncedLocalCount)
                throw new InvalidOperationException(
                    $"GİB listesi eksik okundu ({outcome.PkImported + outcome.GbImported:N0} etiket) — yerel kayıtlar değiştirilmedi.");

            var activeBefore = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1", cancellationToken: ct));
            using (var tx = db.BeginTransaction())
            {
                foreach (var (tax, rows) in found)
                    await EFaturaMukellefLookupService.SaveAsync(db, tx, tax, rows, "GibList", ct);

                // Artık cari olmayan VKN'ler: son 7 günde anlık sorgulanmadıysa silinir (yeni cari girişinde yeniden sorulur)
                await db.ExecuteAsync(new CommandDefinition(
                    @"DELETE m FROM dbo.EFaturaMukellef m
                      WHERE NOT EXISTS (SELECT 1 FROM dbo.EFaturaMukellefCheck c WHERE c.TaxNr = m.TaxNr AND c.CheckedAt >= DATEADD(DAY, -7, GETDATE()));
                      DELETE dbo.EFaturaMukellefCheck WHERE CheckedAt < DATEADD(DAY, -7, GETDATE());",
                    transaction: tx, cancellationToken: ct, commandTimeout: 0));
                tx.Commit();
            }

            // Staging bırakılmaz — Import tablosu aksi halde GB mertebesinde kalır
            await db.ExecuteAsync(new CommandDefinition(
                "TRUNCATE TABLE dbo.EFaturaMukellef_Import",
                cancellationToken: ct));

            outcome.TotalLocal = await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT COUNT(*) FROM dbo.EFaturaMukellef WHERE IsActive = 1",
                cancellationToken: ct));
            outcome.Deactivated = Math.Max(0, activeBefore - outcome.TotalLocal);
            var mukellef = found.Count(f => f.Value.Any(r => r.AliasType == "PK"));

            outcome.Success = true;
            outcome.Message =
                $"GİB senkron tamam: listede PK {outcome.PkImported:N0}, GB {outcome.GbImported:N0} etiket okundu; " +
                $"{found.Count:N0} cari VKN/TCKN'den {mukellef:N0} mükellef, yerel {outcome.TotalLocal:N0} etiket · kaynak: {outcome.Source}";

            await db.ExecuteAsync(new CommandDefinition(
                @"UPDATE dbo.SYS_EFaturaMukellefSync
                  SET FinishedAt = GETDATE(), Status = N'Ok',
                      PkImported = @pk, GbImported = @gb, TotalLocal = @tot, Message = @msg, SourceUrl = @src
                  WHERE SyncID = @id",
                new
                {
                    id = syncId,
                    pk = outcome.PkImported,
                    gb = outcome.GbImported,
                    tot = outcome.TotalLocal,
                    msg = outcome.Message,
                    src = outcome.Source,
                },
                cancellationToken: ct));

            return outcome;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "GİB mükellef senkronu başarısız");
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

    /// <summary>İndirilmiş liste dosyalarını siler (senkron bitince — liste diskte de kalmaz)</summary>
    public void DeleteCachedZips()
    {
        try
        {
            foreach (var f in Directory.EnumerateFiles(ResolveCacheDir(), "efatura_*_list.xml.zip*"))
                File.Delete(f);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "GİB liste dosyaları silinemedi");
        }
    }

    /// <summary>Carilerin (kart + adres) ve firmaların 10/11 haneli VKN/TCKN'leri</summary>
    private static async Task<HashSet<string>> LoadTargetTaxesAsync(IDbConnection db, CancellationToken ct)
    {
        var raw = await db.QueryAsync<string?>(new CommandDefinition(
            @"SELECT TaxNr FROM dbo.CustomerCard WHERE TaxNr IS NOT NULL
              UNION SELECT TaxNr FROM dbo.CustomerAdress WHERE TaxNr IS NOT NULL
              UNION SELECT TaxNumber FROM dbo.SYS_Companies WHERE TaxNumber IS NOT NULL",
            cancellationToken: ct));
        return raw.Select(NormalizeTax).Where(t => t.Length is 10 or 11).ToHashSet();
    }

    /// <summary>Zip içindeki listeyi akış olarak okur; yalnız hedef VKN'lerin etiketleri toplanır. Dönen: okunan etiket sayısı.</summary>
    private static async Task<int> ScanZipAsync(
        string zipPath,
        string defaultType,
        Dictionary<string, List<EFaturaMukellefRow>> found,
        CancellationToken ct)
    {
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

        var read = 0;
        while (await reader.ReadAsync())
        {
            ct.ThrowIfCancellationRequested();
            if (reader.NodeType != XmlNodeType.Element) continue;
            if (!reader.LocalName.Equals("User", StringComparison.OrdinalIgnoreCase)) continue;

            foreach (var user in await ReadUsersAsync(reader, defaultType))
            {
                read++;
                if (found.TryGetValue(user.TaxNr, out var list)) list.Add(user);
            }
        }
        return read;
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

    /// <summary>
    /// PK / GB listesi zip'i: önce GİB adresleri (merkez.gib.gov.tr — çoğu ağda yalnız entegratörlere açık),
    /// olmazsa e-Logo getUserListNew. reuseCacheHours içinde indirilmiş zip yeniden kullanılır.
    /// </summary>
    private async Task<(string Path, string Source)> AcquireZipAsync(
        string role, ELogoCompanyCredentials? elogo, int reuseCacheHours, CancellationToken ct)
    {
        var path = Path.Combine(ResolveCacheDir(), $"efatura_{role}_list.xml.zip");
        if (reuseCacheHours > 0 && File.Exists(path)
            && DateTime.UtcNow - File.GetLastWriteTimeUtc(path) <= TimeSpan.FromHours(reuseCacheHours))
            return (path, "önbellek");

        var (url, fallbacks) = role == "pk" ? (_opt.PkListUrl, _opt.PkListFallbackUrls) : (_opt.GbListUrl, _opt.GbListFallbackUrls);
        try
        {
            return (await EnsureZipAsync(role, PrimaryAndFallbacks(url, fallbacks), ct,
                forceRefresh: true, timeoutMinutes: _opt.DownloadTimeoutMinutes), url);
        }
        catch (Exception ex) when (elogo is { IntegratorUser: { Length: > 0 }, IntegratorPassword: { Length: > 0 } } && !ct.IsCancellationRequested)
        {
            _log.LogWarning("GİB {Role} listesi doğrudan indirilemedi ({Msg}) — e-Logo'dan alınıyor", role, ex.Message);
            var wsUrl = ELogoDocumentSyncService.ResolvePostBoxUrl(elogo.IntegratorWsUrl);
            var http = _httpFactory.CreateClient("GibEFatura");
            try
            {
                await ELogoUserListClient.DownloadAsync(http, wsUrl, elogo.IntegratorUser!, elogo.IntegratorPassword!,
                    role == "pk" ? "PKLIST" : "GBLIST", path, ct);
                return (path, "e-Logo getUserListNew");
            }
            catch (Exception elogoEx) when (!ct.IsCancellationRequested && File.Exists(path)
                                            && DateTime.UtcNow - File.GetLastWriteTimeUtc(path) <= TimeSpan.FromHours(Math.Max(1, _opt.CacheMaxAgeHours)))
            {
                // e-Logo listeyi 10 dakikadan sık vermez («saatte bir güncellenir») — taze önbellek kullanılır
                _log.LogWarning("e-Logo {Role} listesi alınamadı ({Msg}) — önbellekteki liste kullanılıyor", role, elogoEx.Message);
                return (path, $"önbellek ({File.GetLastWriteTime(path):dd.MM.yyyy HH:mm})");
            }
        }
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

    /// <summary>
    /// Bir &lt;User&gt; kaydını okur (okuyucu kaydın bitişinde kalır). GİB «newUser» biçimi:
    /// User/Documents/Document[@type=Invoice|DespatchAdvice]/Alias/{Name, CreationTime, DeletionTime} —
    /// silinmiş etiketler (DeletionTime) alınmaz; fatura etiketi «e-Fatura», irsaliye etiketi «e-İrsaliye».
    /// Eski düz biçim (User/Alias metni) de okunur. Etiket türü (PK / GB) listeden gelir.
    /// </summary>
    private static async Task<List<EFaturaMukellefRow>> ReadUsersAsync(XmlReader reader, string defaultType)
    {
        var rows = new List<EFaturaMukellefRow>();
        if (reader.IsEmptyElement) return rows;

        XElement user;
        using (var sub = reader.ReadSubtree())
            user = await XElement.LoadAsync(sub, LoadOptions.None, CancellationToken.None);

        static string? Child(XElement e, params string[] names) =>
            e.Elements().FirstOrDefault(c => names.Any(n => c.Name.LocalName.Equals(n, StringComparison.OrdinalIgnoreCase)))?.Value?.Trim();
        static DateTime? Date(string? v) => DateTime.TryParse(v, out var d) ? d : null;

        var identifier = NormalizeTax(Child(user, "Identifier", "VKN", "TaxNr"));
        if (string.IsNullOrWhiteSpace(identifier)) return rows;
        var title = Child(user, "Title", "Unvan");
        var first = Date(Child(user, "FirstCreationTime", "FirstCreateDate", "RegisterTime"));

        var aliasType = defaultType;
        var flatType = Child(user, "AliasType");
        if (flatType?.Contains("PK", StringComparison.OrdinalIgnoreCase) == true) aliasType = "PK";
        else if (flatType?.Contains("GB", StringComparison.OrdinalIgnoreCase) == true) aliasType = "GB";

        void Add(string? alias, string unit, DateTime? created)
        {
            if (string.IsNullOrWhiteSpace(alias)) return;
            rows.Add(new EFaturaMukellefRow
            {
                TaxNr = identifier,
                Alias = alias.Trim(),
                Title = title,
                AliasType = aliasType,
                UnitType = unit,
                // Mükellefiyet başlangıcı (cari kartta e-Fatura başlangıç tarihi): kullanıcının ilk kaydı, yoksa etiket kaydı
                FirstCreateDate = first ?? created,
                IsActive = true,
            });
        }

        foreach (var doc in user.Descendants().Where(d => d.Name.LocalName == "Document"))
        {
            var unit = string.Equals((string?)doc.Attribute("type"), "DespatchAdvice", StringComparison.OrdinalIgnoreCase)
                ? "e-İrsaliye" : "e-Fatura";
            foreach (var a in doc.Elements().Where(x => x.Name.LocalName == "Alias"))
            {
                if (a.HasElements)
                {
                    if (!string.IsNullOrWhiteSpace(Child(a, "DeletionTime"))) continue;
                    Add(Child(a, "Name"), unit, Date(Child(a, "CreationTime")));
                }
                else
                {
                    Add(a.Value, unit, null);
                }
            }
        }

        // Eski düz biçim: User/Alias metni
        foreach (var a in user.Elements().Where(x => x.Name.LocalName == "Alias" && !x.HasElements))
            Add(a.Value, "e-Fatura", null);

        return rows;
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
IF OBJECT_ID(N'dbo.EFaturaMukellefCheck', N'U') IS NULL
  THROW 50000, N'EFaturaMukellefCheck tablosu yok — Veritabanı Güncelleme ile 20261020_221500_egov_mukellef_slim.sql uygulayın.', 1;");
    }


    private static string NormalizeTax(string? taxNr)
    {
        if (string.IsNullOrWhiteSpace(taxNr)) return "";
        return new string(taxNr.Where(char.IsDigit).ToArray());
    }
}
