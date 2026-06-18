import { Router, type IRouter } from "express";
import { db, conversationsTable, messagesTable, usersTable, productsTable, activityTable, typingIndicatorsTable } from "@workspace/db";
import { eq, and, or, desc, inArray, ne, gte, sql } from "drizzle-orm";
import { authenticate } from "../lib/auth";
import { randomUUID } from "crypto";
import { sendNotification } from "../lib/notifications";
import { sendWasenderText } from "../lib/wasender";

const ADMIN_PHONE = process.env.ADMIN_PHONE || "";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.role === "admin" ? "دعم غايتك" : user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    banned: user.banned,
    isVerified: user.isVerified,
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function formatMessage(m: typeof messagesTable.$inferSelect) {
  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, m.senderId));
  let replyTo = null;
  if (m.replyToId) {
    const [replyMsg] = await db.select().from(messagesTable).where(eq(messagesTable.id, m.replyToId));
    if (replyMsg) {
      const [replySender] = await db.select().from(usersTable).where(eq(usersTable.id, replyMsg.senderId));
      replyTo = {
        id: replyMsg.id,
        content: replyMsg.content,
        senderName: replySender?.name ?? "مستخدم",
        senderId: replyMsg.senderId,
      };
    }
  }
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: sender ? formatUser(sender) : null,
    content: m.content,
    replyToId: m.replyToId,
    replyTo,
    imageUrl: m.imageUrl,
    voiceUrl: m.voiceUrl,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/conversations", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === "admin";

  let conversations;
  if (isAdmin) {
    // Admins see ALL conversations that involve ANY admin user
    const adminUsers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "admin"));
    const adminIds = adminUsers.map((u) => u.id);
    conversations = await db
      .select()
      .from(conversationsTable)
      .where(or(inArray(conversationsTable.participant1Id, adminIds), inArray(conversationsTable.participant2Id, adminIds)))
      .orderBy(desc(conversationsTable.updatedAt));
  } else {
    conversations = await db
      .select()
      .from(conversationsTable)
      .where(or(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, userId)))
      .orderBy(desc(conversationsTable.updatedAt));
  }

  // Batch-fetch user data for ALL conversations in single queries to avoid N+1
  const allParticipantIds = [...new Set(conversations.flatMap(c => [c.participant1Id, c.participant2Id]))];
  const allUsers = allParticipantIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, allParticipantIds))
    : [];
  const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

  const allProductIds = [...new Set(conversations.map(c => c.productId).filter(Boolean))] as string[];
  const allProducts = allProductIds.length > 0
    ? await db.select().from(productsTable).where(inArray(productsTable.id, allProductIds))
    : [];
  const productMap = Object.fromEntries(allProducts.map(p => [p.id, p]));

  const allConvIds = conversations.map(c => c.id);
  const lastMessages = allConvIds.length > 0
    ? await db
        .select({
          conversationId: messagesTable.conversationId,
          content: messagesTable.content,
          senderId: messagesTable.senderId,
          createdAt: messagesTable.createdAt,
          id: messagesTable.id,
          isRead: messagesTable.isRead,
          replyToId: messagesTable.replyToId,
          imageUrl: messagesTable.imageUrl,
          voiceUrl: messagesTable.voiceUrl,
        })
        .from(messagesTable)
        .where(inArray(messagesTable.conversationId, allConvIds))
        .orderBy(desc(messagesTable.createdAt))
    : [];

  const lastMsgMap = new Map<string, typeof lastMessages[0]>();
  for (const m of lastMessages) {
    if (!lastMsgMap.has(m.conversationId)) lastMsgMap.set(m.conversationId, m);
  }

  const unreadCounts = allConvIds.length > 0
    ? await db
        .select({ conversationId: messagesTable.conversationId, cnt: sql<number>`count(*)::int` })
        .from(messagesTable)
        .where(and(
          inArray(messagesTable.conversationId, allConvIds),
          eq(messagesTable.isRead, false),
          sql`${messagesTable.senderId} != ${userId}`
        ))
        .groupBy(messagesTable.conversationId)
    : [];
  const unreadMap = Object.fromEntries(unreadCounts.map(u => [u.conversationId, u.cnt]));

  const result = conversations.map((conv) => {
    const p1 = userMap[conv.participant1Id];
    const p2 = userMap[conv.participant2Id];
    const product = conv.productId ? productMap[conv.productId] : null;
    const lastMsg = lastMsgMap.get(conv.id);
    const lastSender = lastMsg ? userMap[lastMsg.senderId] : null;
    const lastMessage = lastMsg ? {
      id: lastMsg.id,
      conversationId: lastMsg.conversationId,
      senderId: lastMsg.senderId,
      sender: lastSender ? formatUser(lastSender) : null,
      content: lastMsg.content,
      replyToId: lastMsg.replyToId,
      replyTo: null,
      imageUrl: lastMsg.imageUrl,
      voiceUrl: lastMsg.voiceUrl,
      isRead: lastMsg.isRead,
      createdAt: lastMsg.createdAt.toISOString(),
    } : null;
    const unreadCount = unreadMap[conv.id] ?? 0;

    return {
      id: conv.id,
      participants: [p1 ? formatUser(p1) : null, p2 ? formatUser(p2) : null].filter(Boolean),
      product: product ? { id: product.id, title: product.title, price: Number(product.price), images: product.images, status: product.status, sellerId: product.sellerId, createdAt: product.createdAt.toISOString() } : null,
      lastMessage,
      unreadCount,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    };
  });

  res.json(result);
});

