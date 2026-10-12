# KaviSoft / Bartu ERP — Teklif Yonetimi (CRM) derle + yayinla
# 1) Frontend (vite) build  -> iis-site\wwwroot
# 2) Backend dotnet publish -> iis-site-staging
# 3) (Yonetici) servisi durdur, staging -> iis-site, servisi baslat
# 4) SqlUpdates bekleyenleri uygula (70_crm_offer_management.sql)
# Log: _claude_build\build.log

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$log = Join-Path $root "_claude_build\build.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
"=== $(Get-Date -Format s) CRM build basladi ===" | Out-File $log -Encoding utf8
function L($m) { $line = "$(Get-Date -Format HH:mm:ss) $m"; Write-Host $line; $line | Out-File $log -Append -Encoding utf8 }

try {
  # ---------- 1) Frontend
  L "== Frontend build =="
  Push-Location (Join-Path $root "FrontendUI")
  $node = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe"
  if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
  if (-not $node) { throw "node bulunamadi" }
  L "node: $node"
  & $node .\node_modules\vite\bin\vite.js build 2>&1 | ForEach-Object { L "  $_" }
  if ($LASTEXITCODE -ne 0) { throw "Frontend build basarisiz ($LASTEXITCODE)" }
  Pop-Location

  $www = Join-Path $root "iis-site\wwwroot"
  New-Item -ItemType Directory -Force -Path $www | Out-Null
  Copy-Item -Path (Join-Path $root "FrontendUI\dist\*") -Destination $www -Recurse -Force
  L "wwwroot guncellendi: $www"

  # ---------- 2) Backend
  L "== dotnet publish =="
  $staging = Join-Path $root "iis-site-staging"
  dotnet publish (Join-Path $root "BackendAPI") -c Release -o $staging --nologo 2>&1 | ForEach-Object { L "  $_" }
  if ($LASTEXITCODE -ne 0) { throw "dotnet publish basarisiz ($LASTEXITCODE)" }
  New-Item -ItemType Directory -Force -Path (Join-Path $staging "SqlUpdates") | Out-Null
  Copy-Item (Join-Path $root "SqlUpdates\*.sql") (Join-Path $staging "SqlUpdates") -Force
  L "staging hazir: $staging"

  # ---------- 3) Servis swap (yonetici)
  L "== Servis guncelleme (UAC onayi gerekir) =="
  $swap = Join-Path $root "deploy-staging-swap.ps1"
  $p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$swap`""
  L "swap cikis kodu: $($p.ExitCode)"

  # ---------- 4) SQL guncellemeleri
  L "== SqlUpdates uygulaniyor =="
  $ok = $false
  for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
    try { Invoke-RestMethod "http://localhost:8090/api/db-settings/status" -TimeoutSec 5 | Out-Null; $ok = $true } catch { Start-Sleep 2 }
  }
  if (-not $ok) { throw "API 8090 ayaga kalkmadi" }
  foreach ($sql in @("70_crm_offer_management.sql","71_crm_mail_profiles.sql")) { $r = Invoke-RestMethod -Method Post "http://localhost:8090/api/db-updates/$sql/apply?appliedBy=crm-build" -TimeoutSec 120; L ("apply $sql : " + ($r | ConvertTo-Json -Depth 4 -Compress)) }
  $ping = Invoke-RestMethod "http://localhost:8090/api/mailler/ping" -TimeoutSec 10
  L ("mailler/ping: " + ($ping | ConvertTo-Json -Compress))
  L "=== TAMAM ==="
  Write-Host "`nTamam. http://localhost:8090/#/crm" -ForegroundColor Green
}
catch {
  L "HATA: $($_.Exception.Message)"
  Write-Host "`nHATA - log: $log" -ForegroundColor Red
  exit 1
}
