import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db, usersTable, productsTable, conversationsTable, messagesTable, activityTable, ordersTable, broadcastsTable, ridesTable, driverProfilesTable } from "@workspace/db";
import { count, eq, and, or, ne, gte, sql, desc, inArray, isNotNull } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth";
import { notifyUsers, sendNotification } from "../lib/notifications";

// إرسال إشعار لمستخدم واحد من users.pushToken (نفس أسلوب الدردشة)
async function pushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const [u] = await db
    .select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (u?.pushToken) {
    try {
      await sendNotification({ fcmToken: u.pushToken, title, body, data: data ?? {} });
    } catch (e: any) {
      console.warn("[FCM] admin pushToUser failed:", e?.message);
    }
  } else {
    console.warn("[FCM] no pushToken for user:", userId);
  }
}

const router: IRouter = Router();

router.get("/admin/stats", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(usersTable);
  const [{ totalProducts }] = await db.select({ totalProducts: count() }).from(productsTable);
  const [{ pendingProducts }] = await db.select({ pendingProducts: count() }).from(productsTable).where(eq(productsTable.status, "pending"));
  const [{ activeProducts }] = await db.select({ activeProducts: count() }).from(productsTable).where(eq(productsTable.status, "active"));
  const [{ totalConversations }] = await db.select({ totalConversations: count() }).from(conversationsTable);
  const [{ totalMessages }] = await db.select({ totalMessages: count() }).from(messagesTable);
  const [{ bannedUsers }] = await db.select({ bannedUsers: count() }).from(usersTable).where(eq(usersTable.banned, true));

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last24h  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const last30d  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [{ newUsersToday }]     = await db.select({ newUsersToday: count() }).from(usersTable).where(gte(usersTable.createdAt, today));
  const [{ newProductsToday }]  = await db.select({ newProductsToday: count() }).from(productsTable).where(gte(productsTable.createdAt, today));
  const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000);
  const [{ activeNow }]         = await db.select({ activeNow: count() }).from(usersTable).where(and(gte(usersTable.lastSeenAt, threeMinAgo), ne(usersTable.role, "admin")));
  const [{ activeToday }]       = await db.select({ activeToday: count() }).from(usersTable).where(gte(usersTable.lastSeenAt, last24h));
  const [{ activeWeek }]        = await db.select({ activeWeek: count() }).from(usersTable).where(gte(usersTable.lastSeenAt, last7d));
  const [{ activeMonth }]       = await db.select({ activeMonth: count() }).from(usersTable).where(gte(usersTable.lastSeenAt, last30d));
  const [{ usersWithToken }]    = await db.select({ usersWithToken: count() }).from(usersTable).where(sql`push_token IS NOT NULL`);

  // ── Orders stats ──
  const [{ totalOrders }]     = await db.select({ totalOrders: count() }).from(ordersTable);
  const [{ totalRevenueRaw }] = await db.select({ totalRevenueRaw: sql<number>`coalesce(sum(${ordersTable.price} * ${ordersTable.quantity}), 0)::numeric(12,2)` }).from(ordersTable);
  const [{ totalSellers }]    = await db.select({ totalSellers: count(sql`DISTINCT ${ordersTable.sellerId}`) }).from(ordersTable);
  const [{ totalBuyers }]     = await db.select({ totalBuyers: count(sql`DISTINCT ${ordersTable.buyerId}`) }).from(ordersTable);
  const [{ ordersToday }]     = await db.select({ ordersToday: count() }).from(ordersTable).where(gte(ordersTable.createdAt, today));
  const [{ revenueTodayRaw }] = await db.select({ revenueTodayRaw: sql<number>`coalesce(sum(${ordersTable.price} * ${ordersTable.quantity}), 0)::numeric(12,2)` }).from(ordersTable).where(gte(ordersTable.createdAt, today));
  const [{ ordersPending }]    = await db.select({ ordersPending: count() }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [{ ordersConfirmed }]  = await db.select({ ordersConfirmed: count() }).from(ordersTable).where(eq(ordersTable.status, "confirmed"));
  const [{ ordersShipped }]    = await db.select({ ordersShipped: count() }).from(ordersTable).where(eq(ordersTable.status, "shipped"));
  const [{ ordersDelivered }]  = await db.select({ ordersDelivered: count() }).from(ordersTable).where(eq(ordersTable.status, "delivered"));
  const [{ ordersCancelled }]  = await db.select({ ordersCancelled: count() }).from(ordersTable).where(eq(ordersTable.status, "cancelled"));

  // ── Rides stats ──
  const [{ totalRides }]          = await db.select({ totalRides: count() }).from(ridesTable);
  const [{ ridesToday }]          = await db.select({ ridesToday: count() }).from(ridesTable).where(gte(ridesTable.createdAt, today));
  const [{ ridesPending }]        = await db.select({ ridesPending: count() }).from(ridesTable).where(eq(ridesTable.status, "pending"));
  const [{ ridesAccepted }]       = await db.select({ ridesAccepted: count() }).from(ridesTable).where(eq(ridesTable.status, "accepted"));
  const [{ ridesCompleted }]      = await db.select({ ridesCompleted: count() }).from(ridesTable).where(eq(ridesTable.status, "completed"));
  const [{ ridesCancelled }]      = await db.select({ ridesCancelled: count() }).from(ridesTable).where(eq(ridesTable.status, "cancelled"));
  const [{ totalRideRevenueRaw }] = await db.select({ totalRideRevenueRaw: sql<number>`coalesce(sum(${ridesTable.price}), 0)::numeric(12,2)` }).from(ridesTable).where(eq(ridesTable.status, "completed"));
  const [{ rideRevenueTodayRaw }] = await db.select({ rideRevenueTodayRaw: sql<number>`coalesce(sum(${ridesTable.price}), 0)::numeric(12,2)` }).from(ridesTable).where(and(eq(ridesTable.status, "completed"), gte(ridesTable.completedAt, today)));

  // ── Driver stats ──
  const [{ totalDrivers }]        = await db.select({ totalDrivers: count() }).from(driverProfilesTable);
  const [{ activeDrivers }]       = await db.select({ activeDrivers: count() }).from(driverProfilesTable).where(eq(driverProfilesTable.isOnline, true));
  const [{ subscribedDrivers }]   = await db.select({ subscribedDrivers: count() }).from(driverProfilesTable).where(eq(driverProfilesTable.isSubscribed, true));
  const [{ availableDrivers }]    = await db.select({ availableDrivers: count() }).from(driverProfilesTable).where(eq(driverProfilesTable.isAvailable, true));
  const [{ freeDrivers }]         = await db.select({ freeDrivers: count() }).from(driverProfilesTable).where(eq(driverProfilesTable.isFree, true));
  const [{ freeSellers }]         = await db.select({ freeSellers: count() }).from(usersTable).where(eq(usersTable.isFree, true));

  res.json({
    totalUsers: Number(totalUsers),
    totalProducts: Number(totalProducts),
    pendingProducts: Number(pendingProducts),
    activeProducts: Number(activeProducts),
    totalConversations: Number(totalConversations),
    totalMessages: Number(totalMessages),
    newUsersToday: Number(newUsersToday),
    newProductsToday: Number(newProductsToday),
    bannedUsers: Number(bannedUsers),
    activeNow: Number(activeNow),
    activeToday: Number(activeToday),
    activeWeek: Number(activeWeek),
    activeMonth: Number(activeMonth),
    usersWithToken: Number(usersWithToken),
    totalOrders: Number(totalOrders),
    totalRevenue: Number(totalRevenueRaw ?? 0),
    totalSellers: Number(totalSellers),
    totalBuyers: Number(totalBuyers),
    ordersToday: Number(ordersToday),
    revenueToday: Number(revenueTodayRaw ?? 0),
    ordersPending: Number(ordersPending),
    ordersConfirmed: Number(ordersConfirmed),
    ordersShipped: Number(ordersShipped),
    ordersDelivered: Number(ordersDelivered),
    ordersCancelled: Number(ordersCancelled),
    // Rides
    totalRides: Number(totalRides),
    ridesToday: Number(ridesToday),
    ridesPending: Number(ridesPending),
    ridesAccepted: Number(ridesAccepted),
    ridesCompleted: Number(ridesCompleted),
    ridesCancelled: Number(ridesCancelled),
    totalRideRevenue: Number(totalRideRevenueRaw ?? 0),
    rideRevenueToday: Number(rideRevenueTodayRaw ?? 0),
    // Drivers
    totalDrivers: Number(totalDrivers),
    activeDrivers: Number(activeDrivers),
    subscribedDrivers: Number(subscribedDrivers),
    availableDrivers: Number(availableDrivers),
    freeDrivers: Number(freeDrivers),
    freeSellers: Number(freeSellers),
  });
});

