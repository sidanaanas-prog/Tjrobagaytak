import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { db, usersTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/auth";
import { sendOtp, verifyOtp } from "../lib/wasender";

const isDev = process.env.NODE_ENV === "development";
const router: IRouter = Router();
const DEFAULT_NAME = "مستخدم Gaytak";

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
  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: "رقم الهاتف مطلوب" });
    return;
  }

  const normalized = normalizePhone(phone);
  const result = await sendOtp(normalized);

  if (!result.success) {
    res.status(400).json({ error: result.error || "فشل إرسال الرمز" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.phone, normalized));

  // وضع التطوير: أرجع الكود مباشرة على الشاشة
  const devCode = isDev ? result.code : undefined;

  res.json({
    success: true,
    isNewUser: needsName(existing),
    ...(devCode ? { devCode } : {}),
  });
});

router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  const { phone, code, name } = req.body;
  if (!phone || !code) {
    res.status(400).json({ error: "رقم الهاتف والرمز مطلوبان" });
    return;
  }

  const normalized = normalizePhone(phone);
  const result = verifyOtp(normalized, code);

  if (!result.valid) {
    res.status(400).json({ error: result.error || "الرمز غير صحيح أو منتهي الصلاحية" });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, normalized));
  const userName = name?.trim() || DEFAULT_NAME;

  if (!user) {
    const id = randomUUID();
    const [created] = await db.insert(usersTable).values({
      id,
      name: userName,
      phone: normalized,
      email: `${id}@gaytak.phone`,
      passwordHash: randomUUID(),
      role: "user",
      banned: false,
    }).returning();
    user = created;

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "user_registered",
      description: `${userName} انضم عبر رقم الهاتف`,
      userId: user.id,
      userName: user.name,
    });
  } else if (needsName(user) && name?.trim()) {
    const [updated] = await db
      .update(usersTable)
      .set({ name: name.trim() })
      .where(eq(usersTable.id, user.id))
      .returning();
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
});

export default router;
