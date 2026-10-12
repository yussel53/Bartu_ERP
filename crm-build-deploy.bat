@echo off
cd /d "%~dp0"
echo KaviSoft - Teklif Yonetimi derle + yayinla
echo (servis guncellenirken UAC penceresinde Evet'e basin)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0crm-build-deploy.ps1"
echo.
echo Log: %~dp0_claude_build\build.log
pause