router.get("/admin/activity", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const activities = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(50);

  res.json(activities.map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    userId: a.userId,
    userName: a.userName,
    createdAt: a.createdAt.toISOString(),
  })));
});

// ── إحصائيات الطلبات لكل بائع ───────────────────────────────
router.get("/admin/seller-orders", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  // كل البائعين الذين لديهم طلبات
  const sellersWithOrders = await db
    .select({
      sellerId: ordersTable.sellerId,
      sellerName: usersTable.name,
      totalOrders: sql<number>`count(*)::int`,
      pending: sql<number>`count(case when ${ordersTable.status} = 'pending' then 1 end)::int`,
      confirmed: sql<number>`count(case when ${ordersTable.status} = 'confirmed' then 1 end)::int`,
      shipped: sql<number>`count(case when ${ordersTable.status} = 'shipped' then 1 end)::int`,
      delivered: sql<number>`count(case when ${ordersTable.status} = 'delivered' then 1 end)::int`,
      cancelled: sql<number>`count(case when ${ordersTable.status} = 'cancelled' then 1 end)::int`,
      totalRevenue: sql<number>`sum(${ordersTable.price} * ${ordersTable.quantity})::numeric(12,2)`,
    })
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.sellerId, usersTable.id))
    .groupBy(ordersTable.sellerId, usersTable.name)
    .orderBy(sql`count(*) desc`);

  res.json(sellersWithOrders.map((s) => ({
    sellerId: s.sellerId,
    sellerName: s.sellerName,
    totalOrders: Number(s.totalOrders),
    pending: Number(s.pending),
    confirmed: Number(s.confirmed),
    shipped: Number(s.shipped),
    delivered: Number(s.delivered),
    cancelled: Number(s.cancelled),
    totalRevenue: Number(s.totalRevenue ?? 0),
  })));
});

