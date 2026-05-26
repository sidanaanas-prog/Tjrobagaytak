import { Router, type IRouter } from "express";
import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { sendNotification as sendFirebaseNotification } from "../lib/notifications";

const router: IRouter = Router();

// ── حفظ Push Token ─────────────────────────────────────────
router.post("/push-tokens", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { token, platform = "unknown" } = req.body;

  if (!token) {
    res.status(400).json({ error: "token مطلوب" });
    return;
  }

  await db.insert(pushTokensTable)
    .values({ userId, token, platform })
    .onConflictDoNothing();

  // تحديث pushToken في usersTable أيضاً (للتوافقية)
  await db.update(usersTable).set({ pushToken: token }).where(eq(usersTable.id, userId));

  res.json({ success: true });
});

// ── حذف Push Token ─────────────────────────────────────────
router.delete("/push-tokens", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ error: "token مطلوب" });
    return;
  }

  await db.delete(pushTokensTable).where(
    and(eq(pushTokensTable.userId, userId), eq(pushTokensTable.token, token))
  );

  res.json({ success: true });
});

// ── إرسال إشعار عبر API (للاختبار أو من طرف Admin) ──────────────
router.post("/send-notification", authenticate, async (req, res): Promise<void> => {
  const { userId, title, body, data } = req.body;

  if (!userId || !title || !body) {
    res.status(400).json({ error: "userId, title, body مطلوبة" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.pushToken) {
    res.status(400).json({ error: "المستخدم لا يملك push token" });
    return;
  }

  try {
    await sendFirebaseNotification({
      fcmToken: user.pushToken,
      title,
      body,
      data: data ?? {},
    });
    res.json({ success: true, provider: "firebase" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إشعار تجريبي للمستخدم الحالي ────────────────────────────
router.post("/test-notification", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;

    // جلب كل tokens للمستخدم
    const tokens = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));

    if (tokens.length === 0) {
      res.json({ success: false, recipients: 0, oneSignalResponse: { recipients: 0 }, message: "لا يوجد token مسجّل — ثبّت التطبيق ومنح صلاحية الإشعارات" });
      return;
    }

    let sent = 0;
    for (const { token } of tokens) {
      try {
        await sendFirebaseNotification({
          fcmToken: token,
          title: "اختبار الإشعارات 🔔",
          body: "تم إرسال هذا الإشعار بنجاح من تطبيق Gaytak",
          data: { type: "test" },
        });
        sent++;
      } catch {}
    }

    res.json({ success: sent > 0, recipients: sent, oneSignalResponse: { recipients: sent } });
  } catch (e: any) {
    req.log.error({ err: e }, "POST /test-notification failed");
    res.status(500).json({ error: e.message });
  }
});

export default router;
