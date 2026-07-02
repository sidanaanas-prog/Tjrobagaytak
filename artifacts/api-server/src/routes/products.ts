import { Router, type IRouter } from "express";
import { db, productsTable, usersTable, categoriesTable, activityTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, count, desc, or, inArray, gt } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

/** IDs البائعين الذين لديهم اشتراك نشط أو دور admin أو مجاني */
async function getSubscribedSellerIds(): Promise<string[]> {
  const now = new Date();
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      or(
        eq(usersTable.role, "admin"),
        eq(usersTable.isFree, true),
        and(
          eq(usersTable.isVerified, true),
          gt(usersTable.subscriptionExpiresAt, now)
        )
      )
    );
  return rows.map((r) => r.id);
}

function formatProduct(p: typeof productsTable.$inferSelect, seller?: typeof usersTable.$inferSelect | null, categoryName?: string | null) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: Number(p.price),
    originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
    images: p.images ?? [],
    category: categoryName ?? null,
    categoryId: p.categoryId,
    status: p.status,
    sellerId: p.sellerId,
    createdAt: p.createdAt.toISOString(),
    viewCount: p.viewCount,
    seller: seller
      ? {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          avatar: seller.avatar,
          role: seller.role,
          banned: seller.banned,
          isVerified: seller.isVerified,
          createdAt: seller.createdAt.toISOString(),
        }
      : null,
  };
}

router.get("/products/featured", async (_req, res): Promise<void> => {
  const subscribedIds = await getSubscribedSellerIds();
  // جلب أكبر pool ثم خلط عشوائي لعرض منتجات مختلفة في كل زيارة
  const featuredWhere = subscribedIds.length > 0
    ? and(eq(productsTable.status, "active"), inArray(productsTable.sellerId, subscribedIds))
    : eq(productsTable.status, "never_match_placeholder" as any);

  const pool = await db
    .select()
    .from(productsTable)
    .where(featuredWhere)
    .orderBy(desc(productsTable.viewCount))
    .limit(30);

  // خلط عشوائي (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const products = pool.slice(0, 8);

  const sellerIds = [...new Set(products.map((p) => p.sellerId))];
  const sellers = sellerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, sellerIds))
    : [];
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))] as string[];
  const cats = catIds.length > 0
    ? await db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds))
    : [];
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  res.json(products.map((p) => formatProduct(p, sellerMap[p.sellerId], p.categoryId ? catMap[p.categoryId] : null)));
});

router.get("/products", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? 1), 10);
  const limit = parseInt(String(req.query.limit ?? 20), 10);
  const search = String(req.query.search ?? "");
  const categoryId = req.query.category ? String(req.query.category) : null;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const statusFilter = req.query.status ? String(req.query.status) : "active";
  const sellerId = req.query.sellerId ? String(req.query.sellerId) : null;
  const offset = (page - 1) * limit;

  const conditions = [];
  // الحالات المدعومة: "active" (default) | "pending" | "rejected" | "all" (كل ما عدا)
  // عند التصفية بـ sellerId، الـ "all" تعرض كل منتجاته
  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(productsTable.status, statusFilter));
  }
  if (search) conditions.push(ilike(productsTable.title, `%${search}%`));
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (minPrice !== null) conditions.push(gte(productsTable.price, String(minPrice)));
  if (maxPrice !== null) conditions.push(lte(productsTable.price, String(maxPrice)));
  if (sellerId) {
    conditions.push(eq(productsTable.sellerId, sellerId));
  } else {
    // عرض عام — أظهر فقط منتجات البائعين المشتركين
    const subscribedIds = await getSubscribedSellerIds();
    if (subscribedIds.length > 0) {
      conditions.push(inArray(productsTable.sellerId, subscribedIds));
    } else {
      conditions.push(eq(productsTable.id, "__no_match__"));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(productsTable).where(whereClause);

  const products = await db
    .select()
    .from(productsTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(productsTable.createdAt));

  const sellerIds = [...new Set(products.map((p) => p.sellerId))];
  const sellers = sellerIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, sellerIds))
    : [];
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s]));

  const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))] as string[];
  const cats = catIds.length > 0
    ? await db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds))
    : [];
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  res.json({
    products: products.map((p) => formatProduct(p, sellerMap[p.sellerId], p.categoryId ? catMap[p.categoryId] : null)),
    total: Number(total),
    page,
    limit,
  });
});

