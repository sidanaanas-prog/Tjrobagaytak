import { Router, type IRouter } from "express";
import { authenticate } from "../lib/auth";

const API_URL = "https://app.wasenderapi.com/api/send-message";
const API_KEY = process.env.WASENDER_API_KEY || "";

const router: IRouter = Router();

/**
 * POST /api/wasender/send
 * إرسال رسالة واتساب مباشرة عبر WasenderAPI
 *
 * Body:
 *   to      - رقم الهاتف المستلم (مع مفتاح الدولة)
 *   text    - نص الرسالة
 */
router.post("/wasender/send", authenticate, async (req, res): Promise<void> => {
  const { to, text } = req.body;

  if (!to || !text) {
    res.status(400).json({ error: "الحقول المطلوبة: to, text" });
    return;
  }

  if (!API_KEY) {
    res.status(500).json({ error: "WasenderAPI key غير مُهيأ" });
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ to, text }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: data?.message || data?.error || "فشل إرسال الرسالة",
        details: data,
      });
      return;
    }

    res.json({
      success: true,
      message: "تم إرسال الرسالة بنجاح",
      data,
    });
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e?.message || "خطأ في الاتصال بـ WasenderAPI",
    });
  }
});

/**
 * GET /api/wasender/status
 * التحقق من حالة WasenderAPI
 */
router.get("/wasender/status", authenticate, async (_req, res): Promise<void> => {
  res.json({
    configured: !!API_KEY,
    apiUrl: API_URL,
    keyPrefix: API_KEY ? `${API_KEY.slice(0, 8)}...` : null,
  });
});

export default router;
