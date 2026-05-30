import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const FCM_URL = "https://fcm.googleapis.com/fcm/send";

function getServerKey(): string {
  const key = process.env.FIREBASE_SERVER_KEY ?? "";
  if (!key) console.warn("[FCM] ⚠️ FIREBASE_SERVER_KEY غير مضبوط");
  return key;
}

async function fcmSend(payload: object): Promise<void> {
  const key = getServerKey();
  if (!key) return;

  const res = await fetch(FCM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[FCM] HTTP ${res.status}:`, text);
    return;
  }

  const json = (await res.json()) as { success?: number; failure?: number; results?: { error?: string }[] };
  if (json.failure && json.failure > 0) {
    console.warn("[FCM] فشل إرسال بعض الإشعارات:", json.failure, "من", (json.success ?? 0) + json.failure);
  }

  if (json.results) {
    const tokens = (payload as { registration_ids?: string[]; to?: string }).registration_ids
      ?? [(payload as { to?: string }).to ?? ""];
    for (let i = 0; i < json.results.length; i++) {
      const err = json.results[i]?.error;
      if (err === "NotRegistered" || err === "InvalidRegistration") {
        const badToken = tokens[i];
        if (badToken) {
          await db.delete(pushTokensTable).where(eq(pushTokensTable.token, badToken)).catch(() => {});
          await db.update(usersTable).set({ pushToken: null }).where(eq(usersTable.pushToken, badToken)).catch(() => {});
        }
      }
    }
  }
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
  if (!fcmToken) return;
  await fcmSend({
    to: fcmToken,
    notification: { title, body, sound: "default" },
    data: data ?? {},
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default", badge: 1 } } },
  });
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
  const clean = tokens.filter((t) => t?.trim());
  if (clean.length === 0) return;

  if (clean.length === 1) {
    await sendNotification({ fcmToken: clean[0], title, body, data });
    return;
  }

  await fcmSend({
    registration_ids: clean,
    notification: { title, body, sound: "default" },
    data: data ?? {},
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default", badge: 1 } } },
  });
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
