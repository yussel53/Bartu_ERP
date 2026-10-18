using System.Diagnostics;
using System.Reflection;
using System.Text;
using Microsoft.Extensions.Hosting.WindowsServices;

namespace BartuERP.Backend.Services;

public sealed class AppVersionInfo
{
    public string Version { get; set; } = "";
    public string? Commit { get; set; }
    public DateTime? BuildTime { get; set; }
}

public sealed class AppUpdateStatus
{
    public AppVersionInfo Current { get; set; } = new();
    public AppVersionInfo? Staging { get; set; }
    public bool UpdateAvailable { get; set; }
    public bool CanApply { get; set; }
    public string? Message { get; set; }
    public string StagingPath { get; set; } = "";
    public string? LastLog { get; set; }
}

/// <summary>
/// Uygulama içinden güncelleme (yönetici hakkı gerekmez): yeni sürüm iis-site-staging'e yayımlanır
/// (dotnet publish), yönetici «Yeni sürümü yükle» der → servis hesabıyla (LocalSystem) çalışan ayrı bir
/// PowerShell süreci servisi durdurur, dosyaları kopyalar (önceki sürüm Data/update/backup'a), servisi başlatır;
/// başlatılamazsa önceki sürüme döner. deploy-staging-swap.ps1 yedek yol olarak kalır.
/// Yapılandırma: Update:StagingPath (varsayılan ../iis-site-staging), Update:ServiceName (BartuERP).
/// </summary>
public sealed class AppUpdateService
{
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _cfg;
    private readonly ILogger<AppUpdateService> _log;

    public AppUpdateService(IWebHostEnvironment env, IConfiguration cfg, ILogger<AppUpdateService> log)
    {
        _env = env;
        _cfg = cfg;
        _log = log;
    }

    private string Target => _env.ContentRootPath;

    private string StagingPath =>
        Path.GetFullPath(Path.Combine(Target, _cfg["Update:StagingPath"] is { Length: > 0 } p ? p : "../iis-site-staging"));

    private string ServiceName => _cfg["Update:ServiceName"] is { Length: > 0 } n ? n : "BartuERP";

    private string WorkDir => Path.Combine(Target, "Data", "update");

    /// <summary>Çalışan sürüm (InformationalVersion "1.0.0+abc1234" → commit)</summary>
    public static AppVersionInfo CurrentVersion()
    {
        var asm = Assembly.GetEntryAssembly() ?? typeof(AppUpdateService).Assembly;
        return Read(asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion,
            File.Exists(asm.Location) ? File.GetLastWriteTime(asm.Location) : null);
    }

    private static AppVersionInfo Read(string? informational, DateTime? buildTime)
    {
        var v = informational ?? "";
        var plus = v.IndexOf('+');
        return new AppVersionInfo
        {
            Version = plus > 0 ? v[..plus] : v,
            Commit = plus > 0 ? v[(plus + 1)..] is var c && c.Length > 7 ? c[..7] : v[(plus + 1)..] : null,
            BuildTime = buildTime,
        };
    }

    private AppVersionInfo? StagingVersion()
    {
        var dll = Path.Combine(StagingPath, "BackendAPI.dll");
        if (!File.Exists(dll)) return null;
        string? info = null;
        try
        {
            info = FileVersionInfo.GetVersionInfo(dll).ProductVersion;
        }
        catch
        {
            // sürüm okunamazsa yalnız tarih
        }
        return Read(info, File.GetLastWriteTime(dll));
    }

    public AppUpdateStatus Status()
    {
        var s = new AppUpdateStatus { Current = CurrentVersion(), Staging = StagingVersion(), StagingPath = StagingPath };
        var curDll = Path.Combine(Target, "BackendAPI.dll");
        var curTime = File.Exists(curDll) ? File.GetLastWriteTime(curDll) : s.Current.BuildTime;
        s.UpdateAvailable = s.Staging?.BuildTime is DateTime st && (curTime == null || st > curTime.Value.AddSeconds(5));
        s.CanApply = WindowsServiceHelpers.IsWindowsService() && OperatingSystem.IsWindows();
        s.Message = s.Staging == null
            ? "Yayımlanmış yeni sürüm yok (iis-site-staging boş)."
            : !s.UpdateAvailable
                ? "Çalışan sürüm güncel."
                : s.CanApply
                    ? $"Yeni sürüm hazır ({s.Staging.BuildTime:dd.MM.yyyy HH:mm})."
                    : "Yeni sürüm var ama uygulama Windows servisi olarak çalışmıyor — elle güncelleyin.";
        var log = Path.Combine(WorkDir, "update.log");
        if (File.Exists(log))
        {
            try
            {
                var lines = File.ReadAllLines(log);
                s.LastLog = string.Join('\n', lines.Skip(Math.Max(0, lines.Length - 15)));
            }
            catch
            {
                // log kilitli olabilir
            }
        }
        return s;
    }

