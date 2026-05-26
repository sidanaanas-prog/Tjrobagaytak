import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db, storiesTable, usersTable, storyViewsTable, storyLikesTable } from "@workspace/db";
import { eq, gt, and, desc, sql, inArray } from "drizzle-orm";
import { authenticate, optionalAuthenticate } from "../lib/auth";

const router: IRouter = Router();

router.get("/stories", optionalAuthenticate, async (req, res): Promise<void> => {
  const now = new Date();
  const viewerId = (req as any).user?.id ?? null;

  const stories = await db
    .select({
      id: storiesTable.id,
      userId: storiesTable.userId,
      mediaUrl: storiesTable.mediaUrl,
      mediaType: storiesTable.mediaType,
      bgColor: storiesTable.bgColor,
      fontFamily: storiesTable.fontFamily,
      caption: storiesTable.caption,
      expiresAt: storiesTable.expiresAt,
      createdAt: storiesTable.createdAt,
      userName: usersTable.name,
      userAvatar: usersTable.avatar,
      userRole: usersTable.role,
    })
    .from(storiesTable)
    .innerJoin(usersTable, eq(storiesTable.userId, usersTable.id))
    .where(and(eq(storiesTable.isActive, true), gt(storiesTable.expiresAt, now)))
    .orderBy(desc(storiesTable.createdAt));

  const storyIds = stories.map((s) => s.id);
  let viewData: Array<{ storyId: string; viewCount: number; viewedByMe: boolean }> = [];
  let likeData: Array<{ storyId: string; likeCount: number; likedByMe: boolean }> = [];

  if (storyIds.length > 0) {
    const views = await db
      .select({
        storyId: storyViewsTable.storyId,
        viewCount: sql<number>`count(*)::int`,
        viewedByMe: viewerId
          ? sql<boolean>`bool_or(${storyViewsTable.viewerId} = ${viewerId})`
          : sql<boolean>`false`,
      })
      .from(storyViewsTable)
      .where(inArray(storyViewsTable.storyId, storyIds))
      .groupBy(storyViewsTable.storyId);

    viewData = views.map((v) => ({
      storyId: v.storyId,
      viewCount: v.viewCount,
      viewedByMe: Boolean(v.viewedByMe),
    }));

    const likes = await db
      .select({
        storyId: storyLikesTable.storyId,
        likeCount: sql<number>`count(*)::int`,
        likedByMe: viewerId
          ? sql<boolean>`bool_or(${storyLikesTable.userId} = ${viewerId})`
          : sql<boolean>`false`,
      })
      .from(storyLikesTable)
      .where(inArray(storyLikesTable.storyId, storyIds))
      .groupBy(storyLikesTable.storyId);

    likeData = likes.map((v) => ({
      storyId: v.storyId,
      likeCount: v.likeCount,
      likedByMe: Boolean(v.likedByMe),
    }));
  }

  const viewMap = Object.fromEntries(viewData.map((v) => [v.storyId, v]));
  const likeMap = Object.fromEntries(likeData.map((v) => [v.storyId, v]));

  const storiesWithMeta = stories.map((s) => ({
    ...s,
    viewCount: viewMap[s.id]?.viewCount ?? 0,
    viewedByMe: viewMap[s.id]?.viewedByMe ?? false,
    likeCount: likeMap[s.id]?.likeCount ?? 0,
    likedByMe: likeMap[s.id]?.likedByMe ?? false,
  }));

  const grouped = storiesWithMeta.reduce<
    Record<string, {
      userId: string;
      userName: string;
      userAvatar: string | null;
      userRole: string;
      allViewed: boolean;
      stories: typeof storiesWithMeta;
    }>
  >((acc, story) => {
    if (!acc[story.userId]) {
      acc[story.userId] = {
        userId: story.userId,
        userName: story.userName,
        userAvatar: story.userAvatar,
        userRole: story.userRole,
        allViewed: true,
        stories: [],
      };
    }
    if (!story.viewedByMe) acc[story.userId].allViewed = false;
    acc[story.userId].stories.push(story);
    return acc;
  }, {});

  const result = Object.values(grouped).sort((a, b) =>
    a.allViewed === b.allViewed ? 0 : a.allViewed ? 1 : -1
  );

  res.json(result);
});

