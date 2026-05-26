@echo off
chcp 65001 >nul
echo.
echo ====================================
echo    Gaytak Capacitor - Build Setup
echo ====================================
echo.

echo [1/4] Installing packages...
call npm install
if %errorlevel% neq 0 ( echo ERROR: npm install failed & pause & exit /b 1 )

echo [2/4] Building web app...
call npm run build
if %errorlevel% neq 0 ( echo ERROR: Build failed & pause & exit /b 1 )

echo [3/4] Adding Android platform...
call npx cap add android
if %errorlevel% neq 0 ( echo Android already added, continuing... )

echo [4/4] Syncing files...
call npx cap sync

echo.
echo ====================================
echo Done! Now open Android Studio:
echo    File - Open - android folder
echo    Then: Build - Build APK
echo ====================================
echo.
pause
