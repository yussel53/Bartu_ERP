namespace BartuERP.Backend.Services;

/// <summary>
/// Gelen e-belgeleri otomatik çekme görevi (yol haritası E-02). Her dakika, sunucudaki her Bartu veritabanında
/// zamanı gelmiş firmaları (EGovAutoFetchSetting.NextRunAt) e-Logo'dan çeker — asıl iş EGovAutoFetchService'te.
/// Veritabanı yapılandırılmamışsa / tablolar yoksa bekler; bir firmanın hatası diğerlerini ve servisi durdurmaz.
/// </summary>
public sealed class EGovAutoFetchJob : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly DbConnectionStore _store;
    private readonly ILogger<EGovAutoFetchJob> _log;

    public EGovAutoFetchJob(IServiceScopeFactory scopes, DbConnectionStore store, ILogger<EGovAutoFetchJob> log)
    {
        _scopes = scopes;
        _store = store;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Servis açılırken diğer başlangıç işleri (şema güncellemeleri) bitsin
        try { await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var dbs = _store.GetSettings().HasMinimumInfo()
                    ? _scopes.CreateScope().ServiceProvider.GetRequiredService<TenantDbRegistry>().List()
                    : Array.Empty<string>();
                foreach (var name in dbs)
                {
                    try
                    {
                        using var scope = _scopes.CreateScope();
                        scope.ServiceProvider.GetRequiredService<CurrentDatabase>().Name = name;
                        await scope.ServiceProvider.GetRequiredService<EGovAutoFetchService>().RunDueAsync(stoppingToken);
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                    {
                        _log.LogWarning(ex, "Otomatik e-belge çekme görevi hatası: {Db}", name);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _log.LogWarning(ex, "Otomatik e-belge çekme görevi hatası");
            }

            try { await Task.Delay(Tick, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
