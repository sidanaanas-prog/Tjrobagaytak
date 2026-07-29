---
name: Pharmacy system
description: معلومات نظام صيدلية شفاء — مكوناته وقواعد استخدامه
---

## الجداول المُنشأة
- `pharmacies` — الصيدلية الرئيسية (id: shifa-pharmacy-001)
- `pharmacy_staff` — الأطباء والطاقم الطبي
- `prescription_orders` — طلبات الوصفات
- `pharmacy_exams` — أنواع الفحوصات وأسعارها
- `pharmacy_appointments` — حجوزات المواعيد
- `pharmacy_consultations` — الاستفسارات الطبية
- `consultation_replies` — ردود الطاقم الطبي

## API endpoints (artifacts/api-server/src/routes/pharmacy.ts)
- GET /api/pharmacy — معلومات الصيدلية (public)
- POST /api/pharmacy/prescriptions — رفع وصفة (auth)
- POST /api/pharmacy/appointments — حجز موعد (auth)
- POST /api/pharmacy/consultations — استفسار (auth)
- GET /api/pharmacy/me — التحقق من دور المستخدم (صاحب/طاقم/عادي)
- /api/pharmacy/owner/* — لوحة صاحب الصيدلية
- /api/pharmacy/staff/consultations — لوحة الطاقم الطبي
- /api/admin/pharmacies — إدارة الأدمن

## الربط التلقائي
- صاحب الصيدلية: عند دخوله بنفس رقم ownerPhone يُربط تلقائياً
- الطاقم الطبي: عند تسجيلهم بنفس الرقم المضاف يصبحون active تلقائياً

## مكونات الواجهة
- marketplace: /pharmacy (صفحة كاملة بـ 3 tabs)
- marketplace home: PharmacyStrip بدل RestaurantsStrip
- mobile: artifacts/gaytak-mobile/app/(tabs)/food.tsx (استُبدل كاملاً)
- admin: /pharmacy في لوحة الأدمن

**Why:** قسم صيدلاني متكامل مع نسبة عمولة يتحكم بها الأدمن
**How to apply:** لإضافة صيدليات جديدة: POST /api/admin/pharmacies من لوحة الأدمن
