@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [INFO] Starting local environment...

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo [HINT] Install Node.js first, then run start.bat again.
  pause
  exit /b 1
)

if not exist "proxy\server.js" (
  echo [ERROR] Missing file: proxy\server.js
  pause
  exit /b 1
)

if not exist "proxy\start_proxy.bat" (
  echo [ERROR] Missing file: proxy\start_proxy.bat
  pause
  exit /b 1
)

echo [INFO] Launching local proxy window on http://localhost:3001 ...
start "SellerSprite Proxy" "%~dp0proxy\start_proxy.bat"

timeout /t 1 >nul

echo [INFO] Opening page: http://localhost:3001/
start "" "http://localhost:3001/"

echo [DONE] Started. Close the "SellerSprite Proxy" window to stop proxy.
exit /b 0
