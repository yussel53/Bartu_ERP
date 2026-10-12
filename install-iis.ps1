# Bartu ERP -> IIS kalici kurulum
# Site: http://localhost:8090  |  Pool AlwaysRunning + LocalSystem

$ErrorActionPreference = "Stop"
$SiteName = "BartuERP"
$PoolName = "BartuERP"
$Port = 8090
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sitePath = Join-Path $root "iis-site"
$logFile = Join-Path $root "iis-install.log"

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Write-Log([string]$m) {
  $line = "$((Get-Date).ToString('s')) $m"
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding utf8 -ErrorAction SilentlyContinue
}

if (-not (Test-Admin)) {
  Write-Host "Yonetici izni isteniyor (UAC onaylayin)..." -ForegroundColor Yellow
  "$((Get-Date).ToString('s')) elevating..." | Out-File $logFile -Encoding utf8
  $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $p = Start-Process powershell.exe -Verb RunAs -ArgumentList $arg -Wait -PassThru
  if (Test-Path $logFile) { Get-Content $logFile | Write-Host }
  exit $(if ($null -eq $p.ExitCode) { 1 } else { $p.ExitCode })
}

"$((Get-Date).ToString('s')) Admin session started" | Out-File $logFile -Encoding utf8

try {
  Import-Module WebAdministration -ErrorAction Stop
  Write-Log "WebAdministration OK"

  function Test-Ancm {
    return (Test-Path "$env:windir\system32\inetsrv\aspnetcorev2.dll") -or
           (Test-Path "C:\Program Files\IIS\AspNetCoreModuleV2")
  }

  if (-not (Test-Ancm)) {
    Write-Log "ANCM yok - Hosting Bundle indiriliyor"
    $installer = Join-Path $env:TEMP "dotnet-hosting-windows.exe"
    $urls = @(
      "https://aka.ms/dotnet/10.0/windowshosting",
      "https://aka.ms/dotnet/8.0/windowshosting"
    )
    $installed = $false
    foreach ($url in $urls) {
      try {
        Write-Log "Indir: $url"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing -TimeoutSec 600
        $len = (Get-Item $installer).Length
        Write-Log "Dosya boyutu: $len"
        if ($len -lt 1MB) { throw "cok kucuk" }
        $proc = Start-Process -FilePath $installer -ArgumentList "/install","/quiet","/norestart" -Wait -PassThru
        Write-Log "Kurulum exit=$($proc.ExitCode)"
        $installed = $true
        break
      } catch {
        Write-Log "Deneme hata: $($_.Exception.Message)"
      }
    }
    if (-not $installed) { throw "Hosting Bundle kurulamadi" }
    Write-Log "iisreset"
    & iisreset | Out-Null
    Start-Sleep 4
    if (-not (Test-Ancm)) { throw "ANCM hala yok - bilgisayari yeniden baslatin" }
  } else {
    Write-Log "ANCM mevcut"
  }

  if (-not (Test-Path (Join-Path $sitePath "BackendAPI.dll"))) {
    Write-Log "publish-iis.ps1 calisiyor"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "publish-iis.ps1")
    if ($LASTEXITCODE -ne 0) { throw "publish basarisiz" }
  }
  if (-not (Test-Path (Join-Path $sitePath "BackendAPI.dll"))) {
    throw "iis-site\BackendAPI.dll yok"
  }
  if (-not (Test-Path (Join-Path $sitePath "web.config"))) {
    Copy-Item (Join-Path $root "iis\web.config") (Join-Path $sitePath "web.config") -Force
  }

  New-Item -ItemType Directory -Force -Path (Join-Path $sitePath "logs") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $sitePath "App_Data") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $sitePath "Data") | Out-Null
  icacls $sitePath /grant "IIS_IUSRS:(OI)(CI)M" /T /Q | Out-Null
  icacls $sitePath /grant "NETWORK SERVICE:(OI)(CI)M" /T /Q | Out-Null
  Write-Log "Izinler OK"

  if (-not (Test-Path "IIS:\AppPools\$PoolName")) {
    New-WebAppPool -Name $PoolName | Out-Null
    Write-Log "Pool olusturuldu"
  }
  Set-ItemProperty "IIS:\AppPools\$PoolName" -Name managedRuntimeVersion -Value ""
  Set-ItemProperty "IIS:\AppPools\$PoolName" -Name startMode -Value "AlwaysRunning"
  Set-ItemProperty "IIS:\AppPools\$PoolName" -Name processModel.idleTimeout -Value ([TimeSpan]::FromMinutes(0))
  Set-ItemProperty "IIS:\AppPools\$PoolName" -Name processModel.identityType -Value "LocalSystem"
  Set-ItemProperty "IIS:\AppPools\$PoolName" -Name recycling.periodicRestart.time -Value ([TimeSpan]::FromDays(29))
  Write-Log "Pool ayarlari OK"

  $existing = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
  if ($existing) {
    # Binding port guncelle
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $sitePath
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $PoolName
    try {
      $bind = Get-WebBinding -Name $SiteName -Protocol http -ErrorAction SilentlyContinue
      if ($bind) {
        $bind | Remove-WebBinding -ErrorAction SilentlyContinue
      }
      New-WebBinding -Name $SiteName -Protocol http -Port $Port -IPAddress "*" | Out-Null
    } catch {
      Write-Log "Binding uyarisi: $($_.Exception.Message)"
    }
    Write-Log "Site guncellendi"
  } else {
    New-Website -Name $SiteName -Port $Port -PhysicalPath $sitePath -ApplicationPool $PoolName | Out-Null
    Write-Log "Site olusturuldu"
  }

  try {
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationDefaults.preloadEnabled -Value $true
  } catch { }

  $rule = "BartuERP IIS $Port"
  Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
  Write-Log "Firewall OK"

  Set-Service W3SVC -StartupType Automatic -ErrorAction SilentlyContinue
  Start-Service W3SVC -ErrorAction SilentlyContinue
  Restart-WebAppPool -Name $PoolName
  Start-Website -Name $SiteName -ErrorAction SilentlyContinue
  Write-Log "Site baslatildi"

  Start-Sleep 8
  $url = "http://localhost:$Port"
  $ok = $false
  foreach ($i in 1..20) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400 -and $r.RawContentLength -gt 200) {
        $ok = $true
        Write-Log "HTTP $($r.StatusCode) len=$($r.RawContentLength)"
        break
      }
      Write-Log "HTTP $($r.StatusCode) len=$($r.RawContentLength) (bekleniyor)"
    } catch {
      Write-Log "Deneme $i : $($_.Exception.Message)"
    }
    Start-Sleep 3
  }

  if ($ok) {
    try {
      $api = Invoke-RestMethod -Uri "$url/api/db-updates" -TimeoutSec 30
      Write-Log "API OK total=$($api.total) pending=$($api.pendingCount)"
    } catch {
      Write-Log "API hata: $($_.Exception.Message)"
      $stdout = Get-ChildItem (Join-Path $sitePath "logs") -Filter "stdout*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($stdout) {
        Write-Log "stdout log: $($stdout.FullName)"
        Get-Content $stdout.FullName -Tail 30 | ForEach-Object { Write-Log "  $_" }
      }
    }
  }

  try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $lnkPath = Join-Path $desktop "Bartu ERP.lnk"
    $w = New-Object -ComObject WScript.Shell
    $lnk = $w.CreateShortcut($lnkPath)
    $lnk.TargetPath = $url
    $lnk.Description = "Bartu ERP (IIS)"
    $lnk.Save()
    Write-Log "Kisayol: $lnkPath"
  } catch { }

  Write-Log "DONE ok=$ok url=$url"
  if ($ok) { exit 0 } else { exit 2 }
}
catch {
  Write-Log "FATAL: $($_.Exception.Message)"
  Write-Log $_.ScriptStackTrace
  exit 1
}
