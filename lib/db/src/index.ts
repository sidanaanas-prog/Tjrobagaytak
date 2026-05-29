import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ── منع crash عند قطع الاتصال من طرف Neon/PostgreSQL ──────────────────────
// Neon تقطع الاتصالات الخاملة بعد فترة — بدون هذا الـ handler يكرش السيرفر
pool.on("error", (err) => {
  console.error("[DB Pool] idle client error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
