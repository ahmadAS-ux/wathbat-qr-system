import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export interface SessionData {
  userId: number;
  username: string;
  role: string;
}

// In-memory session store: token → session
const sessions = new Map<string, SessionData>();

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
  const token = crypto.randomUUID();
  sessions.set(token, data);
  return token;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).session = session;
  (req as any).token = token;
  next();
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
