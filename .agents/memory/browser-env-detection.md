---
name: Browser env detection
description: كيفية كشف البيئة (Replit vs Render) في كود البراوزر
---

## المشكلة
`import.meta.env.REPL_ID` لا تصل للبراوزر لأن Vite يكشف فقط المتغيرات ذات البادئة `VITE_`.
النتيجة: `isReplit = false` دائماً، فيستخدم الكود دائماً `gaytak-api.onrender.com`.

## الحل الصحيح
استخدم `window.location.hostname` للكشف عن البيئة في البراوزر:
```typescript
const isOnRender = typeof window !== "undefined" && window.location.hostname.includes(".onrender.com");
```

- `.onrender.com` → استخدم الـ Render API URL
- غير ذلك (replit.dev, localhost) → استخدم URLs نسبية

**Why:** window.location.hostname موثوق في البراوزر ولا يتأثر ببيئة البناء.

**How to apply:** أي كشف للبيئة في ملفات `.tsx/.ts` في artifacts يجب أن يعتمد على hostname لا على env vars غير VITE_*.
