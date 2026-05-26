import { Router, type IRouter } from "express";
import { db, ordersTable, usersTable, productsTable, activityTable } from "@workspace/db";
import { eq, and, or, desc, count, inArray } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";

// إرسال إشعار لمستخدم واحد بنفس أسلوب الدردشة (users.pushToken)
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
      console.warn("[FCM] orders pushToUser failed:", e?.message);
    }
  } else {
    console.warn("[FCM] no pushToken for user:", userId);
  }
}

const router: IRouter = Router();

function formatOrder(order: typeof ordersTable.$inferSelect, buyer?: typeof usersTable.$inferSelect, seller?: typeof usersTable.$inferSelect, product?: typeof productsTable.$inferSelect) {
  return {
    id: order.id,
    productId: order.productId,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    status: order.status,
    price: Number(order.price),
    quantity: order.quantity,
    shippingAddress: order.shippingAddress,
    phone: order.phone,
    notes: order.notes,
    deliveryType: order.deliveryType ?? null,
    deliveryStatus: order.deliveryStatus ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    buyer: buyer ? { id: buyer.id, name: buyer.name, avatar: buyer.avatar, phone: buyer.phone } : null,
    seller: seller ? { id: seller.id, name: seller.name, avatar: seller.avatar, phone: seller.phone } : null,
    product: product ? { id: product.id, title: product.title, images: product.images, price: Number(product.price) } : null,
  };
}

// ── إنشاء طلب جديد ───────────────────────────────────────
router.post("/orders", authenticate, async (req, res): Promise<void> => {
  const buyerId = req.user!.id;
  const { productId, quantity = 1, shippingAddress, phone, notes } = req.body;

  if (!productId) {
    res.status(400).json({ error: "productId مطلوب" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  if (product.sellerId === buyerId) {
    res.status(400).json({ error: "لا يمكنك طلب منتجك" });
    return;
  }
  if (product.status !== "active") {
    res.status(400).json({ error: "المنتج غير متاح حالياً" });
    return;
  }

  const order = {
    id: randomUUID(),
    productId,
    buyerId,
    sellerId: product.sellerId,
    status: "pending" as const,
    price: product.price,
    quantity: quantity ?? 1,
    shippingAddress: shippingAddress ?? null,
    phone: phone ?? null,
    notes: notes ?? null,
    deliveryType: null as string | null,
    deliveryStatus: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(ordersTable).values(order as any);

  // تسجيل نشاط الطلب الجديد
  const [buyerUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, buyerId));
  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "order_created",
    description: `طلب جديد على منتج "${product.title}" — ${order.price} ريال`,
    userId: buyerId,
    userName: buyerUser?.name ?? "مستخدم",
  });

  // إرسال إشعار للبائع (نفس أسلوب الدردشة)
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, product.sellerId));
  await pushToUser(
    product.sellerId,
    "طلب جديد! 📦",
    `تم طلب منتجك "${product.title}" من ${buyerUser?.name ?? "مستخدم"}`,
    { type: "new_order", orderId: order.id, productId }
  );

  res.json(formatOrder(order, undefined, seller, product));
});

// ── قائمة طلباتي (كمشتري أو كبائع) ─────────────────────────
router.get("/orders", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const role = String(req.query.role ?? ""); // buyer | seller
  const status = String(req.query.status ?? "");

  let conditions = or(eq(ordersTable.buyerId, userId), eq(ordersTable.sellerId, userId));
  if (role === "buyer") conditions = eq(ordersTable.buyerId, userId);
  if (role === "seller") conditions = eq(ordersTable.sellerId, userId);

  const orders = await db.select().from(ordersTable).where(conditions).orderBy(desc(ordersTable.createdAt));

  const userIds = [...new Set(orders.flatMap((o) => [o.buyerId, o.sellerId]))];
  const productIds = [...new Set(orders.map((o) => o.productId))];

  const users = userIds.length > 0 ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const products = productIds.length > 0 ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds)) : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const result = orders.map((o) => formatOrder(o, userMap[o.buyerId], userMap[o.sellerId], productMap[o.productId]));
  res.json(result);
});

// ── تحديث حالة الطلب ──────────────────────────────────────
router.patch("/orders/:id/status", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const orderId = req.params.id;
  const { status } = req.body;

  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "حالة غير صالحة" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId as string));
  if (!order) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }
  if (order.sellerId !== userId && order.buyerId !== userId) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, orderId as string));

  // تسجيل نشاط تغيير الحالة
  const statusLabels2: Record<string, string> = {
    pending: "قيد الانتظار",
    confirmed: "تم التأكيد",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };
  const [actor] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  await db.insert(activityTable).values({
    id: randomUUID(),
    type: `order_${status}`,
    description: `تم تحديث حالة الطلب #${orderId.slice(0, 8)} إلى: ${statusLabels2[status]}`,
    userId,
    userName: actor?.name ?? "مستخدم",
  });

  // إشعار للطرف الآخر (نفس أسلوب الدردشة)
  const notifyId = order.sellerId === userId ? order.buyerId : order.sellerId;
  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    confirmed: "تم التأكيد ✅",
    shipped: "تم الشحن 🚚",
    delivered: "تم التسليم 🎉",
    cancelled: "ملغي ❌",
  };
  await pushToUser(
    notifyId,
    "تحديث الطلب 📦",
    `تم تحديث حالة الطلب إلى: ${statusLabels[status] ?? status}`,
    { type: "order_status", orderId: orderId as string, status: status as string }
  );

  res.json({ success: true, status });
});

// ── البائع يختار نوع التوصيل بعد التأكيد ──────────────────
router.patch("/orders/:id/delivery-type", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const orderId = req.params.id as string;
  const { deliveryType } = req.body; // 'self' | 'service'

  if (!["self", "service"].includes(deliveryType)) {
    res.status(400).json({ error: "نوع التوصيل غير صالح" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }
  if (order.sellerId !== userId) { res.status(403).json({ error: "غير مصرح" }); return; }
  if (order.status !== "confirmed") { res.status(400).json({ error: "يجب أن يكون الطلب مؤكداً أولاً" }); return; }

  const deliveryStatus = deliveryType === "service" ? "pending" : null;
  await db.update(ordersTable)
    .set({ deliveryType, deliveryStatus, updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId));

  if (deliveryType === "service") {
    await pushToUser(
      order.buyerId,
      "تحديث طلبك 🚚",
      "البائع طلب خدمة التوصيل لطلبك، سيتم التواصل معك قريباً",
      { type: "delivery_requested", orderId }
    );
  }

  res.json({ success: true, deliveryType, deliveryStatus });
});

export default router;
