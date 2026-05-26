import { Router, type IRouter } from "express";
import { db, usersTable, productsTable, activityTable, conversationsTable, messagesTable } from "@workspace/db";
import { eq, ilike, or, sql, count, and, inArray } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect, productCount = 0) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatar: user.avatar,
    role: user.role,
    banned: user.banned,
    createdAt: user.createdAt.toISOString(),
    productCount,
  };
}

router.get("/users", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? 1), 10);
  const limit = parseInt(String(req.query.limit ?? 20), 10);
  const search = String(req.query.search ?? "");
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`)));
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(conditions.length > 0 ? conditions[0] : undefined);

  const users = await db
    .select()
    .from(usersTable)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .limit(limit)
    .offset(offset)
    .orderBy(usersTable.createdAt);

  const productCounts = await db
    .select({ sellerId: productsTable.sellerId, cnt: count() })
    .from(productsTable)
    .groupBy(productsTable.sellerId);

  const countMap = Object.fromEntries(productCounts.map((p) => [p.sellerId, Number(p.cnt)]));

  res.json({
    users: users.map((u) => formatUser(u, countMap[u.id] ?? 0)),
    total: Number(total),
    page,
    limit,
  });
});

// ── بحث عن البائعين (عام) ────────────────────────────────────
router.get("/sellers", async (req, res): Promise<void> => {
  const search = String(req.query.search ?? "").trim();
  const page = Math.max(1, parseInt(String(req.query.page ?? 1), 10));
  const limit = Math.min(30, parseInt(String(req.query.limit ?? 20), 10));
  const offset = (page - 1) * limit;

  const sellerIds = await db
    .selectDistinct({ sellerId: productsTable.sellerId })
    .from(productsTable)
    .where(eq(productsTable.status, "active"));

  const ids = sellerIds.map(r => r.sellerId);
  if (!ids.length) { res.json({ sellers: [], total: 0, page, limit }); return; }

  const conditions = [inArray(usersTable.id, ids), eq(usersTable.banned, false)];
  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));

  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(and(...conditions));

  const users = await db
    .select()
    .from(usersTable)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)
    .orderBy(usersTable.name);

  const productCounts = ids.length
    ? await db.select({ sellerId: productsTable.sellerId, cnt: count() })
        .from(productsTable)
        .where(and(inArray(productsTable.sellerId, ids), eq(productsTable.status, "active")))
        .groupBy(productsTable.sellerId)
    : [];

  const countMap = Object.fromEntries(productCounts.map(p => [p.sellerId, Number(p.cnt)]));

  res.json({
    sellers: users.map(u => formatUser(u, countMap[u.id] ?? 0)),
    total: Number(total),
    page,
    limit,
  });
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id as string));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [{ cnt }] = await db.select({ cnt: count() }).from(productsTable).where(eq(productsTable.sellerId, id));
  res.json(formatUser(user, Number(cnt)));
});

router.patch("/users/:id", authenticate, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (req.user!.id !== id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { name, avatar, role, pushToken } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name) updates.name = name;
  if (avatar !== undefined) updates.avatar = avatar;
  if (pushToken !== undefined) updates.pushToken = pushToken;
  if (role && req.user!.role === "admin") updates.role = role;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id as string)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

router.delete("/users/me", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ message: "Account deleted successfully" });
});

router.delete("/users/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id as string)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ message: "User deleted" });
});

router.post("/users/:id/ban", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { banned } = req.body;
  const [user] = await db.update(usersTable).set({ banned: !!banned }).where(eq(usersTable.id, id as string)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: banned ? "user_banned" : "user_unbanned",
    description: `${user.name} was ${banned ? "banned" : "unbanned"} by admin`,
    userId: user.id,
    userName: user.name,
  });

  res.json(formatUser(user));
});

// ── اختبار إشعار OneSignal للمستخدم الحالي ────────────────────────────────
router.post("/test-notification", authenticate, async (req, res) => {
  const userId = req.user!.id;
  console.log(`[Test] إرسال إشعار FCM تجريبي للمستخدم: ${userId}`);

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user?.pushToken) {
      res.status(400).json({ error: "لا يوجد FCM Token — افتح التطبيق أولاً لتسجيل الجهاز" });
      return;
    }

    await sendNotification({
      fcmToken: user.pushToken,
      title: "اختبار Gaytak 🔔",
      body: "الإشعارات تعمل بنجاح! ✅",
    });

    res.json({ success: true, message: "تم إرسال الإشعار", token: user.pushToken.slice(0, 20) + "..." });
  } catch (err: any) {
    console.error("[Test] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── إرسال رسالة مباشرة من الأدمن لمستخدم محدد ──────────────
router.post("/admin/users/:userId/message", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.user!.id;
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { message } = req.body;

  if (!message?.trim()) {
    res.status(400).json({ error: "الرسالة مطلوبة" });
    return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId as string));
  if (!targetUser) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        and(eq(conversationsTable.participant1Id, adminId), eq(conversationsTable.participant2Id, userId as string)),
        and(eq(conversationsTable.participant1Id, userId as string), eq(conversationsTable.participant2Id, adminId))
      )
    );

  let convId: string;
  if (existing) {
    convId = existing.id;
  } else {
    convId = randomUUID();
    await db.insert(conversationsTable).values({
      id: convId,
      participant1Id: adminId,
      participant2Id: userId as string,
      updatedAt: new Date(),
    });
  }

  await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId: convId,
    senderId: adminId,
    content: message.trim(),
  });

  await db.update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  if (targetUser.pushToken) {
    sendNotification({
      fcmToken: targetUser.pushToken,
      title: "رسالة جديدة من دعم Gaytak 📩",
      body: message.trim().slice(0, 80),
      data: { type: "direct_message", conversationId: convId },
    }).catch(() => {});
  }

  res.json({ success: true, conversationId: convId });
});

// ── ping: تحديث lastSeenAt + حساب السلسلة اليومية ──────────────
router.post("/users/ping", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const lastDate = user.streakLastDate; // string "YYYY-MM-DD" or null
  let streakCount = user.streakCount;

  if (!lastDate) {
    streakCount = 1;
  } else if (lastDate === todayStr) {
    // نفس اليوم — لا تغيير
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (lastDate === yesterdayStr) {
      streakCount += 1;
    } else {
      streakCount = 1;
    }
  }

  await db.update(usersTable).set({
    lastSeenAt: now,
    streakCount,
    streakLastDate: todayStr,
  }).where(eq(usersTable.id, userId));

  res.json({ streakCount, streakLastDate: todayStr });
});

export default router;