router.post("/conversations", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { recipientId, productId } = req.body;
  if (!recipientId) {
    res.status(400).json({ error: "recipientId is required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        and(eq(conversationsTable.participant1Id, userId), eq(conversationsTable.participant2Id, recipientId)),
        and(eq(conversationsTable.participant1Id, recipientId), eq(conversationsTable.participant2Id, userId))
      )
    );

  if (existing) {
    const [p1] = await db.select().from(usersTable).where(eq(usersTable.id, existing.participant1Id));
    const [p2] = await db.select().from(usersTable).where(eq(usersTable.id, existing.participant2Id));

    if (productId) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
      if (product) {
        const price = Number(product.price).toFixed(0);
        const firstMsg = `\ud83d\udce6 *${product.title}*\n\ud83d\udcb0 ${price} \u062f\u062c\n\n\u0623\u0647\u0644\u0627\u064c\u060c \u0623\u0646\u0627 \u0645\u0647\u062a\u0645 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c`;
        await db.insert(messagesTable).values({
          id: randomUUID(),
          conversationId: existing.id,
          senderId: userId,
          content: firstMsg,
        });
      }
    }

    res.json({
      id: existing.id,
      participants: [p1 ? formatUser(p1) : null, p2 ? formatUser(p2) : null].filter(Boolean),
      product: null,
      lastMessage: null,
      unreadCount: 0,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    });
    return;
  }

  const id = randomUUID();
  const now = new Date();
  await db.insert(conversationsTable).values({
    id,
    participant1Id: userId,
    participant2Id: recipientId,
    productId: productId ?? null,
    updatedAt: now,
  });
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));

  const [p1] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const [p2] = await db.select().from(usersTable).where(eq(usersTable.id, conv.participant2Id));

  if (productId) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (product) {
      const price = Number(product.price).toFixed(0);
      const firstMsg = `\ud83d\udce6 *${product.title}*\n\ud83d\udcb0 ${price} \u062f\u062c\n\n\u0623\u0647\u0644\u0627\u064c\u060c \u0623\u0646\u0627 \u0645\u0647\u062a\u0645 \u0628\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c`;
      await db.insert(messagesTable).values({
        id: randomUUID(),
        conversationId: id,
        senderId: userId,
        content: firstMsg,
      });

      if (p2?.pushToken && p2.id === recipientId) {
        try {
          await sendNotification({
            fcmToken: p2.pushToken,
            title: `\u0631\u0633\u0627\u0644\u0629 \u062c\u062f\u064a\u062f\u0629 \u0645\u0646 ${p1?.name ?? "\u0645\u0633\u062a\u062e\u062f\u0645"} \ud83d\udce9`,
            body: `\u0645\u0647\u062a\u0645 \u0628\u0645\u0646\u062a\u062c\u0643: ${product.title}`,
            data: { type: "message", conversationId: id },
          });
        } catch (e: any) {
          console.warn("[Chat] Product notification failed:", e.message);
        }
      }
    }
  }

  res.json({
    id: conv.id,
    participants: [p1 ? formatUser(p1) : null, p2 ? formatUser(p2) : null].filter(Boolean),
    product: null,
    lastMessage: null,
    unreadCount: 0,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  });
});