router.post("/products", authenticate, async (req, res): Promise<void> => {
  const { title, description, price, originalPrice, images, categoryId } = req.body;
  if (!title || price === undefined) {
    res.status(400).json({ error: "Title and price are required" });
    return;
  }

  // تحقق من إشتراك البائع
  const [sellerCheck] = (await db.select({
    trialExpiresAt: usersTable.trialExpiresAt,
    subscriptionExpiresAt: usersTable.subscriptionExpiresAt,
    isFree: usersTable.isFree,
    isVerified: usersTable.isVerified,
  }).from(usersTable).where(eq(usersTable.id, req.user!.id))) ?? [];

  const now = new Date();
  const trialActive = sellerCheck?.trialExpiresAt && new Date(sellerCheck.trialExpiresAt) > now;
  const subscriptionActive = sellerCheck?.subscriptionExpiresAt && new Date(sellerCheck.subscriptionExpiresAt) > now;

  if (!sellerCheck?.isFree && !trialActive && !subscriptionActive) {
    res.status(403).json({ error: "يجب اشتراك لإضافة منتجات" });
    return;
  }

  const id = randomUUID();
  await db.insert(productsTable).values({
    id,
    title,
    description: description ?? null,
    price: String(price),
    originalPrice: originalPrice != null ? String(originalPrice) : null,
    images: images ?? [],
    categoryId: categoryId ?? null,
    status: "active",
    sellerId: req.user!.id,
  });
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "product_listed",
    description: `${seller.name} listed "${title}"`,
    userId: seller.id,
    userName: seller.name,
  });

  res.status(201).json(formatProduct(product, seller));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id as string));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // تحقق من اشتراك البائع
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, product.sellerId));
  const now = new Date();
  const sellerSubscribed =
    seller?.role === "admin" ||
    (seller?.isVerified === true && seller?.subscriptionExpiresAt != null && seller.subscriptionExpiresAt > now);
  if (!sellerSubscribed) {
    res.status(404).json({ error: "Product not available" });
    return;
  }

  await db.update(productsTable).set({ viewCount: product.viewCount + 1 }).where(eq(productsTable.id, id as string));
  let catName: string | null = null;
  if (product.categoryId) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
    catName = cat?.name ?? null;
  }

  res.json(formatProduct({ ...product, viewCount: product.viewCount + 1 }, seller, catName));
});

router.patch("/products/:id", authenticate, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id as string));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (existing.sellerId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { title, description, price, originalPrice, images, categoryId } = req.body;
  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = String(price);
  if (originalPrice !== undefined) updates.originalPrice = originalPrice != null ? String(originalPrice) : null;
  if (images !== undefined) updates.images = images;
  if (categoryId !== undefined) updates.categoryId = categoryId;

  await db.update(productsTable).set(updates).where(eq(productsTable.id, id as string));
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id as string));
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, product.sellerId));
  res.json(formatProduct(product, seller));
});

router.delete("/products/:id", authenticate, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id as string));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (existing.sellerId !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id as string));
  res.json({ message: "Product deleted" });
});

router.post("/products/:id/approve", authenticate, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body;
  if (!["active", "rejected"].includes(status)) {
    res.status(400).json({ error: "Status must be active or rejected" });
    return;
  }

  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id as string));
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await db.update(productsTable).set({ status }).where(eq(productsTable.id, id as string));
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id as string));
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, product.sellerId));

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: status === "active" ? "product_approved" : "product_rejected",
    description: `"${product.title}" was ${status === "active" ? "approved" : "rejected"}`,
    userId: seller?.id,
    userName: seller?.name,
  });

  if (seller?.pushToken) {
    try {
      await sendNotification({
        fcmToken: seller.pushToken,
        title: status === "active" ? "✅ تم قبول منتجك!" : "❌ تم رفض منتجك",
        body: status === "active"
          ? `منتجك "${product.title}" أصبح مرئياً للجميع الآن`
          : `منتجك "${product.title}" لم يستوفِ الشروط، راجع التفاصيل`,
        data: { type: "product", productId: product.id, status },
      });
    } catch (e: any) {
      console.warn("[Products] Notification failed:", e.message);
    }
  }

  res.json(formatProduct(product, seller));
});

export default router;
