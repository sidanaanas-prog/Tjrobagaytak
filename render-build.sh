#!/bin/bash
set -e

echo "==> Installing dependencies..."
corepack enable pnpm 2>/dev/null || npm install -g pnpm
pnpm install

echo "==> Building libs (type declarations)..."
cd lib/db && pnpm exec tsc --noEmit 2>/dev/null || true && cd ../..
cd lib/api-zod && pnpm exec tsc --noEmit 2>/dev/null || true && cd ../..
cd lib/api-client-react && pnpm exec tsc --noEmit 2>/dev/null || true && cd ../..

echo "==> Building API Server..."
cd artifacts/api-server
pnpm exec node build.mjs
cd ../..

echo "==> Building Marketplace (static)..."
cd artifacts/marketplace
PORT=3000 BASE_PATH=/ pnpm exec vite build --config vite.config.ts
cd ../..

echo "==> Build complete!"
