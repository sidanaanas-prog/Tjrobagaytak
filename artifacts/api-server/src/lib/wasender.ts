const API_URL = "https://app.wasenderapi.com/api/send-message";
const API_KEY = process.env.WASENDER_API_KEY || "";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

interface OtpEntry {
  code: string;
  expiresAt: number;
  lastSentAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const IS_DEV = process.env.NODE_ENV === "development";

export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string; code?: string }> {
  const now = Date.now();
  const existing = otpStore.get(phone);

  if (existing && now - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
    // في وضع التطوير: أعد الكود القديم بدل رفض الطلب
    if (IS_DEV) {
      console.log(`[OTP-DEV] Returning existing code for ${phone}: ${existing.code}`);
      return { success: true, code: existing.code };
    }
    const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return { success: false, error: `انتظر ${waitSec} ثانية قبل إعادة الإرسال` };
  }

  const code = generateCode();
  otpStore.set(phone, { code, expiresAt: now + OTP_EXPIRY_MS, lastSentAt: now, attempts: 0 });

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
    console.log(`[OTP] Wasender response for ${phone}: status=${res.status}`, JSON.stringify(data));

    if (!res.ok) {
      // في وضع التطوير: إظهار الكود حتى لو Wasender رفض (rate limit أو خطأ آخر)
      if (IS_DEV) {
        console.log(`[OTP-DEV] Wasender failed (${res.status}) but returning code for testing: ${code}`);
        return { success: true, code };
      }
      otpStore.delete(phone);
      return { success: false, error: data?.message || data?.error || "فشل إرسال الرمز" };
    }

    console.log(`[OTP] Code sent to ${phone}: ${code}`);
    return { success: true, code };
  } catch (e: any) {
    if (IS_DEV) {
      console.log(`[OTP-DEV] Network error but returning code for testing: ${code}`);
      return { success: true, code };
    }
    otpStore.delete(phone);
    return { success: false, error: "خطأ في الاتصال بخدمة الرسائل" };
  }
}

export function verifyOtp(phone: string, code: string): { valid: boolean; error?: string } {
  const entry = otpStore.get(phone);

  if (!entry) {
    return { valid: false, error: "لم يتم إرسال رمز لهذا الرقم" };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, error: "انتهت صلاحية الرمز، أعد الإرسال" };
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(phone);
    return { valid: false, error: "تجاوزت عدد المحاولات، أعد إرسال الرمز" };
  }

  if (entry.code !== code.trim()) {
    return { valid: false, error: "الرمز غير صحيح" };
  }

  otpStore.delete(phone);
  return { valid: true };
}
