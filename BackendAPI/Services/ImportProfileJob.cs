namespace BartuERP.Backend.Services;

/// <summary>Kayıtlı SQL / API aktarımlarını, süreçteki aralık dolunca çalıştırır.</summary>
public sealed class ImportProfileJob : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly DbConnectionStore _store;
    private readonly ILogger<ImportProfileJob> _log;

    public ImportProfileJob(IServiceScopeFactory scopes, DbConnectionStore store, ILogger<ImportProfileJob> log)
    {
        _scopes = scopes;
        _store = store;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(90), stoppingToken); }
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
                        var n = await scope.ServiceProvider.GetRequiredService<ImportProfileService>().RunDueAsync(stoppingToken);
                        if (n > 0) _log.LogInformation("Zamanlanmış aktarım: {Db} — {Count} profil", name, n);
                    }
                    catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                    {
                        _log.LogWarning(ex, "Zamanlanmış aktarım hatası: {Db}", name);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _log.LogWarning(ex, "Zamanlanmış aktarım hatası");
            }
            try { await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
