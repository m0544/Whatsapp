@echo off
chcp 65001 >nul
title WhatsApp Reader - Setup

echo.
echo ╔══════════════════════════════════════════╗
echo ║     WhatsApp Reader - התקנה ראשונית     ║
echo ╚══════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js לא מותקן במחשב
    echo.
    echo [*] פותח דף הורדה של Node.js...
    echo [*] הורד והתקן את הגרסה LTS
    echo [*] לאחר ההתקנה, הרץ שוב את הקובץ הזה
    echo.
    start https://nodejs.org/
    pause
    exit /b
)

echo [✓] Node.js מותקן
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo     גרסה: %NODE_VER%
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [*] מתקין תלויות...
    echo.
    call npm install
    echo.
)

echo [✓] התלויות מותקנות
echo.
echo ╔══════════════════════════════════════════╗
echo ║            מפעיל את האפליקציה           ║
echo ╚══════════════════════════════════════════╝
echo.
echo [*] סרוק את קוד ה-QR שיופיע עם וואטסאפ
echo [*] לאחר החיבור, פתח: http://localhost:3000
echo.
echo ─────────────────────────────────────────────
echo.

node index.js

pause