router.get("/conversations/:id/messages", authenticate, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const search = (req.query.search as string)?.trim().toLowerCase();

  let messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt);

  if (search) {
    messages = messages.filter(m => m.content.toLowerCase().includes(search));
  }

  const result = await Promise.all(messages.map(m => formatMessage(m)));
  res.json(result);
});

router.post("/conversations/:id/messages", authenticate, async (req, res): Promise<void> => {
  const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { content, replyToId, imageUrl, voiceUrl } = req.body;

  if (!content && !imageUrl && !voiceUrl) {
    res.status(400).json({ error: "Content, imageUrl, or voiceUrl is required" });
    return;
  }

  const msgId = randomUUID();
  await db.insert(messagesTable).values({
    id: msgId,
    conversationId: convId,
    senderId: req.user!.id,
    content: content ?? "",
    replyToId: replyToId ?? null,
    imageUrl: imageUrl ?? null,
    voiceUrl: voiceUrl ?? null,
  });
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId));

  // تحديث تاريخ آخر محادثة لترتيب القائمة
  await db.update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, convId));

  const formatted = await formatMessage(msg);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (conv) {
    const recipientId = conv.participant1Id === req.user!.id ? conv.participant2Id : conv.participant1Id;
    const [recipient] = await db.select().from(usersTable).where(eq(usersTable.id, recipientId));
    const senderName = formatted.sender?.name ?? "مستخدم";
    const preview = content?.length > 80 ? content.slice(0, 80) + "..." : (content || (imageUrl ? "صورة" : "رسالة صوتية"));

    if (recipient?.pushToken) {
      try {
        await sendNotification({
          fcmToken: recipient.pushToken,
          title: `\u0631\u0633\u0627\u0644\u0629 \u062c\u062f\u064a\u062f\u0629 \u0645\u0646 ${senderName} \ud83d\udce9`,
          body: preview,
          data: { type: "message", conversationId: convId },
        });
      } catch (e: any) {
        console.warn("[Chat] Failed to send push notification:", e.message);
      }
    }

    // إشعار WhatsApp للأدمن عند رسائل الدعم (حتى بدون pushToken)
    if (recipient?.role === "admin" && ADMIN_PHONE) {
      try {
        await sendWasenderText(
          ADMIN_PHONE,
          `📩 *رسالة دعم جديدة*\n\n👤 *المستخدم:* ${senderName}\n💬 ${preview}\n\n_Gaytak Support_`
        );
      } catch (e: any) {
        console.warn("[Chat] Failed to send WhatsApp admin notification:", e.message);
      }
    }
  }

  res.status(201).json(formatted);
});

router.post("/conversations/:id/mark-read", authenticate, async (req, res): Promise<void> => {
  const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) {
    res.status(404).json({ error: "المحادثة غير موجودة" });
    return;
  }

  const otherParticipantId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

  await db.update(messagesTable)
    .set({ isRead: true })
    .where(and(
      eq(messagesTable.conversationId, convId),
      eq(messagesTable.senderId, otherParticipantId),
      eq(messagesTable.isRead, false)
    ));

  res.json({ success: true });
});

router.post("/conversations/:id/typing", authenticate, async (req, res): Promise<void> => {
  try {
    const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user!.id;
    const [conv] = (await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId))) ?? [];
    if (!conv) { res.status(404).json({ error: "المحادثة غير موجودة" }); return; }
    await db.insert(typingIndicatorsTable)
      .values({ id: `${convId}_${userId}`, conversationId: convId, userId })
      .onConflictDoUpdate({ target: typingIndicatorsTable.id, set: { updatedAt: new Date() } });
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // non-fatal — لا تكسر الـ UI
  }
});

