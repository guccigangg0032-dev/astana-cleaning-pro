@echo off
setlocal
cd /d "%~dp0"
title ACPro Threads
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACPRO_THREADS_DAILY.ps1"
echo.
echo Press any key to close.
pause >nul
endlocal
