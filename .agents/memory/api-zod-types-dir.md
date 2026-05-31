---
name: api-zod types directory conflict
description: lib/api-zod/src/generated/types is a DIRECTORY not a file — exporting from it causes TS2308 duplicate errors
---

# api-zod duplicate export fix

`lib/api-zod/src/index.ts` must only re-export from `./generated/api`.
The `./generated/types` path is a **directory** (created by Orval for type-only files), not a .ts file.
Exporting from it causes `TS2308: Module has already exported member` errors.

**Rule:** Keep index.ts as:
```ts
export * from "./generated/api";
```
Never add `export * from "./generated/types"`.

**Why:** Orval's codegen creates a `types/` subdirectory but index.ts barrel shouldn't include it via glob — TypeScript treats it as duplicate re-export of the same names.

**How to apply:** If typecheck:libs fails with TS2308 duplicate exports in api-zod, check index.ts and remove any non-api exports.
