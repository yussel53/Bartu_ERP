@echo off
rem Cift tikla: yonetici izni ister, staging API'yi canliya (8090) alir
net session >nul 2>&1
if errorlevel 1 (
  echo Yonetici izni isteniyor - acilan pencerede EVET deyin...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-staging-swap.ps1"
echo.
echo Bitti. Kapatmak icin bir tusa basin.
pause >nul
