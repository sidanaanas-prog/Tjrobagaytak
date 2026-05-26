import { Router, type IRouter } from "express";
import { db, flashSalesTable, productsTable, usersTable, wishlistsTable, pushTokensTable } from "@workspace/db";
import { eq, gt, inArray, and } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

// ── جلب العرض الفاعل حالياً (عام) ───────────────────────────
router.get("/flash-sale/active", async (req, res): Promise<void> => {
  const now = new Date();
  const [sale] = await db
    .select()
    .from(flashSalesTable)
    .where(gt(flashSalesTable.endsAt, now))
    .orderBy(flashSalesTable.createdAt)
    .limit(1);

  if (!sale) {
    res.json(null);
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, sale.productId));
  if (!product) {
    res.json(null);
    return;
  }

  res.json({
    id: sale.id,
    productId: sale.productId,
    salePrice: Number(sale.salePrice),
    endsAt: sale.endsAt.toISOString(),
    createdAt: sale.createdAt.toISOString(),
    product: {
      id: product.id,
      title: product.title,
      price: Number(product.price),
      images: product.images,
      sellerId: product.sellerId,
    },
  });
});

// ── قائمة كل العروض (Admin) ──────────────────────────────────
router.get("/admin/flash-sales", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const sales = await db
    .select()
    .from(flashSalesTable)
    .orderBy(flashSalesTable.createdAt);

  const productIds = [...new Set(sales.map((s) => s.productId))];
  const products = productIds.length > 0
    ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const now = new Date();
  res.json(sales.map((s) => ({
    id: s.id,
    productId: s.productId,
    salePrice: Number(s.salePrice),
    endsAt: s.endsAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    isActive: s.endsAt > now,
    product: productMap.has(s.productId)
      ? {
          id: productMap.get(s.productId)!.id,
          title: productMap.get(s.productId)!.title,
          price: Number(productMap.get(s.productId)!.price),
          images: productMap.get(s.productId)!.images,
        }
      : null,
  })));
});

// ── إنشاء عرض جديد (Admin) ───────────────────────────────────
router.post("/admin/flash-sales", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { productId, salePrice, durationHours = 3 } = req.body;
  if (!productId || !salePrice) {
    res.status(400).json({ error: "productId و salePrice مطلوبان" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }

  const endsAt = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
  const id = randomUUID();

  await db.insert(flashSalesTable).values({
    id,
    productId,
    salePrice: String(salePrice),
    endsAt,
    createdBy: req.user!.id,
  });

  // إشعار مستخدمي المفضلة
  const wishlistUsers = await db
    .select({ userId: wishlistsTable.userId })
    .from(wishlistsTable)
    .where(eq(wishlistsTable.productId, productId));

  // إشعار كل مستخدم من المفضلة مباشرة عبر pushToken
  if (wishlistUsers.length > 0) {
    const userIds = wishlistUsers.map((w) => w.userId);
    const tokenRows = await db
      .select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
    await Promise.allSettled(
      tokenRows
        .filter((u) => u.pushToken)
        .map((u) =>
          sendNotification({
            fcmToken: u.pushToken!,
            title: "⚡ عرض على منتج في مفضلتك!",
            body: `انخفض سعر "${product.title}" إلى ${salePrice} د.ج — لمدة ${durationHours} ساعات فقط!`,
            data: { type: "flash_sale", productId },
          })
        )
    );
  }

  res.json({ success: true, id, endsAt: endsAt.toISOString() });
});

// ── حذف / إنهاء عرض (Admin) ──────────────────────────────────
router.delete("/admin/flash-sales/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  await db.delete(flashSalesTable).where(eq(flashSalesTable.id, String(req.params.id)));
  res.json({ success: true });
});

// ── البائع يُنشئ تخفيضاً على منتجه ─────────────────────────────
router.post("/products/:id/flash-sale", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const productId = String(req.params.id);
  const { salePrice, durationHours = 3 } = req.body;

  if (!salePrice) {
    res.status(400).json({ error: "salePrice مطلوب" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "المنتج غير موجود" }); return; }
  if (product.sellerId !== userId) { res.status(403).json({ error: "ليس منتجك" }); return; }
  if (product.status !== "active") { res.status(400).json({ error: "المنتج غير منشور" }); return; }
  if (Number(salePrice) >= Number(product.price)) {
    res.status(400).json({ error: "سعر التخفيض يجب أن يكون أقل من السعر الأصلي" });
    return;
  }

  const endsAt = new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000);
  const id = randomUUID();

  await db.insert(flashSalesTable).values({
    id, productId, salePrice: String(salePrice), endsAt, createdBy: userId,
  });

  // إشعار مستخدمي المفضلة
  const wishlistUsers = await db
    .select({ userId: wishlistsTable.userId })
    .from(wishlistsTable)
    .where(eq(wishlistsTable.productId, productId));

  if (wishlistUsers.length > 0) {
    const userIds2 = wishlistUsers.map((w) => w.userId);
    const tokenRows2 = await db
      .select({ pushToken: usersTable.pushToken })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds2));
    await Promise.allSettled(
      tokenRows2
        .filter((u) => u.pushToken)
        .map((u) =>
          sendNotification({
            fcmToken: u.pushToken!,
            title: "⚡ انخفض سعر منتج في مفضلتك!",
            body: `"${product.title}" الآن بسعر ${salePrice} د.ج لمدة ${durationHours} ساعات فقط!`,
            data: { type: "flash_sale", productId },
          })
        )
    );
  }

  res.json({ success: true, id, endsAt: endsAt.toISOString() });
});

// ── البائع يُنهي تخفيضه ─────────────────────────────────────────
router.delete("/products/:id/flash-sale", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const productId = String(req.params.id);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product || product.sellerId !== userId) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const now = new Date();
  const activeSales = await db
    .select()
    .from(flashSalesTable)
    .where(and(eq(flashSalesTable.productId, productId), gt(flashSalesTable.endsAt, now)));

  for (const sale of activeSales) {
    await db.delete(flashSalesTable).where(eq(flashSalesTable.id, sale.id));
  }

  res.json({ success: true });
});

// ── جلب العرض الفاعل لمنتج محدد ─────────────────────────────────
router.get("/products/:id/flash-sale", async (req, res): Promise<void> => {
  const now = new Date();
  const [sale] = await db
    .select()
    .from(flashSalesTable)
    .where(and(eq(flashSalesTable.productId, String(req.params.id)), gt(flashSalesTable.endsAt, now)))
    .limit(1);

  if (!sale) { res.json(null); return; }
  res.json({ id: sale.id, salePrice: Number(sale.salePrice), endsAt: sale.endsAt.toISOString() });
});

export default router;
