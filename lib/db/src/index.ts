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
  min: 0,
  max: 10,
  idleTimeoutMillis: 2_000,        // أغلق الخامل بعد ثانيتين — أسرع من أي timeout خارجي
  connectionTimeoutMillis: 10_000,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

// ─── منع crash من انقطاع Neon ─────────────────────────────────────────────────
// طريقة 1: معالج قياسي على المجموعة
pool.on("error", (err: Error) => {
  console.error("[DB] Pool error (survived):", err.message);
});

// طريقة 2: تجاوز pool.emit مباشرة — يضمن عدم وصول أي خطأ لـ EventEmitter
// هذا يُصلح حالة "BoundPool" حيث يُفوّت المعالج القياسي
const _origEmit = pool.emit.bind(pool);
(pool as any).emit = function (event: string, ...args: unknown[]) {
  if (event === "error") {
    const err = args[0] as Error;
    console.error("[DB] Intercepted pool error:", err?.message ?? String(err));
    return false; // ← يمنع throw er; // Unhandled 'error' event
  }
  return _origEmit(event, ...args);
};

export const db = drizzle(pool, { schema });

export * from "./schema";
