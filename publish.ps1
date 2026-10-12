# Bartu ERP — pratik yayın (IIS zorunlu değil)
# Kullanım: .\publish.ps1
# Sonra: cd BackendAPI\publish ; .\BackendAPI.exe --urls http://0.0.0.0:5205

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$api = Join-Path $root "BackendAPI"
$ui = Join-Path $root "FrontendUI"
$out = Join-Path $api "publish"
$www = Join-Path $out "wwwroot"

Write-Host "== Frontend build ==" -ForegroundColor Cyan
Push-Location $ui
$node = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe"
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { throw "node bulunamadı" }
& $node .\node_modules\vite\bin\vite.js build
Pop-Location

Write-Host "== API publish ==" -ForegroundColor Cyan
dotnet publish $api -c Release -o $out

Write-Host "== wwwroot kopyala ==" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $www | Out-Null
Copy-Item -Path (Join-Path $ui "dist\*") -Destination $www -Recurse -Force

# dbsettings taşınsın
$dataSrc = Join-Path $api "Data"
$dataDst = Join-Path $out "Data"
if (Test-Path $dataSrc) {
  New-Item -ItemType Directory -Force -Path $dataDst | Out-Null
  Copy-Item (Join-Path $dataSrc "*") $dataDst -Force
}

Write-Host ""
Write-Host "Hazır: $out" -ForegroundColor Green
Write-Host "Çalıştır:"
Write-Host "  cd `"$out`""
Write-Host "  .\BackendAPI.exe --urls http://0.0.0.0:5205"
Write-Host "Tarayıcı: http://localhost:5205"
Write-Host "Kalici kurulum (Windows Service, onerilen):"
Write-Host "  .\publish-iis.ps1"
Write-Host "  .\install-service.ps1   # http://localhost:8090 - makine acilinca otomatik"
Write-Host "IIS (Hosting Bundle gerekir): .\install-iis.ps1"
