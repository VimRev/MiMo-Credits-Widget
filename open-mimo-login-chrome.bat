@echo off
setlocal

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_CDP_PORT=9224"
set "CHROME_PROFILE=%LOCALAPPDATA%\MiMo-Credits-Chrome"

if not exist "%CHROME%" (
    echo [ERROR] Chrome not found:
    echo   %CHROME%
    pause
    exit /b 1
)

if not exist "%CHROME_PROFILE%" mkdir "%CHROME_PROFILE%" >nul 2>&1

start "" "%CHROME%" --remote-debugging-port=%CHROME_CDP_PORT% --remote-allow-origins=* --user-data-dir="%CHROME_PROFILE%" --no-first-run --new-window "https://platform.xiaomimimo.com"

echo MiMo login Chrome opened.
echo.
echo Login in this Chrome window, then run start-mimo-widget.bat again.
echo.
pause
