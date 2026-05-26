import { Router, type IRouter } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { authenticate, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

// ── عام: جلب البانرات النشطة للصفحة الرئيسية ──────────────────
router.get("/banners", async (_req, res): Promise<void> => {
  const banners = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.isActive, true))
    .orderBy(asc(bannersTable.sortOrder));

  res.json(banners);
});

// ── أدمن: جلب كل البانرات ──────────────────────────────────────
router.get("/admin/banners", authenticate, requireAdmin, async (_req, res): Promise<void> => {
  const banners = await db
    .select()
    .from(bannersTable)
    .orderBy(asc(bannersTable.sortOrder));

  res.json(banners);
});

// ── أدمن: إنشاء بانر جديد ──────────────────────────────────────
router.post("/admin/banners", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { title, subtitle, emoji, bg, accent, imageUrl, linkUrl, isActive, sortOrder } = req.body;

  if (!title?.trim()) {
    res.status(400).json({ error: "العنوان مطلوب" });
    return;
  }

  const [banner] = await db
    .insert(bannersTable)
    .values({
      title: title.trim(),
      subtitle: subtitle?.trim() ?? null,
      emoji: emoji?.trim() || "🛍️",
      bg: bg?.trim() || "from-violet-600/40 to-fuchsia-600/20",
      accent: accent?.trim() || "#a855f7",
      imageUrl: imageUrl?.trim() ?? null,
      linkUrl: linkUrl?.trim() ?? null,
      isActive: isActive !== false,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
    })
    .returning();

  res.status(201).json(banner);
});

// ── أدمن: تعديل بانر ──────────────────────────────────────────
router.put("/admin/banners/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { title, subtitle, emoji, bg, accent, imageUrl, linkUrl, isActive, sortOrder } = req.body;

  if (!title?.trim()) {
    res.status(400).json({ error: "العنوان مطلوب" });
    return;
  }

  const [banner] = await db
    .update(bannersTable)
    .set({
      title: title.trim(),
      subtitle: subtitle?.trim() ?? null,
      emoji: emoji?.trim() || "🛍️",
      bg: bg?.trim() || "from-violet-600/40 to-fuchsia-600/20",
      accent: accent?.trim() || "#a855f7",
      imageUrl: imageUrl?.trim() ?? null,
      linkUrl: linkUrl?.trim() ?? null,
      isActive: isActive !== false,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
    })
    .where(eq(bannersTable.id, id as string))
    .returning();

  if (!banner) {
    res.status(404).json({ error: "البانر غير موجود" });
    return;
  }

  res.json(banner);
});

// ── أدمن: تفعيل/إيقاف بانر ────────────────────────────────────
router.patch("/admin/banners/:id/toggle", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  const [existing] = await db.select().from(bannersTable).where(eq(bannersTable.id, id as string));
  if (!existing) {
    res.status(404).json({ error: "البانر غير موجود" });
    return;
  }

  const [banner] = await db
    .update(bannersTable)
    .set({ isActive: !existing.isActive })
    .where(eq(bannersTable.id, id as string))
    .returning();

  res.json(banner);
});

// ── أدمن: حذف بانر ────────────────────────────────────────────
router.delete("/admin/banners/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;

  await db.delete(bannersTable).where(eq(bannersTable.id, id as string));
  res.json({ ok: true });
});

export default router;
