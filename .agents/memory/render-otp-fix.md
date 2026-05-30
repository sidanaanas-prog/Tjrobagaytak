---
name: Render OTP cold-start fix
description: Wasender OTP كان يُخزن في Map بالذاكرة، تُمسح عند cold-start على Render
---

## المشكلة
Wasender OTP (`lib/wasender.ts`) كان يستخدم `const otpStore = new Map()` لتخزين الأكواد.
على Render free tier، الخادم ينام وعند صحيانه (cold-start) تُمسح الذاكرة كلياً.
النتيجة: المستخدم يُرسل OTP، يصله على WhatsApp، لكن التحقق يفشل بـ "لم يتم إرسال رمز".

## الحل
- أضفنا جدول `phone_otps` في DB (phone PK, code, expires_at, sent_at, attempts)
- `wasender.ts` يستخدم الآن DB upsert عند الإرسال والتحقق بدل Map
- الكود يبقى في DB 5 دقائق ويُحذف بعد التحقق الناجح أو انتهاء الصلاحية

**Why:** الـ DB يبقى بين cold-starts على Render، الذاكرة لا.

**How to apply:** أي OTP مخزن في in-memory على Render سيُمسح. دائماً استخدم DB لتخزين الأكواد في Render.
