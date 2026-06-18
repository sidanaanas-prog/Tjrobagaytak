import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const DATABASE_URL = process.env.DATABASE_URL;
const isNeon = DATABASE_URL.includes("neon.tech");

function buildDb() {
  if (isNeon) {
    // Neon serverless HTTP — لا يعاني من انقطاع TCP مع Neon
    const sql = neon(DATABASE_URL);
    return drizzleNeon(sql, { schema });
  }
  // node-postgres — للتطوير المحلي
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (err: Error) => {
    console.error("[DB Pool] idle client error (non-fatal):", err.message);
  });
  return drizzleNode(pool, { schema });
}

export const db = buildDb();
export * from "./schema";
