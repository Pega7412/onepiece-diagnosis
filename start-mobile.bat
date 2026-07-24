@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON=py"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON=python"
  ) else (
    echo Python was not found.
    echo Install Python from https://www.python.org/downloads/ and try again.
    pause
    exit /b 1
  )
)

set "LOCAL_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } ^| Select-Object -First 1 -ExpandProperty IPAddress"`) do set "LOCAL_IP=%%I"

echo.
echo ========================================
echo   Pachi Safety Net is ready
echo ========================================
echo PC:     http://localhost:4173
if defined LOCAL_IP (
  echo MOBILE: http://%LOCAL_IP%:4173
) else (
  echo MOBILE: Could not detect the PC address.
)
echo.
echo Keep this window open while using the app.
echo Press Ctrl+C to stop.
echo If Windows asks, allow access on private networks.
echo ========================================
echo.

start "" "http://localhost:4173"
%PYTHON% -m http.server 4173 --bind 0.0.0.0
