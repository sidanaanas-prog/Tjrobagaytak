---
name: Adding nullable fields to OpenAPI + codegen workflow
description: Steps to correctly add a nullable field to the API contract and propagate it to TypeScript types
---

# Adding nullable fields (e.g. originalPrice) to OpenAPI

When adding a new nullable field to a product (or any schema):

1. **Update `lib/api-spec/openapi.yaml`** — add field to ALL relevant schemas:
   - `Product` (the response shape)
   - `CreateProductInput` (POST body)
   - `UpdateProductInput` (PATCH body)
   - Mark as `nullable: true`

2. **Run codegen**: `pnpm --filter @workspace/api-spec run codegen`
   - This regenerates `lib/api-client-react/src/generated/api.schemas.ts` and `api.ts`
   - The `dist/` declarations are NOT automatically updated yet

3. **Rebuild libs**: `pnpm run typecheck:libs`
   - This runs `tsc --build` on composite libs, updating `dist/*.d.ts`
   - Only then will consumers (marketplace) see the new types

4. **Add column to DB via SQL** if drizzle push hangs on interactive prompts:
   ```sql
   ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price numeric(12,2);
   ```

**Why:** The dist/ declarations of api-client-react are what Vite resolves at typecheck time. Until typecheck:libs rebuilds them, consumers see the old types even after codegen.