router.post("/stories", authenticate, async (req, res): Promise<void> => {
  const { mediaUrl, mediaType = "image", caption, bgColor, fontFamily } = req.body;

  if (mediaType === "text") {
    if (!caption?.trim()) {
      res.status(400).json({ error: "نص الحالة مطلوب" });
      return;
    }
  } else {
    if (!mediaUrl) {
      res.status(400).json({ error: "الصورة مطلوبة" });
      return;
    }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [story] = await db
    .insert(storiesTable)
    .values({
      id: randomUUID(),
      userId: req.user!.id,
      mediaUrl: mediaUrl ?? null,
      mediaType,
      bgColor: bgColor ?? null,
      fontFamily: fontFamily ?? null,
      caption: caption?.trim() ?? null,
      isActive: true,
      expiresAt,
    })
    .returning();

  res.status(201).json(story);
});

router.post("/stories/:id/view", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const viewerId = req.user!.id;

  const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id as string));
  if (!story || !story.isActive) {
    res.status(404).json({ error: "الحالة غير موجودة" });
    return;
  }

  if (story.userId === viewerId) {
    res.json({ ok: true });
    return;
  }

  await db
    .insert(storyViewsTable)
    .values({ storyId: id as string, viewerId })
    .onConflictDoNothing();

  res.json({ ok: true });
});

router.post("/stories/:id/like", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id as string));
  if (!story || !story.isActive) {
    res.status(404).json({ error: "الحالة غير موجودة" });
    return;
  }

  // Toggle: بدفع نتحقق من وجود الإعجاب
  const [existing] = await db
    .select()
    .from(storyLikesTable)
    .where(and(eq(storyLikesTable.storyId, id as string), eq(storyLikesTable.userId, userId)));

  if (existing) {
    // إلغاء الإعجاب
    await db
      .delete(storyLikesTable)
      .where(and(eq(storyLikesTable.storyId, id as string), eq(storyLikesTable.userId, userId)));
  } else {
    // إضافة إعجاب
    await db
      .insert(storyLikesTable)
      .values({ storyId: id as string, userId })
      .onConflictDoNothing();
  }

  const [row] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(storyLikesTable)
    .where(eq(storyLikesTable.storyId, id as string));

  res.json({ liked: !existing, likeCount: Number(row?.cnt ?? 0) });
});

router.delete("/stories/:id/like", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  await db
    .delete(storyLikesTable)
    .where(and(eq(storyLikesTable.storyId, id as string), eq(storyLikesTable.userId, userId)));

  const [row] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(storyLikesTable)
    .where(eq(storyLikesTable.storyId, id as string));

  res.json({ liked: false, likeCount: Number(row?.cnt ?? 0) });
});

router.get("/stories/:id/viewers", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id as string));
  if (!story) {
    res.status(404).json({ error: "الحالة غير موجودة" });
    return;
  }
  if (story.userId !== userId) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const viewers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      avatar: usersTable.avatar,
      viewedAt: storyViewsTable.viewedAt,
    })
    .from(storyViewsTable)
    .innerJoin(usersTable, eq(storyViewsTable.viewerId, usersTable.id))
    .where(eq(storyViewsTable.storyId, id as string))
    .orderBy(desc(storyViewsTable.viewedAt));

  res.json(viewers);
});

router.get("/stories/:id/likes", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id as string));
  if (!story) {
    res.status(404).json({ error: "الحالة غير موجودة" });
    return;
  }
  if (story.userId !== userId) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const likers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      avatar: usersTable.avatar,
      likedAt: storyLikesTable.likedAt,
    })
    .from(storyLikesTable)
    .innerJoin(usersTable, eq(storyLikesTable.userId, usersTable.id))
    .where(eq(storyLikesTable.storyId, id as string))
    .orderBy(desc(storyLikesTable.likedAt));

  res.json(likers);
});

router.delete("/stories/:id", authenticate, async (req, res): Promise<void> => {
  const { id } = req.params;

  const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id as string));
  if (!story) {
    res.status(404).json({ error: "الحالة غير موجودة" });
    return;
  }

  if (story.userId !== req.user!.id) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  await db.update(storiesTable).set({ isActive: false }).where(eq(storiesTable.id, id as string));
  res.json({ message: "تم حذف الحالة" });
});

export default router;
