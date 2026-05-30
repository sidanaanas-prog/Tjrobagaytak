---
name: Firebase-only notifications
description: المشروع يستخدم Firebase FCM فقط للإشعارات — لا OneSignal ولا أي provider آخر
---

المشروع يعتمد **Firebase FCM** فقط للإشعارات الفورية.

**Why:** صاحب المشروع صرّح صراحةً "نحن لا نستخدم OneSignal أبداً بل نستخدم Firebase".

**How to apply:**
- `FIREBASE_SERVER_KEY` هو المتغير الوحيد المطلوب للإشعارات من الـ server
- لا تُضف `ONESIGNAL_APP_ID` أو `ONESIGNAL_REST_API_KEY` لأي كود
- `lib/notifications.ts` في api-server يستخدم FCM مباشرة عبر `https://fcm.googleapis.com/fcm/send`
- في الـ client: `lib/firebase.ts` في marketplace يستخدم Firebase SDK + VAPID key
