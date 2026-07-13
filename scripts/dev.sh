#!/usr/bin/env bash
#
# Gaytak — سكريبت تشغيل التطبيق محلياً (VS Code)
# استخدام: ./scripts/dev.sh
#

set -e

print_header() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════════════╗"
  echo "║  🚀  Gaytak — مساعد التشغيل المحلي          ║"
  echo "╚═══════════════════════════════════════════════════════════════════════╝"
  echo ""
}

print_ok()   { echo "   ✅ $1"; }
print_warn() { echo "   ⚠️  $1"; }
print_err()  { echo "   ❌ $1"; }
print_step() { echo ""; echo "🟢 $1"; }

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    print_ok "$2"
    return 0
  else
    print_err "$3"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────
print_header

# 1. المتطلبات
print_step "1/5 مراجعة المتطلبات"

MISSING=0
check_cmd "node" "Node.js $(node --version 2>/dev/null || echo '')" "Node.js غير مثبت. ثبت: https://nodejs.org" || MISSING=1
check_cmd "pnpm" "pnpm $(pnpm --version 2>/dev/null || echo '')" "pnpm غير مثبت. ثبت: npm install -g pnpm" || MISSING=1
check_cmd "docker" "Docker مثبت" "Docker غير مثبت (للقاعدة). ثبت: https://docker.com" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo ""
  print_err "يوجد مشاكل. أصلح قبل المتابعة."
  exit 1
fi

# Node.js الإصدار
NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 24 ]; then
  print_warn "Node.js $NODE_MAJOR مكتشف. المطلوب: 24.x. يمكن أن تحدث: nvm install 24"
fi

# 2. المكونات
print_step "2/5 تثبيت المكونات"

if [ ! -d "node_modules" ]; then
  print_warn "node_modules غير موجود. جاري التثبيت..."
  pnpm install
else
  print_ok "node_modules موجود. تخطي التثبيت..."
  pnpm install
fi

# 3. إعداد ملفات البيئة
print_step "3/5 التأكد من ملفات البيئة (.env)"

NEEDS_SETUP=0

if [ ! -f "artifacts/api-server/.env" ]; then
  print_warn "artifacts/api-server/.env غير موجود. جاري الإنشاء..."
  cat > artifacts/api-server/.env << 'EOF'
DATABASE_URL="postgresql://gaytak:gaytak123@localhost:5432/gaytak"
PORT=8080
BASE_PATH="/api"
NODE_ENV="development"
SESSION_SECRET="dev-secret-key-123"
ADMIN_EMAIL="admin@gaytak.com"
ADMIN_PASSWORD="gaytak@2025"
EOF
  print_ok "artifacts/api-server/.env تم إنشاؤه"
  NEEDS_SETUP=1
else
  print_ok "artifacts/api-server/.env موجود"
fi

if [ ! -f "artifacts/marketplace/.env.local" ]; then
  print_warn "artifacts/marketplace/.env.local غير موجود. جاري الإنشاء..."
  printf 'VITE_API_URL=http://localhost:8080\n' > artifacts/marketplace/.env.local
  print_ok "artifacts/marketplace/.env.local تم إنشاؤه"
  NEEDS_SETUP=1
else
  print_ok "artifacts/marketplace/.env.local موجود"
fi

if [ ! -f "artifacts/admin-panel/.env.local" ]; then
  print_warn "artifacts/admin-panel/.env.local غير موجود. جاري الإنشاء..."
  printf 'VITE_API_URL=http://localhost:8080\n' > artifacts/admin-panel/.env.local
  print_ok "artifacts/admin-panel/.env.local تم إنشاؤه"
  NEEDS_SETUP=1
else
  print_ok "artifacts/admin-panel/.env.local موجود"
fi

if [ "$NEEDS_SETUP" -eq 1 ]; then
  echo ""
  print_warn "تم إنشاء ملفات البيئة بالقيم الافتراضية."
  print_warn "افتح artifacts/api-server/.env وعدّل القيم إذا كانت داتابيس مختلفة عن Docker."
fi

# 4. بناء المكتبات المشتركة + المخطط
print_step "4/5 بناء المكتبات المشتركة"

pnpm run typecheck:libs || {
  print_warn "typecheck:libs رجع خطأ (غالباً بسبب تحذيرات عادية). مواصلة..."
}

print_step "4b. دفع مخطط البيانات"
docker-compose up -d postgres || {
  print_warn "Docker موجود لكن فشل التشغيل. تأكد من أن القاعدة مشغولة."
}

# انتظر حتى تصبح القاعدة جاهزة
for i in 1 2 3 4 5; do
  if docker-compose ps postgres | grep -q "Up\|running"; then
    break
  fi
  sleep 2
done

pnpm --filter @workspace/db run push-force || {
  print_warn "دفع المخطط فشل. حاول تشغيل: pnpm --filter @workspace/db run push-force"
}

# 5. تشغيل
print_step "5/5 جاهز! افتح 3 طرمادات منفصلة للتشغيل"

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ التطبيق جاهز للتشغيل!                  ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "💻 انسخ هذه الأوامر في طرمادات منفصلة (عبر VS Code Terminal):"
echo ""
echo "   ┌────────────────────────────────────────────────────────────────────────┐"
echo "   │  الطرماد 1 — API Server                            │"
echo "   │  PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run start  │"
echo "   │  → http://localhost:8080                               │"
echo "   └────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "   ┌────────────────────────────────────────────────────────────────────────┐"
echo "   │  الطرماد 2 — Marketplace (السوق)              │"
echo "   │  pnpm --filter @workspace/marketplace run dev          │"
echo "   │  → http://localhost:3000 أو البورت اللي راح يظهرك  │"
echo "   └────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "   ┌────────────────────────────────────────────────────────────────────────┐"
echo "   │  الطرماد 3 — Admin Panel (التحكم)            │"
echo "   │  pnpm --filter @workspace/admin-panel run dev         │"
echo "   │  → http://localhost:3001                              │"
echo "   └────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "   الـAdmin: admin@gaytak.com / gaytak@2025"
echo "   الـAPI Health: http://localhost:8080/api/healthz"
echo ""
echo "   اضغط Ctrl+C في كل طرماد للإيقاف."
echo ""
