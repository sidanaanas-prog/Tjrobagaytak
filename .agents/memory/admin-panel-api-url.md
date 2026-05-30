---
name: Admin panel API URL routing
description: Admin panel getApiUrl() must NOT prepend BASE_URL for API calls on Replit deployment
---

## Rule
In `artifacts/admin-panel/src/lib/api-url.ts`, for non-Render / non-VITE_API_URL environments, return `path` directly (empty base), NOT `BASE_URL + path`.

**Why:** Admin panel is served at `/admin/` path, so `import.meta.env.BASE_URL = "/admin/"`. Prepending it to API calls produces `/admin/api/...` which the Replit proxy routes to the admin panel Vite server — NOT the API server at `/api`. Result: all manual fetch calls get 401/404 silently.

**How to apply:**
```ts
// CORRECT for admin-panel/src/lib/api-url.ts
return path; // "" for base, "/api/something" for API calls

// WRONG
const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
return `${base}${path}`; // produces "/admin/api/..." — broken on deployment
```

The generated hooks (api-client-react) use `setBaseUrl(null)` which defaults to root-relative and work correctly. Only manual `fetch` with `getApiUrl()` was broken.
