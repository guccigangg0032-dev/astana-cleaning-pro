@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title ACPro Qwen 3.5 Offline Price Test
echo.
echo ACPro - LOCAL QWEN TEST
echo -----------------------
echo This test does not post or reply on Instagram or Threads.
echo.
if not exist "qwen_quote.py" goto missing_files
if not exist "quote.py" goto missing_files
if not exist "pricing_catalog.json" goto missing_files
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 --version >nul 2>nul
if errorlevel 1 goto use_python
py -3 qwen_quote.py --text "Сколько стоит генеральная уборка 50 м2 и диван?"
set "RESULT=%ERRORLEVEL%"
goto result
:use_python
where python >nul 2>nul
if errorlevel 1 goto missing_python
python --version >nul 2>nul
if errorlevel 1 goto missing_python
python qwen_quote.py --text "Сколько стоит генеральная уборка 50 м2 и диван?"
set "RESULT=%ERRORLEVEL%"
goto result
:missing_files
echo ERROR: Required bot files are missing from this folder.
echo Put this CMD file inside the bot folder with qwen_quote.py and quote.py.
goto done
:missing_python
echo ERROR: Python 3 was not detected on this PC.
echo Ollama and Qwen need NOT be installed again.
goto done
:result
if not "%RESULT%"=="0" goto failed
echo.
echo Script finished. Please check the fields:
echo    amount_from: 55000
echo    used_model_extraction: true = Qwen worked
echo    used_model_extraction: false = rule-based fallback only
goto done
:failed
echo ERROR: The calculation script returned status %RESULT%.
:done
echo.
echo No messages were sent to Instagram or Threads.
echo Press any key to close this window.
pause >nul
endlocal