// ── تفاصيل الطلبات لبائع محدد ─────────────────────────────
router.get("/admin/seller-orders/:sellerId", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { sellerId } = req.params;

  const orders = await db
    .select({
      id: ordersTable.id,
      status: ordersTable.status,
      price: ordersTable.price,
      quantity: ordersTable.quantity,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
      buyerName: usersTable.name,
      buyerAvatar: usersTable.avatar,
    })
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.buyerId, usersTable.id))
    .where(eq(ordersTable.sellerId, sellerId as string))
    .orderBy(desc(ordersTable.createdAt));

  res.json(orders.map((o) => ({
    id: o.id,
    status: o.status,
    price: Number(o.price),
    quantity: o.quantity,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    buyerName: o.buyerName,
    buyerAvatar: o.buyerAvatar,
  })));
});

// ── بث رسالة جماعية لجميع المستخدمين ─────────────────────
router.post("/admin/broadcast", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.user!.id;
  const { message } = req.body;

  if (!message?.trim()) {
    res.status(400).json({ error: "الرسالة مطلوبة" });
    return;
  }

  const allUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(ne(usersTable.role, "admin"), eq(usersTable.banned, false)));

  // إنشاء سجل البث أولاً للحصول على broadcastId
  const broadcastId = randomUUID();
  await db.insert(broadcastsTable).values({
    id: broadcastId,
    adminId,
    message: message.trim(),
    recipientCount: allUsers.length,
  });

  let sent = 0;
  let failed = 0;
  const sentUserIds: string[] = [];

  for (const user of allUsers) {
    try {
      const [existing] = await db
        .select()
        .from(conversationsTable)
        .where(
          or(
            and(eq(conversationsTable.participant1Id, adminId), eq(conversationsTable.participant2Id, user.id)),
            and(eq(conversationsTable.participant1Id, user.id), eq(conversationsTable.participant2Id, adminId))
          )
        );

      let convId: string;
      if (existing) {
        convId = existing.id;
      } else {
        const id = randomUUID();
        await db.insert(conversationsTable).values({
          id,
          participant1Id: adminId,
          participant2Id: user.id,
          updatedAt: new Date(),
        });
        convId = id;
      }

      await db.insert(messagesTable).values({
        id: randomUUID(),
        conversationId: convId,
        senderId: adminId,
        content: message.trim(),
        broadcastId,
      });

      await db.update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, convId));

      sentUserIds.push(user.id);
      sent++;
    } catch {
      failed++;
    }
  }

  // تحديث عدد المستلمين الفعلي
  await db.update(broadcastsTable)
    .set({ recipientCount: sent })
    .where(eq(broadcastsTable.id, broadcastId));

  // إرسال إشعار Firebase
  if (sentUserIds.length > 0) {
    try {
      await notifyUsers({
        userIds: sentUserIds,
        title: "رسالة من Gaytak 📢",
        body: message.trim().length > 100 ? message.trim().slice(0, 100) + "..." : message.trim(),
        data: { type: "broadcast" },
      });
    } catch (e: any) {
      console.warn("[Broadcast] Push notifications failed:", e.message);
    }
  }

  res.json({ broadcastId, sent, failed, total: allUsers.length });
});

