import { Router, type Request, type Response } from "express";
import { db, requestsTable, processedDocsTable, usersTable } from "@workspace/db";
import { eq, gte, count, sql, isNotNull } from "drizzle-orm";
import { totalDocsProcessed, totalQRsGenerated } from "../lib/stats.js";
import { requireAdmin, hashPassword } from "../lib/auth.js";

const router = Router();

// ── Metrics ───────────────────────────────────────────────
router.get("/admin/metrics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [thisMonthCount] = await db.select({ count: count() }).from(requestsTable).where(gte(requestsTable.createdAt, startOfMonth));
    const [totalCount] = await db.select({ count: count() }).from(requestsTable);
    const [doneCount] = await db.select({ count: count() }).from(requestsTable).where(eq(requestsTable.status, "Done"));
    const total = totalCount?.count ?? 0;
    const done = doneCount?.count ?? 0;
    const successRate = total > 0 ? Math.round((Number(done) / Number(total)) * 100) : 100;
    res.json({ totalDocsProcessed, totalQRsGenerated, requestsThisMonth: Number(thisMonthCount?.count ?? 0), successRate });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// ── Requests ──────────────────────────────────────────────
router.get("/admin/requests", async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query as { status?: string };
    const rows = await db
      .select()
      .from(requestsTable)
      .where(status && status !== "All" ? eq(requestsTable.status, status) : undefined)
      .orderBy(sql`${requestsTable.createdAt} desc`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// POST is public — used by the customer-facing scan form
router.post("/admin/requests", async (req: Request, res: Response): Promise<void> => {
  try {
    const { positionId, requestType, customerPhone, projectName, invoiceNumber, message } = req.body;
    if (!positionId || !requestType) {
      res.status(400).json({ error: "BadRequest", message: "positionId and requestType required" });
      return;
    }
    const [created] = await db
      .insert(requestsTable)
      .values({ positionId, requestType, customerPhone, projectName, invoiceNumber, message, status: "New" })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

router.patch("/admin/requests/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;
    if (!status) { res.status(400).json({ error: "BadRequest", message: "status required" }); return; }
    const [updated] = await db.update(requestsTable).set({ status }).where(eq(requestsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "NotFound" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// DELETE request — admin only
router.delete("/admin/requests/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(requestsTable).where(eq(requestsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// ── Projects ──────────────────────────────────────────────
router.get("/admin/projects", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({ projectName: processedDocsTable.projectName })
      .from(processedDocsTable)
      .where(isNotNull(processedDocsTable.projectName))
      .orderBy(processedDocsTable.projectName);
    const names = [...new Set(rows.map(r => r.projectName).filter(Boolean))];
    res.json(names);
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// ── History ───────────────────────────────────────────────
router.get("/admin/history", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: processedDocsTable.id,
        originalFilename: processedDocsTable.originalFilename,
        reportFilename: processedDocsTable.reportFilename,
        projectName: processedDocsTable.projectName,
        processingDate: processedDocsTable.processingDate,
        positionCount: processedDocsTable.positionCount,
        createdAt: processedDocsTable.createdAt,
      })
      .from(processedDocsTable)
      .orderBy(sql`${processedDocsTable.createdAt} desc`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

// ── User Management (admin only) ──────────────────────────
router.get("/admin/users", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({ id: usersTable.id, username: usersTable.username, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

router.post("/admin/users", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      res.status(400).json({ error: "BadRequest", message: "username, password, and role are required" });
      return;
    }
    if (!["Admin", "User"].includes(role)) {
      res.status(400).json({ error: "BadRequest", message: "role must be Admin or User" });
      return;
    }
    const passwordHash = hashPassword(password);
    const [created] = await db
      .insert(usersTable)
      .values({ username, passwordHash, role })
      .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role, createdAt: usersTable.createdAt });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "Username already exists" });
      return;
    }
    res.status(500).json({ error: "InternalError" });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const session = (req as any).session;

    if (session.userId === id) {
      res.status(400).json({ error: "BadRequest", message: "Cannot delete your own account" });
      return;
    }

    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) { res.status(404).json({ error: "NotFound" }); return; }

    if (target.role === "Admin") {
      const [adminCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "Admin"));
      if (Number(adminCount?.count) <= 1) {
        res.status(400).json({ error: "BadRequest", message: "Cannot delete the last admin account" });
        return;
      }
    }

    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "InternalError" });
  }
});

export default router;
