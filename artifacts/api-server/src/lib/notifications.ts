import admin from "firebase-admin";
import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";

const INVALID_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];

let _firebaseApp: admin.app.App | null = null;
let _firebaseInitError: string | null = null;

function initFirebase(): admin.app.App {
  if (_firebaseApp) return _firebaseApp;
  if (_firebaseInitError) throw new Error(_firebaseInitError);

  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL  || "";
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
  const projectId    = process.env.FIREBASE_PROJECT_ID    || "gaytak";

  if (!clientEmail || !privateKey) {
    _firebaseInitError = `Firebase credentials missing: clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`;
    console.error("[FCM] ❌", _firebaseInitError);
    throw new Error(_firebaseInitError);
  }

  try {
    _firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({ clientEmail, privateKey, projectId }),
    });
    console.log("[FCM] ✅ Firebase Admin initialized, project:", projectId);
    return _firebaseApp;
  } catch (e: any) {
    _firebaseInitError = e.message;
    console.error("[FCM] ❌ Firebase init failed:", e.message);
    throw e;
  }
}

try { initFirebase(); } catch (_) {}

function getFirebaseApp(): admin.app.App {
  return initFirebase();
}

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
  if (!fcmToken) {
    console.warn("[FCM] لا يوجد FCM Token");
    return;
  }

  try {
    const app = getFirebaseApp();
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: { title, body },
      data: data ?? {},
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "messages" },
      },
      webpush: {
        notification: { icon: "/favicon.png", badge: "/favicon.png" },
        headers: { Urgency: "high" },
      },
    };

    const msgId = await admin.messaging(app).send(message);
    console.log("[FCM] ✅ إشعار أُرسل:", msgId);
  } catch (err: any) {
    const code = err?.code || "";
    const isInvalidToken = INVALID_TOKEN_CODES.some((c) => code.includes(c) || err?.message?.includes(c));
    if (isInvalidToken) {
      console.warn("[FCM] Token غير صالح — حذف من DB:", fcmToken.slice(0, 20) + "...");
      try {
        await db.delete(pushTokensTable).where(eq(pushTokensTable.token, fcmToken));
        await db.update(usersTable).set({ pushToken: null }).where(eq(usersTable.pushToken, fcmToken));
      } catch (dbErr) {
        console.warn("[FCM] خطأ في حذف التوكن الغير صالح:", dbErr);
      }
    } else {
      console.error("[FCM] sendNotification error:", err?.message || err);
    }
  }
}

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
  const cleanTokens = tokens.filter((t) => t && typeof t === "string" && t.trim().length > 0);
  if (cleanTokens.length === 0) return;

  try {
    const app = getFirebaseApp();
    const results = await admin.messaging(app).sendEach(
      cleanTokens.map((token) => ({
        token,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: "high",
          notification: { sound: "default", channelId: "messages" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } },
        },
        webpush: {
          notification: { icon: "/favicon.png", badge: "/favicon.png" },
          headers: { Urgency: "high" },
        },
      }))
    );
    console.log(`[FCM] ✅ Sent ${results.successCount}/${cleanTokens.length}, failed ${results.failureCount}`);
  } catch (err: any) {
    console.error("[FCM] Multicast error:", err?.message || err);
  }
}

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

  // جلب التوكنات من جدول push_tokens (المصدر الرئيسي)
  const rows = await db
    .select({ token: pushTokensTable.token })
    .from(pushTokensTable)
    .where(inArray(pushTokensTable.userId, userIds));

  const tokenSet = new Set(rows.map((r) => r.token));

  // fallback: جلب push_token من جدول users للمستخدمين الذين لا يملكون سجلاً في push_tokens
  const usersWithToken = await db
    .select({ id: usersTable.id, pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));

  for (const u of usersWithToken) {
    if (u.pushToken && !tokenSet.has(u.pushToken)) {
      tokenSet.add(u.pushToken);
    }
  }

  const tokenList = [...tokenSet].filter(Boolean);
  if (tokenList.length === 0) {
    console.warn("[FCM] notifyUsers: لا توجد توكنات للمستخدمين:", userIds);
    return;
  }

  return sendPushNotification({ tokens: tokenList, title, body, data });
}
