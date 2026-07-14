import { Router, type IRouter } from "express";
import { db, subscriptionsTable, usersTable, activityTable, driverProfilesTable } from "@workspace/db";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, requireAdmin } from "../lib/auth";
import { notifyUsers } from "../lib/notifications";

const router: IRouter = Router();

const PLANS = {
  "1month": { price: 2000, months: 1, label: "1 شهر" },
  "6months": { price: 5000, months: 6, label: "6 أشهر" },
  "12months": { price: 10000, months: 12, label: "12 شهر" },
};

// ── حالة اشتراكي الحالي ───────────────────────────────────────────────────
router.get("/subscriptions/my", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [user] = (await db.select({
      isVerified: usersTable.isVerified,
      isFree: usersTable.isFree,
      subscriptionExpiresAt: usersTable.subscriptionExpiresAt,
      trialExpiresAt: usersTable.trialExpiresAt,
    }).from(usersTable).where(eq(usersTable.id, userId))) ?? [];

    const now = new Date();
    const trialActive = user?.trialExpiresAt && new Date(user.trialExpiresAt) > now;
    const subscriptionActive = user?.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now;
    const isFree = user?.isFree || trialActive || subscriptionActive;
    const isActive = isFree;
    const isVerified = user?.isVerified || trialActive || subscriptionActive || user?.isFree;

    const rawResult2 = await db.execute(sql`
      SELECT * FROM "subscriptions" WHERE "user_id" = ${userId} ORDER BY "created_at" DESC LIMIT 1
    `);
    const userSubs2 = (rawResult2.rows ?? rawResult2 ?? []) as any[];
    const latest = userSubs2.find((r: any) => r.type === "seller");

    res.json({
      isActive,
      isFree,
      isVerified,
      expiresAt: user?.subscriptionExpiresAt ?? null,
      trialExpiresAt: user?.trialExpiresAt ?? null,
      latestRequest: latest ?? null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إنشاء طلب اشتراك جديد ────────────────────────────────────────────────
router.post("/subscriptions", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { plan, paymentMethod, paymentProofUrl, idDocumentUrl, notes, type, restaurantId } = req.body;
    const subType = type === "driver" ? "driver" : type === "restaurant" ? "restaurant" : "seller";

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
    if (paymentMethod === "ccp" && !idDocumentUrl) {
      res.status(400).json({ error: "صورة بطاقة الهوية مطلوبة للتحقق" });
      return;
    }
    if (paymentMethod === "cash" && !idDocumentUrl) {
      res.status(400).json({ error: "صورة الوثيقة مطلوبة" });
      return;
    }

    // استخدام raw SQL بدلاً من eq()+انتشار مباشر لتجنب بغ 42P02
    const rawResult = await db.execute(sql`
      SELECT * FROM "subscriptions" WHERE "user_id" = ${userId}
    `);
    const userSubs = (rawResult.rows ?? rawResult ?? []) as any[];
    const pending = userSubs.find((r: any) => r.status === "pending" && r.type === subType);
    if (pending) {
      res.status(409).json({ error: "لديك طلب اشتراك قيد المراجعة بالفعل" });
      return;
    }

    const planInfo = PLANS[plan as keyof typeof PLANS];
    const id = randomUUID();
    const now = new Date().toISOString();

    // جلب اسم المطعم إذا كان النوع restaurant
    let restName: string | null = null;
    if (subType === "restaurant" && restaurantId) {
      const restResult = await db.execute(sql`SELECT "name" FROM "restaurants" WHERE "id" = ${restaurantId} AND "owner_id" = ${userId} LIMIT 1`);
      const rests = (restResult.rows ?? restResult ?? []) as any[];
      restName = rests[0]?.name ?? null;
      if (!restName) { res.status(403).json({ error: "المطعم غير موجود أو لا تملكه" }); return; }
    }

    await db.execute(sql`
      INSERT INTO "subscriptions" ("id", "user_id", "type", "restaurant_id", "restaurant_name", "plan", "payment_method", "status", "price", "payment_proof_url", "id_document_url", "notes", "created_at")
      VALUES (${id}, ${userId}, ${subType}, ${restaurantId ?? null}, ${restName}, ${plan}, ${paymentMethod}, 'pending', ${String(planInfo.price)}, ${paymentProofUrl ?? null}, ${idDocumentUrl ?? null}, ${notes ?? null}, ${now})
    `);

    const userResult = await db.execute(sql`SELECT "name" FROM "users" WHERE "id" = ${userId} LIMIT 1`);
    const users = (userResult.rows ?? userResult ?? []) as any[];
    const user = users[0] ?? { name: null };

    const actDesc = subType === "restaurant"
      ? `طلب اشتراك مطعم (${restName ?? ""}) — ${planInfo.label} — ${paymentMethod === "ccp" ? "CCP" : "نقدي"}`
      : `طلب اشتراك جديد (${planInfo.label}) — ${paymentMethod === "ccp" ? "CCP" : "نقدي"} — ${user?.name ?? "مستخدم"}`;

    await db.execute(sql`
      INSERT INTO "activity" ("id", "type", "description", "user_id", "user_name", "created_at")
      VALUES (${randomUUID()}, 'subscription_request', ${actDesc}, ${userId}, ${user?.name ?? "مستخدم"}, ${now})
    `);

    try {
      const [admin] = (await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, "admin@gaytak.com"))) ?? [];
      if (admin?.id) {
        const notifBody = subType === "restaurant"
          ? `مطعم "${restName}" يطلب الاشتراك (${planInfo.label}) — ${paymentMethod === "ccp" ? "دفع CCP" : "دفع نقدي"}`
          : `${user?.name ?? "مستخدم"} يطلب الاشتراك (${planInfo.label}) — ${paymentMethod === "ccp" ? "دفع CCP" : "دفع نقدي"}`;
        await notifyUsers({
          userIds: [admin.id],
          title: subType === "restaurant" ? "طلب اشتراك مطعم 🍽️" : "طلب اشتراك جديد 💳",
          body: notifBody,
          data: { type: "subscription_request", subscriptionId: id },
        });
      }
    } catch {}

    res.json({ success: true, id, status: "pending" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── حالة اشتراك مطعم معين ─────────────────────────────────────────────────
router.get("/subscriptions/restaurant/:restaurantId", authenticate, async (req, res): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.id;

    // التحقق من أن المستخدم هو مالك المطعم
    const restResult = await db.execute(sql`
      SELECT "id", "name", "is_subscribed", "subscription_plan", "subscription_expires_at"
      FROM "restaurants" WHERE "id" = ${restaurantId} AND "owner_id" = ${userId} LIMIT 1
    `);
    const rests = (restResult.rows ?? restResult ?? []) as any[];
    const rest = rests[0];
    if (!rest) { res.status(403).json({ error: "المطعم غير موجود" }); return; }

    // آخر طلب اشتراك لهذا المطعم
    const subResult = await db.execute(sql`
      SELECT * FROM "subscriptions"
      WHERE "restaurant_id" = ${restaurantId} AND "user_id" = ${userId}
      ORDER BY "created_at" DESC LIMIT 1
    `);
    const subs = (subResult.rows ?? subResult ?? []) as any[];
    const latest = subs[0] ?? null;

    res.json({
      isSubscribed: rest.is_subscribed ?? false,
      subscriptionPlan: rest.subscription_plan ?? "free",
      subscriptionExpiresAt: rest.subscription_expires_at ?? null,
      latestRequest: latest,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: قائمة طلبات الاشتراك ─────────────────────────────────────────
router.get("/admin/subscriptions", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;

    const rows = (await db
      .select()
      .from(subscriptionsTable)
      .orderBy(desc(subscriptionsTable.createdAt))) ?? [];

    const filtered = status ? rows.filter((r) => r.status === status) : rows;

    const userIds = [...new Set(filtered.map((r) => r.userId))];
    const users = userIds.length > 0
      ? (await db.select({
          id: usersTable.id,
          name: usersTable.name,
          phone: usersTable.phone,
          avatar: usersTable.avatar,
          email: usersTable.email,
        }).from(usersTable).where(inArray(usersTable.id, userIds))) ?? []
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json(filtered.map((s) => ({ ...s, user: userMap[s.userId] ?? null })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: عدد الطلبات المعلقة ──────────────────────────────────────────
router.get("/admin/subscriptions/pending-count", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.status, "pending"))) ?? [];
    res.json({ count: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: تفاصيل الاشتراكات التجريبية والإحصائيات ──────────────────────────
router.get("/admin/subscriptions/trials-and-stats", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    // 1. Fetch Sellers with their trial/subscription info & stats
    const sellersResult = await db.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.avatar,
        u.is_free as "isFree",
        u.trial_expires_at as "trialExpiresAt",
        u.subscription_expires_at as "subscriptionExpiresAt",
        u.created_at as "createdAt",
        (SELECT COUNT(*)::int FROM orders o WHERE o.seller_id = u.id) as "ordersCount",
        (SELECT COUNT(*)::int FROM messages m WHERE m.sender_id = u.id) as "messagesCount"
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'seller'
      ORDER BY u.created_at DESC
    `);
    const sellers = (sellersResult.rows ?? sellersResult ?? []) as any[];

    // 2. Fetch Drivers with their trial/subscription info & stats
    const driversResult = await db.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.avatar,
        dp.is_free as "isFree",
        dp.is_subscribed as "isSubscribed",
        dp.trial_expires_at as "trialExpiresAt",
        dp.subscription_expires_at as "subscriptionExpiresAt",
        dp.total_rides as "totalRidesProfile",
        dp.vehicle_type as "vehicleType",
        dp.vehicle_model as "vehicleModel",
        dp.vehicle_plate as "vehiclePlate",
        dp.vehicle_color as "vehicleColor",
        u.created_at as "createdAt",
        (SELECT COUNT(*)::int FROM rides r WHERE r.driver_id = u.id) as "ridesCount",
        (SELECT COUNT(*)::int FROM messages m WHERE m.sender_id = u.id) as "messagesCount"
      FROM users u
      INNER JOIN driver_profiles dp ON dp.user_id = u.id
      ORDER BY u.created_at DESC
    `);
    const drivers = (driversResult.rows ?? driversResult ?? []) as any[];

    res.json({
      sellers,
      drivers
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: قبول طلب اشتراك ──────────────────────────────────────────────
router.patch("/admin/subscriptions/:id/approve", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const subId = req.params.id as string;
    const adminId = req.user!.id;

    const [sub] = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId))) ?? [];
    if (!sub) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
    if (sub.status !== "pending") { res.status(400).json({ error: "الطلب مُعالج بالفعل" }); return; }

    const planInfo = PLANS[sub.plan as keyof typeof PLANS];
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (planInfo?.months ?? 6));

    await db.update(subscriptionsTable)
      .set({ status: "approved", reviewedAt: new Date(), reviewedBy: adminId, expiresAt })
      .where(eq(subscriptionsTable.id, subId));

    // تحديث حسب نوع الاشتراك
    if (sub.type === "restaurant") {
      // تفعيل اشتراك المطعم مباشرةً
      const rawSub = sub as any;
      if (rawSub.restaurant_id) {
        await db.execute(sql`
          UPDATE "restaurants"
          SET "is_subscribed" = true,
              "subscription_plan" = ${sub.plan},
              "subscription_expires_at" = ${expiresAt.toISOString()},
              "updated_at" = ${new Date().toISOString()}
          WHERE "id" = ${rawSub.restaurant_id}
        `);
      }
    } else if (sub.type !== "driver") {
      // بائع عادي
      await db.update(usersTable)
        .set({ isVerified: true, subscriptionExpiresAt: expiresAt })
        .where(eq(usersTable.id, sub.userId));
    }

    // إذا كان اشتراك سائق حدّث أو أنشئ ملف السائق + وثّق الوثائق
    if (sub.type === "driver") {
      const [driverProfile] = (await db.select().from(driverProfilesTable).where(eq(driverProfilesTable.userId, sub.userId))) ?? [];
      if (driverProfile) {
        await db.update(driverProfilesTable)
          .set({
            isSubscribed: true,
            subscriptionExpiresAt: expiresAt,
            documentsStatus: "verified",
            licenseVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(driverProfilesTable.userId, sub.userId));
      } else {
        await db.insert(driverProfilesTable).values({
          id: randomUUID(),
          userId: sub.userId,
          isSubscribed: true,
          subscriptionExpiresAt: expiresAt,
          documentsStatus: "verified",
          licenseVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "subscription_approved",
      description: `تم قبول اشتراك المستخدم — ${planInfo?.label ?? sub.plan}`,
      userId: sub.userId,
      userName: "Admin",
    });

    try {
      const [user] = (await db.select({ name: usersTable.name })
        .from(usersTable).where(eq(usersTable.id, sub.userId))) ?? [];
      const rawSub = sub as any;
      const notifBody = sub.type === "restaurant"
        ? `مبروك! اشتراك مطعم "${rawSub.restaurant_name ?? ""}" تم قبوله — المطعم الآن مشترك ✅`
        : `مبروك ${user?.name ?? ""}! اشتراكك تم قبوله — شارة التوثيق ✅ ستظهر على جميع منتجاتك ومحتواك. ابدأ البيع الآن!`;
      await notifyUsers({
        userIds: [sub.userId],
        title: sub.type === "restaurant" ? "🎉 تم قبول اشتراك مطعمك!" : "🎉 تهانينا! حسابك موثّق الآن",
        body: notifBody,
        data: { type: "subscription_approved" },
      });
    } catch {}

    res.json({ success: true, expiresAt });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: رفض طلب اشتراك ────────────────────────────────────────────────
router.patch("/admin/subscriptions/:id/reject", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const subId = req.params.id as string;
    const adminId = req.user!.id;
    const { reason, notes: notesBody } = req.body;
    const rejectNotes = reason ?? notesBody ?? null;

    const [sub] = (await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subId))) ?? [];
    if (!sub) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
    if (sub.status !== "pending") { res.status(400).json({ error: "الطلب مُعالج بالفعل" }); return; }

    await db.update(subscriptionsTable)
      .set({ status: "rejected", reviewedAt: new Date(), reviewedBy: adminId, notes: rejectNotes ?? sub.notes })
      .where(eq(subscriptionsTable.id, subId));

    try {
      await notifyUsers({
        userIds: [sub.userId],
        title: "تحديث طلب اشتراكك",
        body: "للأسف لم يتم قبول طلب اشتراكك. يمكنك التواصل مع الدعم لمزيد من التفاصيل.",
        data: { type: "subscription_rejected" },
      });
    } catch {}

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تفعيل تجربة مجانية 7 أيام ──────────────────────────────────────────
router.post("/subscriptions/trial", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [user] = (await db.select({ trialExpiresAt: usersTable.trialExpiresAt })
      .from(usersTable).where(eq(usersTable.id, userId))) ?? [];

    // إذا كان لديه تجربة نشطة، لا تعيد التفعيل
    if (user?.trialExpiresAt && new Date(user.trialExpiresAt) > now) {
      res.status(400).json({ error: "لديك تجربة مجانية نشطة بالفعل" });
      return;
    }

    await db.update(usersTable)
      .set({ trialExpiresAt: trialExpiry })
      .where(eq(usersTable.id, userId));

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "trial_activated",
      description: "تم تفعيل التجربة المجانية (7 أيام)",
      userId,
      userName: "User",
    });

    res.json({
      success: true,
      message: "🎉 مبروك! تم تفعيل التجربة المجانية 7 أيام",
      trialExpiresAt: trialExpiry.toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// —— البائع: رفع وثيقة هوية + تفعيل التجربة المجانية ——
router.post("/seller/documents", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { idDocumentUrl } = req.body;
    if (!idDocumentUrl) {
      res.status(400).json({ error: "صورة بطاقة الهوية مطلوبة" });
      return;
    }

    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // حفظ الوثيقة وتفعيل التجربة
    await db.update(usersTable)
      .set({ sellerIdDocument: idDocumentUrl, trialExpiresAt: trialExpiry })
      .where(eq(usersTable.id, userId));

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "trial_activated",
      description: "تم تفعيل التجربة المجانية (7 أيام) للبائع",
      userId,
      userName: "User",
    });

    res.json({
      success: true,
      message: "🎉 مبروك! تم تفعيل التجربة المجانية 7 أيام",
      trialExpiresAt: trialExpiry.toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
export default router;