// ── قائمة الرسائل الجماعية السابقة ──────────────────────────
router.get("/admin/broadcasts", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const broadcasts = await db
    .select()
    .from(broadcastsTable)
    .orderBy(desc(broadcastsTable.createdAt))
    .limit(50);

  const result = await Promise.all(broadcasts.map(async (b) => {
    const [{ readCount }] = await db
      .select({ readCount: sql<number>`count(*)::int` })
      .from(messagesTable)
      .where(and(eq(messagesTable.broadcastId, b.id), eq(messagesTable.isRead, true)));

    return {
      id: b.id,
      message: b.message,
      recipientCount: b.recipientCount,
      readCount: Number(readCount ?? 0),
      createdAt: b.createdAt.toISOString(),
    };
  }));

  res.json(result);
});

// ── من شاهد رسالة جماعية محددة ──────────────────────────────
router.get("/admin/broadcasts/:id/readers", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const broadcastId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const adminUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
  const adminIds = adminUsers.map(u => u.id);

  const readMessages = await db
    .select({
      convId: messagesTable.conversationId,
      isRead: messagesTable.isRead,
    })
    .from(messagesTable)
    .where(eq(messagesTable.broadcastId, broadcastId));

  const readers: any[] = [];
  for (const msg of readMessages) {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.convId));
    if (!conv) continue;
    const userId = adminIds.includes(conv.participant1Id) ? conv.participant2Id : conv.participant1Id;
    const [u] = await db.select({ id: usersTable.id, name: usersTable.name, avatar: usersTable.avatar, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.id, userId));
    if (u) readers.push({ ...u, isRead: msg.isRead });
  }

  res.json(readers);
});

// ── طلبات التوصيل (للأدمن) ────────────────────────────────
router.get("/admin/delivery-requests", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.deliveryType, "service"), isNotNull(ordersTable.deliveryStatus)))
    .orderBy(desc(ordersTable.updatedAt));

  if (!orders.length) { res.json([]); return; }

  const userIds = [...new Set(orders.flatMap(o => [o.buyerId, o.sellerId]))];
  const productIds = [...new Set(orders.map(o => o.productId))];

  const users = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  res.json(orders.map(o => ({
    id: o.id,
    status: o.status,
    deliveryStatus: o.deliveryStatus,
    price: Number(o.price),
    quantity: o.quantity,
    shippingAddress: o.shippingAddress,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    buyer: userMap[o.buyerId] ? {
      id: userMap[o.buyerId].id,
      name: userMap[o.buyerId].name,
      phone: userMap[o.buyerId].phone,
      avatar: userMap[o.buyerId].avatar,
    } : null,
    seller: userMap[o.sellerId] ? {
      id: userMap[o.sellerId].id,
      name: userMap[o.sellerId].name,
      phone: userMap[o.sellerId].phone,
      avatar: userMap[o.sellerId].avatar,
    } : null,
    product: productMap[o.productId] ? {
      id: productMap[o.productId].id,
      title: productMap[o.productId].title,
      images: productMap[o.productId].images,
    } : null,
  })));
});

