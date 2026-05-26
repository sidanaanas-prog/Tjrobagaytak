import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Primary secret for signing new tokens — fixed so dev and prod are always compatible.
const PRIMARY_SECRET = "gaytak-market-2025";
// Also accept tokens signed with any previous secret so existing sessions keep working.
const ACCEPTED_SECRETS = [
  PRIMARY_SECRET,
  process.env.SESSION_SECRET,
  "glow-market-secret-key",
].filter(Boolean) as string[];

export interface AuthPayload {
  userId: string;
  role: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, PRIMARY_SECRET, { expiresIn: "90d" });
}

export function verifyToken(token: string): AuthPayload {
  for (const secret of ACCEPTED_SECRETS) {
    try {
      return jwt.verify(token, secret) as AuthPayload;
    } catch {}
  }
  throw new Error("Invalid token");
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token) as AuthPayload & { iat?: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user || user.banned) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // تحقق من تسجيل الخروج الجماعي
    if (user.tokenIssuedAfter && payload.iat) {
      const tokenTime = new Date(payload.iat * 1000);
      if (tokenTime < user.tokenIssuedAfter) {
        res.status(401).json({ error: "Session expired" });
        return;
      }
    }
    req.user = { id: user.id, role: user.role };
    // تحديث آخر نشاط (fire & forget)
    db.update(usersTable).set({ lastSeenAt: new Date() }).where(eq(usersTable.id, user.id)).catch(() => {});
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      // Trust the JWT — no DB round-trip needed here (saves ~500ms in production)
      const payload = verifyToken(authHeader.slice(7));
      req.user = { id: payload.userId, role: payload.role };
    } catch {}
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
