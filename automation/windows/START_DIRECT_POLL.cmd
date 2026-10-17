@echo off
setlocal
chcp 65001 >nul
set "CFG=%APPDATA%\ACPro\facebook-direct.json"
if not exist "%APPDATA%\ACPro" mkdir "%APPDATA%\ACPro"
if not exist "%CFG%" (
  copy /Y "%~dp0facebook-direct.example.json" "%CFG%" >nul
  echo First run: private config created at:
  echo %CFG%
  echo Replace placeholder with a NEW non-leaked Facebook Page token.
  echo Keep mode dry_run for the first test.
  start "" notepad.exe "%CFG%"
  pause
  exit /b 0
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACPRO_DIRECT_POLL.ps1"
pause
