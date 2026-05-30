@echo off
setlocal
cd /d "%USERPROFILE%"

:: -- Config --
set "WIDGET_DIR=%~dp0widget"
set "SERVICE_PORT=19220"
set "SERVICE_URL=http://127.0.0.1:%SERVICE_PORT%/api/credits"
set "ELECTRON=%WIDGET_DIR%\node_modules\electron\dist\electron.exe"
set "LAUNCHER=%TEMP%\mimo-svc.sh"
set "HEALTH_FILE=%TEMP%\mimo-health.json"
set "SERVICE_LOG=%TEMP%\mimo-service.log"
set "WSL=wsl.exe"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_CDP_PORT=9224"
set "CHROME_CDP_URL=http://127.0.0.1:%CHROME_CDP_PORT%"
set "CHROME_PROFILE=%LOCALAPPDATA%\MiMo-Credits-Chrome"

:: Optional: uncomment and set this if your distro is not the default.
:: set "WSL=wsl.exe -d Ubuntu-22.04"

:: -- Check Electron --
if not exist "%ELECTRON%" (
    echo [ERROR] Electron not found. Run: npm install in widget/
    pause
    exit /b 1
)

if not exist "%CHROME%" (
    echo [ERROR] Chrome not found:
    echo   %CHROME%
    pause
    exit /b 1
)

:: -- Close stale widget instances from this project --
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$widget='%WIDGET_DIR:\=\\%'; try { Get-CimInstance Win32_Process -Filter \"name='electron.exe' or name='node.exe'\" | Where-Object { $_.CommandLine -like ('*' + $widget + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force } } catch { Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '%ELECTRON%' } | Stop-Process -Force }" >nul 2>&1

:: -- Ensure a Windows Chrome profile is available for MiMo login/CDP --
call :ensure_chrome_cdp

:: -- If service is already running, skip WSL startup --
call :check_service
if errorlevel 2 goto auth_error
if not errorlevel 1 goto service_ready

:: A stale/broken service may still be holding the port.
call :stop_existing_service

:: -- Check WSL/default distro --
%WSL% -e sh -lc "echo ok" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] WSL default distro is not available.
    echo.
    echo Installed distros:
    wsl.exe -l -v
    echo.
    echo If your distro has another name, edit this file and set:
    echo   set "WSL=wsl.exe -d YourDistroName"
    pause
    exit /b 1
)

:: -- Write launcher script to avoid quote escaping --
> "%LAUNCHER%" echo #!/usr/bin/env bash
>>"%LAUNCHER%" echo set -e
>>"%LAUNCHER%" echo export MIMO_CDP_URL="%CHROME_CDP_URL%"
>>"%LAUNCHER%" echo source ~/.hermes/hermes-agent/venv/bin/activate
>>"%LAUNCHER%" echo exec python3 ~/mimo-credits-service.py

for /f "usebackq delims=" %%P in (`%WSL% -e wslpath -a "%LAUNCHER%" 2^>nul`) do set "LAUNCHER_WSL=%%P"
if not defined LAUNCHER_WSL (
    echo [ERROR] Could not convert launcher path for WSL.
    pause
    exit /b 1
)

%WSL% -e sed -i "s/\r$//" "%LAUNCHER_WSL%" >nul 2>&1

:: -- Start WSL service --
echo Starting data service...
del "%SERVICE_LOG%" 2>nul
start "" /b %WSL% -e bash "%LAUNCHER_WSL%" > "%SERVICE_LOG%" 2>&1

:: -- Wait for service --
set /a n=0
:wait
timeout /t 1 /nobreak >nul
set /a n+=1
if %n% gtr 15 (
    echo [ERROR] Service did not start. Check WSL manually.
    echo.
    echo Debug command:
    echo   %WSL% -e bash "%LAUNCHER_WSL%"
    pause
    exit /b 1
)
call :check_service
if errorlevel 2 goto auth_error
if errorlevel 1 goto wait

:service_ready
echo Service ready. Launching widget...

:: -- Launch Electron --
start "" "%ELECTRON%" "%WIDGET_DIR%"

:: -- Cleanup --
del "%LAUNCHER%" 2>nul
del "%HEALTH_FILE%" 2>nul

endlocal
exit /b 0

:auth_error
echo [ERROR] Data service is running, but MiMo authentication failed.
echo.
echo Last response:
type "%HEALTH_FILE%" 2>nul
echo.
echo.
echo This usually means the browser login/cookie/token used by the WSL service expired.
echo Login in the MiMo Chrome window opened by this launcher, then restart this widget.
echo If the window is not visible, run:
echo   %~dp0open-mimo-login-chrome.bat
echo.
echo Service log:
echo   %SERVICE_LOG%
pause
exit /b 2

:ensure_chrome_cdp
curl -s --max-time 2 "%CHROME_CDP_URL%/json/version" >nul 2>&1
if not errorlevel 1 exit /b 0
echo Opening MiMo login Chrome...
if not exist "%CHROME_PROFILE%" mkdir "%CHROME_PROFILE%" >nul 2>&1
start "" "%CHROME%" --remote-debugging-port=%CHROME_CDP_PORT% --remote-allow-origins=* --user-data-dir="%CHROME_PROFILE%" --no-first-run --new-window "https://platform.xiaomimimo.com"
timeout /t 2 /nobreak >nul
exit /b 0

:check_service
curl -s --max-time 3 "%SERVICE_URL%" > "%HEALTH_FILE%" 2>nul
if errorlevel 1 exit /b 1
findstr /I /C:"HTTP Error 401" "%HEALTH_FILE%" >nul 2>&1
if not errorlevel 1 exit /b 2
findstr /I /C:"AUTH_EXPIRED" "%HEALTH_FILE%" >nul 2>&1
if not errorlevel 1 exit /b 2
findstr /I /C:"code" "%HEALTH_FILE%" >nul 2>&1
if not errorlevel 1 findstr /I /C:"-1" "%HEALTH_FILE%" >nul 2>&1
if not errorlevel 1 exit /b 2
findstr /I /C:"error" "%HEALTH_FILE%" >nul 2>&1
if not errorlevel 1 exit /b 1
findstr /I /C:"detail" "%HEALTH_FILE%" >nul 2>&1
if errorlevel 1 exit /b 1
findstr /I /C:"usage" "%HEALTH_FILE%" >nul 2>&1
if errorlevel 1 exit /b 1
findstr /I /C:"balance" "%HEALTH_FILE%" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:stop_existing_service
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%SERVICE_PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)
%WSL% -e sh -lc "command -v fuser >/dev/null 2>&1 && fuser -k %SERVICE_PORT%/tcp || true" >nul 2>&1
timeout /t 1 /nobreak >nul
exit /b 0
