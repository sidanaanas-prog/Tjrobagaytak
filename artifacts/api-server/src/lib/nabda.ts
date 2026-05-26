const API_URL = process.env.NABDA_API_URL || "https://api.nabdaotp.com";
const TOKEN = process.env.NABDA_TOKEN || "";

export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/messages/otp/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": TOKEN,
      },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      return { success: false, error: data?.message || data?.error || "فشل إرسال الرمز" };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "خطأ في الشبكة" };
  }
}

export async function verifyOtp(phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/messages/otp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": TOKEN,
      },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      return { valid: false, error: data?.message || data?.error || "الرمز غير صحيح أو منتهي" };
    }
    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e?.message || "خطأ في الشبكة" };
  }
}
