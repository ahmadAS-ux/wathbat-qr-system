import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db, revokedTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SessionData {
  userId: number;
  username: string;
  role: string;
}

function getSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET environment variable is required");
  return s;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const inputHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(inputHash, "hex"));
  } catch {
    return false;
  }
}

export function createSession(data: SessionData): string {
  return jwt.sign({ ...data, jti: crypto.randomUUID() }, getSecret(), { expiresIn: "24h" });
}

export async function deleteSession(token: string): Promise<void> {
  try {
    const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
    if (!decoded?.jti) return;
    const expiresAt = decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(revokedTokensTable).values({ jti: decoded.jti, expiresAt }).onConflictDoNothing();
  } catch {
    // best-effort — never throw on logout
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  let payload: SessionData;
  try {
    payload = jwt.verify(token, getSecret()) as SessionData;
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // jwt.verify succeeded — set session, then check blocklist
  (req as any).session = payload;
  (req as any).token = token;
  const jti = (payload as any).jti as string | undefined;
  if (!jti) {
    // Pre-v4.4.9 token without jti — pass through, expires on original schedule
    next();
    return;
  }
  db.select({ id: revokedTokensTable.id })
    .from(revokedTokensTable)
    .where(eq(revokedTokensTable.jti, jti))
    .then(([found]) => {
      if (found) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ error: "InternalError" });
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as any).session as SessionData;
    if (!session || !roles.includes(session.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const session = (req as any).session as SessionData;
    if (session?.role !== "Admin") {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }
    next();
  });
}
