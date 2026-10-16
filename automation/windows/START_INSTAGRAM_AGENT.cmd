@echo off
setlocal
cd /d "%~dp0"
title ACPro Instagram AI Manager
echo ACPro Instagram manager - starting local Qwen...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACPRO_INSTAGRAM_AGENT.ps1"
echo.
echo The agent has stopped. Press any key to close.
pause >nul
endlocal
