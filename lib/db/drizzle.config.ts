import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

let dbUrl = process.env.DATABASE_URL || "";

// Load NEON_URL from .neon_env to override localhost if present
try {
  let currentDir = __dirname;
  let neonEnvPath = "";
  for (let i = 0; i < 4; i++) {
    const tempPath = path.join(currentDir, ".neon_env");
    if (fs.existsSync(tempPath)) {
      neonEnvPath = tempPath;
      break;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  if (neonEnvPath) {
    const content = fs.readFileSync(neonEnvPath, "utf-8");
    const match = content.match(/NEON_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
    if (match && match[1]) {
      dbUrl = match[1].trim();
      console.log("[Drizzle Config] Found and loaded NEON_URL from .neon_env");
    }
  }
} catch (err: any) {
  console.warn("[Drizzle Config] Failed to load .neon_env:", err.message);
}

if (process.env.NEON_URL) {
  dbUrl = process.env.NEON_URL;
}

if (!dbUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