    /// <summary>Güncellemeyi başlatır; servis birkaç saniye içinde yeniden başlar</summary>
    public (bool Ok, string Message) Apply(string? requestedBy)
    {
        var st = Status();
        if (!st.UpdateAvailable) return (false, st.Message ?? "Güncelleme yok.");
        if (!st.CanApply) return (false, st.Message ?? "Servis olarak çalışmıyor.");

        Directory.CreateDirectory(WorkDir);
        var script = Path.Combine(WorkDir, "apply-update.ps1");
        File.WriteAllText(script, BuildScript(StagingPath, Target, ServiceName, WorkDir), new UTF8Encoding(true));

        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{script}\"",
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = WorkDir,
        };
        Process.Start(psi);
        _log.LogWarning("Uygulama güncellemesi başlatıldı ({By}): {Staging} → {Target}", requestedBy, StagingPath, Target);
        return (true, "Güncelleme başladı — servis yeniden başlatılıyor, sayfa birazdan kendini yenileyecek.");
    }

    private static string Q(string s) => "'" + s.Replace("'", "''") + "'";

    /// <summary>
    /// Servis durdur → mevcut dosyaları yedekle → staging'i kopyala (Data/dbsettings.json ve jwt.key korunur)
    /// → servis başlat; başlamazsa yedekten geri yükle.
    /// </summary>
    private static string BuildScript(string staging, string target, string service, string work) => $$"""
        $ErrorActionPreference = 'Stop'
        $staging = {{Q(staging)}}
        $target = {{Q(target)}}
        $service = {{Q(service)}}
        $work = {{Q(work)}}
        $backup = Join-Path $work 'backup'
        Start-Transcript -Path (Join-Path $work 'update.log') -Force | Out-Null
        function Copy-App($from, $to) {
          Get-ChildItem $from -File | ForEach-Object { Copy-Item $_.FullName (Join-Path $to $_.Name) -Force }
          foreach ($d in @('runtimes', 'SqlUpdates')) {
            $src = Join-Path $from $d
            if (Test-Path $src) {
              New-Item -ItemType Directory -Force -Path (Join-Path $to $d) | Out-Null
              Copy-Item (Join-Path $src '*') (Join-Path $to $d) -Recurse -Force
            }
          }
        }
        try {
          Start-Sleep -Seconds 2
          Write-Host "Durduruluyor: $service"
          Stop-Service $service -Force
          $p = Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($target, [StringComparison]::OrdinalIgnoreCase) -and $_.ProcessName -eq 'BackendAPI' }
          if ($p) { $p | Stop-Process -Force; Start-Sleep -Seconds 1 }

          Write-Host 'Yedekleniyor (onceki surum)'
          if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
          New-Item -ItemType Directory -Force -Path $backup | Out-Null
          Copy-App $target $backup

          Write-Host 'Kopyalaniyor'
          Copy-App $staging $target

          Write-Host "Baslatiliyor: $service"
          Start-Service $service
          Start-Sleep -Seconds 5
          if ((Get-Service $service).Status -ne 'Running') { throw 'Servis yeni surumle baslamadi' }
          Write-Host "Tamam: $((Get-Item (Join-Path $target 'BackendAPI.dll')).LastWriteTime)"
        }
        catch {
          Write-Host "HATA: $_"
          try {
            Stop-Service $service -Force -ErrorAction SilentlyContinue
            Copy-App $backup $target
            Start-Service $service
            Write-Host 'Onceki surume geri donuldu'
          } catch { Write-Host "Geri donus HATA: $_" }
        }
        finally { Stop-Transcript | Out-Null }
        """;
}

/// <summary>
/// Otomatik güncelleme: Data/update/auto-apply dosyası varsa (ya da Update:AutoApply = true) staging'deki
/// yeni sürüm, yayım bittikten (dosyalar 90 sn değişmeden) sonra kendiliğinden yüklenir. Aynı sürüm bir kez
/// denenir (başarısız olup geri dönerse tekrar denenmez). İşaret dosyası korunur (Data kopyalanmaz).
/// </summary>
public sealed class AppAutoUpdateJob : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan Settle = TimeSpan.FromSeconds(90);

    private readonly AppUpdateService _update;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _cfg;
    private readonly ILogger<AppAutoUpdateJob> _log;

    public AppAutoUpdateJob(AppUpdateService update, IWebHostEnvironment env, IConfiguration cfg, ILogger<AppAutoUpdateJob> log)
    {
        _update = update;
        _env = env;
        _cfg = cfg;
        _log = log;
    }

    private string WorkDir => Path.Combine(_env.ContentRootPath, "Data", "update");

    private bool Enabled => _cfg.GetValue("Update:AutoApply", false) || File.Exists(Path.Combine(WorkDir, "auto-apply"));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
        catch (TaskCanceledException)
        {
            return;
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                TryApply();
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Otomatik güncelleme kontrolü başarısız");
            }
            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                return;
            }
        }
    }

    private void TryApply()
    {
        if (!Enabled) return;
        var st = _update.Status();
        if (!st.UpdateAvailable || !st.CanApply || st.Staging?.BuildTime is not DateTime build) return;

        // Yayım sürüyorsa bekle: staging'deki en yeni dosya Settle süresinden eski olmalı
        var newest = new DirectoryInfo(st.StagingPath).EnumerateFiles("*", SearchOption.AllDirectories)
            .Select(f => f.LastWriteTime).DefaultIfEmpty(DateTime.MinValue).Max();
        if (DateTime.Now - newest < Settle) return;

        Directory.CreateDirectory(WorkDir);
        var marker = Path.Combine(WorkDir, "last-auto-attempt.txt");
        var stamp = build.ToString("O");
        if (File.Exists(marker) && File.ReadAllText(marker).Trim() == stamp) return; // bu sürüm zaten denendi
        File.WriteAllText(marker, stamp);

        var (ok, message) = _update.Apply("otomatik");
        _log.LogWarning("Otomatik güncelleme: {Ok} {Message}", ok, message);
    }
}
