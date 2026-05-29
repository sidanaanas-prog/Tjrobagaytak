import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const dbUrl = process.env.DATABASE_URL;
const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: dbUrl,
  min: 0,              // لا اتصالات خاملة — تُفتح عند الحاجة فقط
  max: 10,
  idleTimeoutMillis: 10_000,        // أغلق الخامل بعد 10 ث
  connectionTimeoutMillis: 10_000,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

// ─── منع crash من انقطاع اتصال Neon ─────────────────────────────────────────
// هذا المعالج يمنع Node.js من رمي "Unhandled 'error' event" الذي يُسقط السيرفر
pool.on("error", (err: Error) => {
  console.error("[DB Pool] Connection dropped:", err.message);
  // لا نعيد throw — السيرفر يبقى حياً ويفتح اتصالاً جديداً عند الطلب التالي
});

export const db = drizzle(pool, { schema });

export * from "./schema";
