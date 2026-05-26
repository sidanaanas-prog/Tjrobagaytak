import { Router, type IRouter } from "express";
import { db, messagesTable, conversationsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { sendNotification } from "../lib/notifications";
import { randomUUID } from "crypto";

const router: IRouter = Router();

/**
 * POST /api/send-message
 * إرسال رسالة وإشعار FCM مباشرة
 *
 * Body:
 *   senderName   - اسم المرسل
 *   receiverToken - FCM Token الخاص بالمستلم
 *   message       - نص الرسالة
 *   conversationId (اختياري) - معرّف المحادثة لحفظ الرسالة
 *   senderId (اختياري) - معرّف المرسل لحفظ الرسالة
 */
router.post("/send-message", async (req, res): Promise<void> => {
  const { senderName, receiverToken, message, conversationId, senderId } = req.body;

  if (!receiverToken || !message || !senderName) {
    res.status(400).json({
      error: "الحقول المطلوبة: senderName, receiverToken, message",
    });
    return;
  }

  const preview = message.length > 80 ? message.slice(0, 80) + "..." : message;

  // إرسال إشعار FCM
  await sendNotification({
    fcmToken: receiverToken,
    title: `رسالة جديدة من ${senderName} 📩`,
    body: preview,
    data: {
      type: "message",
      conversationId: conversationId ?? "",
    },
  });

  // حفظ الرسالة في قاعدة البيانات (اختياري)
  let savedMessage = null;
  if (conversationId && senderId) {
    try {
      const [msg] = await db
        .insert(messagesTable)
        .values({
          id: randomUUID(),
          conversationId,
          senderId,
          content: message,
        })
        .returning();
      savedMessage = msg;
    } catch (e) {
      console.warn("[send-message] خطأ في حفظ الرسالة:", e);
    }
  }

  res.json({
    success: true,
    message: "تم إرسال الإشعار بنجاح",
    saved: !!savedMessage,
  });
});

export default router;
