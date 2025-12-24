@echo off
title WhatsApp Reader - Setup

:: Change to the directory where this script is located
cd /d "%~dp0"

echo.
echo ========================================
echo     WhatsApp Reader - First Time Setup
echo ========================================
echo.
echo Current folder: %cd%
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js is NOT installed!
    echo.
    echo [*] Opening Node.js download page...
    echo [*] Please download and install the LTS version
    echo [*] After installation, run this file again
    echo.
    start https://nodejs.org/
    pause
    exit /b
)

echo [OK] Node.js is installed
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo     Version: %NODE_VER%
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo Make sure you extracted all files from the ZIP.
    pause
    exit /b
)

:: Run npm install
echo [*] Installing dependencies...
echo     This may take a few minutes...
echo.
call npm install
echo.

:: Verify installation
if not exist "node_modules\whatsapp-web.js" (
    echo [ERROR] Installation failed!
    echo.
    echo Try running manually:
    echo   1. Open Command Prompt
    echo   2. cd "%cd%"
    echo   3. npm install
    echo.
    pause
    exit /b
)

echo [OK] Dependencies installed successfully!
echo.
echo ========================================
echo         Starting Application
echo ========================================
echo.
echo [*] Scan the QR code with WhatsApp
echo [*] After connecting, open: http://localhost:3000
echo.
echo -----------------------------------------
echo.

node index.js

pause
