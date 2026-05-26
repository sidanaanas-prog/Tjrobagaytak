import { Router, type IRouter } from "express";
import { db, wishlistsTable, productsTable, usersTable, flashSalesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

// ── جلب قائمة المفضلة ─────────────────────────────────────────
router.get("/wishlist", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  const rows = await db
    .select({
      productId: wishlistsTable.productId,
      createdAt: wishlistsTable.createdAt,
      product: {
        id: productsTable.id,
        title: productsTable.title,
        price: productsTable.price,
        images: productsTable.images,
        status: productsTable.status,
        sellerId: productsTable.sellerId,
      },
    })
    .from(wishlistsTable)
    .innerJoin(productsTable, eq(wishlistsTable.productId, productsTable.id))
    .where(eq(wishlistsTable.userId, userId))
    .orderBy(wishlistsTable.createdAt);

  // جلب العروض الفاعلة لمنتجات المفضلة
  const now = new Date();
  const activeSales = await db
    .select()
    .from(flashSalesTable)
    .where(gt(flashSalesTable.endsAt, now));

  const saleMap = new Map(activeSales.map((s) => [s.productId, s]));

  const items = rows.map((r) => ({
    productId: r.productId,
    createdAt: r.createdAt.toISOString(),
    product: {
      ...r.product,
      price: Number(r.product.price),
    },
    activeSale: saleMap.has(r.productId)
      ? { salePrice: Number(saleMap.get(r.productId)!.salePrice), endsAt: saleMap.get(r.productId)!.endsAt.toISOString() }
      : null,
  }));

  res.json(items);
});

// ── جلب فقط IDs المنتجات المحفوظة (سريع) ─────────────────────
router.get("/wishlist/ids", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const rows = await db
    .select({ productId: wishlistsTable.productId })
    .from(wishlistsTable)
    .where(eq(wishlistsTable.userId, userId));
  res.json(rows.map((r) => r.productId));
});

// ── إضافة منتج للمفضلة ────────────────────────────────────────
router.post("/wishlist/:productId", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const productId = String(req.params.productId);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }

  await db.insert(wishlistsTable).values({ userId, productId }).onConflictDoNothing();
  res.json({ success: true });
});

// ── حذف منتج من المفضلة ───────────────────────────────────────
router.delete("/wishlist/:productId", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const productId = String(req.params.productId);

  await db.delete(wishlistsTable).where(
    and(eq(wishlistsTable.userId, userId), eq(wishlistsTable.productId, productId))
  );
  res.json({ success: true });
});

export default router;
