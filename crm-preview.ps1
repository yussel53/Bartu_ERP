# KaviSoft - Teklif Yonetimi ONIZLEME (yonetici gerekmez)
# Derler ve yeni surumu ayri bir surec olarak http://localhost:8091 uzerinde calistirir.
# Asil servis (8090) degismez. Log: _claude_build\build.log
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cb = Join-Path $root "_claude_build"
$log = Join-Path $cb "build.log"
$out = Join-Path $cb "preview"
New-Item -ItemType Directory -Force -Path $cb | Out-Null
"=== $(Get-Date -Format s) ONIZLEME build ===" | Out-File $log -Encoding utf8
function L($m) { $line = "$(Get-Date -Format HH:mm:ss) $m"; Write-Host $line; $line | Out-File $log -Append -Encoding utf8 }
try {
  Get-Process BackendAPI -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*_claude_build*" } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep 1

  L "== Frontend build =="
  Push-Location (Join-Path $root "FrontendUI")
  $node = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe"
  if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
  if (-not $node) { throw "node bulunamadi" }
  $ErrorActionPreference = "Continue"
  & $node .\node_modules\vite\bin\vite.js build 2>&1 | ForEach-Object { L "  $_" }
  $code = $LASTEXITCODE; $ErrorActionPreference = "Stop"
  if ($code -ne 0) { throw "Frontend build basarisiz ($code)" }
  Pop-Location

  L "== dotnet publish =="
  $ErrorActionPreference = "Continue"
  dotnet publish (Join-Path $root "BackendAPI") -c Release -o $out --nologo 2>&1 | ForEach-Object { L "  $_" }
  $code = $LASTEXITCODE; $ErrorActionPreference = "Stop"
  if ($code -ne 0) { throw "dotnet publish basarisiz ($code)" }

  New-Item -ItemType Directory -Force -Path (Join-Path $out "wwwroot"), (Join-Path $out "Data") | Out-Null
  Copy-Item (Join-Path $root "FrontendUI\dist\*") (Join-Path $out "wwwroot") -Recurse -Force
  Copy-Item (Join-Path $root "iis-site\Data\*") (Join-Path $out "Data") -Recurse -Force
  L "preview klasoru hazir: $out"

  L "== 8091 baslatiliyor =="
  $env:ASPNETCORE_ENVIRONMENT = "Production"
  $exe = Join-Path $out "BackendAPI.exe"
  $argList = @("--urls", "http://localhost:8091", "--contentRoot", "`"$out`"", "--SqlUpdates:Path=`"$(Join-Path $root 'SqlUpdates')`"")
  Start-Process -FilePath $exe -ArgumentList $argList -WorkingDirectory $out -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $cb "preview.out.log") -RedirectStandardError (Join-Path $cb "preview.err.log")
  $ok = $false
  for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
    try { Invoke-RestMethod "http://localhost:8091/api/db-settings/status" -TimeoutSec 3 | Out-Null; $ok = $true } catch { Start-Sleep 1 }
  }
  if (-not $ok) { throw "8091 ayaga kalkmadi (preview.err.log)" }

  L "== SQL 70 =="
  try {
    foreach ($sql in @("70_crm_offer_management.sql","71_crm_mail_profiles.sql")) { $r = Invoke-RestMethod -Method Post "http://localhost:8091/api/db-updates/$sql/apply?appliedBy=crm-preview" -TimeoutSec 120; L ("apply $sql : " + ($r | ConvertTo-Json -Depth 4 -Compress)) }
  } catch { L ("apply SQL HATA: " + $_.Exception.Message + " " + $_.ErrorDetails.Message) }
  $ping = Invoke-RestMethod "http://localhost:8091/api/mailler/ping" -TimeoutSec 10
  L ("ping: " + ($ping | ConvertTo-Json -Compress))
  L "=== TAMAM === http://localhost:8091/#/crm"
}
catch {
  L "HATA: $($_.Exception.Message)"
  exit 1
}
