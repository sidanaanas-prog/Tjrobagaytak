import { Router, type IRouter } from "express";
import { db, promotionsTable, usersTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate, requireAdmin } from "../lib/auth";
const router: IRouter = Router();

function validatePromotion(body: any) {
  const errors: string[] = [];
  if (!body.name || typeof body.name !== "string") errors.push("name required");
  if (!["challenge", "discount", "flash"].includes(body.type)) errors.push("type must be challenge|discount|flash");
  if (!["6months", "12months", "both"].includes(body.plan)) errors.push("plan must be 6months|12months|both");
  if (typeof body.originalPrice !== "number" || body.originalPrice <= 0) errors.push("originalPrice must be positive number");
  if (typeof body.discountedPrice !== "number" || body.discountedPrice <= 0) errors.push("discountedPrice must be positive number");
  if (typeof body.discountPercent !== "number" || body.discountPercent < 0 || body.discountPercent > 100) errors.push("discountPercent must be 0-100");
  return errors;
}

// ── المشتري: العروض النشطة ──────────────────────────────────────────────────
router.get("/promotions/active", async (req, res): Promise<void> => {
  try {
    const rows = (await db
      .select()
      .from(promotionsTable)
      .where(eq(promotionsTable.isActive, true))
      .orderBy(desc(promotionsTable.createdAt))) ?? [];

    const now = new Date();
    const valid = rows.filter((p) => {
      if (p.startAt && new Date(p.startAt) > now) return false;
      if (p.endAt && new Date(p.endAt) < now) return false;
      return true;
    });

    res.json(valid);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: قائمة جميع العروض ──────────────────────────────────────────────────
router.get("/admin/promotions", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = (await db
      .select()
      .from(promotionsTable)
      .orderBy(desc(promotionsTable.createdAt))) ?? [];

    const userIds = [...new Set(rows.filter((r) => r.createdBy).map((r) => r.createdBy))].filter(Boolean) as string[];
    const users = userIds.length > 0
      ? (await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds))) ?? []
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json(rows.map((p) => ({ ...p, createdByName: userMap[p.createdBy ?? ""]?.name ?? null })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: إنشاء عرض جديد ──────────────────────────────────────────────────
router.post("/admin/promotions", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const errors = validatePromotion(body);
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join(", ") });
      return;
    }
    const id = randomUUID();
    const now = new Date();

    await db.insert(promotionsTable).values({
      id,
      name: body.name,
      description: body.description ?? null,
      type: body.type,
      plan: body.plan,
      originalPrice: String(body.originalPrice),
      discountedPrice: String(body.discountedPrice),
      discountPercent: body.discountPercent,
      isActive: body.isActive,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      trialDays: body.trialDays ?? null,
      goalDescription: body.goalDescription ?? null,
      reward: body.reward ?? null,
      showCountdown: body.showCountdown,
      countdownMessage: body.countdownMessage ?? null,
      maxUsers: body.maxUsers ?? null,
      usedCount: 0,
      createdAt: now,
      createdBy: (req as any).user?.id ?? null,
    });

    res.json({ id, success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── الأدمن: تعديل عرض ──────────────────────────────────────────────────
router.put("/admin/promotions/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const updates: any = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.type !== undefined) updates.type = body.type;
    if (body.plan !== undefined) updates.plan = body.plan;
    if (body.originalPrice !== undefined) updates.originalPrice = String(body.originalPrice);
    if (body.discountedPrice !== undefined) updates.discountedPrice = String(body.discountedPrice);
    if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.startAt !== undefined) updates.startAt = body.startAt ? new Date(body.startAt) : null;
    if (body.endAt !== undefined) updates.endAt = body.endAt ? new Date(body.endAt) : null;
    if (body.trialDays !== undefined) updates.trialDays = body.trialDays;
    if (body.goalDescription !== undefined) updates.goalDescription = body.goalDescription;
    if (body.reward !== undefined) updates.reward = body.reward;
    if (body.showCountdown !== undefined) updates.showCountdown = body.showCountdown;
    if (body.countdownMessage !== undefined) updates.countdownMessage = body.countdownMessage;
    if (body.maxUsers !== undefined) updates.maxUsers = body.maxUsers;

    await db.update(promotionsTable).set(updates).where(eq(promotionsTable.id, req.params.id as string));
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── الأدمن: تبديل التفعيل/إيقاف ──────────────────────────────────────────────────
router.patch("/admin/promotions/:id/toggle", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    const [existing] = (await db.select().from(promotionsTable).where(eq(promotionsTable.id, req.params.id as string))) ?? [];
    if (!existing) {
      res.status(404).json({ error: "العرض غير موجود" });
      return;
    }
    await db.update(promotionsTable).set({ isActive: !existing.isActive }).where(eq(promotionsTable.id, req.params.id as string));
    res.json({ success: true, isActive: !existing.isActive });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── الأدمن: حذف عرض ──────────────────────────────────────────────────
router.delete("/admin/promotions/:id", authenticate, requireAdmin, async (req, res): Promise<void> => {
  try {
    await db.delete(promotionsTable).where(eq(promotionsTable.id, req.params.id as string));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
