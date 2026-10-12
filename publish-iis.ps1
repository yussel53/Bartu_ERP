# Bartu ERP — IIS yayin klasoru hazirla (yonetici gerekmez)
# Cikti: .\iis-site  (Frontend wwwroot + API + SqlUpdates + web.config)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$api = Join-Path $root "BackendAPI"
$ui = Join-Path $root "FrontendUI"
$out = Join-Path $root "iis-site"
$www = Join-Path $out "wwwroot"

Write-Host "== Frontend build ==" -ForegroundColor Cyan
Push-Location $ui
$node = "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe"
if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { throw "node bulunamadi" }
& $node .\node_modules\vite\bin\vite.js build
if ($LASTEXITCODE -ne 0) { throw "Frontend build basarisiz" }
Pop-Location

Write-Host "== API publish ==" -ForegroundColor Cyan
if (Test-Path $out) {
  $bak = "$out.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  try {
    Rename-Item $out $bak -ErrorAction Stop
    Write-Host "Eski site yedek: $bak"
  } catch {
    Write-Host "Uyari: eski iis-site kilitli, uzerine yaziliyor..." -ForegroundColor Yellow
  }
}
New-Item -ItemType Directory -Force -Path $out | Out-Null
dotnet publish $api -c Release -o $out --nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet publish basarisiz" }

Write-Host "== wwwroot ==" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $www | Out-Null
Copy-Item -Path (Join-Path $ui "dist\*") -Destination $www -Recurse -Force

Write-Host "== Data / SqlUpdates / Create_DB / web.config ==" -ForegroundColor Cyan
$dataSrc = Join-Path $api "Data"
$dataDst = Join-Path $out "Data"
if (Test-Path $dataSrc) {
  New-Item -ItemType Directory -Force -Path $dataDst | Out-Null
  Copy-Item (Join-Path $dataSrc "*") $dataDst -Force -Recurse
}

$sqlSrc = Join-Path $root "SqlUpdates"
$sqlDst = Join-Path $out "SqlUpdates"
if (Test-Path $sqlSrc) {
  New-Item -ItemType Directory -Force -Path $sqlDst | Out-Null
  Copy-Item (Join-Path $sqlSrc "*.sql") $sqlDst -Force
}

foreach ($f in @("Create_DB.sql", "SYS_Tables_And_UDF.sql")) {
  $p = Join-Path $root $f
  if (Test-Path $p) { Copy-Item $p $out -Force }
}

Copy-Item (Join-Path $root "iis\web.config") (Join-Path $out "web.config") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $out "logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $out "App_Data") | Out-Null

$prod = Join-Path $api "appsettings.Production.json"
if (Test-Path $prod) { Copy-Item $prod $out -Force }

Write-Host ""
Write-Host "Hazir: $out" -ForegroundColor Green
Write-Host "Sonraki adim (Yonetici PowerShell):"
Write-Host "  .\install-iis.ps1"
