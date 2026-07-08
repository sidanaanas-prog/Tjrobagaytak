@echo off
chcp 65001 >nul
title Gaytak — مساعد التشغيل المحلي

echo.
echo   ╔═══════════════════════════════════════════════════════════════════════╗
echo   ║  🚀  Gaytak — مساعد التشغيل المحلي          ║
echo   ╚═══════════════════════════════════════════════════════════════════════╝
echo.

REM --- Check Node.js ---
echo   [1/5] مراجعة Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo   ❌ Node.js غير مثبت. ثبت: https://nodejs.org
  pause
  exit /b 1
)
for /f "tokens=1 delims=v" %%a in ('node --version') do set NODE_VER=%%a
echo   ✅ Node.js %NODE_VER%

REM --- Check pnpm ---
echo   [2/5] مراجعة pnpm...
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
  echo   ❌ pnpm غير مثبت. ثبت: npm install -g pnpm
  pause
  exit /b 1
)
for /f "tokens=*" %%a in ('pnpm --version') do set PNPM_VER=%%a
echo   ✅ pnpm %PNPM_VER%

REM --- Install dependencies ---
echo   [3/5] تثبيت المكونات...
if not exist node_modules (
  echo   ⏳ جاري التثبيت...
  call pnpm install
  if %errorlevel% neq 0 (
    echo   ❌ فشل التثبيت
    pause
    exit /b 1
  )
) else (
  echo   ✅ node_modules موجود
)

REM --- Setup env files ---
echo   [4/5] إعداد ملفات البيئة...

if not exist artifacts\api-server\.env (
  echo   📝 إنشاء artifacts\api-server\.env
  (
    echo DATABASE_URL="postgresql://gaytak:gaytak123@localhost:5432/gaytak"
    echo PORT=8080
    echo BASE_PATH="/api"
    echo NODE_ENV="development"
    echo SESSION_SECRET="dev-secret-key-123"
    echo ADMIN_EMAIL="admin@gaytak.com"
    echo ADMIN_PASSWORD="gaytak@2025"
  ) > artifacts\api-server\.env
) else (
  echo   ✅ artifacts\api-server\.env موجود
)

if not exist artifacts\marketplace\.env.local (
  echo   📝 إنشاء marketplace\.env.local
  echo VITE_API_URL=http://localhost:8080 > artifacts\marketplace\.env.local
) else (
  echo   ✅ marketplace\.env.local موجود
)

if not exist artifacts\admin-panel\.env.local (
  echo   📝 إنشاء admin-panel\.env.local
  echo VITE_API_URL=http://localhost:8080 > artifacts\admin-panel\.env.local
) else (
  echo   ✅ admin-panel\.env.local موجود
)

REM --- Docker PostgreSQL ---
echo   [5/5] تشغيل PostgreSQL...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
  echo   ⚠️  Docker غير مثبت. القاعدة مش راح تتشغل تلقائياً.
  echo   تأكد من أن قاعدة PostgreSQL محلية مشغولة على localhost:5432
) else (
  call docker-compose up -d postgres
  if %errorlevel% neq 0 (
    echo   ⚠️  فشل تشغيل Docker
  ) else (
    echo   ✅ PostgreSQL تم التشغيل
    echo   ⏳ انتظار 5 ثواني...
    timeout /t 5 /nobreak >nul
  )
)

REM --- Push schema ---
echo   🗄️  دفع مخطط البيانات...
call pnpm --filter @workspace/db run push-force
if %errorlevel% neq 0 (
  echo   ⚠️  تحذير: فشل دفع المخطط. حاول: pnpm --filter @workspace/db run push-force
)

REM --- Done ---
echo.
echo   ╔═══════════════════════════════════════════════════════════════════════╗
echo   ║  ✅ التطبيق جاهز للتشغيل!                  ║
echo   ╚═══════════════════════════════════════════════════════════════════════╝
echo.
echo   انسخ هذه الأوامر في طرمادات منفصلة داخل VS Code:e cho.
echo   ┌────────────────────────────────────────────────────────────────────────┐
echo   │  طرماد 1 — API Server                             │
echo   │  set PORT=8080 ^&^& set BASE_PATH=/api ^&^& pnpm --filter @workspace/api-server run start  │
echo   │  → http://localhost:8080                                │
echo   └────────────────────────────────────────────────────────────────────────┘
echo.
echo   ┌────────────────────────────────────────────────────────────────────────┐
echo   │  طرماد 2 — Marketplace (السوق)               │
echo   │  pnpm --filter @workspace/marketplace run dev           │
echo   │  → http://localhost:3000                                │
echo   └────────────────────────────────────────────────────────────────────────┘
echo.
echo   ┌────────────────────────────────────────────────────────────────────────┐
echo   │  طرماد 3 — Admin Panel (التحكم)             │
echo   │  pnpm --filter @workspace/admin-panel run dev          │
echo   │  → http://localhost:3001                               │
echo   └────────────────────────────────────────────────────────────────────────┘
echo.
echo   Admin: admin@gaytak.com / gaytak@2025
echo   API: http://localhost:8080/api/healthz
echo.
pause
