# تعليمات النشر على Render

## 1. Environment Variables → Render Dashboard

```
# قاعدة البيانات
DATABASE_URL=
SESSION_SECRET=

# واتساب OTP
WASENDER_API_KEY=

# Firebase Admin
FIREBASE_PROJECT_ID=gaytak-45ae1
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Client (للـ Vite build)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=gaytak-45ae1
VITE_FIREBASE_STORAGE_BUCKET=gaytak-45ae1.firebasestorage.app
VITE_FIREBASE_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

## 2. قاعدة البيانات خارجية

أنشئ قاعدة بيانات على **Neon.tech** (مجاني) أو **Supabase**

1. انسخ الرابط (Connection String)
2. أنشئ موسعة pg_dump من Replit
3. استرجع الرابط في Render الآن

## 3. Build Commands بـ Render

### API Server (Web Service)
```bash
# Build
pnpm --filter @workspace/api-server run build

# Start
node artifacts/api-server/dist/index.mjs
```

### Marketplace (Static Site)
```bash
# Build
pnpm --filter @workspace/marketplace run build

# Public folder
artifacts/marketplace/dist/public
```

## 4. Rewrite Rules (Static Site)

```
/api/*  →  نحو إلى API Server
/*      →  /index.html
```

## 5. الأشياء المستقلة عن Replit

| الميزة | المسار |
|---|---|
| Firebase Storage | يستخدم المشروع ورابط قابلة للوصول |
| Firestore (الرسائل) | يستخدم المشروع ورابط قابلة للوصى |
| صور المستخدمين | في Firebase Storage |
| الرسائل | في Firestore |
| المستخدمين، المنتجات، الطلبات | في PostgreSQL (الخارجية) |
