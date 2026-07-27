import admin from "firebase-admin";
import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// ── تهيئة Firebase Admin (مرة واحدة فقط) ─────────────────────────────────
function cleanPrivateKey(key: string): string {
  if (!key) return "";
  
  let cleaned = key.trim();
  
  // Remove surrounding quotes if any
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Replace escaped newlines with actual newlines
  cleaned = cleaned.replace(/\\n/g, "\n");
  
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  
  // If it's single-line (has spaces instead of newlines)
  if (!cleaned.includes("\n")) {
    if (cleaned.startsWith(header) && cleaned.endsWith(footer)) {
      let body = cleaned.substring(header.length, cleaned.length - footer.length).trim();
      // Remove all spaces in base64 body
      body = body.replace(/\s+/g, "");
      
      // Chunk body every 64 chars
      const chunks: string[] = [];
      for (let i = 0; i < body.length; i += 64) {
        chunks.push(body.substring(i, i + 64));
      }
      cleaned = `${header}\n${chunks.join("\n")}\n${footer}`;
    }
  } else {
    // If it contains newlines, make sure it is formatted cleanly
    const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
    let bodyLines: string[] = [];
    
    for (let line of lines) {
      if (line.includes(header)) continue;
      if (line.includes(footer)) continue;
      bodyLines.push(line.replace(/\s+/g, ""));
    }
    
    const body = bodyLines.join("");
    const chunks: string[] = [];
    for (let i = 0; i < body.length; i += 64) {
      chunks.push(body.substring(i, i + 64));
    }
    cleaned = `${header}\n${chunks.join("\n")}\n${footer}`;
  }
  
  return cleaned;
}

function getApp(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const projectId   = process.env.FIREBASE_PROJECT_ID   ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
  const rawKey      = process.env.FIREBASE_PRIVATE_KEY  ?? "";
  const privateKey  = cleanPrivateKey(rawKey);

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[FCM] ⚠️ بيانات Firebase Admin غير مكتملة");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

// رموز الخطأ التي تعني أن الـ token منتهي أو غير صالح → نحذفه من DB
const STALE_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/unregistered",
]);

async function cleanBadToken(token: string) {
  await db.delete(pushTokensTable).where(eq(pushTokensTable.token, token)).catch(() => {});
  await db.update(usersTable).set({ pushToken: null }).where(eq(usersTable.pushToken, token)).catch(() => {});
}

// بناء رابط مطلق من الدومين المتاح
function absoluteLink(path: string): string {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const base = domains[0] ? `https://${domains[0]}` : "";
  return base ? `${base}${path}` : "";   // string فارغ → لا نُرسل fcmOptions
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
    const isRideAlert = !!(data?.type && (data.type === "new_ride" || data.type === "price_update" || data.type.includes("ride")));
    const link = absoluteLink(isRideAlert ? "/rides" : "/");

    // تحويل جميع القيم في الـ data لتكون نصوصًا (string) لضمان توافقية مكتبة Firebase FCM وعدم إلقاء استثناءات
    const stringData: Record<string, string> = {};
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) {
          stringData[k] = String(v);
        }
      }
    }

    console.log(`[FCM] محاولة إرسال إشعار إلى الرمز: ${fcmToken.slice(0, 15)}... | العنوان: "${title}"`);

    await admin.messaging().send({
      token: fcmToken,
      // كائن notification على المستوى الأعلى ضروري لاستقبال الهواتف والمتصفحات الإشعارات مباشرة في الخلفية
      notification: {
        title,
        body,
      },
      data: {
        ...stringData,
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
          sound: isRideAlert ? "alert.mp3" : "default",
          notificationPriority: isRideAlert ? "PRIORITY_MAX" : "PRIORITY_DEFAULT",
          // تفعيل العرض على شاشة القفل كشاشة كاملة (مكالمة واردة)
          ...(isRideAlert ? {
            visibility: "public",   // يظهر المحتوى كاملاً على شاشة القفل
            defaultVibrateTimings: false,
            vibrateTimingsMillis: [0, 200, 100, 200, 100, 500, 100, 500],
            tag: "incoming_ride",   // يمنع تراكم إشعارات متعددة
          } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: isRideAlert ? "alert.mp3" : "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title,
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          dir: "rtl",
          lang: "ar",
          ...(isRideAlert ? {
            tag: "ride_alert",
            requireInteraction: true,
            actions: [
              { action: "accept", title: "قبول" },
              { action: "decline", title: "رفض" },
            ],
          } : {
            tag: "default",
          }),
        },
        ...(link ? { fcmOptions: { link } } : {}),
      },
    });
    console.log(`[FCM] تم إرسال الإشعار بنجاح إلى: ${fcmToken.slice(0, 15)}...`);
  } catch (err: any) {
    const code: string = err?.code ?? "";
    console.error("[FCM] sendNotification error:", code, err?.message ?? err);
    if (STALE_TOKEN_CODES.has(code)) {
      await cleanBadToken(fcmToken);
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

  const isRideAlert = !!(data?.type && (data.type === "new_ride" || data.type === "price_update" || data.type.includes("ride")));
  const link = absoluteLink(isRideAlert ? "/rides" : "/");

  // تحويل جميع القيم في الـ data لتكون نصوصًا (string) لضمان توافقية مكتبة Firebase FCM وعدم إلقاء استثناءات
  const stringData: Record<string, string> = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== null) {
        stringData[k] = String(v);
      }
    }
  }

  console.log(`[FCM] محاولة إرسال إشعارات جماعية لعدد ${clean.length} رمز... | العنوان: "${title}"`);

  const results = await admin.messaging().sendEach(
    clean.map((token) => ({
      token,
      notification: {
        title,
        body,
      },
      data: {
        ...stringData,
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
          sound: isRideAlert ? "alert.mp3" : "default",
          notificationPriority: isRideAlert ? "PRIORITY_MAX" : "PRIORITY_DEFAULT",
          // تفعيل العرض على شاشة القفل كشاشة كاملة (مكالمة واردة)
          ...(isRideAlert ? {
            visibility: "public",
            defaultVibrateTimings: false,
            vibrateTimingsMillis: [0, 200, 100, 200, 100, 500, 100, 500],
            tag: "incoming_ride",
          } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: isRideAlert ? "alert.mp3" : "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title,
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          dir: "rtl",
          lang: "ar",
          ...(isRideAlert ? {
            tag: "ride_alert",
            requireInteraction: true,
            actions: [
              { action: "accept", title: "قبول" },
              { action: "decline", title: "رفض" },
            ],
          } : {
            tag: "default",
          }),
        },
        ...(link ? { fcmOptions: { link } } : {}),
      },
    }))
  );

  const badTokens: string[] = [];
  for (let i = 0; i < results.responses.length; i++) {
    const r = results.responses[i];
    if (!r.success) {
      const code: string = r.error?.code ?? "";
      console.warn("[FCM] فشل للـ token:", clean[i]?.slice(0, 20), "| code:", code);
      if (STALE_TOKEN_CODES.has(code)) {
        badTokens.push(clean[i]!);
      }
    }
  }

  // تنظيف الـ tokens الفاسدة دفعة واحدة
  for (const bad of badTokens) {
    await cleanBadToken(bad).catch(() => {});
  }

  if (results.failureCount > 0) {
    console.warn(`[FCM] ${results.failureCount} فشل من أصل ${clean.length} | تم حذف ${badTokens.length} token فاسد`);
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
