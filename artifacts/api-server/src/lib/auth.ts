import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

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
  return jwt.sign(data, getSecret(), { expiresIn: "7d" });
}

// No-op kept for API compatibility (logout still clears the client-side token)
export function deleteSession(_token: string): void {}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, getSecret()) as SessionData;
    (req as any).session = payload;
    (req as any).token = token;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
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
