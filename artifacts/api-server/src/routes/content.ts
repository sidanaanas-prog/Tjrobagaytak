import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db, contentVideosTable, contentLikesTable, contentCommentsTable, contentViewsTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import { authenticate, optionalAuthenticate } from "../lib/auth";
import { sendNotification } from "../lib/notifications";

const router: IRouter = Router();

router.get("/content", optionalAuthenticate, async (req, res): Promise<void> => {
  const viewerId = (req as any).user?.id ?? null;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Number(req.query.offset) || 0;
  const filterUserId = req.query.userId ? String(req.query.userId) : null;

  const videos = await db
    .select({
      id: contentVideosTable.id,
      userId: contentVideosTable.userId,
      videoUrl: contentVideosTable.videoUrl,
      thumbnailUrl: contentVideosTable.thumbnailUrl,
      caption: contentVideosTable.caption,
      likesCount: contentVideosTable.likesCount,
      viewsCount: contentVideosTable.viewsCount,
      createdAt: contentVideosTable.createdAt,
      userName: usersTable.name,
      userAvatar: usersTable.avatar,
      userRole: usersTable.role,
    })
    .from(contentVideosTable)
    .innerJoin(usersTable, eq(contentVideosTable.userId, usersTable.id))
    .where(filterUserId ? eq(contentVideosTable.userId, filterUserId) : undefined)
    .orderBy(desc(contentVideosTable.createdAt))
    .limit(limit)
    .offset(offset);

  let likedIds = new Set<string>();
  if (viewerId && videos.length > 0) {
    const videoIds = videos.map((v) => v.id);
    const likes = await db
      .select({ videoId: contentLikesTable.videoId })
      .from(contentLikesTable)
      .where(and(
        inArray(contentLikesTable.videoId, videoIds),
        eq(contentLikesTable.userId, viewerId)
      ));
    likedIds = new Set(likes.map((l) => l.videoId));
  }

  res.json(videos.map((v) => ({ ...v, likedByMe: likedIds.has(v.id) })));
});

router.post("/content", authenticate, async (req, res): Promise<void> => {
  const { videoUrl, thumbnailUrl, caption } = req.body;
  if (!videoUrl) {
    res.status(400).json({ error: "رابط الفيديو مطلوب" });
    return;
  }

  const [video] = await db
    .insert(contentVideosTable)
    .values({
      id: randomUUID(),
      userId: req.user!.id,
      videoUrl,
      thumbnailUrl: thumbnailUrl ?? null,
      caption: caption ?? null,
    })
    .returning();

  res.status(201).json(video);
});

router.post("/content/:id/like", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [video] = await db.select().from(contentVideosTable).where(eq(contentVideosTable.id, id as string));
  if (!video) { res.status(404).json({ error: "الفيديو غير موجود" }); return; }

  const [existing] = await db
    .select()
    .from(contentLikesTable)
    .where(and(eq(contentLikesTable.videoId, id as string), eq(contentLikesTable.userId, userId)));

  if (existing) {
    await db.delete(contentLikesTable)
      .where(and(eq(contentLikesTable.videoId, id as string), eq(contentLikesTable.userId, userId)));
    await db.update(contentVideosTable)
      .set({ likesCount: sql`${contentVideosTable.likesCount} - 1` })
      .where(eq(contentVideosTable.id, id as string));
    res.json({ liked: false, likesCount: Math.max(0, video.likesCount - 1) });
  } else {
    await db.insert(contentLikesTable).values({ videoId: id as string, userId }).onConflictDoNothing();
    await db.update(contentVideosTable)
      .set({ likesCount: sql`${contentVideosTable.likesCount} + 1` })
      .where(eq(contentVideosTable.id, id as string));
    res.json({ liked: true, likesCount: video.likesCount + 1 });

    // إشعار لصاحب الفيديو (إذا لم يكن هو نفسه)
    if (video.userId !== userId) {
      const [liker] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
      const [owner] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, video.userId));
      if (owner?.pushToken) {
        sendNotification({
          fcmToken: owner.pushToken,
          title: "❤️ إعجاب جديد",
          body: `${liker?.name ?? "مستخدم"} أعجب بفيديوك`,
          data: { type: "video_like", videoId: id as string },
        }).catch(() => {});
      }
    }
  }
});

