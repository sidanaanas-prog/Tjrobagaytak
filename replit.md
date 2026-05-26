# Gaytak — Full Stack Marketplace

## Overview
Arabic dark-mode marketplace platform with neon glow design. Mobile-first UI (max-w-lg centered).
App name: **Gaytak** | Admin panel: **Gaytak Admin**

## Stack
- **Monorepo**: pnpm workspaces
- **Node.js**: 24 | **TypeScript**: 5.9 | **Package manager**: pnpm
- **API**: Express 5 + Drizzle ORM + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS v4 + shadcn/ui + Framer Motion
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)

## Artifacts
| Name | Path | Purpose |
|---|---|---|
| Gaytak (marketplace) | `/` | Main user app |
| Gaytak Admin | `/admin-panel` | Admin control panel |
| API Server | internal | Express REST API |

## Auth System
- **Primary**: Phone + OTP via WhatsApp (Nabda OTP)
- **Fallback**: Email + Password at `/login-email`
- JWT stored in localStorage as `glow_token` (marketplace) / `glow_admin_token` (admin)
- Admin credentials: admin@gaytak.com / gaytak@2025

## Nabda OTP Integration
- **API URL**: https://api.nabdaotp.com
- **Instance ID**: stored as env `NABDA_INSTANCE_ID`
- **Token**: stored as env `NABDA_TOKEN`
- Send OTP: `POST /api/v1/messages/otp/send` → body: `{ phone: "+966..." }` → Auth: `Authorization: <token>`
- Verify OTP: `POST /api/v1/messages/otp/verify` → body: `{ phone, code }` → Auth: `Authorization: <token>`
- OTP delivered via **WhatsApp**
- API routes: `POST /api/auth/otp/send` and `POST /api/auth/otp/verify`

## Database Schema (PostgreSQL)
- **users**: id, name, phone (unique, nullable), email (unique), password_hash, avatar, role, banned, created_at
- **products**: id, title, description, price, images[], category_id, seller_id, status (pending/approved/rejected), created_at
- **categories**: id, name, slug
- **messages**: id, conversation_id, sender_id, content, created_at
- **conversations**: id, user1_id, user2_id, created_at
- **stories**: id, user_id, image_url, caption, expires_at, is_active, created_at
- **activity**: id, type, description, user_id, user_name, created_at

## Features Built
- ✅ Home page with StoriesBar + product grid
- ✅ Stories (الحالات): add, view, auto-advance, 24h expiry
- ✅ Products: list, search, filter by category
- ✅ Sell page: up to 4 images (gallery or URL), product form
- ✅ My Listings: status cards (approved/pending/rejected), filter tabs
- ✅ Chat: real-time style messaging, unread count
- ✅ Profile: edit name + avatar (gallery or URL), camera button
- ✅ Phone + OTP login via Nabda (WhatsApp)
- ✅ Admin panel: products approval, users management, categories, activity

## Image Upload
- Shared utility: `artifacts/marketplace/src/lib/compress-image.ts`
- Max 900px, 0.8 JPEG quality
- Used in: sell page (4 images), profile (avatar), add-story

## Important Notes
- Tailwind v4: use `class="dark"` on HTML element, NOT `@apply dark`
- Express body limit: 20mb (for base64 images)
- Drizzle: use `inArray()` NOT `sql ANY()` for array queries
- Chat API returns array directly (not `{ messages: [] }`)
- Phone numbers stored in international format: `+966...`

## Key Commands
- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/db run push-force` — force push schema

## Expo (React Native) — Planned
- Target: Google Play Store (AAB via EAS Build)
- OTP auth works with Expo (same API)
- Nabda env vars already saved: NABDA_INSTANCE_ID, NABDA_TOKEN, NABDA_API_URL
- Push notifications: Expo Push Service (to be added)
- User runs: `eas build --platform android` to get AAB
