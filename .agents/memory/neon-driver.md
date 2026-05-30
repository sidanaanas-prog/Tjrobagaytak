---
name: Neon DB driver fix
description: pg.Pool causes server crash every ~78s on Neon — fixed with dual-driver that auto-detects neon.tech URLs
---

## Rule
Never use pg.Pool with Neon on Render/serverless. Use @neondatabase/serverless + drizzle-orm/neon-http for Neon, pg.Pool for local PostgreSQL.

**Why:** Neon terminates idle TCP connections after ~78 seconds. pg-pool emits an unrecoverable error event that crashes Node.js with "Unhandled 'error' event on BoundPool instance". @neondatabase/serverless uses HTTP requests — no persistent TCP connections, no timeout crashes.

**How to apply:**
- lib/db/src/index.ts: detect `DATABASE_URL.includes("neon.tech")` — if true use drizzle-orm/neon-http + neon(), else use drizzle-orm/node-postgres + pg.Pool
- lib/db/package.json: BOTH @neondatabase/serverless AND pg in `dependencies` (pg needed for local dev)
- pnpm-workspace.yaml overrides: `drizzle-orm: "0.45.1"` — forces single instance, prevents TS2346 dual-instance type conflict
- api-server/src/index.ts: warmupDb uses `db.execute(sql\`SELECT 1\`)` (no pool.connect)
- Also: @neondatabase/serverless returns null instead of [] for empty results — all db.select() must use `?? []`
