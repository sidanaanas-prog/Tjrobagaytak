import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

import fs from "fs";
import path from "path";

let DATABASE_URL = process.env.DATABASE_URL || "";

// Load NEON_URL from .neon_env to override localhost if present
try {
  let currentDir = process.cwd();
  let neonEnvPath = "";
  for (let i = 0; i < 4; i++) {
    const tempPath = path.join(currentDir, ".neon_env");
    if (fs.existsSync(tempPath)) {
      neonEnvPath = tempPath;
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  if (neonEnvPath) {
    const content = fs.readFileSync(neonEnvPath, "utf-8");
    const match = content.match(/NEON_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match && match[1]) {
      DATABASE_URL = match[1].trim();
      console.log("[DB] Found and loaded NEON_URL from .neon_env");
    }
  }
} catch (err: any) {
  console.warn("[DB] Failed to load .neon_env:", err.message);
}

if (process.env.NEON_URL) {
  DATABASE_URL = process.env.NEON_URL;
}

const isNeon = DATABASE_URL ? DATABASE_URL.includes("neon.tech") : false;

function buildDb() {
  if (!DATABASE_URL) {
    console.warn("[AI Studio] DATABASE_URL is not set — falling back to mock database proxy.");
    const noOpSelect = () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        limit: () => chain,
        orderBy: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        catch: () => [],
        then: (cb: any) => Promise.resolve([]).then(cb),
      };
      return chain;
    };
    const noOpInsert = () => {
      const chain = {
        values: () => chain,
        returning: () => chain,
        catch: () => [],
        then: (cb: any) => Promise.resolve([]).then(cb),
      };
      return chain;
    };
    const noOpUpdate = () => {
      const chain = {
        set: () => chain,
        where: () => chain,
        returning: () => chain,
        catch: () => [],
        then: (cb: any) => Promise.resolve([]).then(cb),
      };
      return chain;
    };
    const noOpDelete = () => {
      const chain = {
        where: () => chain,
        returning: () => chain,
        catch: () => [],
        then: (cb: any) => Promise.resolve([]).then(cb),
      };
      return chain;
    };
    const noOpQuery = {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (d: any) => d?.data ?? {},
      update: async (d: any) => d?.data ?? {},
      delete: async () => ({}),
    };
    return new Proxy({}, {
      get: (_, prop) => {
        if (prop === "query") {
          return new Proxy({}, { get: () => noOpQuery });
        }
        if (prop === "select") return noOpSelect;
        if (prop === "insert") return noOpInsert;
        if (prop === "update") return noOpUpdate;
        if (prop === "delete") return noOpDelete;
        if (prop === "execute") return async () => ({ rows: [] });
        return async () => [];
      },
    }) as any;
  }

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

// Helper to check if running on Neon
export const isNeonDb = isNeon;

export const db = buildDb();
export * from "./schema";
