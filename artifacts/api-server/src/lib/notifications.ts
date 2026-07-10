import admin from "firebase-admin";
import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// ── تهيئة Firebase Admin (مرة واحدة فقط) ─────────────────────────────────
function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const projectId   = process.env.FIREBASE_PROJECT_ID   ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[FCM] ⚠️ بيانات Firebase Admin غير مكتملة");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

// ── إرسال لرمز واحد ───────────────────────────────────────────────────────
export async function sendNotification({
  fcmToken,
  title,
  body,
  data,
}: {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  if (!fcmToken?.trim()) return;
  try {
    getApp();
    const isRideAlert = data?.type === "new_ride" || data?.type === "price_update";
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: {
        ...data,
        _title: title,
        _body: body,
        _isRideAlert: isRideAlert ? "1" : "0",
      },
      android: {
        priority: "high",
        notification: {
          title,
          body,
          channelId: isRideAlert ? "ride_alerts" : "default",
          priority: "high",
          sound: isRideAlert ? "alert.mp3" : "default",
          // رن مثل المكالمة الواردة — يفتح التطبيق حتى لو مقفل/خارج التطبيق
          ...(isRideAlert ? { fullScreenIntent: true, wakeScreen: true } : {}),
        },
      },
      apns: { payload: { aps: { sound: isRideAlert ? "alert.mp3" : "default", badge: 1, "content-available": 1 } } },
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: isRideAlert ? "/rides" : "/" },
      },
    });
  } catch (err: any) {
    const code: string = err?.code ?? "";
    console.error("[FCM] sendNotification error:", code, err?.message ?? err);
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      await db.delete(pushTokensTable).where(eq(pushTokensTable.token, fcmToken)).catch(() => {});
      await db.update(usersTable).set({ pushToken: null }).where(eq(usersTable.pushToken, fcmToken)).catch(() => {});
    }
  }
}

// ── إرسال لمجموعة رموز ────────────────────────────────────────────────────
export async function sendPushNotification({
  tokens,
  title,
  body,
  data,
}: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const clean = [...new Set(tokens.filter((t) => t?.trim()))];
  if (clean.length === 0) return;

  getApp();

  const isRideAlert = data?.type === "new_ride" || data?.type === "price_update";

  const results = await admin.messaging().sendEach(
    clean.map((token) => ({
      token,
      notification: { title, body },
      data: {
        ...data,
        _title: title,
        _body: body,
        _isRideAlert: isRideAlert ? "1" : "0",
      },
      android: {
        priority: "high" as const,
        notification: {
          title,
          body,
          channelId: isRideAlert ? "ride_alerts" : "default",
          priority: "high" as const,
          sound: isRideAlert ? "alert.mp3" : "default",
          fullScreenIntent: isRideAlert,
          wakeScreen: isRideAlert,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: isRideAlert ? "alert.mp3" : "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: isRideAlert ? "/rides" : "/" },
      },
    }))
  );

  for (let i = 0; i < results.responses.length; i++) {
    const r = results.responses[i];
    if (!r.success) {
      const code: string = r.error?.code ?? "";
      console.warn("[FCM] فشل الإرسال للـ token:", clean[i]?.slice(0, 20), code);
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        const bad = clean[i]!;
        await db.delete(pushTokensTable).where(eq(pushTokensTable.token, bad)).catch(() => {});
        await db.update(usersTable).set({ pushToken: null }).where(eq(usersTable.pushToken, bad)).catch(() => {});
      }
    }
  }

  if (results.failureCount > 0) {
    console.warn(`[FCM] ${results.failureCount} فشل من أصل ${clean.length}`);
  }
}

// ── إرسال لمجموعة مستخدمين (بالـ userIds) ───────────────────────────────
export async function notifyUsers({
  userIds,
  title,
  body,
  data,
}: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  if (userIds.length === 0) return;

  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds))
    .catch(() => []);

  const tokenSet = new Set(rows.map((r) => r.token));

  const users = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds))
    .catch(() => []);

  for (const u of users) {
    if (u.pushToken && !tokenSet.has(u.pushToken)) tokenSet.add(u.pushToken);
  }

  const tokenList = [...tokenSet].filter(Boolean) as string[];
  if (tokenList.length === 0) {
    console.warn("[FCM] لا توجد tokens للمستخدمين:", userIds);
    return;
  }

  await sendPushNotification({ tokens: tokenList, title, body, data });
}