router.get("/conversations/:id/typing", authenticate, async (req, res): Promise<void> => {
  try {
    const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user!.id;
    const [conv] = (await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId))) ?? [];
    if (!conv) { res.json({ isTyping: false, userId: null }); return; }
    const otherId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    const [indicator] = (await db.select().from(typingIndicatorsTable).where(and(
      eq(typingIndicatorsTable.conversationId, convId),
      eq(typingIndicatorsTable.userId, otherId),
      gte(typingIndicatorsTable.updatedAt, oneMinAgo)
    ))) ?? [];
    res.json({ isTyping: !!indicator, userId: otherId });
  } catch {
    res.json({ isTyping: false, userId: null }); // non-fatal
  }
});

router.get("/conversations/:id/status", authenticate, async (req, res): Promise<void> => {
  const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) {
    res.status(404).json({ error: "المحادثة غير موجودة" });
    return;
  }

  const otherId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;
  const [otherUser] = await db.select({ lastSeenAt: usersTable.lastSeenAt }).from(usersTable).where(eq(usersTable.id, otherId));

  const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
  const isOnline = otherUser?.lastSeenAt ? new Date(otherUser.lastSeenAt) > threeMinAgo : false;

  res.json({
    isOnline,
    lastSeenAt: otherUser?.lastSeenAt ? new Date(otherUser.lastSeenAt).toISOString() : null,
  });
});

router.post("/conversations/:id/forward", authenticate, async (req, res): Promise<void> => {
  const fromConvId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { messageId, toConversationId } = req.body;
  const userId = req.user!.id;

  if (!messageId || !toConversationId) {
    res.status(400).json({ error: "messageId and toConversationId are required" });
    return;
  }

  // get original message
  const [origMsg] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, messageId), eq(messagesTable.conversationId, fromConvId)));

  if (!origMsg) {
    res.status(404).json({ error: "الرس\u0627\u0644\u0629 غ\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629" });
    return;
  }

  // verify user is in destination conversation
  const [toConv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, toConversationId));
  if (!toConv || (toConv.participant1Id !== userId && toConv.participant2Id !== userId)) {
    res.status(403).json({ error: "غ\u064a\u0631 \u0645\u0635\u0631\u062d" });
    return;
  }

  const newId = randomUUID();
  await db.insert(messagesTable).values({
    id: newId,
    conversationId: toConversationId,
    senderId: userId,
    content: origMsg.content,
    imageUrl: origMsg.imageUrl,
    voiceUrl: origMsg.voiceUrl,
  });
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, newId));
  const formatted = await formatMessage(msg);
  res.status(201).json(formatted);
});

router.delete("/conversations/:id/messages/:msgId", authenticate, async (req, res): Promise<void> => {
  const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const msgId = Array.isArray(req.params.msgId) ? req.params.msgId[0] : req.params.msgId;
  const userId = req.user!.id;

  const [msg] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, msgId), eq(messagesTable.conversationId, convId)));

  if (!msg) {
    res.status(404).json({ error: "الرس\u0627\u0644\u0629 غ\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629" });
    return;
  }

  if (msg.senderId !== userId) {
    res.status(403).json({ error: "ل\u0627 \u064a\u0645\u0643\u0646\u0643 \u062d\u0630\u0641 \u0631\u0633\u0627\u0644\u0629 \u0637\u0631\u0641 \u0622\u062e\u0631" });
    return;
  }

  await db.delete(messagesTable).where(eq(messagesTable.id, msgId));
  res.json({ success: true });
});

router.delete("/conversations/:id", authenticate, async (req, res): Promise<void> => {
  const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.user!.id;

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, convId));

  if (!conv) {
    res.status(404).json({ error: "المح\u0627\u062f\u062b\u0629 غ\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629" });
    return;
  }

  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    res.status(403).json({ error: "غ\u064a\u0631 \u0645\u0635\u0631\u062d" });
    return;
  }

  await db.delete(messagesTable).where(eq(messagesTable.conversationId, convId));
  await db.delete(typingIndicatorsTable).where(eq(typingIndicatorsTable.conversationId, convId));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, convId));

  res.json({ success: true });
});

export default router;
