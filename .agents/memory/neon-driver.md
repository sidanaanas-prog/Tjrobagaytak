---
name: Neon DB driver crash fix
description: pg.Pool causes server crash every ~78s on Neon/Replit — fixed by switching to @neondatabase/serverless HTTP mode
---

## Rule
Never use pg.Pool with Neon on Replit/serverless. Use @neondatabase/serverless + drizzle-orm/neon-http instead.

**Why:** Neon terminates idle TCP connections after ~78 seconds. pg-pool emits an error event that cannot be caught (BoundPool internal), causing Node.js to crash with "Unhandled 'error' event on BoundPool instance". All interception attempts (pool.on, pool.emit override, process.on uncaughtException) fail because Node.js prints to stderr BEFORE uncaughtException handler runs, and Replit orchestrator watches stderr.

**How to apply:** 
- lib/db/src/index.ts: use `neon(DATABASE_URL)` + `drizzle(sql, { schema })` from drizzle-orm/neon-http
- lib/db/package.json: @neondatabase/serverless in dependencies, pg in devDependencies only (for drizzle-kit migrations)
- pnpm-workspace.yaml: no additional overrides needed — removing pg from runtime deps is enough to prevent drizzle-orm dual-instance type conflict
- api-server/src/index.ts: warmupDb uses `db.execute(sql\`SELECT 1\`)` (no pool.connect)
