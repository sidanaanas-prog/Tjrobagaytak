# Gaytak — Local Dev Setup (Windows PowerShell)
# Usage: .\scripts\dev.ps1

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Ὠ0  Gaytak — مساعد التشغيل المحلي          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# --- 1. Check prerequisites ---
Write-Host "🟢 1/5 مراجعة المتطلبات" -ForegroundColor Green

function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

$missing = 0
if (-not (Test-Command "node")) {
    Write-Host "   ❌ Node.js غير مثبت. ثبت: https://nodejs.org" -ForegroundColor Red
    $missing = 1
} else {
    $ver = (node --version)
    Write-Host "   ✅ Node.js $ver" -ForegroundColor Green
}

if (-not (Test-Command "pnpm")) {
    Write-Host "   ❌ pnpm غير مثبت. ثبت: npm install -g pnpm" -ForegroundColor Red
    $missing = 1
} else {
    $ver = (pnpm --version)
    Write-Host "   ✅ pnpm $ver" -ForegroundColor Green
}

if (-not (Test-Command "docker")) {
    Write-Host "   ⚠️  Docker غير مثبت (اختياري). ثبت: https://docker.com" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Docker مثبت" -ForegroundColor Green
}

if ($missing -eq 1) {
    Write-Host ""
    Write-Host "❌ يوجد مشاكل. أصلح قبل المتابعة." -ForegroundColor Red
    exit 1
}

# --- 2. Install dependencies ---
Write-Host ""
Write-Host "🟢 2/5 تثبيت المكونات" -ForegroundColor Green

if (-not (Test-Path "node_modules")) {
    Write-Host "   ⚠️  node_modules غير موجود. جاري التثبيت..." -ForegroundColor Yellow
    pnpm install
} else {
    Write-Host "   ✅ node_modules موجود. تخطي التثبيت..." -ForegroundColor Green
    pnpm install
}

# --- 3. Env files ---
Write-Host ""
Write-Host "🟢 3/5 التأكد من ملفات البيئة (.env)" -ForegroundColor Green

$needsSetup = 0

if (-not (Test-Path "artifacts/api-server/.env")) {
    Write-Host "   ⚠️  artifacts/api-server/.env غير موجود. جاري الإنشاء..." -ForegroundColor Yellow
    @'
DATABASE_URL="postgresql://gaytak:gaytak123@localhost:5432/gaytak"
PORT=8080
BASE_PATH="/api"
NODE_ENV="development"
SESSION_SECRET="dev-secret-key-123"
ADMIN_EMAIL="admin@gaytak.com"
ADMIN_PASSWORD="gaytak@2025"
'@ | Set-Content -Path "artifacts/api-server/.env" -Encoding UTF8
    Write-Host "   ✅ تم إنشاؤه" -ForegroundColor Green
    $needsSetup = 1
} else {
    Write-Host "   ✅ artifacts/api-server/.env موجود" -ForegroundColor Green
}

if (-not (Test-Path "artifacts/marketplace/.env.local")) {
    Write-Host "   ⚠️  marketplace/.env.local غير موجود. جاري الإنشاء..." -ForegroundColor Yellow
    "VITE_API_URL=http://localhost:8080" | Set-Content -Path "artifacts/marketplace/.env.local" -Encoding UTF8
    Write-Host "   ✅ تم إنشاؤه" -ForegroundColor Green
    $needsSetup = 1
} else {
    Write-Host "   ✅ marketplace/.env.local موجود" -ForegroundColor Green
}

if (-not (Test-Path "artifacts/admin-panel/.env.local")) {
    Write-Host "   ⚠️  admin-panel/.env.local غير موجود. جاري الإنشاء..." -ForegroundColor Yellow
    "VITE_API_URL=http://localhost:8080" | Set-Content -Path "artifacts/admin-panel/.env.local" -Encoding UTF8
    Write-Host "   ✅ تم إنشاؤه" -ForegroundColor Green
    $needsSetup = 1
} else {
    Write-Host "   ✅ admin-panel/.env.local موجود" -ForegroundColor Green
}

if ($needsSetup -eq 1) {
    Write-Host ""
    Write-Host "   ⚠️  تم إنشاء ملفات البيئة بالقيم الافتراضية." -ForegroundColor Yellow
    Write-Host "   افتح artifacts/api-server/.env وعدّل إذا كانت داتابيس مختلفة." -ForegroundColor Yellow
}

# --- 4. Build libs + push schema ---
Write-Host ""
Write-Host "🟢 4/5 بناء المكتبات المشتركة + المخطط" -ForegroundColor Green

pnpm run typecheck:libs 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  typecheck:libs رجع خطأ (غالباً بسبب تحذيرات). مواصلة..." -ForegroundColor Yellow
} else {
    Write-Host "   ✅ المكتبات جاهزة" -ForegroundColor Green
}

if (Test-Command "docker") {
    docker-compose up -d postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PostgreSQL (Docker) تم التشغيل" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  فشل تشغيل Docker. تأكد من أن القاعدة مشغولة." -ForegroundColor Yellow
    }
}

# Wait for DB
Write-Host "   ⏳ انتظار القاعدة..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

pnpm --filter @workspace/db run push-force 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  دفع المخطط فشل. حاول: pnpm --filter @workspace/db run push-force" -ForegroundColor Yellow
} else {
    Write-Host "   ✅ تم دفع المخطط" -ForegroundColor Green
}

# --- 5. Done ---
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✅ التطبيق جاهز للتشغيل!                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "💻 انسخ هذه الأوامر في طرمادات منفصلة (داخل VS Code):" -ForegroundColor White
Write-Host ""
Write-Host "   ┌────────────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "   │  الطرماد 1 — API Server                            │" -ForegroundColor White
Write-Host "   │  PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run start  │" -ForegroundColor Yellow
Write-Host "   │  → http://localhost:8080                               │" -ForegroundColor White
Write-Host "   └────────────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "   ┌────────────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "   │  الطرماد 2 — Marketplace (السوق)              │" -ForegroundColor White
Write-Host "   │  pnpm --filter @workspace/marketplace run dev          │" -ForegroundColor Yellow
Write-Host "   │  → http://localhost:3000 أو البورت اللي راح يظهرك  │" -ForegroundColor White
Write-Host "   └────────────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "   ┌────────────────────────────────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "   │  الطرماد 3 — Admin Panel (التحكم)            │" -ForegroundColor White
Write-Host "   │  pnpm --filter @workspace/admin-panel run dev         │" -ForegroundColor Yellow
Write-Host "   │  → http://localhost:3001                              │" -ForegroundColor White
Write-Host "   └────────────────────────────────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "   Admin: admin@gaytak.com / gaytak@2025" -ForegroundColor White
Write-Host "   API Health: http://localhost:8080/api/healthz" -ForegroundColor White
Write-Host ""
Write-Host "   اضغط Ctrl+C في كل طرماد للإيقاف." -ForegroundColor Gray
Write-Host ""
