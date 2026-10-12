# Bartu ERP - Windows Service (makine acilinca otomatik, IIS Hosting Bundle gerekmez)
# Adres: http://localhost:8090

$ErrorActionPreference = "Stop"
$ServiceName = "BartuERP"
$DisplayName = "Bartu ERP"
$Port = 8090
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sitePath = Join-Path $root "iis-site"
$exe = Join-Path $sitePath "BackendAPI.exe"
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
  Write-Host "Yonetici izni isteniyor (UAC)..." -ForegroundColor Yellow
  "$((Get-Date).ToString('s')) elevating service install..." | Out-File $logFile -Encoding utf8
  $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $p = Start-Process powershell.exe -Verb RunAs -ArgumentList $arg -Wait -PassThru
  if (Test-Path $logFile) { Get-Content $logFile | Write-Host }
  exit $(if ($null -eq $p.ExitCode) { 1 } else { $p.ExitCode })
}

"$((Get-Date).ToString('s')) Admin service install" | Out-File $logFile -Encoding utf8

try {
  if (-not (Test-Path $exe)) {
    Write-Log "Yayin yok - publish-iis.ps1"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "publish-iis.ps1")
    if ($LASTEXITCODE -ne 0) { throw "publish basarisiz" }
  }
  if (-not (Test-Path $exe)) { throw "Bulunamadi: $exe" }

  # Eski gelistirme sureci 8090'i tutmasin
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      try {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match 'BackendAPI|dotnet') {
          Write-Log "Durduruluyor PID $($proc.Id) $($proc.ProcessName)"
          Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
      } catch {}
    }

  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Log "Servis mevcut - durduruluyor"
    if ($existing.Status -eq 'Running') {
      Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
      Start-Sleep 2
    }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep 2
  }

  $binPath = "`"$exe`" --urls http://0.0.0.0:$Port"
  Write-Log "sc create binPath=$binPath"
  $create = sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= $DisplayName obj= LocalSystem
  Write-Log "sc create: $create"
  sc.exe description $ServiceName "Bartu ERP API + UI (Kestrel). http://localhost:$Port" | Out-Null
  sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null

  # Ortam: Production
  $reg = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName"
  if (Test-Path $reg) {
    # Environment multi-string
    New-ItemProperty -Path $reg -Name Environment -PropertyType MultiString -Value @(
      "ASPNETCORE_ENVIRONMENT=Production",
      "ASPNETCORE_URLS=http://0.0.0.0:$Port"
    ) -Force | Out-Null
  }

  icacls $sitePath /grant "SYSTEM:(OI)(CI)M" /T /Q | Out-Null
  icacls $sitePath /grant "NETWORK SERVICE:(OI)(CI)M" /T /Q | Out-Null

  # LocalSystem -> SQL Trusted Connection (AQUAN / NOTEBOOKX)
  try {
    $dbJson = Get-Content (Join-Path $sitePath "Data\dbsettings.json") -Raw | ConvertFrom-Json
    $srv = $dbJson.server
    $dbn = $dbJson.database
    if ($srv -and $dbn) {
      Write-Log "SQL yetki: $srv / $dbn -> NT AUTHORITY\SYSTEM"
      $grant = @"
IF SUSER_ID(N'NT AUTHORITY\SYSTEM') IS NULL CREATE LOGIN [NT AUTHORITY\SYSTEM] FROM WINDOWS;
USE [$dbn];
IF USER_ID(N'NT AUTHORITY\SYSTEM') IS NULL CREATE USER [NT AUTHORITY\SYSTEM] FOR LOGIN [NT AUTHORITY\SYSTEM];
ALTER ROLE db_owner ADD MEMBER [NT AUTHORITY\SYSTEM];
"@
      sqlcmd -S $srv -d master -E -Q $grant -b | Out-Null
      Write-Log "SQL yetki OK"
    }
  } catch {
    Write-Log "SQL yetki uyarisi: $($_.Exception.Message)"
  }

  Start-Service -Name $ServiceName
  Write-Log "Servis baslatildi"
  Start-Sleep 6

  $url = "http://localhost:$Port"
  $ok = $false
  foreach ($i in 1..20) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 12
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) {
        $ok = $true
        Write-Log "HTTP $($r.StatusCode) len=$($r.RawContentLength)"
        break
      }
    } catch {
      Write-Log "Deneme $i : $($_.Exception.Message)"
      Start-Sleep 3
    }
  }

  if ($ok) {
    try {
      $api = Invoke-RestMethod -Uri "$url/api/db-updates" -TimeoutSec 25
      Write-Log "API OK total=$($api.total) pending=$($api.pendingCount)"
    } catch {
      Write-Log "API: $($_.Exception.Message)"
    }
  }

  try {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $lnkPath = Join-Path $desktop "Bartu ERP.lnk"
    $w = New-Object -ComObject WScript.Shell
    $lnk = $w.CreateShortcut($lnkPath)
    $lnk.TargetPath = $url
    $lnk.Description = "Bartu ERP (Windows Service)"
    $lnk.Save()
    Write-Log "Kisayol: $lnkPath"
  } catch {}

  # Firewall
  $rule = "BartuERP $Port"
  Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null

  Write-Log "DONE ok=$ok url=$url service=$ServiceName"
  Write-Host ""
  Write-Host "Kalici adres: $url" -ForegroundColor Green
  Write-Host "Servis: services.msc -> $DisplayName (Otomatik)"
  Write-Host "Kod guncelle: .\publish-iis.ps1 sonra Restart-Service $ServiceName"
  if ($ok) { exit 0 } else { exit 2 }
}
catch {
  Write-Log "FATAL: $($_.Exception.Message)"
  exit 1
}
