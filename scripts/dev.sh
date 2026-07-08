#!/usr/bin/env bash
#
# Gaytak - Local Development Startup Script
# Run: ./scripts/dev.sh
#

set -e

echo "🚀 Gaytak Local Dev Starter"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found. Install from https://nodejs.org/"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm not found. Install: npm install -g pnpm"; exit 1; }

NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "⚠️  Node.js version $NODE_MAJOR detected. Recommended: 24.x"
fi

echo "✅ Node $(node --version) | pnpm $(pnpm --version)"
echo ""

# Check .env exists
if [ ! -f ".env" ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
  echo "⚠️  Please edit .env and set your DATABASE_URL and other secrets"
  echo "   For local PostgreSQL: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gaytak"
  echo "   For Docker:         DATABASE_URL=postgresql://gaytak:gaytak123@localhost:5432/gaytak"
  echo ""
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

# Build libraries
echo "🔨 Building shared libraries..."
pnpm run typecheck:libs || true

# Push DB schema
echo "🗄️  Pushing database schema..."
pnpm --filter @workspace/db run push-force || {
  echo "⚠️  DB push failed. Check DATABASE_URL in .env"
  echo "   Start PostgreSQL: docker-compose up -d postgres"
}

echo ""
echo "✅ Ready! Start services in separate terminals:"
echo ""
echo "  Terminal 1 - API Server:"
echo "    pnpm --filter @workspace/api-server run dev"
echo "    → http://localhost:8080"
echo ""
echo "  Terminal 2 - Marketplace:"
echo "    pnpm --filter @workspace/marketplace run dev"
echo "    → http://localhost:3000"
echo ""
echo "  Terminal 3 - Admin Panel (optional):"
echo "    pnpm --filter @workspace/admin-panel run dev"
echo "    → http://localhost:3001"
echo ""
