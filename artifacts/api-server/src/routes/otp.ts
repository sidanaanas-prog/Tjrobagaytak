import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db, usersTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/auth";
import { sendOtp as sendWasenderOtp, verifyOtp as verifyWasenderOtp } from "../lib/wasender";
import { sendOtp as sendNabdaOtp, verifyOtp as verifyNabdaOtp } from "../lib/nabda";

const isDev = process.env.NODE_ENV === "development";
const hasWasenderKey = !!process.env.WASENDER_API_KEY;
const hasNabdaToken = !!process.env.NABDA_TOKEN;

const router: IRouter = Router();
const DEFAULT_NAME = "مستخدم Gaytak";

/* ── Unified OTP: Wasender → Nabda → dev-fallback ── */
async function unifiedSendOtp(phone: string): Promise<{ success: boolean; error?: string; code?: string }> {
  if (hasWasenderKey) {
    return sendWasenderOtp(phone);
  }
  if (hasNabdaToken) {
    const result = await sendNabdaOtp(phone);
    return { ...result, code: undefined };
  }
  if (isDev) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return { success: true, code };
  }
  return { success: false, error: "خدمة OTP غير مهيأة" };
}

async function unifiedVerifyOtp(phone: string, code: string): Promise<{ valid: boolean; error?: string }> {
  if (hasWasenderKey) {
    return verifyWasenderOtp(phone, code);
  }
  if (hasNabdaToken) {
    return await verifyNabdaOtp(phone, code);
  }
  return { valid: false, error: "خدمة OTP غير مهيأة" };
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

function needsName(user: typeof usersTable.$inferSelect | undefined): boolean {
  if (!user) return true;
  const n = user.name?.trim() ?? "";
  return !n || n === DEFAULT_NAME;
}

router.post("/auth/otp/send", async (req, res): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: "رقم الهاتف مطلوب" });
      return;
    }

    const normalized = normalizePhone(phone);

    // الرقم السحري لمراجعي Google Play: لا نرسل OTP حقيقياً
    if (normalized === MAGIC_PHONE) {
      let isNewUser = true;
      try {
        const [existing] = (await db.select().from(usersTable).where(eq(usersTable.phone, normalized))) ?? [];
        isNewUser = needsName(existing);
      } catch {}
      res.json({ success: true, isNewUser });
      return;
    }

    const result = await unifiedSendOtp(normalized);

    if (!result.success) {
      res.status(400).json({ error: result.error || "فشل إرسال الرمز" });
      return;
    }

    // حماية: حتى لو فشل استعلام DB بعد إرسال الرمز، نُرجع success
    // لأن الرمز وصل للمستخدم ويجب أن يتمكن من إدخاله
    let isNewUser = true;
    try {
      const [existing] = (await db.select().from(usersTable).where(eq(usersTable.phone, normalized))) ?? [];
      isNewUser = needsName(existing);
    } catch (dbErr: any) {
      req.log.error({ err: dbErr }, "otp/send db query error (non-fatal)");
      // fallback: افتراض أنه مستخدم جديد
      isNewUser = true;
    }

    const devCode = isDev ? result.code : undefined;

    res.json({
      success: true,
      isNewUser,
      ...(devCode ? { devCode } : {}),
    });
  } catch (e) {
    req.log.error({ err: e }, "otp/send fatal error");
    res.status(500).json({ error: "حدث خطأ، حاول مجدداً" });
  }
});

const MAGIC_PHONE = "+966500000000";

router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  try {
    const { phone, code, name } = req.body;
    if (!phone || !code) {
      res.status(400).json({ error: "رقم الهاتف والرمز مطلوبان" });
      return;
    }

    const normalized = normalizePhone(phone);

    // ــالرقم السحري: يقبل أي رمز لمراجعي Google Play ــ
    const isMagicPhone = normalized === MAGIC_PHONE;
    let result: { valid: boolean; error?: string };
    if (isMagicPhone) {
      result = { valid: true };
    } else {
      result = await unifiedVerifyOtp(normalized, code);
    }

    if (!result.valid) {
      res.status(400).json({ error: result.error || "الرمز غير صحيح أو منتهي الصلاحية" });
      return;
    }

    let [user] = (await db.select().from(usersTable).where(eq(usersTable.phone, normalized))) ?? [];
    const userName = name?.trim() || DEFAULT_NAME;

    if (!user) {
      const id = randomUUID();
      const now = new Date();
      const trialExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days trial
      // Neon HTTP driver لا يدعم .returning() → نستخدم select() بعد الإدخال
      await db.insert(usersTable).values({
        id,
        name: userName,
        phone: normalized,
        email: `${id}@gaytak.phone`,
        passwordHash: randomUUID(),
        role: "user",
        banned: false,
        trialExpiresAt: trialExpiry,
      });
      const [created] = await db.select().from(usersTable).where(eq(usersTable.id, id));
      user = created;

      await db.insert(activityTable).values({
        id: randomUUID(),
        type: "user_registered",
        description: `${userName} انضم عبر رقم الهاتف (تجربة 7 أيام)`,
        userId: id,
        userName: userName,
      });
    } else if (needsName(user) && name?.trim()) {
      await db
        .update(usersTable)
        .set({ name: name.trim() })
        .where(eq(usersTable.id, user.id));
      const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
      user = updated;
    }

    if (user.banned) {
      res.status(401).json({ error: "الحساب موقوف" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (e) {
    req.log.error({ err: e }, "otp/verify error");
    res.status(500).json({ error: "حدث خطأ، حاول مجدداً" });
  }
});

export default router;
