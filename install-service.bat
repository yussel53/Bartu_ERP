@echo off
cd /d "%~dp0"
echo Bartu ERP Windows Service kurulumu
echo UAC penceresinde Evet'e basin.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"
echo.
echo Cikis: %ERRORLEVEL%
echo Log: %~dp0iis-install.log
pause
