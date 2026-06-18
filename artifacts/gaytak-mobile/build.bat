@echo off
echo ========================================
echo    Gaytak Mobile - EAS Build Script
echo ========================================
echo.

echo [1/4] Removing old node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    echo Done.
) else (
    echo No node_modules found, skipping.
)

echo.
echo [2/4] Removing old lock file...
if exist package-lock.json (
    del package-lock.json
    echo Done.
) else (
    echo No lock file found, skipping.
)

echo.
echo [3/4] Installing packages...
npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Starting EAS build (preview APK)...
eas build -p android --profile preview

echo.
echo ========================================
echo Build submitted! Check status above.
echo ========================================
pause
