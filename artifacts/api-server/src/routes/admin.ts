import { Router, type IRouter, type Request, type Response } from "express";
import { db, requestsTable } from "@workspace/db";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { totalDocsProcessed, totalQRsGenerated } from "../lib/stats.js";

const router: IRouter = Router();

router.get("/admin/metrics", async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [thisMonthCount] = await db
      .select({ count: count() })
      .from(requestsTable)
      .where(gte(requestsTable.createdAt, startOfMonth));

    const [totalCount] = await db.select({ count: count() }).from(requestsTable);

    const [doneCount] = await db
      .select({ count: count() })
      .from(requestsTable)
      .where(eq(requestsTable.status, "Done"));

    const total = totalCount?.count ?? 0;
    const done = doneCount?.count ?? 0;
    const successRate = total > 0 ? Math.round((Number(done) / Number(total)) * 100) : 100;

    res.json({
      totalDocsProcessed,
      totalQRsGenerated,
      requestsThisMonth: Number(thisMonthCount?.count ?? 0),
      successRate,
    });
  } catch (err) {
    req.log?.error?.({ err }, "Metrics error");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch metrics" });
  }
});

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
    res.status(500).json({ error: "InternalError", message: "Failed to fetch requests" });
  }
});

router.post("/admin/requests", async (req: Request, res: Response): Promise<void> => {
  try {
    const { positionId, requestType, customerPhone, invoiceNumber, message } = req.body;
    if (!positionId || !requestType) {
      res.status(400).json({ error: "BadRequest", message: "positionId and requestType required" });
      return;
    }
    const [created] = await db
      .insert(requestsTable)
      .values({ positionId, requestType, customerPhone, invoiceNumber, message, status: "New" })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "InternalError", message: "Failed to create request" });
  }
});

router.patch("/admin/requests/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "BadRequest", message: "status required" });
      return;
    }
    const [updated] = await db
      .update(requestsTable)
      .set({ status })
      .where(eq(requestsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "NotFound", message: "Request not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "InternalError", message: "Failed to update request" });
  }
});

export default router;
