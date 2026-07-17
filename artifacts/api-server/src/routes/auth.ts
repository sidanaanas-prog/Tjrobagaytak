import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db, usersTable, walletsTable, competitionParticipantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, authenticate } from "../lib/auth";
import { activityTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const { name, email, password, avatar, referredBy } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();

    let referrerUserId: string | null = null;
    if (referredBy) {
      try {
        const normalizedRef = referredBy.trim().toUpperCase();
        const [participant] = await db
          .select()
          .from(competitionParticipantsTable)
          .where(eq(competitionParticipantsTable.inviteCode, normalizedRef));
        if (participant) {
          referrerUserId = participant.userId;
          console.log(`Resolved invite code ${normalizedRef} to referrer userId ${referrerUserId}`);
        } else {
          res.status(400).json({ error: "كود الإحالة غير صحيح أو غير موجود" });
          return;
        }
      } catch (err) {
        console.error("Error resolving invite code in email registration:", err);
      }
    }

    // Neon HTTP driver لا يدعم .returning()
    await db.insert(usersTable).values({
      id,
      name,
      email,
      passwordHash,
      avatar: avatar ?? null,
      role: "user",
      banned: false,
      referredBy: referrerUserId,
    });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));

    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "user_registered",
      description: `${name} joined the platform`,
      userId: id,
      userName: name,
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (user.banned) {
      res.status(401).json({ error: "Account suspended" });
      return;
    }

    // المستخدم سجّل بالهاتف (OTP) وليس عنده كلمة مرور
    if (!user.passwordHash) {
      res.status(401).json({ error: "هذا الحساب مرتبط برقم الهاتف، يرجى تسجيل الدخول بالواتساب" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "حدث خطأ في الخادم" });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // جلب رصيد المحفظة
  const [wallet] = (await db.select({ balance: walletsTable.balance }).from(walletsTable).where(eq(walletsTable.userId, user.id))) ?? [];
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role,
    banned: user.banned,
    isVerified: user.isVerified,
    subscriptionExpiresAt: user.subscriptionExpiresAt ? user.subscriptionExpiresAt.toISOString() : null,
    trialExpiresAt: user.trialExpiresAt ? user.trialExpiresAt.toISOString() : null,
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    walletBalance: wallet?.balance ? Number(wallet.balance) : null,
    noShowCount: user.noShowCount ?? 0,
    rideBannedUntil: user.rideBannedUntil ? user.rideBannedUntil.toISOString() : null,
  });
});

// ─── PIN Lock ───────────────────────────────────────────────────────

const MAX_PIN_ATTEMPTS = 3;
const pinAttempts = new Map<string, number>(); // userId → attempts

router.post("/auth/pin/set", authenticate, async (req, res): Promise<void> => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "PIN must be 4 digits" });
    return;
  }
  const hash = await bcrypt.hash(pin, 10);
  await db.update(usersTable)
    .set({ pinHash: hash })
    .where(eq(usersTable.id, req.user!.id));
  pinAttempts.delete(req.user!.id);
  res.json({ ok: true });
});

router.post("/auth/pin/verify", authenticate, async (req, res): Promise<void> => {
  const { pin } = req.body;
  if (!pin || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "PIN must be 4 digits" });
    return;
  }
  const userId = req.user!.id;
  const attempts = pinAttempts.get(userId) || 0;

  const [user] = (await db.select({ pinHash: usersTable.pinHash }).from(usersTable).where(eq(usersTable.id, userId))) ?? [];

  if (!user?.pinHash) {
    res.status(400).json({ error: "No PIN set" });
    return;
  }

  if (attempts >= MAX_PIN_ATTEMPTS) {
    res.status(403).json({ error: "locked", message: "تم تجاوز الحد الأقصى. تواصل مع الدعم \u2706" });
    return;
  }

  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) {
    pinAttempts.set(userId, attempts + 1);
    res.status(401).json({ error: "wrong", remaining: MAX_PIN_ATTEMPTS - attempts - 1 });
    return;
  }

  pinAttempts.delete(userId);
  res.json({ ok: true });
});

router.get("/auth/pin/has-pin", authenticate, async (req, res): Promise<void> => {
  const [user] = (await db.select({ pinHash: usersTable.pinHash }).from(usersTable).where(eq(usersTable.id, req.user!.id))) ?? [];
  res.json({ hasPin: !!user?.pinHash });
});

router.post("/auth/pin/remove", authenticate, async (req, res): Promise<void> => {
  await db.update(usersTable).set({ pinHash: null }).where(eq(usersTable.id, req.user!.id));
  pinAttempts.delete(req.user!.id);
  res.json({ ok: true });
});

router.get("/auth/validate-invite-code/:code", async (req, res): Promise<void> => {
  try {
    const { code } = req.params;
    if (!code) {
      res.status(400).json({ valid: false, error: "الكود مطلوب" });
      return;
    }
    const normalizedCode = code.trim().toUpperCase();
    const [participant] = await db
      .select()
      .from(competitionParticipantsTable)
      .where(eq(competitionParticipantsTable.inviteCode, normalizedCode));
    if (participant) {
      res.json({ valid: true, code: normalizedCode });
    } else {
      res.json({ valid: false, error: "كود الإحالة غير صحيح أو غير موجود" });
    }
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

export default router;
