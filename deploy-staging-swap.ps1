# Yonetici PowerShell: servisi durdur, staging API'yi iis-site'a al, yeniden baslat
# Kullanim: sag tik > Yonetici olarak calistir  VEYA
#   Start-Process powershell -Verb RunAs -ArgumentList '-File',"$PWD\deploy-staging-swap.ps1"

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$staging = Join-Path $root "iis-site-staging"
$site = Join-Path $root "iis-site"
$ServiceName = "BartuERP"
Start-Transcript -Path (Join-Path $root "deploy-swap.log") -Force | Out-Null
trap { Write-Host "HATA: $_" -ForegroundColor Red; Stop-Transcript | Out-Null; break }

if (-not (Test-Path $staging)) { throw "iis-site-staging yok - once publish edin" }

Write-Host "Durduruluyor: $ServiceName" -ForegroundColor Cyan
Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Get-Process | Where-Object { $_.Path -like "*iis-site*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

Write-Host "API dosyalari kopyalaniyor..." -ForegroundColor Cyan
Get-ChildItem $staging -File | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $site $_.Name) -Force
}
foreach ($dir in @("Data", "SqlUpdates", "runtimes")) {
  $src = Join-Path $staging $dir
  $dst = Join-Path $site $dir
  if (Test-Path $src) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item (Join-Path $src "*") $dst -Recurse -Force
  }
}

Write-Host "Baslatiliyor: $ServiceName" -ForegroundColor Cyan
Start-Service $ServiceName
Start-Sleep 2
Get-Service $ServiceName | Format-List Name, Status
Write-Host "Tamam. http://localhost:8090" -ForegroundColor Green
Write-Host "API dll: $((Get-Item (Join-Path $site "BackendAPI.dll")).LastWriteTime)" -ForegroundColor Yellow
Stop-Transcript | Out-Null
