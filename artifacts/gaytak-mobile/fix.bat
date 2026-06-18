@echo off
chcp 65001 >nul
echo.
echo ====================================
echo    Gaytak - Fix and Build
echo ====================================
echo.

if not exist "package.json" (
  echo ERROR: Run this file from inside the gaytak-mobile folder
  pause
  exit /b 1
)

echo [1/4] Removing OneSignal from package.json...
node -e "
var fs=require('fs');
var pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
delete pkg.dependencies['@onesignal/react-native-onesignal'];
delete pkg.dependencies['react-native-onesignal'];
delete pkg.dependencies['onesignal-expo-plugin'];
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));
console.log('  Done');
"

echo [2/4] Stubbing useNotifications.ts...
node -e "
var fs=require('fs');
var stub='import { useEffect } from \"react\";\n\nexport function setupAndroidChannels() {}\nexport function initOneSignal() {}\nexport function loginOneSignal(_userId) {}\nexport function logoutOneSignal() {}\nexport function useNotifications(_userId) {}\n';
fs.writeFileSync('hooks/useNotifications.ts', stub);
console.log('  Done');
"

echo [3/4] Fixing babel.config.js and app.config.js...
node -e "
var fs=require('fs');
var lines=fs.readFileSync('babel.config.js','utf8').split('\n');
lines=lines.filter(function(l){ return l.indexOf('onesignal-stub')===-1; });
fs.writeFileSync('babel.config.js',lines.join('\n'));

var cfg=fs.readFileSync('app.config.js','utf8');
cfg=cfg.replace(/const nativePlugins[\s\S]*?;(\s*\n)/,'');
cfg=cfg.replace(/\.\.\.\(isReplit \? \[\] : nativePlugins\),?\s*\n/,'');
fs.writeFileSync('app.config.js',cfg);
console.log('  Done');
"

echo.
echo [4/4] Running npm install...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
  echo ERROR: npm install failed
  pause
  exit /b 1
)

echo.
echo ====================================
echo    Starting EAS Build...
echo ====================================
echo.
call eas build --platform android --profile preview --clear-cache

pause
