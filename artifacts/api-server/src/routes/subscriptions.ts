import { Router, type IRouter } from "express";
import { db, subscriptionsTable, usersTable, activityTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, requireAdmin } from "../lib/auth";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

const PLANS = {
  "6months": { price: 5000, months: 6, label: "6 أشهر" },
  "12months": { price: 10000, months: 12, label: "12 شهر" },
};

// ── حالة اشتراكي الحالي ───────────────────────────────────────────────────
router.get("/subscriptions/my", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [user] = await db.select({
    isVerified: usersTable.isVerified,
    subscriptionExpiresAt: usersTable.subscriptionExpiresAt,
  }).from(usersTable).where(eq(usersTable.id, userId));

  const now = new Date();
  const isActive = !!(user?.isVerified && user.subscriptionExpiresAt && user.subscriptionExpiresAt > now);

  const [latest] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  res.json({
    isActive,
    isVerified: user?.isVerified ?? false,
    expiresAt: user?.subscriptionExpiresAt ?? null,
    latestRequest: latest ?? null,
  });
});

// ── إنشاء طلب اشتراك جديد ────────────────────────────────────────────────
router.post("/subscriptions", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { plan, paymentMethod, paymentProofUrl, idDocumentUrl, notes } = req.body;

  if (!plan || !PLANS[plan as keyof typeof PLANS]) {
    res.status(400).json({ error: "الخطة غير صالحة" });
    return;
  }
  if (!["ccp", "cash"].includes(paymentMethod)) {
    res.status(400).json({ error: "طريقة الدفع غير صالحة" });
    return;
  }
  if (paymentMethod === "ccp" && !paymentProofUrl) {
    res.status(400).json({ error: "صورة وصل الدفع مطلوبة" });
    return;
  }
  if (paymentMethod === "cash" && !idDocumentUrl) {
    res.status(400).json({ error: "صورة الوثيقة مطلوبة" });
    return;
  }

  // تحقق من عدم وجود طلب معلق
  const [pending] = await db.select().from(subscriptionsTable).where(
    and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.status, "pending"))
  );
  if (pending) {
    res.status(409).json({ error: "لديك طلب اشتراك قيد المراجعة بالفعل" });
    return;
  }

  const planInfo = PLANS[plan as keyof typeof PLANS];
  const id = randomUUID();

  await db.insert(subscriptionsTable).values({
    id,
    userId,
    plan,
    paymentMethod,
    status: "pending",
    price: String(planInfo.price),
    paymentProofUrl: paymentProofUrl ?? null,
    idDocumentUrl: idDocumentUrl ?? null,
    notes: notes ?? null,
    createdAt: new Date(),
  });

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  // تسجيل نشاط
  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "subscription_request",
    description: `طلب اشتراك جديد (${planInfo.label}) — ${paymentMethod === "ccp" ? "CCP" : "نقدي"} — ${user?.name ?? "مستخدم"}`,
    userId,
    userName: user?.name ?? "مستخدم",
  });

  // إشعار للأدمن (admin@gaytak.com)
  try {
    const [admin] = await db.select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(eq(usersTable.email, "admin@gaytak.com"));
    if (admin?.pushToken) {
      await sendNotification({
        fcmToken: admin.pushToken,
        title: "طلب اشتراك جديد 💳",
        body: `${user?.name ?? "مستخدم"} يطلب الاشتراك (${planInfo.label}) — ${paymentMethod === "ccp" ? "دفع CCP" : "دفع نقدي"}`,
        data: { type: "subscription_request", subscriptionId: id },
      });
    }
  } catch {}

  res.json({ success: true, id, status: "pending" });
});

// ── الأدمن: قائمة طلبات الاشتراك ─────────────────────────────────────────
router.get("/admin/subscriptions", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;

  const rows = await db
    .select()
    .from(subscriptionsTable)
    .orderBy(desc(subscriptionsTable.createdAt));

  const filtered = status ? rows.filter((r) => r.status === status) : rows;

  const userIds = [...new Set(filtered.map((r) => r.userId))];
  const users = userIds.length > 0
    ? await db.select({
        id: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        avatar: usersTable.avatar,
        email: usersTable.email,
      }).from(usersTable)
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  res.json(filtered.map((s) => ({ ...s, user: userMap[s.userId] ?? null })));
});

// ── الأدمن: عدد الطلبات المعلقة ──────────────────────────────────────────
router.get("/admin/subscriptions/pending-count", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "pending"));
  res.json({ count: rows.length });
});

// ── الأدمن: قبول طلب اشتراك ──────────────────────────────────────────────
router.patch("/admin/subscriptions/:id/approve", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const subId = req.params.id as string;
  const adminId = req.user!.id;

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  if (!sub) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  if (sub.status !== "pending") { res.status(400).json({ error: "الطلب مُعالج بالفعل" }); return; }

  const planInfo = PLANS[sub.plan as keyof typeof PLANS];
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (planInfo?.months ?? 6));

  await db.update(subscriptionsTable)
    .set({ status: "approved", reviewedAt: new Date(), reviewedBy: adminId, expiresAt })
    .where(eq(subscriptionsTable.id, subId));

  await db.update(usersTable)
    .set({ isVerified: true, subscriptionExpiresAt: expiresAt })
    .where(eq(usersTable.id, sub.userId));

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "subscription_approved",
    description: `تم قبول اشتراك المستخدم — ${planInfo?.label ?? sub.plan}`,
    userId: sub.userId,
    userName: "Admin",
  });

  // إشعار للمستخدم
  try {
    const [user] = await db.select({ pushToken: usersTable.pushToken, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, sub.userId));
    if (user?.pushToken) {
      await sendNotification({
        fcmToken: user.pushToken,
        title: "تم قبول اشتراكك! 🎉",
        body: `مبروك ${user.name}! حسابك موثّق الآن ويمكنك نشر منتجاتك وفيديوهاتك`,
        data: { type: "subscription_approved" },
      });
    }
  } catch {}

  res.json({ success: true, expiresAt });
});

// ── الأدمن: رفض طلب اشتراك ────────────────────────────────────────────────
router.patch("/admin/subscriptions/:id/reject", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const subId = req.params.id as string;
  const adminId = req.user!.id;
  const { reason } = req.body;

  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId));
  if (!sub) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  if (sub.status !== "pending") { res.status(400).json({ error: "الطلب مُعالج بالفعل" }); return; }

  await db.update(subscriptionsTable)
    .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: adminId, notes: reason ?? sub.notes })
    .where(eq(subscriptionsTable.id, subId));

  // إشعار للمستخدم
  try {
    const [user] = await db.select({ pushToken: usersTable.pushToken, name: usersTable.name })
      .from(usersTable).where(eq(usersTable.id, sub.userId));
    if (user?.pushToken) {
      await sendNotification({
        fcmToken: user.pushToken,
        title: "تحديث طلب اشتراكك",
        body: "للأسف لم يتم قبول طلب اشتراكك. يمكنك التواصل مع الدعم لمزيد من التفاصيل.",
        data: { type: "subscription_rejected" },
      });
    }
  } catch {}

  res.json({ success: true });
});

export default router;
