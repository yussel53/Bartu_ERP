@echo off
rem Sag tik > Yonetici olarak calistir: staging APIyi canliya (8090) alir
net session >nul 2>&1 || (echo YONETICI DEGIL - sag tik ^> Yonetici olarak calistir & pause & exit /b 1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-staging-swap.ps1"
pause
