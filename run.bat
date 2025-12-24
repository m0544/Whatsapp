@echo off
title WhatsApp Reader

:: Change to the directory where this script is located
cd /d "%~dp0"

echo.
echo ========================================
echo        WhatsApp Reader v1.0
echo ========================================
echo.
echo [*] Starting...
echo [*] After connecting, open: http://localhost:3000
echo.

node index.js

pause