router.patch("/admin/delivery-requests/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const orderId = req.params.id as string;
  const { deliveryStatus } = req.body; // 'accepted' | 'rejected' | 'in_transit' | 'delivered'

  const validStatuses = ["accepted", "rejected", "in_transit", "delivered"];
  if (!validStatuses.includes(deliveryStatus)) {
    res.status(400).json({ error: "حالة غير صالحة" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

  const updates: Record<string, any> = { deliveryStatus, updatedAt: new Date() };

  // عند التسليم الفعلي → حدّث حالة الطلب أيضاً
  if (deliveryStatus === "in_transit") updates.status = "shipped";
  if (deliveryStatus === "delivered") updates.status = "delivered";

  await db.update(ordersTable).set(updates).where(eq(ordersTable.id, orderId));

  // إشعار البائع والمشتري (نفس أسلوب الدردشة — من users.pushToken مباشرة)
  const buyerMsgs: Record<string, string> = {
    accepted: "تم قبول طلب التوصيل لطلبك ✅",
    rejected: "تم رفض طلب التوصيل، يرجى التواصل مع البائع ❌",
    in_transit: "طلبك في الطريق إليك 🚚",
    delivered: "تم تسليم طلبك بنجاح 🎉",
  };
  const sellerMsgs: Record<string, string> = {
    accepted: "تم قبول طلب التوصيل ✅ — سيتم استلام الطلب قريباً",
    rejected: "تم رفض طلب التوصيل ❌ — يرجى مراجعة العميل",
    in_transit: "الطلب في مرحلة التوصيل الآن 🚚",
    delivered: "تم تسليم الطلب للعميل بنجاح 🎉",
  };

  await Promise.all([
    pushToUser(
      order.buyerId,
      "تحديث التوصيل 📦",
      buyerMsgs[deliveryStatus] ?? "تم تحديث حالة التوصيل",
      { type: "delivery_update", orderId, deliveryStatus }
    ),
    pushToUser(
      order.sellerId,
      "تحديث التوصيل 📦",
      sellerMsgs[deliveryStatus] ?? "تم تحديث حالة التوصيل",
      { type: "delivery_update", orderId, deliveryStatus }
    ),
  ]);

  res.json({ success: true, deliveryStatus });
});

// ── قائمة السائقين (للأدمن) ────────────────────────────────
router.get("/admin/drivers", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const drivers = await db.select().from(driverProfilesTable).orderBy(desc(driverProfilesTable.createdAt));
  if (!drivers.length) { res.json([]); return; }

  const userIds = drivers.map(d => d.userId);
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(drivers.map(d => {
    const u = userMap[d.userId];
    return {
      id: d.id,
      userId: d.userId,
      name: u?.name || "—",
      phone: u?.phone || null,
      email: u?.email || "—",
      avatar: u?.avatar || null,
      vehicleType: d.vehicleType,
      vehicleModel: d.vehicleModel,
      vehiclePlate: d.vehiclePlate,
      isSubscribed: d.isSubscribed,
      subscriptionExpiresAt: d.subscriptionExpiresAt?.toISOString() ?? null,
      isOnline: d.isOnline,
      isAvailable: d.isAvailable,
      totalRides: d.totalRides,
      totalEarnings: d.totalEarnings,
      createdAt: d.createdAt.toISOString(),
      // الوثائق
      licenseImage: d.licenseImage,
      idCardImage: d.idCardImage,
      vehicleDocImage: d.vehicleDocImage,
      licenseVerified: d.licenseVerified,
      documentsStatus: d.documentsStatus,
      documentsSubmittedAt: d.documentsSubmittedAt?.toISOString() ?? null,
      isFree: d.isFree,
    };
  }));
});

// ── تفعيل/إلغاء وضع السائق المجاني (للأدمن) ──────────────────
router.patch("/admin/drivers/:userId/free", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;
  const { isFree } = req.body;
  const now = new Date();
  await db.update(driverProfilesTable)
    .set({ isFree: isFree ?? false, updatedAt: now })
    .where(eq(driverProfilesTable.userId, userId));
  res.json({ success: true });
});

