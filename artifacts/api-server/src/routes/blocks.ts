import { Router, type IRouter } from "express";
import { db, blocksTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

// ── حظر مستخدم ──────────────────────────────────────────────
router.post("/blocks", authenticate, async (req, res): Promise<void> => {
  const blockerId = req.user!.id;
  const { blockedId } = req.body;

  if (!blockedId || blockerId === blockedId) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, blockedId));
  if (!target) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  // إدراج إذا لم يكن موجوداً
  await db.insert(blocksTable).values({ blockerId, blockedId }).onConflictDoNothing();

  res.json({ success: true });
});

// ── إلغاء الحظر ─────────────────────────────────────────────
router.delete("/blocks", authenticate, async (req, res): Promise<void> => {
  const blockerId = req.user!.id;
  const { blockedId } = req.body;

  if (!blockedId) {
    res.status(400).json({ error: "blockedId مطلوب" });
    return;
  }

  await db.delete(blocksTable)
    .where(and(eq(blocksTable.blockerId, blockerId), eq(blocksTable.blockedId, blockedId)));

  res.json({ success: true });
});

// ── التحقق من الحظر بين مستخدمين ────────────────────────────
router.get("/blocks/check", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const otherId = String(req.query.userId ?? "");

  if (!otherId) {
    res.status(400).json({ error: "userId مطلوب" });
    return;
  }

  const [block] = await db.select()
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, otherId)),
        and(eq(blocksTable.blockerId, otherId), eq(blocksTable.blockedId, userId))
      )
    );

  res.json({
    blocked: !!block,
    iBlockedThem: block ? block.blockerId === userId : false,
    theyBlockedMe: block ? block.blockerId === otherId : false,
  });
});

export default router;
