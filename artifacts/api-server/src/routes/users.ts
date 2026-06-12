import { Router, type IRouter } from "express";
import { db, usersTable, productsTable, activityTable, conversationsTable, messagesTable, ordersTable, wishlistsTable, followsTable, postsTable, postLikesTable, postCommentsTable, postViewsTable, storiesTable, storyViewsTable, storyLikesTable, pushTokensTable, userRolesTable, subscriptionsTable, reportsTable, blocksTable, driverProfilesTable, ridesTable, promotionsTable, flashSalesTable, broadcastsTable, typingIndicatorsTable } from "@workspace/db";
import { eq, ilike, or, sql, count, and, inArray } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

// ── حذف مستخدم مع جميع مرتبطاته (تجنب خطأ Foreign Key) ───────────────
async function deleteUserWithRelations(userId: string): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      // 1. حذف المنتجات (orders مرتبطة بها → نحذف orders أولاً)
      const userProducts = await tx.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.sellerId, userId));
      const productIds = userProducts.map((p) => p.id);
      if (productIds.length > 0) {
        await tx.delete(ordersTable).where(inArray(ordersTable.productId, productIds));
        await tx.delete(wishlistsTable).where(inArray(wishlistsTable.productId, productIds));
      }
      // 2. حذف الطلبات (buyer أو seller)
      await tx.delete(ordersTable).where(or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId)));
      // 3. حذف الرسائل والمحادثات
      await tx.delete(messagesTable).where(eq(messagesTable.senderId, userId));
      const convs = await tx.select({ id: conversationsTable.id }).from(conversationsTable).where(or(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, userId)));
      const convIds = convs.map((c) => c.id);
      if (convIds.length > 0) {
        await tx.delete(messagesTable).where(inArray(messagesTable.conversationId, convIds));
        await tx.delete(conversationsTable).where(inArray(conversationsTable.id, convIds));
      }
      // 4. حذف الرحلات
      await tx.delete(ridesTable).where(or(eq(ridesTable.passengerId, userId), eq(ridesTable.driverId, userId)));
      // 5. حذف المتابعات
      await tx.delete(followsTable).where(or(eq(followsTable.followerId, userId), eq(followsTable.sellerId, userId)));
      // 6. حذف المنشورات والتفاعلات
      await tx.delete(postLikesTable).where(eq(postLikesTable.userId, userId));
      await tx.delete(postCommentsTable).where(eq(postCommentsTable.userId, userId));
      await tx.delete(postViewsTable).where(eq(postViewsTable.userId, userId));
      await tx.delete(postsTable).where(eq(postsTable.userId, userId));
      // 7. حذف الحالات والتفاعلات
      await tx.delete(storyViewsTable).where(eq(storyViewsTable.viewerId, userId));
      await tx.delete(storyLikesTable).where(eq(storyLikesTable.userId, userId));
      await tx.delete(storiesTable).where(eq(storiesTable.userId, userId));
      // 8. حذف المنتجات
      await tx.delete(productsTable).where(eq(productsTable.sellerId, userId));
      // 9. حذف الوش ليست
      await tx.delete(wishlistsTable).where(eq(wishlistsTable.userId, userId));
      // 10. حذف التقييمات
      await tx.delete(reportsTable).where(or(eq(reportsTable.reporterId, userId), eq(reportsTable.reportedId, userId)));
      // 11. حذف الحظر
      await tx.delete(blocksTable).where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)));
      // 12. حذف الاشتراكات
      await tx.delete(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
      // 13. حذف أدوار المستخدم
      await tx.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
      // 14. حذف توكنات الإشعارات
      await tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
      // 15. حذف الكتابة
      await tx.delete(typingIndicatorsTable).where(eq(typingIndicatorsTable.userId, userId));
      // 16. حذف البثوث
      await tx.delete(broadcastsTable).where(eq(broadcastsTable.adminId, userId));
      // 17. حذف بروفايل السائق
      await tx.delete(driverProfilesTable).where(eq(driverProfilesTable.userId, userId));
      // 18. أخيراً حذف المستخدم
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });
    return true;
  } catch (err: any) {
    console.error("[deleteUser] error:", err?.message ?? err);
    return false;
  }
}

function formatUser(user: typeof usersTable.$inferSelect, productCount = 0) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatar: user.avatar,
    role: user.role,
    banned: user.banned,
    isVerified: user.isVerified,
    subscriptionExpiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    productCount,
  };
}

router.get("/users", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
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
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id as string));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [{ cnt }] = await db.select({ cnt: count() }).from(productsTable).where(eq(productsTable.sellerId, id));
    res.json(formatUser(user, Number(cnt)));
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.patch("/users/:id", authenticate, async (req, res): Promise<void> => {
  try {
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

    await db.update(usersTable).set(updates).where(eq(usersTable.id, id as string));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id as string));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/users/me", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ok = await deleteUserWithRelations(userId);
    if (!ok) {
      res.status(500).json({ error: "تعذر حذف الحساب — المستخدم لديه مرتبطات لا يمكن حذفها" });
      return;
    }
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.delete("/users/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ok = await deleteUserWithRelations(id as string);
    if (!ok) {
      res.status(500).json({ error: "تعذر حذف المستخدم — لديه مرتبطات لا يمكن حذفها" });
      return;
    }
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── أدمن: إعادة تفعيل متجر معلّق (انتهاء اشتراك) ──────────────────────────────
router.post("/admin/users/:id/reactivate", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { months = 6 } = req.body;
    const monthsNum = Math.min(Math.max(parseInt(String(months), 10) || 6, 1), 24);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id as string));
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + monthsNum);

    await db.update(usersTable)
      .set({ isVerified: true, subscriptionExpiresAt: expiresAt })
      .where(eq(usersTable.id, id as string));

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "subscription_reactivated",
      description: `تم إعادة تفعيل المتجر ${user.name} (${monthsNum} أشهر) — بواسطة الأدمن`,
      userId: id,
      userName: user.name,
    });

    // إشعار للمستخدم
    try {
      if (user.pushToken) {
        await sendNotification({
          fcmToken: user.pushToken,
          title: "🎉 تم إعادة تفعيل حسابك",
          body: `تم تفعيل اشتراكك لمدة ${monthsNum} أشهر. ابدأ البيع الآن!`,
          data: { type: "subscription_reactivated" },
        });
      }
    } catch {}

    const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id as string));
    res.json({ success: true, expiresAt: expiresAt.toISOString(), user: formatUser(updated) });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/users/:id/ban", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { banned } = req.body;
    await db.update(usersTable).set({ banned: !!banned }).where(eq(usersTable.id, id as string));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id as string));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: banned ? "user_banned" : "user_unbanned",
      description: `${user.name} was ${banned ? "banned" : "unbanned"} by admin`,
      userId: id,
      userName: user.name,
    });

    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
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
  try {
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
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

// ── ping: تحديث lastSeenAt + حساب السلسلة اليومية ──────────────
router.post("/users/ping", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "المستخدم غير موجود" });
      return;
    }

    const lastDate = user.streakLastDate;
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
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

export default router;