// ── تفعيل/إلغاء وضع البائع المجاني (للأدمن) ──────────────────
router.patch("/admin/sellers/:userId/free", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;
  const { isFree } = req.body;
  const now = new Date();
  await db.update(usersTable)
    .set({ isFree: isFree ?? false, updatedAt: now })
    .where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── إيقاف اشتراك سائق (للأدمن) ──────────────────────────────
router.patch("/admin/drivers/:userId/deactivate", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;
  const now = new Date();
  await db.update(driverProfilesTable)
    .set({ isSubscribed: false, subscriptionExpiresAt: null, updatedAt: now })
    .where(eq(driverProfilesTable.userId, userId));
  res.json({ success: true });
});

// ── تأكيد وثائق السائق (للأدمن) ────────────────────────
router.patch("/admin/drivers/:userId/verify-documents", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const userId = req.params.userId as string;
  const { status } = req.body; // "verified" | "rejected"
  const now = new Date();
  await db.update(driverProfilesTable)
    .set({
      documentsStatus: status,
      licenseVerified: status === "verified",
      updatedAt: now,
    })
    .where(eq(driverProfilesTable.userId, userId));
  res.json({ success: true });
});

// ── قائمة الرحلات (للأدمن) ────────────────────────────────
router.get("/admin/rides", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const rides = await db.select().from(ridesTable).orderBy(desc(ridesTable.createdAt));
  if (!rides.length) { res.json([]); return; }

  const userIds = [...new Set(rides.flatMap(r => [r.passengerId, r.driverId]).filter((id): id is string => id !== null))];
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(rides.map(r => {
    const passenger = userMap[r.passengerId];
    const driver = r.driverId ? userMap[r.driverId] : null;
    return {
      id: r.id,
      status: r.status,
      fromAddress: r.fromAddress,
      toAddress: r.toAddress,
      price: r.price,
      passengerName: passenger?.name || "—",
      passengerPhone: passenger?.phone || null,
      driverName: driver?.name || null,
      driverPhone: driver?.phone || null,
      rating: r.driverRating,
      driverRating: r.passengerRating,
      createdAt: r.createdAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
    };
  }));
});

// ── تسجيل خروج جميع الحسابات ──────────────────────────────
router.post("/admin/logout-all", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.user!.id;
  const now = new Date();
  // ضبط tokenIssuedAfter للكل عدا الأدمن الحالي
  await db.update(usersTable).set({ tokenIssuedAfter: now });
  // الأدمن الحالي يبقى مسجلاً (أعد ضبطه لوقت سابق)
  await db.update(usersTable).set({ tokenIssuedAfter: null }).where(eq(usersTable.id, adminId));

  res.json({ success: true, loggedOutAt: now.toISOString() });
});

// ── تفعيل/إلغاء الوضع المجاني لجميع المستخدمين والسائقين (للأدمن) ──
router.post("/admin/bulk/free-all", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { free } = req.body as { free?: boolean };
  const isFree = free ?? true;
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (isFree) {
    // تفعيل مجاني
    await db.update(usersTable)
      .set({ isFree: true, isVerified: true, subscriptionExpiresAt: expiry, updatedAt: now })
      .where(eq(usersTable.role, "user"));
    await db.update(driverProfilesTable)
      .set({ isFree: true, isSubscribed: true, subscriptionExpiresAt: expiry, updatedAt: now });
  } else {
    // إلغاء وضع مجاني
    await db.update(usersTable)
      .set({ isFree: false, updatedAt: now })
      .where(eq(usersTable.role, "user"));
    await db.update(driverProfilesTable)
      .set({ isFree: false, updatedAt: now });
  }

  res.json({ success: true, message: isFree ? "تم تفعيل الوضع المجاني لجميع المستخدمين والسائقين" : "تم إلغاء الوضع المجاني لجميع المستخدمين والسائقين" });
});

export default router;
