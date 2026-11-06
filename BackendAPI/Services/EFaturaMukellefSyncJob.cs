using System.Data;
using Dapper;

namespace BartuERP.Backend.Services;

/// <summary>
/// GİB e-Fatura mükellef listesi gece senkronu (yol haritası E-06). Her 15 dakikada bakar; Türkiye saatiyle
/// GibEFatura:NightlySyncHour'dan sonraki 4 saat içindeyse ve o gün bu veritabanında senkron denenmediyse tam listeyi alır
/// (GibEFaturaUserListService.SyncFullAsync — GİB adresi kapalıysa e-Logo getUserListNew).
/// İndirilen zip 20 saat önbellekte tutulur: aynı gece birden çok veritabanı tek indirmeyi paylaşır.
/// Kapatmak için appsettings: GibEFatura:NightlySyncEnabled = false.
/// </summary>
public sealed class EFaturaMukellefSyncJob : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopes;
    private readonly DbConnectionStore _store;
    private readonly GibEFaturaUserListService _gib;
    private readonly ILogger<EFaturaMukellefSyncJob> _log;

    public EFaturaMukellefSyncJob(
        IServiceScopeFactory scopes, DbConnectionStore store, GibEFaturaUserListService gib, ILogger<EFaturaMukellefSyncJob> log)
    {
        _scopes = scopes;
        _store = store;
        _gib = gib;
        _log = log;
    }

    private static DateTime TurkeyNow()
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        catch
        {
            return DateTime.UtcNow.AddHours(3);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var opt = _gib.Options;
                var now = TurkeyNow();
                if (opt.NightlySyncEnabled && InWindow(now, opt.NightlySyncHour) && _store.GetSettings().HasMinimumInfo())
                {
                    var dbs = _scopes.CreateScope().ServiceProvider.GetRequiredService<TenantDbRegistry>().List();
                    var ran = false;
                    foreach (var name in dbs)
                    {
                        if (stoppingToken.IsCancellationRequested) break;
                        try
                        {
                            using var scope = _scopes.CreateScope();
                            scope.ServiceProvider.GetRequiredService<CurrentDatabase>().Name = name;
                            var db = scope.ServiceProvider.GetRequiredService<IDbConnection>();
                            if (!await DueAsync(db, now, opt.NightlySyncHour, stoppingToken)) continue;
                            var elogo = await scope.ServiceProvider.GetRequiredService<ELogoDocumentSyncService>().FindELogoCompanyAsync(stoppingToken);
                            var r = await _gib.SyncFullAsync(db, stoppingToken, elogo, mode: "Nightly", reuseCacheHours: 20);
                            ran = true;
                            if (r.Success) _log.LogInformation("GİB mükellef gece senkronu ({Db}): {Msg}", name, r.Message);
                            else _log.LogWarning("GİB mükellef gece senkronu başarısız ({Db}): {Msg}", name, r.Message);
                        }
                        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                        {
                            _log.LogWarning(ex, "GİB mükellef gece senkronu hatası: {Db}", name);
                        }
                    }
                    // Tüm veritabanları aynı indirmeyi paylaştı; liste dosyaları diskte kalmaz
                    if (ran) _gib.DeleteCachedZips();
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _log.LogWarning(ex, "GİB mükellef gece senkronu hatası");
            }

            try { await Task.Delay(Tick, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    /// <summary>
    /// Senkron saatinden itibaren 4 saatlik pencere (ör. 03:00–06:59): gündüz açılan sunucu ağır indirmeye
    /// hemen başlamasın; kaçırılan gece için elle «Listeyi GİB'den Güncelle» kullanılır.
    /// </summary>
    private static bool InWindow(DateTime nowTr, int hour)
    {
        var h = Math.Clamp(hour, 0, 23);
        return ((nowTr.Hour - h + 24) % 24) < 4;
    }

    /// <summary>Mükellef tabloları var ve bugün senkron saatinden sonra hiç denenmemiş (başarılı ya da değil)</summary>
    private static async Task<bool> DueAsync(IDbConnection db, DateTime nowTr, int hour, CancellationToken ct)
    {
        if (db.State != ConnectionState.Open) db.Open();
        if (await db.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT CASE WHEN OBJECT_ID(N'dbo.EFaturaMukellef', N'U') IS NULL OR OBJECT_ID(N'dbo.EFaturaMukellefCheck', N'U') IS NULL THEN 0 ELSE 1 END",
                cancellationToken: ct)) == 0)
            return false;
        // Sunucu saati Türkiye saatinden farklı olabilir: eşik, sunucu yerel saatine çevrilir
        var since = DateTime.Now - (nowTr - nowTr.Date.AddHours(Math.Clamp(hour, 0, 23)));
        return await db.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            SELECT CASE WHEN OBJECT_ID(N'dbo.SYS_EFaturaMukellefSync', N'U') IS NULL THEN 1
                        WHEN EXISTS (SELECT 1 FROM dbo.SYS_EFaturaMukellefSync WHERE StartedAt >= @since) THEN 0 ELSE 1 END
            """, new { since }, cancellationToken: ct)) == 1;
    }
}
