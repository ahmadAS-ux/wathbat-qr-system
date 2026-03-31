import { Router, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, deleteSession, requireAuth, type SessionData } from "../lib/auth.js";

const router = Router();

// POST /api/auth/login — public
router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "BadRequest", message: "Username and password required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }
    const sessionData: SessionData = { userId: user.id, username: user.username, role: user.role };
    const token = createSession(sessionData);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// POST /api/auth/logout — requires auth
router.post("/auth/logout", requireAuth, (req: Request, res: Response): void => {
  const token = (req as any).token as string;
  deleteSession(token);
  res.json({ ok: true });
});

// GET /api/auth/me — requires auth
router.get("/auth/me", requireAuth, (req: Request, res: Response): void => {
  const session = (req as any).session as SessionData;
  res.json({ userId: session.userId, username: session.username, role: session.role });
});

export default router;
