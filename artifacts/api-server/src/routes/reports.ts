import { Router, type IRouter } from "express";
import { db, reportsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

// ── إرسال تبليغ ─────────────────────────────────────────────
router.post("/reports", authenticate, async (req, res): Promise<void> => {
  const reporterId = req.user!.id;
  const { reportedId, conversationId, reason } = req.body;

  if (!reportedId || !reason?.trim()) {
    res.status(400).json({ error: "البيانات ناقصة" });
    return;
  }

  if (reporterId === reportedId) {
    res.status(400).json({ error: "لا يمكنك الإبلاغ عن نفسك" });
    return;
  }

  const [reportedUser] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, reportedId));
  if (!reportedUser) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const [reporter] = await db.select({ name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, reporterId));

  const id = randomUUID();
  await db.insert(reportsTable).values({
    id,
    reporterId,
    reportedId,
    conversationId: conversationId ?? null,
    reason: reason.trim(),
    status: "pending",
  });

  // إشعار الأدمن
  const admins = await db.select({ pushToken: usersTable.pushToken })
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), eq(usersTable.banned, false)));

  for (const admin of admins) {
    if (admin.pushToken) {
      sendNotification({
        fcmToken: admin.pushToken,
        title: "🚨 تبليغ جديد",
        body: `${reporter?.name ?? "مستخدم"} أبلغ عن ${reportedUser.name}: ${reason.trim().slice(0, 60)}`,
        data: { type: "report", reportId: id },
      }).catch(() => {});
    }
  }

  res.json({ success: true, id });
});

// ── الأدمن: عرض جميع التبليغات ──────────────────────────────
router.get("/admin/reports", authenticate, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "ممنوع" });
    return;
  }

  const reports = await db.select({
    id: reportsTable.id,
    reason: reportsTable.reason,
    status: reportsTable.status,
    conversationId: reportsTable.conversationId,
    createdAt: reportsTable.createdAt,
    reporterId: reportsTable.reporterId,
    reportedId: reportsTable.reportedId,
  }).from(reportsTable).orderBy(desc(reportsTable.createdAt));

  const userIds = [...new Set(reports.flatMap(r => [r.reporterId, r.reportedId]))];
  const users = userIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name, avatar: usersTable.avatar, phone: usersTable.phone })
        .from(usersTable).where(eq(usersTable.id, userIds[0]))
    : [];

  // Fetch all users involved
  const allUsers: Record<string, { id: string; name: string; avatar: string | null; phone: string | null }> = {};
  for (const uid of userIds) {
    const [u] = await db.select({ id: usersTable.id, name: usersTable.name, avatar: usersTable.avatar, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, uid));
    if (u) allUsers[uid] = u;
  }
  void users;

  res.json(reports.map(r => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    conversationId: r.conversationId,
    createdAt: r.createdAt.toISOString(),
    reporter: allUsers[r.reporterId] ?? { id: r.reporterId, name: "مجهول", avatar: null, phone: null },
    reported: allUsers[r.reportedId] ?? { id: r.reportedId, name: "مجهول", avatar: null, phone: null },
  })));
});

// ── الأدمن: تحديث حالة التبليغ ──────────────────────────────
router.patch("/admin/reports/:id/status", authenticate, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "ممنوع" });
    return;
  }

  const { id } = req.params;
  const { status } = req.body;
  if (!["pending", "reviewed", "dismissed"].includes(status)) {
    res.status(400).json({ error: "حالة غير صالحة" });
    return;
  }

  await db.update(reportsTable)
    .set({ status })
    .where(eq(reportsTable.id, id as string));

  res.json({ success: true });
});

export default router;
