# Gaytak — دليل التشغيل المحلي (VS Code)

تشغيل Gaytak على جهازك بدون مشاكل — المعاينة راح تشتغل مثل هنا بالضبط.

---

## المتطلبات

| الأداة | الإصدار | رابط التثبيت |
|---|---|---|
| **Node.js** | 24.x | [nodejs.org](https://nodejs.org) أو `nvm install 24` |
| **pnpm** | 9.x+ | `npm install -g pnpm` |
| **Docker** | — | [docker.com](https://docker.com) (للقاعدة البيانات) |

---

## الخطوات بالتفصيل

### 1. استيراد المشروع من GitHub

```bash
git clone https://github.com/<your-username>/gaytak.git
cd gaytak
```

### 2. تثبيت المكونات

```bash
# اطمئن أن الإصدار Node.js ما يقل عن 24
node --version  # يجب أن يرجع: v24.x.x

# تثبيت المكونات
pnpm install
```

### 3. قاعدة البيانات (PostgreSQL)

**الطريقة الأسهل: Docker**

```bash
# شغّل PostgreSQL في Docker
# الأمر يشغله ويظلّ على بورت 5432
docker-compose up -d postgres
```

> لو ما عندك Docker: نزّل PostgreSQL مباشرة وأنشئ قاعدة `gaytak`.

### 4. إعداد ملفات البيئة (مهم جداً!)

نحتاج 3 ملفات `.env` مختلفة:

**أ. ملف السيرفر (`artifacts/api-server/.env`)**

أنشئ هذا الملف ولصقه من `.env.example`:

```bash
cp .env.example artifacts/api-server/.env
```

افتح الملف وتأكد من هذه القيم:

```env
DATABASE_URL="postgresql://gaytak:gaytak123@localhost:5432/gaytak"
PORT=8080
BASE_PATH="/api"
NODE_ENV="development"
SESSION_SECRET="dev-secret-key-123"
ADMIN_EMAIL="admin@gaytak.com"
ADMIN_PASSWORD="gaytak@2025"
```

> المفاتيح الأساسية فقط. OTP و Firebase و Cloudinary اختيارية — التطبيق يشتغل بدونها.

**ب. ملف الويب (السوق) — `artifacts/marketplace/.env.local`**

```bash
# أنشئ الملف
printf 'VITE_API_URL=http://localhost:8080\n' > artifacts/marketplace/.env.local
```

أو مباشرة:

```bash
echo "VITE_API_URL=http://localhost:8080" > artifacts/marketplace/.env.local
```

> هذا الملف يخبّر الويب أن السيرفر على العنوان `localhost:8080` بدل Replit proxy.

**ج. ملف لوحة التحكم — `artifacts/admin-panel/.env.local`**

```bash
echo "VITE_API_URL=http://localhost:8080" > artifacts/admin-panel/.env.local
```

### 5. بناء المكتبات المشتركة

```bash
# بناء المكتبات المشتركة (شرائح الطابعة + Zod وغيرها)
pnpm run typecheck:libs
```

> يمكن أن يطبع بعض التحذيرات — هذا عادي ولا يؤثر على التشغيل.

### 6. دفع مخطط قاعدة البيانات

```bash
# ارفع جداول المشروع للقاعدة
pnpm --filter @workspace/db run push-force
```

> هذا أمر استخدامه مرة واحدة فقط عند التثبيت. بالمستقبل: إذا غيّرت المخطط فقط.

---

### 7. تشغيل التطبيقات (افتح 3 طرمادات منفصلة)

**طرماد 1 — API Server**

```bash
# يمكنك تشغيله مباشرة أو عبر الوامر
PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run start
```

> راح يشغل على `http://localhost:8080`
> الأول مرة راح يـتولّد الـAdmin تلقائياً.

**طرماد 2 — السوق (الويب)**

```bash
pnpm --filter @workspace/marketplace run dev
```

> راح يفتح Vite dev server على بورت عشوائي — الأغلب الرائج `5173` أو `3000`.
> افتح المتصفح: http://localhost:3000 أو ما راح يظهرك في الطرماد.

**طرماد 3 — لوحة التحكم (Admin)**

```bash
pnpm --filter @workspace/admin-panel run dev
```

> راح يفتح على بورت آخر — مثلاً `3001`.

---

## خلاصة: الأورامر السريعة

```bash
# خطوة واحدة (بعد التثبيت):
docker-compose up -d postgres
cp .env.example artifacts/api-server/.env
echo "VITE_API_URL=http://localhost:8080" > artifacts/marketplace/.env.local
echo "VITE_API_URL=http://localhost:8080" > artifacts/admin-panel/.env.local
pnpm run typecheck:libs
pnpm --filter @workspace/db run push-force
```

ثم فتح 3 طرمادات منفصلة:

| الطرماد | الأمر | الرابط |
|---|---|---|
| 1 | API Server | `PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run start` |
| 2 | Marketplace | `pnpm --filter @workspace/marketplace run dev` |
| 3 | Admin | `pnpm --filter @workspace/admin-panel run dev` |

---

## المشاكل الشائعة والحلول

| المشكل | السبب | الحل |
|---|---|---|
| `EADDRINUSE ≤°°°8080` | بورت 8080 مشغول | `npx kill-port 8080` أو `lsof -ti:8080 \| xargs kill -9` |
| `DATABASE_URL not set` | نسيت ملف `.env` | تأكد من `artifacts/api-server/.env` |
| `❌ Cannot find module '@workspace/db'` | ما بنيت المكتبات المشتركة | شغّل `pnpm run typecheck:libs` |
| `❌ column "X" does not exist` | المخطط ما اتزام | `pnpm --filter @workspace/db run push-force` |
| صفحة بيضاء / ما يتصل الـAPI | الويب ما يعرف عنوان الـAPI | تأكد من ملف `.env.local` للـmarketplace |
| `CORS error` | الـfrontend يتصل ببورت خطأ | تأكد من `VITE_API_URL=http://localhost:8080` |

---

## الفروق بين الملفات

| الملف | المكان | الغرض |
|---|---|---|
| `.env` | جذر المشروع | قالب للسيرفر |
| `artifacts/api-server/.env` | إعدادات السيرفر | PORT, DATABASE_URL, SESSION_SECRET, ... |
| `artifacts/marketplace/.env.local` | اعدادات الويب | VITE_API_URL=http://localhost:8080 |
| `artifacts/admin-panel/.env.local` | إعدادات التحكم | VITE_API_URL=http://localhost:8080 |

> `.env.local` يتم تجاهله من قبل Git تلقائياً — لا تخشى من ارتكاب الأسرار.

---

## ملاحظات إضافية

1. **تسجيل الدخول** بالإيميل + كلمة مرور الـOTP مش شغال محلياً.
2. **الأدمن** يتجده بنفسه تلقائياً: `admin@gaytak.com` / `gaytak@2025`.
3. **المنتجات** الافتراضية لا تظهر إلاّ بعد موافقة الأدمن — هذه سلوكة النظام الافتراضي.
4. **الصور** المرفوعة تتبدّل لـ Cloudinary إذا وضعت مفاتيحه ، وإلاً تتبدّل لـ object storage الخاص بـ Replit — للتشغيل المحلي لا تحتاج هذه الأقسام.
