import { db, phoneOtpsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const API_URL = "https://app.wasenderapi.com/api/send-message";
const API_KEY = process.env.WASENDER_API_KEY || "";

const OTP_EXPIRY_MS        = 5 * 60 * 1000;   // 5 دقائق
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;      // دقيقة بين كل إرسال
const MAX_ATTEMPTS         = 5;

const IS_DEV = process.env.NODE_ENV === "development";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string; code?: string }> {
  const now = Date.now();

  // تحقق من cooldown من DB
  const [existing] = (await db.select().from(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone))) ?? [];
  if (existing && now - existing.sentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    if (IS_DEV) {
      return { success: true, code: existing.code };
    }
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.sentAt.getTime())) / 1000);
    return { success: false, error: `انتظر ${waitSec} ثانية قبل إعادة الإرسال` };
  }

  const code      = generateCode();
  const expiresAt = new Date(now + OTP_EXPIRY_MS);
  const sentAt    = new Date(now);

  // احفظ في DB قبل الإرسال (upsert) — يبقى حتى بعد cold-start
  await db
    .insert(phoneOtpsTable)
    .values({ phone, code, expiresAt, sentAt, attempts: 0 })
    .onConflictDoUpdate({
      target: phoneOtpsTable.phone,
      set: { code, expiresAt, sentAt, attempts: 0 },
    });

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        to: phone,
        text: `رمز التحقق الخاص بـ Gaytak هو:\n\n*${code}*\n\nصالح لمدة 5 دقائق. لا تشاركه مع أحد.`,
      }),
    });

    const data = await res.json() as any;
    console.log(`[OTP] Wasender response for ${phone}: status=${res.status}`);

    if (!res.ok) {
      if (IS_DEV) {
        console.log(`[OTP-DEV] Wasender failed (${res.status}) but code saved in DB: ${code}`);
        return { success: true, code };
      }
      await db.delete(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone));
      return { success: false, error: data?.message || data?.error || "فشل إرسال الرمز" };
    }

    console.log(`[OTP] Code sent to ${phone}: ${code.slice(0, 2)}****`);
    return { success: true, ...(IS_DEV ? { code } : {}) };
  } catch (e: any) {
    if (IS_DEV) {
      console.log(`[OTP-DEV] Network error but code saved in DB: ${code}`);
      return { success: true, code };
    }
    await db.delete(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone));
    return { success: false, error: "خطأ في الاتصال بخدمة الرسائل" };
  }
}

// ── إرسال رسالة نصية عادية (غير OTP) ─────────────────────────────────────────
export async function sendWasenderText(phone: string, text: string): Promise<void> {
  if (!API_KEY) return;
  try {
    await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ to: phone, text }),
    });
  } catch (e: any) {
    console.warn("[Wasender] Failed to send text:", e.message);
  }
}

export async function verifyOtp(phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const [entry] = (await db.select().from(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone))) ?? [];

  if (!entry) {
    return { valid: false, error: "لم يتم إرسال رمز لهذا الرقم" };
  }

  if (Date.now() > entry.expiresAt.getTime()) {
    await db.delete(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone));
    return { valid: false, error: "انتهت صلاحية الرمز، أعد الإرسال" };
  }

  const attempts = (entry.attempts ?? 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    await db.delete(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone));
    return { valid: false, error: "تجاوزت عدد المحاولات، أعد إرسال الرمز" };
  }

  if (entry.code !== code.trim()) {
    await db.update(phoneOtpsTable).set({ attempts }).where(eq(phoneOtpsTable.phone, phone));
    return { valid: false, error: "الرمز غير صحيح" };
  }

  await db.delete(phoneOtpsTable).where(eq(phoneOtpsTable.phone, phone));
  return { valid: true };
}
