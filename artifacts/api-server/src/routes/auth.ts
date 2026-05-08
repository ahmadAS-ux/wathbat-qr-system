import { Router, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyPassword, hashPassword, createSession, deleteSession, requireAuth, type SessionData } from "../lib/auth.js";
import { isDefaultPassword } from "../lib/default-passwords.js";

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
    let mustChange = user.mustChangePassword ?? false;
    if (isDefaultPassword(password) && !mustChange) {
      await db.update(usersTable).set({ mustChangePassword: true }).where(eq(usersTable.id, user.id));
      mustChange = true;
    }
    const sessionData: SessionData = { userId: user.id, username: user.username, role: user.role };
    const token = createSession(sessionData);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, mustChangePassword: mustChange } });
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

// GET /api/auth/me — requires auth (DB lookup so mustChangePassword survives reload)
router.get("/auth/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sess = (req as any).session as SessionData;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sess.userId));
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ userId: user.id, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword ?? false });
  } catch {
    res.status(500).json({ error: "InternalError" });
  }
});

// POST /api/auth/change-password — requires auth
router.post("/auth/change-password", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    if (isDefaultPassword(newPassword)) {
      res.status(400).json({ error: "Cannot use a known default password" });
      return;
    }
    const sess = (req as any).session as SessionData;
    await db.update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), mustChangePassword: false })
      .where(eq(usersTable.id, sess.userId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