router.post("/content/:id/view", optionalAuthenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const userId = (req as any).user?.id ?? null;

  // تجزئة IP للمستخدمين غير المسجلين
  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const ipHash = createHash("sha256").update(rawIp).digest("hex").slice(0, 16);

  // إدخال مشاهدة — نستخدم returning() لمعرفة إن كانت جديدة فعلاً
  const inserted = await db.insert(contentViewsTable).values({
    id: randomUUID(),
    videoId: id as string,
    userId: userId ?? null,
    ipHash: userId ? null : ipHash,
  }).onConflictDoNothing().returning({ id: contentViewsTable.id });

  // نزيد العداد فقط عند مشاهدة جديدة حقيقية
  if (inserted.length > 0) {
    await db.update(contentVideosTable)
      .set({ viewsCount: sql`${contentVideosTable.viewsCount} + 1` })
      .where(eq(contentVideosTable.id, id as string));
  }

  res.json({ ok: true });
});

// ── من شاهد الفيديو ──────────────────────────────────────
router.get("/content/:id/viewers", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const [video] = await db.select({ userId: contentVideosTable.userId }).from(contentVideosTable).where(eq(contentVideosTable.id, id as string));
  if (!video || video.userId !== req.user!.id) {
    res.status(403).json({ error: "غير مصرح — أنت لست صاحب الفيديو" });
    return;
  }

  const viewers = await db
    .select({
      userId: contentViewsTable.userId,
      viewedAt: contentViewsTable.createdAt,
      userName: usersTable.name,
      userAvatar: usersTable.avatar,
    })
    .from(contentViewsTable)
    .leftJoin(usersTable, eq(contentViewsTable.userId, usersTable.id))
    .where(eq(contentViewsTable.videoId, id as string))
    .orderBy(desc(contentViewsTable.createdAt))
    .limit(100);

  res.json(viewers);
});

// ── تعليقات الفيديو ──────────────────────────────────────
router.get("/content/:id/comments", async (req, res): Promise<void> => {
  const { id } = req.params;
  const rows = await db
    .select({
      id: contentCommentsTable.id,
      text: contentCommentsTable.text,
      createdAt: contentCommentsTable.createdAt,
      userId: contentCommentsTable.userId,
      userName: usersTable.name,
      userAvatar: usersTable.avatar,
      userRole: usersTable.role,
    })
    .from(contentCommentsTable)
    .innerJoin(usersTable, eq(contentCommentsTable.userId, usersTable.id))
    .where(eq(contentCommentsTable.videoId, id as string))
    .orderBy(desc(contentCommentsTable.createdAt))
    .limit(50);
  res.json(rows);
});

router.post("/content/:id/comments", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: "التعليق فارغ" }); return; }

  const [comment] = await db
    .insert(contentCommentsTable)
    .values({ id: randomUUID(), videoId: id as string, userId: req.user!.id, text: text.trim() })
    .returning();

  const [video] = await db.select({ userId: contentVideosTable.userId }).from(contentVideosTable).where(eq(contentVideosTable.id, id as string));
  if (video && video.userId !== req.user!.id) {
    const [commenter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.id));
    const [owner] = await db.select({ pushToken: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, video.userId));
    if (owner?.pushToken) {
      sendNotification({
        fcmToken: owner.pushToken,
        title: "💬 تعليق جديد",
        body: `${commenter?.name ?? "مستخدم"}: ${text.trim().slice(0, 60)}`,
        data: { type: "video_comment", videoId: id as string },
      }).catch(() => {});
    }
  }

  res.status(201).json(comment);
});

router.delete("/content/:id/comments/:commentId", authenticate, async (req, res): Promise<void> => {
  const { commentId } = req.params;
  const [c] = await db.select().from(contentCommentsTable).where(eq(contentCommentsTable.id, commentId as string));
  if (!c || c.userId !== req.user!.id) { res.status(403).json({ error: "غير مصرح" }); return; }
  await db.delete(contentCommentsTable).where(eq(contentCommentsTable.id, commentId as string));
  res.json({ ok: true });
});

router.delete("/content/:id", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const [video] = await db.select().from(contentVideosTable).where(eq(contentVideosTable.id, id as string));
  if (!video) { res.status(404).json({ error: "الفيديو غير موجود" }); return; }
  if (video.userId !== req.user!.id) { res.status(403).json({ error: "غير مصرح" }); return; }
  await db.delete(contentVideosTable).where(eq(contentVideosTable.id, id as string));
  res.json({ message: "تم الحذف" });
});

export default router;
