import { Router, type IRouter } from "express";
import { db, userRolesTable, usersTable, driverProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

const DAYS7_MS = 7 * 24 * 60 * 60 * 1000;

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

    // —— تفعيل التجربة المجانية 7 أيام عند اختيار بائع/سائق ——
    const now = new Date();
    const trialExpiry = new Date(now.getTime() + DAYS7_MS);

    if (role === "seller") {
      const [user] = (await db.select({ trialExpiresAt: usersTable.trialExpiresAt })
        .from(usersTable).where(eq(usersTable.id, userId))) ?? [];
      // نفعّل التجربة فقط إذا ما كانت مفعّلة من قبل
      if (!user?.trialExpiresAt || new Date(user.trialExpiresAt) <= now) {
        await db.update(usersTable)
          .set({ trialExpiresAt: trialExpiry })
          .where(eq(usersTable.id, userId));
      }
    }

    if (role === "driver") {
      const [profile] = (await db.select({ trialExpiresAt: driverProfilesTable.trialExpiresAt })
        .from(driverProfilesTable).where(eq(driverProfilesTable.userId, userId))) ?? [];
      // نفعّل التجربة فقط إذا ما كانت مفعّلة من قبل
      if (!profile?.trialExpiresAt || new Date(profile.trialExpiresAt) <= now) {
        // إذا ما كان موجود ملف السائق — ننشئه مع التجربة
        if (!profile) {
          await db.insert(driverProfilesTable).values({
            id: randomUUID(),
            userId,
            trialExpiresAt: trialExpiry,
            createdAt: now,
          });
        } else {
          await db.update(driverProfilesTable)
            .set({ trialExpiresAt: trialExpiry })
            .where(eq(driverProfilesTable.userId, userId));
        }
      }
    }

    res.json({ success: true, trialExpiresAt: trialExpiry });
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
