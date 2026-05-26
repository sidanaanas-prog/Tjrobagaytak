import app from "./app";
import { logger } from "./lib/logger";
import { db, pool, usersTable, categoriesTable, pushTokensTable } from "@workspace/db";
import { eq, count, and, lt, gt, or, isNull, sql } from "drizzle-orm";
import { notifyUsers } from "./lib/notifications";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const SUPPORT_USER_ID = "e0757f35-e7d4-4c07-ae0b-339252aecfa6";

// ── إنشاء حساب Admin تلقائياً إذا لم يكن موجوداً ───────────────────────────
async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@gaytak.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "gaytak@2025";

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
    if (!existing) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await db.insert(usersTable).values({
        id: SUPPORT_USER_ID,
        name: "دعم Gaytak",
        email: adminEmail,
        passwordHash: hash,
        role: "admin",
        banned: false,
      });
      logger.info("✅ Admin user created: " + adminEmail);
    } else if (existing.role !== "admin") {
      logger.info("Admin user exists but role is not admin — skipping");
    } else if (existing.id !== SUPPORT_USER_ID) {
      // Admin exists with different ID — can't change PK due to FK constraints.
      // Just log a warning; the admin-panel will filter by both IDs.
      logger.info("Admin user exists with ID " + existing.id + " (not " + SUPPORT_USER_ID + "). Support conversations will still work.");
    } else {
      logger.info("Admin user already exists");
    }
  } catch (err) {
    logger.error({ err }, "Error seeding admin user");
  }
}

// ── إنشاء حساب دعم Gaytak تلقائياً ─────────────────────────────────────────
async function seedSupportUser() {
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, SUPPORT_USER_ID));
    if (!existing) {
      await db.insert(usersTable).values({
        id: SUPPORT_USER_ID,
        name: "دعم Gaytak",
        email: "support@gaytak.com",
        passwordHash: await bcrypt.hash(randomUUID(), 10),
        role: "admin",
        banned: false,
      });
      logger.info("✅ Support user created");
    } else {
      logger.info("Support user already exists");
    }
  } catch (err) {
    logger.error({ err }, "Error seeding support user");
  }
}

// ── إضافة الفئات الافتراضية إذا كان الجدول فارغاً ──────────────────────────
async function seedCategories() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(categoriesTable);
    if (Number(total) > 0) {
      logger.info("Categories already seeded");
      return;
    }
    const defaults = [
      { name: "هواتف وتابلت",      icon: "📱" },
      { name: "إلكترونيات",        icon: "💻" },
      { name: "ملابس وأزياء",      icon: "👗" },
      { name: "سيارات ودراجات",    icon: "🚗" },
      { name: "منزل وأثاث",        icon: "🛋️" },
      { name: "رياضة ولياقة",      icon: "⚽" },
      { name: "كتب ومجلات",        icon: "📚" },
      { name: "ألعاب وترفيه",      icon: "🎮" },
      { name: "مستلزمات أطفال",    icon: "🧸" },
      { name: "أخرى",              icon: "📦" },
    ];
    await db.insert(categoriesTable).values(defaults.map((c) => ({ id: randomUUID(), name: c.name, icon: c.icon })));
    logger.info(`✅ Seeded ${defaults.length} categories`);
  } catch (err) {
    logger.error({ err }, "Error seeding categories");
  }
}

// Pre-warm DB connection pool so first user request doesn't pay cold-start cost
async function warmupDb() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("DB connection pool warmed up");
  } catch (err) {
    logger.warn({ err }, "DB warmup failed (non-fatal)");
  }
}

// ── Cron: إشعار "افتقدناك" كل 2 دقيقة ──────────────────────────
const MISS_YOU_MESSAGES = [
  { title: "اشتقنا إليك! 😊", body: "تعال شوف الجديد في Gaytak" },
  { title: "وين اختفيت؟ 🤔", body: "عندنا منتجات تستناك تشوفها" },
  { title: "نحن هنا ننتظرك! ✨", body: "تصفح أحدث المنتجات الآن" },
  { title: "لحظة واحدة بس ⚡", body: "عندنا عروض ما شفتها بعد" },
  { title: "صديقك Gaytak يسلم عليك 👋", body: "تعال تسوق اليوم!" },
  { title: "ما تنسانا! 💜", body: "في منتجات جديدة تنتظرك" },
  { title: "مشتاقين لك! 🛍️", body: "ايش تنقصك اليوم؟" },
  { title: "Gaytak بيناديك 📲", body: "تعال شوف ايش الجديد" },
  { title: "كل يوم جديد — 🌟", body: "منتجات جديدة بتستناك" },
  { title: "كمان لحظات وتفوتك صفقة! 😱", body: "ارجع سريعاً لـ Gaytak" },
  { title: "حياك الله معنا 🏪", body: "السوق الرقمي بانتظارك" },
  { title: "ما فاتك شيء؟ 🔥", body: "تحقق من آخر المنتجات" },
];

function startMissYouCron() {
  setInterval(async () => {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const users = await db
        .select({ id: usersTable.id, missYouNotifiedAt: usersTable.missYouNotifiedAt, lastSeenAt: usersTable.lastSeenAt })
        .from(usersTable)
        .where(
          and(
            lt(usersTable.lastSeenAt, fiveMinAgo),
            gt(usersTable.lastSeenAt, twoHoursAgo),
            or(
              isNull(usersTable.missYouNotifiedAt),
              sql`${usersTable.missYouNotifiedAt} < ${usersTable.lastSeenAt}`
            )
          )
        );

      if (users.length === 0) return;

      const msg = MISS_YOU_MESSAGES[Math.floor(Math.random() * MISS_YOU_MESSAGES.length)];
      const userIds = users.map((u) => u.id);

      await notifyUsers({ userIds, title: msg.title, body: msg.body, data: { type: "miss_you" } });

      const now = new Date();
      for (const u of users) {
        await db.update(usersTable).set({ missYouNotifiedAt: now }).where(eq(usersTable.id, u.id));
      }

      logger.info(`[MissYou] أُرسلت إشعارات لـ ${users.length} مستخدم`);
    } catch (err) {
      logger.error({ err }, "[MissYou] خطأ في cron");
    }
  }, 2 * 60 * 1000);
}

// Start server immediately so meta-sidecar can route requests.
// Seeds and warmup run in background — routes don't depend on them.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  warmupDb()
    .then(() => seedAdmin())
    .then(seedSupportUser)
    .then(seedCategories)
    .catch((err) => {
      logger.error({ err }, "Background seed error");
    });
  startMissYouCron();
});
