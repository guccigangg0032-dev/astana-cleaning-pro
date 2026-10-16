@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ===========================================
echo ACPro - local Qwen 3.5 price test (no Meta)
echo ===========================================
echo Checking Qwen and calculator with a test question...
echo.
where py >nul 2>nul
if not errorlevel 1 (
    py -3 qwen_quote.py --text "Сколько стоит генеральная уборка 50 м2 и диван?"
    goto done
)
where python >nul 2>nul
if not errorlevel 1 (
    python qwen_quote.py --text "Сколько стоит генеральная уборка 50 м2 и диван?"
    goto done
)
echo Python 3 is not available. No software was installed.
echo Please check whether Python is installed on your Windows computer.
:done
echo.
echo This test did not send anything to Instagram or Threads.
echo Press any key to close.
pause >nul
endlocal
