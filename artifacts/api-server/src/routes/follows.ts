import { Router, type IRouter } from "express";
import { db, followsTable, usersTable, productsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

// ── متابعة بائع ───────────────────────────────────────────
router.post("/follows", authenticate, async (req, res): Promise<void> => {
  const followerId = req.user!.id;
  const { sellerId } = req.body;

  if (!sellerId) {
    res.status(400).json({ error: "sellerId مطلوب" });
    return;
  }
  if (followerId === sellerId) {
    res.status(400).json({ error: "لا يمكنك متابعة نفسك" });
    return;
  }

  try {
    await db.insert(followsTable).values({ followerId, sellerId }).onConflictDoNothing();

    // إشعار للبائع بمتابع جديد (من users.pushToken مباشرة)
    const [follower] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, followerId));
    const [sellerRow] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, sellerId));
    if (sellerRow?.pushToken) {
      try {
        await sendNotification({
          fcmToken: sellerRow.pushToken,
          title: "متابع جديد! 👥",
          body: `${follower?.name ?? "مستخدم"} بدأ بمتابعة متجرك`,
          data: { type: "new_follower", followerId },
        });
      } catch {}
    }

    res.json({ success: true, following: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إلغاء متابعة بائع ────────────────────────────────────
router.delete("/follows", authenticate, async (req, res): Promise<void> => {
  const followerId = req.user!.id;
  const { sellerId } = req.body;

  if (!sellerId) {
    res.status(400).json({ error: "sellerId مطلوب" });
    return;
  }

  await db.delete(followsTable).where(
    and(eq(followsTable.followerId, followerId), eq(followsTable.sellerId, sellerId))
  );

  res.json({ success: true, following: false });
});

// ── هل المستخدم يتابع هذا البائع؟ ────────────────────────
router.get("/follows/check", authenticate, async (req, res): Promise<void> => {
  const followerId = req.user!.id;
  const sellerId = String(req.query.sellerId ?? "");

  if (!sellerId) {
    res.status(400).json({ error: "sellerId مطلوب" });
    return;
  }

  const [row] = await db.select().from(followsTable).where(
    and(eq(followsTable.followerId, followerId), eq(followsTable.sellerId, sellerId))
  );

  res.json({ following: !!row });
});

// ── عدد المتابعين لبائع معين ──────────────────────────────
router.get("/seller/:id/followers", async (req, res): Promise<void> => {
  const sellerId = req.params.id;
  const [{ cnt }] = await db.select({ cnt: count() }).from(followsTable).where(eq(followsTable.sellerId, sellerId));
  res.json({ count: cnt });
});

// ── قائمة المتاجر المتبوعة (للمستخدم الحالي) ────────────────
router.get("/user/following", authenticate, async (req, res): Promise<void> => {
  const followerId = req.user!.id;
  const rows = await db
    .select()
    .from(followsTable)
    .where(eq(followsTable.followerId, followerId))
    .orderBy(followsTable.createdAt);

  const sellerIds = rows.map((r) => r.sellerId);
  if (sellerIds.length === 0) {
    res.json([]);
    return;
  }

  const sellers = await db.select().from(usersTable).where(inArray(usersTable.id, sellerIds));

  // عدد المنتجات لكل بائع
  const productCounts = await db
    .select({ sellerId: productsTable.sellerId, cnt: count() })
    .from(productsTable)
    .where(inArray(productsTable.sellerId, sellerIds))
    .groupBy(productsTable.sellerId);

  const countMap = Object.fromEntries(productCounts.map((p) => [p.sellerId, p.cnt]));

  const result = sellers.map((s) => ({
    id: s.id,
    name: s.name,
    avatar: s.avatar,
    productCount: countMap[s.id] ?? 0,
  }));

  res.json(result);
});

export default router;
