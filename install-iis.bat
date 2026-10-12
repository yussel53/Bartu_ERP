@echo off
cd /d "%~dp0"
echo Bartu ERP IIS kurulumu - UAC penceresinde Evet'e basin.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-iis.ps1"
echo.
echo Cikis kodu: %ERRORLEVEL%
echo Log: %~dp0iis-install.log
pause
