import { ai } from "@workspace/integrations-gemini-ai";
import { db, videoAiCommentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SmartComment {
  text: string;
  userName: string;
}

/**
 * Generates 18 AI-powered Arabic comments specific to the video caption.
 * Results are cached in video_ai_comments table — Gemini is called once per video.
 */
export async function getOrGenerateAiComments(
  videoId: string,
  caption: string | null | undefined,
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

  // 2. No caption → nothing useful to generate
  if (!caption?.trim()) return [];

  // 3. Call Gemini
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `أنت مجموعة من المستخدمين العرب في تطبيق سوق اجتماعي يشبه تيك توك.
الفيديو المنشور: "${caption}"

اكتب بالضبط 18 تعليقاً قصيراً (جملة أو جملتان) كأنها من أشخاص حقيقيين يشاهدون هذا الفيديو بالذات.
القواعد:
- اكتب باللهجة الجزائرية أو الخليجية أو الحسانية، تنوع بينها
- كل تعليق يتعلق مباشرة بموضوع الفيديو (${caption})
- لا تكرر نفس التعليق
- لا تذكر كلمة "AI" أو "ذكاء اصطناعي"
- استخدم إيموجي مناسب أحياناً
- تنوع بين: سؤال عن السعر، إطراء، طلب معلومات، تجربة شخصية، إبداء رأي، الطلب

أرجع JSON فقط بهذا الشكل بدون أي كلام آخر:
[
  {"text": "...", "userName": "اسم عربي عشوائي"},
  ...
]`,
            },
          ],
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
    // Silent fallback — log but don't crash
    console.warn("[SmartComments] Gemini failed:", err?.message ?? err);
    return [];
  }
}

/**
 * Fire-and-forget: generate AI comments in the background right after video creation.
 * Does not block the API response.
 */
export function generateAiCommentsAsync(videoId: string, caption: string | null | undefined) {
  if (!caption?.trim()) return;
  getOrGenerateAiComments(videoId, caption).catch(() => {});
}
