import { Router } from "express";
import { db, restaurantsTable, menuItemsTable, foodOrdersTable, usersTable } from "@workspace/db";
import { eq, desc, and, inArray, ilike, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, requireAdmin } from "../lib/auth";

const router = Router();

// ── قائمة المطاعم المعتمدة ─────────────────────────────────────────────────
router.get("/restaurants", async (req, res): Promise<void> => {
  try {
    const { category, q } = req.query as { category?: string; q?: string };

    let query = db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.status, "approved"))
      .orderBy(desc(restaurantsTable.isFeatured), desc(restaurantsTable.createdAt))
      .$dynamic();

    const conditions = [eq(restaurantsTable.status, "approved")];
    if (category && category !== "الكل") conditions.push(eq(restaurantsTable.category, category));
    if (q) conditions.push(ilike(restaurantsTable.name, `%${q}%`));

    const rows = (await db
      .select()
      .from(restaurantsTable)
      .where(and(...conditions))
      .orderBy(desc(restaurantsTable.isFeatured), desc(restaurantsTable.createdAt))) ?? [];

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تفاصيل مطعم + قائمته ──────────────────────────────────────────────────
router.get("/restaurants/:id", async (req, res): Promise<void> => {
  try {
    const [restaurant] = (await db
      .select()
      .from(restaurantsTable)
      .where(eq(restaurantsTable.id, req.params.id))) ?? [];

    if (!restaurant) { res.status(404).json({ error: "المطعم غير موجود" }); return; }

    const menu = (await db
      .select()
      .from(menuItemsTable)
      .where(and(eq(menuItemsTable.restaurantId, req.params.id), eq(menuItemsTable.isAvailable, true)))
      .orderBy(menuItemsTable.category, menuItemsTable.sortOrder)) ?? [];

    res.json({ ...restaurant, menu });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تسجيل مطعم جديد ──────────────────────────────────────────────────────
router.post("/restaurants", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { name, description, category, address, phone, logo, coverImage, deliveryFee, minOrder, estimatedDeliveryMinutes } = req.body;

    if (!name || !address) { res.status(400).json({ error: "الاسم والعنوان مطلوبان" }); return; }

    const existing = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (existing.length > 0) { res.status(400).json({ error: "لديك مطعم مسجل بالفعل" }); return; }

    const id = randomUUID().slice(0, 8);
    await db.insert(restaurantsTable).values({
      id,
      ownerId: userId,
      name,
      description: description ?? null,
      category: category ?? "عام",
      address,
      phone: phone ?? null,
      logo: logo ?? null,
      coverImage: coverImage ?? null,
      deliveryFee: deliveryFee ?? "0",
      minOrder: minOrder ?? "0",
      estimatedDeliveryMinutes: estimatedDeliveryMinutes ?? 30,
      status: "pending",
    });

    res.json({ id, message: "تم إرسال طلب تسجيل المطعم، بانتظار المراجعة" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تحديث مطعمي ──────────────────────────────────────────────────────────
router.patch("/restaurants/my", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (!restaurant) { res.status(404).json({ error: "لا تملك مطعماً" }); return; }

    const { name, description, category, address, phone, logo, coverImage, isOpen, deliveryFee, minOrder, estimatedDeliveryMinutes } = req.body;
    await db.update(restaurantsTable).set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(logo !== undefined && { logo }),
      ...(coverImage !== undefined && { coverImage }),
      ...(isOpen !== undefined && { isOpen }),
      ...(deliveryFee !== undefined && { deliveryFee }),
      ...(minOrder !== undefined && { minOrder }),
      ...(estimatedDeliveryMinutes !== undefined && { estimatedDeliveryMinutes }),
      updatedAt: new Date(),
    }).where(eq(restaurantsTable.id, restaurant.id));

    res.json({ message: "تم التحديث" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── مطعمي (للمالك) ────────────────────────────────────────────────────────
router.get("/restaurants/my/profile", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (!restaurant) { res.status(404).json({ error: "لا تملك مطعماً" }); return; }

    const menu = (await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id)).orderBy(menuItemsTable.category, menuItemsTable.sortOrder)) ?? [];
    res.json({ ...restaurant, menu });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إضافة صنف للمنيو ─────────────────────────────────────────────────────
router.post("/restaurants/my/menu", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (!restaurant) { res.status(404).json({ error: "لا تملك مطعماً" }); return; }

    const { name, description, category, price, image, sortOrder } = req.body;
    if (!name || !price) { res.status(400).json({ error: "الاسم والسعر مطلوبان" }); return; }

    const id = randomUUID().slice(0, 8);
    await db.insert(menuItemsTable).values({
      id,
      restaurantId: restaurant.id,
      name,
      description: description ?? null,
      category: category ?? "الرئيسية",
      price: String(price),
      image: image ?? null,
      sortOrder: sortOrder ?? 0,
    });

    res.json({ id, message: "تمت إضافة الصنف" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تعديل صنف من المنيو ─────────────────────────────────────────────────
router.patch("/restaurants/my/menu/:itemId", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (!restaurant) { res.status(404).json({ error: "لا تملك مطعماً" }); return; }

    const { name, description, category, price, image, isAvailable, sortOrder } = req.body;
    await db.update(menuItemsTable).set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(price !== undefined && { price: String(price) }),
      ...(image !== undefined && { image }),
      ...(isAvailable !== undefined && { isAvailable }),
      ...(sortOrder !== undefined && { sortOrder }),
    }).where(and(eq(menuItemsTable.id, req.params.itemId), eq(menuItemsTable.restaurantId, restaurant.id)));

    res.json({ message: "تم التعديل" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── حذف صنف من المنيو ───────────────────────────────────────────────────
router.delete("/restaurants/my/menu/:itemId", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (!restaurant) { res.status(404).json({ error: "لا تملك مطعماً" }); return; }

    await db.delete(menuItemsTable).where(and(eq(menuItemsTable.id, req.params.itemId), eq(menuItemsTable.restaurantId, restaurant.id)));
    res.json({ message: "تم الحذف" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إنشاء طلب طعام ──────────────────────────────────────────────────────
router.post("/food-orders", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { restaurantId, items, deliveryAddress, notes, paymentMethod } = req.body;

    if (!restaurantId || !items?.length || !deliveryAddress) {
      res.status(400).json({ error: "بيانات الطلب غير مكتملة" }); return;
    }

    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId))) ?? [];
    if (!restaurant || restaurant.status !== "approved") { res.status(400).json({ error: "المطعم غير متاح" }); return; }

    const itemTotal = items.reduce((sum: number, it: any) => sum + (Number(it.price) * Number(it.quantity)), 0);
    const deliveryFee = Number(restaurant.deliveryFee ?? 0);
    const totalPrice = itemTotal + deliveryFee;

    const id = randomUUID().slice(0, 8);
    await db.insert(foodOrdersTable).values({
      id,
      userId,
      restaurantId,
      status: "pending",
      deliveryAddress,
      notes: notes ?? null,
      totalPrice: String(totalPrice),
      deliveryFee: String(deliveryFee),
      paymentMethod: paymentMethod ?? "cash",
      items: JSON.stringify(items),
    });

    res.json({ id, message: "تم إرسال الطلب بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── طلباتي (كزبون) ──────────────────────────────────────────────────────
router.get("/food-orders/my", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const orders = (await db
      .select()
      .from(foodOrdersTable)
      .where(eq(foodOrdersTable.userId, userId))
      .orderBy(desc(foodOrdersTable.createdAt))) ?? [];

    if (!orders.length) { res.json([]); return; }

    const restaurantIds = [...new Set(orders.map((o) => o.restaurantId))];
    const restaurants = (await db.select({ id: restaurantsTable.id, name: restaurantsTable.name, logo: restaurantsTable.logo })
      .from(restaurantsTable).where(inArray(restaurantsTable.id, restaurantIds))) ?? [];
    const rMap = Object.fromEntries(restaurants.map((r) => [r.id, r]));

    res.json(orders.map((o) => ({ ...o, restaurant: rMap[o.restaurantId] ?? null })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── طلبات مطعمي (للمالك) ────────────────────────────────────────────────
router.get("/food-orders/restaurant", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.ownerId, userId))) ?? [];
    if (!restaurant) { res.status(404).json({ error: "لا تملك مطعماً" }); return; }

    const orders = (await db
      .select()
      .from(foodOrdersTable)
      .where(eq(foodOrdersTable.restaurantId, restaurant.id))
      .orderBy(desc(foodOrdersTable.createdAt))) ?? [];

    if (!orders.length) { res.json([]); return; }

    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = (await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone, avatar: usersTable.avatar })
      .from(usersTable).where(inArray(usersTable.id, userIds))) ?? [];
    const uMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json(orders.map((o) => ({ ...o, user: uMap[o.userId] ?? null })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── تحديث حالة الطلب (المطعم) ──────────────────────────────────────────
router.patch("/food-orders/:id/status", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { status } = req.body;
    const allowed = ["confirmed", "preparing", "ready", "picked_up", "delivered", "cancelled"];
    if (!allowed.includes(status)) { res.status(400).json({ error: "حالة غير صحيحة" }); return; }

    const [order] = (await db.select().from(foodOrdersTable).where(eq(foodOrdersTable.id, req.params.id))) ?? [];
    if (!order) { res.status(404).json({ error: "الطلب غير موجود" }); return; }

    const [restaurant] = (await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, order.restaurantId))) ?? [];
    const isOwner = restaurant?.ownerId === userId;
    const isAdmin = (req as any).user.role === "admin";
    if (!isOwner && !isAdmin) { res.status(403).json({ error: "غير مصرح" }); return; }

    await db.update(foodOrdersTable).set({ status, updatedAt: new Date() }).where(eq(foodOrdersTable.id, req.params.id));
    res.json({ message: "تم التحديث" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ADMIN ────────────────────────────────────────────────────────────────

// قائمة كل المطاعم (أدمن)
router.get("/admin/restaurants", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = (await db.select().from(restaurantsTable).orderBy(desc(restaurantsTable.createdAt))) ?? [];
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// اعتماد / رفض مطعم
router.patch("/admin/restaurants/:id/status", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) { res.status(400).json({ error: "حالة غير صحيحة" }); return; }

    await db.update(restaurantsTable).set({ status, updatedAt: new Date() }).where(eq(restaurantsTable.id, req.params.id));
    res.json({ message: "تم التحديث" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// تمييز مطعم (featured)
router.patch("/admin/restaurants/:id/featured", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const { isFeatured } = req.body;
    await db.update(restaurantsTable).set({ isFeatured: !!isFeatured, updatedAt: new Date() }).where(eq(restaurantsTable.id, req.params.id));
    res.json({ message: "تم التحديث" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// كل طلبات الطعام (أدمن)
router.get("/admin/food-orders", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const orders = (await db.select().from(foodOrdersTable).orderBy(desc(foodOrdersTable.createdAt)).limit(200)) ?? [];
    res.json(orders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
