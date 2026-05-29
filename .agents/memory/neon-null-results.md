---
name: Neon HTTP driver null results
description: @neondatabase/serverless returns null instead of [] for empty query results in some cases
---

## Rule
Always add `?? []` after awaited drizzle queries when using @neondatabase/serverless HTTP driver.

**Why:** The neon HTTP driver (v1.1.0) can return null instead of an empty array when a SELECT returns no rows. Calling .length or .map on null crashes.

**How to apply:**
```typescript
const results = (await db.select(...).from(...).where(...)) ?? [];
if (results.length === 0) return;
```
