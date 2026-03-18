@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
echo [proxy] Starting SellerSprite local proxy...
node proxy\server.js
echo [proxy] Proxy exited.
pause

