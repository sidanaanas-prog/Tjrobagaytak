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
const isNeon  = dbUrl.includes("neon.tech");

export const pool = new Pool({
  connectionString: dbUrl,
  min: 1,
  max: 10,
  // Neon ينهي الاتصالات الخاملة بعد 5 دقائق — نغلقها نحن بعد دقيقتين
  idleTimeoutMillis: isLocal ? 0 : 120_000,
  connectionTimeoutMillis: 10_000,
  // SSL مطلوب لـ Neon وكل قواعد البيانات الخارجية
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

// ⚠️ منع تعطل السيرفر عند انقطاع الاتصال من طرف قاعدة البيانات
pool.on("error", (err) => {
  console.error("[DB Pool] Connection dropped (auto-reconnect):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
