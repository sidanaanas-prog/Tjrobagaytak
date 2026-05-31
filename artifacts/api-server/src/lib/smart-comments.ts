import { ai } from "@workspace/integrations-gemini-ai";
import { db, videoAiCommentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SmartComment {
  text: string;
  userName: string;
}

export interface ProductContext {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  category?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Generates 18 AI-powered Arabic comments tailored to the video + product context.
 * Uses product data (title, price, description) + caption + thumbnail for ultra-specific comments.
 * Results are cached in video_ai_comments table — Gemini is called once per video.
 */
export async function getOrGenerateAiComments(
  videoId: string,
  caption: string | null | undefined,
  product?: ProductContext,
): Promise<SmartComment[]> {
  // 1. Try cache first
  const [cached] = (await db
    .select()
    .from(videoAiCommentsTable)
    .where(eq(videoAiCommentsTable.videoId, videoId))) ?? [];

  if (cached) {
    try {
      return JSON.parse(cached.comments) as SmartComment[];
    } catch {
      // corrupt cache — regenerate
    }
  }

  // 2. No context at all → nothing useful to generate
  if (!caption?.trim() && !product?.title?.trim()) return [];

  // 3. Build rich context for AI
  const productInfo = product?.title
    ? `المنتج: ${product.title}${product.price ? ` — السعر: ${product.price} ريال` : ""}${product.description ? ` — الوصف: ${product.description.slice(0, 200)}` : ""}${product.category ? ` — الفئة: ${product.category}` : ""}`
    : "";

  const thumbnailInfo = product?.thumbnailUrl
    ? `\nصورة الفيديو/المنتج: ${product.thumbnailUrl}`
    : "";

  const prompt = `أنت مجموعة من 18 مستخدم عربي مختلف في تطبيق سوق اجتماعي (مثل تيك توك + أمازون).
${caption?.trim() ? `الفيديو: "${caption}"` : ""}
${productInfo}
${thumbnailInfo}

اكتب 18 تعليقاً قصيراً (1-3 جمل) كأنها من أشخاص حقيقيين يشاهدون هذا الفيديو بالذات.
يجب أن تكون التعليقات مُصممة خصيصاً لهذا المنتج/الفيديو — لا عامة.

الأنواع المطلوبة (تنوع بينها):
1. ❓ سؤال: "عندك منه في المقاس L؟" / "وش السعر مع التوصيل؟"
2. ❤️ إعجاب بسيط: "🔥🔥🔥" أو "👏 شيء كبير"
3. ✨ إطراء + سؤال: "شين والله، كيف نطلب من عندك؟"
4. 😂 رد فعل عاطفي: "يهبل! أول مرة نلقى حاجة كهذا"
5. 💬 تجربة شخصية: "أنا شريت منه قبل شهر، ممتاز والله"
6. ⚖️ مقارنة: "أحسن من اللي شفتوه في التطبيق الثاني"
7. 📢 Mention: "@أحمد شوف هذا المنتج!"
8. ⏰ تعليق زمني: "جبت هذا الفيديو الصبح والله"
9. 🤔 شك/نقد: "صح شين بصح السعر شوية غالي"
10. 💡 رد على تعليق وهمي: "تسلم على الرد! والله صادق"

القواعد:
- اكتب باللهجة الحسانية (موريتانية) + الجزائرية فقط (تنوع داخل الـ 18)
- كل تعليق يتعلق مباشرة بالمنتج/الفيديو — لا عام
- لا تكرر نفس التعليق
- لا تذكر "AI" أو "ذكاء اصطناعي"
- استخدم إيموجي في 70% من التعليقات
- الأسماء: مزيج من أسماء جزائرية + موريتانية فقط
- بعض التعليقات كلمة واحدة فقط: "🔥" أو "يا سلام"
- بعضها 2-3 جمل كاملة
- ضع ردود على تعليقات أخرى (2-3 من الـ 18)

أرجع JSON فقط بدون أي كلام آخر:
[
  {"text": "...", "userName": "...", "replyTo": "..."},
  ...
]
(replyTo اختياري — اتركه فارغاً إذا لم يكن رد)`;

  // 4. Call Gemini
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const raw = response.text ?? "[]";
    const parsed = JSON.parse(raw) as SmartComment[];

    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    // Save to cache
    await db
      .insert(videoAiCommentsTable)
      .values({ videoId, comments: JSON.stringify(parsed) })
      .onConflictDoNothing();

    return parsed;
  } catch (err: any) {
    console.warn("[SmartComments] Gemini failed:", err?.message ?? err);
    return [];
  }
}

/**
 * Fire-and-forget: generate AI comments in the background right after video creation.
 * Does not block the API response.
 */
export function generateAiCommentsAsync(
  videoId: string,
  caption: string | null | undefined,
  product?: ProductContext,
) {
  if (!caption?.trim() && !product?.title?.trim()) return;
  getOrGenerateAiComments(videoId, caption, product).catch(() => {});
}
