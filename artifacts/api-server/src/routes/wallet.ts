import { Router, type IRouter } from "express";
import { db, walletsTable, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { authenticate } from "../lib/auth";

const router: IRouter = Router();

// حساب أو إنشاء محفظة
async function getOrCreateWallet(userId: string) {
  const [existing] = (await db.select().from(walletsTable).where(eq(walletsTable.userId, userId))) ?? [];
  if (existing) return existing;
  const id = randomUUID();
  await db.insert(walletsTable).values({
    id, userId, balance: "0", currency: "DZD",
    createdAt: new Date(), updatedAt: new Date(),
  });
  return { id, userId, balance: "0", currency: "DZD" };
}

// تسجيل عملية محفظة
async function recordTransaction(
  walletId: string,
  userId: string,
  type: string,
  amount: string,
  balanceAfter: string,
  description: string,
  rideId?: string
) {
  await db.insert(walletTransactionsTable).values({
    id: randomUUID(),
    walletId, userId, type, amount, balanceAfter,
    description, rideId: rideId ?? null,
    status: "completed",
    createdAt: new Date(),
  });
}

// GET /api/wallet — رصيد المحفظة
router.get("/wallet", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const wallet = await getOrCreateWallet(userId);
    const transactions = (await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.walletId, wallet.id))
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(50)) ?? [];
    res.json({ ...wallet, transactions });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/deposit — إيداع رصيد (simulated)
router.post("/wallet/deposit", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "مبلغ غير صالح" }); return; }

    const wallet = await getOrCreateWallet(userId);
    const newBalance = String(Number(wallet.balance) + Number(amount));
    await db.update(walletsTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
    await recordTransaction(wallet.id, userId, "deposit", String(amount), newBalance, "إيداع رصيد");

    res.json({ success: true, balance: newBalance });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/withdraw — سحب (سيمولاتي)
router.post("/wallet/withdraw", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) { res.status(400).json({ error: "مبلغ غير صالح" }); return; }

    const wallet = await getOrCreateWallet(userId);
    if (Number(wallet.balance) < Number(amount)) { res.status(400).json({ error: "الرصيد غير كافي" }); return; }

    const newBalance = String(Number(wallet.balance) - Number(amount));
    await db.update(walletsTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
    await recordTransaction(wallet.id, userId, "withdrawal", String(-amount), newBalance, "سحب رصيد");

    res.json({ success: true, balance: newBalance });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/wallet/pay-ride — دفع الرحلة من المحفظة
router.post("/wallet/pay-ride", authenticate, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { rideId, amount } = req.body;
    if (!rideId || !amount || Number(amount) <= 0) { res.status(400).json({ error: "بيانات ناقصة" }); return; }

    const wallet = await getOrCreateWallet(userId);
    if (Number(wallet.balance) < Number(amount)) { res.status(400).json({ error: "الرصيد غير كافي" }); return; }

    const newBalance = String(Number(wallet.balance) - Number(amount));
    await db.update(walletsTable).set({ balance: newBalance, updatedAt: new Date() }).where(eq(walletsTable.id, wallet.id));
    await recordTransaction(wallet.id, userId, "ride_payment", String(-amount), newBalance, "دفع رحلة", rideId);

    res.json({ success: true, balance: newBalance });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
