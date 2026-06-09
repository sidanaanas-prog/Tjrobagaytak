import { Router, type IRouter } from "express";
import { db, userRolesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

// ── أدواري ──────────────────────────────────────────────────
router.get("/user/roles", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const rows = (await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId))) ?? [];
    res.json(rows.map((r) => r.role));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إضافة دور ──────────────────────────────────────────────────
router.post("/user/roles", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { role } = req.body;
    if (!["seller", "driver", "passenger", "shopper"].includes(role)) {
      res.status(400).json({ error: "دور غير صالح" });
      return;
    }

    const existing = (await db.select().from(userRolesTable).where(
      and(eq(userRolesTable.userId, userId), eq(userRolesTable.role, role))
    )) ?? [];

    if (existing.length > 0) {
      res.status(400).json({ error: "الدور موجود بالفعل" });
      return;
    }

    await db.insert(userRolesTable).values({
      id: randomUUID(),
      userId,
      role,
      isActive: true,
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── إدارة الأدوار ──────────────────────────────────────────────────
router.patch("/user/roles/:role", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const role = req.params.role;
    const { isActive } = req.body;

    await db.update(userRolesTable).set({ isActive }).where(
      and(eq(userRolesTable.userId, userId), eq(userRolesTable.role, role as string))
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── حذف دور ──────────────────────────────────────────────────
router.delete("/user/roles/:role", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const role = req.params.role;

    await db.delete(userRolesTable).where(
      and(eq(userRolesTable.userId, userId), eq(userRolesTable.role, role as string))
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
