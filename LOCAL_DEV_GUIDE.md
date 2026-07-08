# Gaytak - Local Development Guide

Run Gaytak on your machine with VS Code.

---

## Requirements

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 24.x | [nodejs.org](https://nodejs.org) or `nvm install 24` |
| **pnpm** | 9.x+ | `npm install -g pnpm` |
| **PostgreSQL** | 15+ | Docker (recommended) or local install |

---

## Quick Start (3 minutes)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd gaytak

# Install dependencies
pnpm install
```

### 2. Database (Choose one)

**Option A: Docker (Easiest)**
```bash
docker-compose up -d postgres
```

**Option B: Local PostgreSQL**
```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb gaytak
```

### 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# For Docker PostgreSQL
DATABASE_URL="postgresql://gaytak:gaytak123@localhost:5432/gaytak"

# For local PostgreSQL
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gaytak"

# Server
PORT=8080
BASE_PATH="/api"
NODE_ENV="development"
SESSION_SECRET="change-me-in-production"

# Admin (auto-created)
ADMIN_EMAIL="admin@gaytak.com"
ADMIN_PASSWORD="gaytak@2025"
```

### 4. Build Libraries & Push Schema

```bash
pnpm run typecheck:libs
pnpm --filter @workspace/db run push-force
```

### 5. Start Services

Open **3 separate terminals**:

**Terminal 1 — API Server**
```bash
pnpm --filter @workspace/api-server run dev
# → http://localhost:8080
```

**Terminal 2 — Marketplace Web**
```bash
pnpm --filter @workspace/marketplace run dev
# → http://localhost:3000
```

**Terminal 3 — Admin Panel (optional)**
```bash
pnpm --filter @workspace/admin-panel run dev
# → http://localhost:3001
```

---

## One-Command Startup

```bash
# Make executable
chmod +x scripts/dev.sh

# Run
./scripts/dev.sh
```

---

## VS Code Setup

### Extensions (Recommended)

- **ESLint** — linting
- **Prettier** — formatting
- **Tailwind CSS IntelliSense** — class autocomplete
- **Thunder Client** — API testing (like Postman)

### Launch Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "API Server",
      "type": "shell",
      "command": "pnpm --filter @workspace/api-server run dev",
      "group": "build"
    },
    {
      "label": "Marketplace",
      "type": "shell",
      "command": "pnpm --filter @workspace/marketplace run dev",
      "group": "build"
    }
  ]
}
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `Cannot find module '@workspace/db'` | Run `pnpm run typecheck:libs` |
| `DATABASE_URL not set` | Check `.env` file exists and has correct URL |
| `column "X" does not exist` | Run `pnpm --filter @workspace/db run push-force` |
| `EADDRINUSE :::8080` | Kill process: `kill $(lsof -t -i:8080)` |
| White/blank page | API server must be running. Check `http://localhost:8080/api/healthz` |
| `Use pnpm instead` | You're using npm/yarn. Run: `npm install -g pnpm` |

---

## Project Structure

```
gaytak/
├── artifacts/
│   ├── api-server/       → Express API (port 8080)
│   ├── marketplace/      → React web app (port 3000)
│   ├── admin-panel/       → React admin app (port 3001)
│   └── gaytak-mobile/     → Expo mobile app
├── lib/
│   ├── db/               → Drizzle schema + migrations
│   ├── api-zod/          → Zod schemas
│   ├── api-client-react/  → React Query hooks
│   └── ...
├── docker-compose.yml     → PostgreSQL container
├── .env.example          → Template for env vars
└── scripts/dev.sh        → Startup helper
```

---

## Optional Features (Not Required Locally)

| Feature | Env Vars Needed |
|---------|----------------|
| WhatsApp OTP | `NABDA_TOKEN`, `NABDA_INSTANCE_ID` |
| Push Notifications | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY` |
| Image Upload (Cloudinary) | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` |

Without these, the app still works — you can login with email/password.
