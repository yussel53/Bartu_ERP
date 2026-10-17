namespace BartuERP.Backend.Services;

/// <summary>
/// Günlük TCMB kur indirme görevi. Her 30 dakikada bir:
/// hafta içi 15:45'ten sonra o günün bültenini, öncesinde son yayımlanan bülteni kontrol eder;
/// otomatik dövizlerin (AutoRate=1) kuru eksikse indirir. Veritabanı yapılandırılmamışsa / tablolar yoksa bekler.
/// </summary>
public sealed class CurrencyRateJob : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan PublishAfter = new(15, 45, 0);

    private readonly IServiceScopeFactory _scopes;
    private readonly DbConnectionStore _store;
    private readonly ILogger<CurrencyRateJob> _log;

    public CurrencyRateJob(IServiceScopeFactory scopes, DbConnectionStore store, ILogger<CurrencyRateJob> log)
    {
        _scopes = scopes;
        _store = store;
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

    /// <summary>Şu an itibarıyla yayımlanmış olması gereken en son bülten günü</summary>
    public static DateTime ExpectedBulletinDate(DateTime nowTr)
    {
        var d = nowTr.Date;
        if (nowTr.TimeOfDay < PublishAfter) d = d.AddDays(-1);
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(-1);
        return d;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Servis açılırken diğer başlangıç işleri bitsin
        try { await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_store.GetSettings().HasMinimumInfo())
                {
                    using var scope = _scopes.CreateScope();
                    var svc = scope.ServiceProvider.GetRequiredService<TcmbRateService>();
                    if (await svc.ReadyAsync() && (await svc.AutoCurrenciesAsync()).Count > 0)
                    {
                        var expected = ExpectedBulletinDate(TurkeyNow());
                        if (!await svc.HasRatesForAsync(expected))
                        {
                            // today.xml: son yayımlanan bülten (tatilde önceki iş günü) — zaten kayıtlıysa sessizce geçer
                            var r = await svc.DownloadAsync(null, "Otomatik", skipIfPresent: true, ct: stoppingToken);
                            if (r.RateCount > 0)
                                _log.LogInformation("TCMB kurları indirildi: {Msg}", r.Message);
                        }
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _log.LogWarning(ex, "Otomatik kur görevi hatası");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
