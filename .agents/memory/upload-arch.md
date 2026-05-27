---
name: Upload Architecture
description: All file uploads go through /api/upload → Replit Object Storage → served at /api/storage/public-objects/*
---

**Upload flow (both Replit and Render):**
1. Client sends base64 + path + contentType to POST /api/upload (with JWT auth)
2. Server (upload.ts) saves to Replit Object Storage public bucket using objectStorageClient
3. Server returns URL: `{proto}://{host}/api/storage/public-objects/{path}`
4. Files served via GET /api/storage/public-objects/* (existing route in storage.ts)

**Key files:**
- Server: `artifacts/api-server/src/routes/upload.ts`
- Client: `artifacts/marketplace/src/lib/upload-image.ts`
- Bucket info from env: PUBLIC_OBJECT_SEARCH_PATHS = `/replit-objstore-xxx/public`

**Why:** Firebase Storage bucket doesn't exist; Replit Object Storage works locally and serves files via API. On Render, the sidecar (127.0.0.1:1106) won't be available — if Render deployment is needed, Firebase Storage bucket must be created first OR a different storage backend added.

**How to apply:** Never bypass /api/upload to upload directly from client (Firebase SDK). All upload* functions in upload-image.ts call uploadViaServer() which posts to /api/upload.
