import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq, and, lt, sql, ne, isNull, or } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadLogsTable,
  projectsTable,
  projectFilesTable,
  dropdownOptionsTable,
  usersTable,
} from "@workspace/db";
import { requireRole } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx files are accepted"));
    }
  },
});

// ─── Role sets ────────────────────────────────────────────────────────────────
const NO_SALES_NO_ACCT = ["Admin", "FactoryManager", "Employee"];
const ADMIN_FM = ["Admin", "FactoryManager"];
const ADMIN_ONLY = ["Admin"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function session(req: Request) {
  return (req as any).session as { userId: number; username: string; role: string };
}

function notFound(res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// ─── DROPDOWN OPTIONS ─────────────────────────────────────────────────────────

// GET /erp/options — all options for all categories (Admin only)
router.get("/erp/options", requireRole(...ADMIN_ONLY), async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(dropdownOptionsTable)
      .orderBy(dropdownOptionsTable.category, dropdownOptionsTable.sortOrder);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/options failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/options/:category — public, used by forms
router.get("/erp/options/:category", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(dropdownOptionsTable)
      .where(
        and(
          eq(dropdownOptionsTable.category, String(req.params.category)),
          ne(dropdownOptionsTable.active, false)
        )
      )
      .orderBy(dropdownOptionsTable.sortOrder);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/options/:category failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/options — Admin only
router.post("/erp/options", requireRole(...ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const { category, value, labelAr, labelEn, sortOrder } = req.body;
    if (!category || !value || !labelAr || !labelEn) {
      res.status(400).json({ error: "category, value, labelAr, labelEn are required" });
      return;
    }
    const [row] = await db.insert(dropdownOptionsTable).values({ category, value, labelAr, labelEn, sortOrder: sortOrder ?? 0 }).returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/options failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/options/:id — Admin only
router.patch("/erp/options/:id", requireRole(...ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { labelAr, labelEn, sortOrder, active } = req.body;
    const [row] = await db
      .update(dropdownOptionsTable)
      .set({ ...(labelAr !== undefined && { labelAr }), ...(labelEn !== undefined && { labelEn }), ...(sortOrder !== undefined && { sortOrder }), ...(active !== undefined && { active }) })
      .where(eq(dropdownOptionsTable.id, id))
      .returning();
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/options/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/options/:id — Admin only
router.delete("/erp/options/:id", requireRole(...ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(dropdownOptionsTable).where(eq(dropdownOptionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/options/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── LEADS ────────────────────────────────────────────────────────────────────

// GET /erp/leads — all roles except Accountant
router.get("/erp/leads", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const { status, assignedTo, overdue } = req.query;
    let query = db.select().from(leadsTable);

    const conditions = [];
    if (status) conditions.push(eq(leadsTable.status, status as string));
    if (assignedTo) conditions.push(eq(leadsTable.assignedTo, Number(assignedTo)));
    if (overdue === "true") {
      conditions.push(lt(leadsTable.firstFollowupDate, new Date().toISOString().split("T")[0]));
      conditions.push(eq(leadsTable.status, "followup"));
    }

    const rows = conditions.length > 0
      ? await db.select().from(leadsTable).where(and(...conditions)).orderBy(leadsTable.createdAt)
      : await db.select().from(leadsTable).orderBy(leadsTable.createdAt);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/leads failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/leads/overdue-count — overdue badge count
router.get("/erp/leads/overdue-count", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM leads WHERE status IN ('new','followup') AND first_followup_date < ${today}`
    );
    const count = Number((result.rows[0] as any)?.count ?? 0);
    res.json({ count });
  } catch (err) {
    logger.error({ err }, "GET /erp/leads/overdue-count failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/leads — create
router.post("/erp/leads", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const { customerName, phone, source, productInterest, buildingType, location, assignedTo, budgetRange, estimatedValue, firstFollowupDate } = req.body;
    if (!customerName || !phone || !source || !productInterest || !buildingType || !firstFollowupDate) {
      res.status(400).json({ error: "customerName, phone, source, productInterest, buildingType, firstFollowupDate are required" });
      return;
    }
    if (!/^05\d{8}$/.test(phone)) {
      res.status(400).json({ error: "Phone must be a valid Saudi number starting with 05 (10 digits)" });
      return;
    }
    const sess = session(req);
    const [row] = await db.insert(leadsTable).values({
      customerName, phone, source, productInterest, buildingType,
      location: location ?? null,
      assignedTo: assignedTo ? Number(assignedTo) : sess.userId,
      budgetRange: budgetRange ?? null,
      estimatedValue: estimatedValue ? Number(estimatedValue) : null,
      firstFollowupDate,
      createdBy: sess.userId,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/leads failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/leads/:id — detail + logs
router.get("/erp/leads/:id", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!lead) return notFound(res);
    const logs = await db.select().from(leadLogsTable).where(eq(leadLogsTable.leadId, id)).orderBy(leadLogsTable.createdAt);
    res.json({ ...lead, logs });
  } catch (err) {
    logger.error({ err }, "GET /erp/leads/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/leads/:id — update fields or status
router.patch("/erp/leads/:id", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const allowed = ["customerName", "phone", "source", "productInterest", "buildingType", "location", "assignedTo", "budgetRange", "estimatedValue", "firstFollowupDate", "status"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    const [row] = await db.update(leadsTable).set(updates).where(eq(leadsTable.id, id)).returning();
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/leads/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/leads/:id — Admin/FactoryManager only
router.delete("/erp/leads/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(leadLogsTable).where(eq(leadLogsTable.leadId, id));
    await db.delete(leadsTable).where(eq(leadsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/leads/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/leads/:id/logs — add contact log
router.post("/erp/leads/:id/logs", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const { note, nextFollowupDate } = req.body;
    if (!note) {
      res.status(400).json({ error: "note is required" });
      return;
    }
    const sess = session(req);
    const [row] = await db.insert(leadLogsTable).values({
      leadId,
      note,
      nextFollowupDate: nextFollowupDate ?? null,
      createdBy: sess.userId,
    }).returning();

    // Update lead's firstFollowupDate if a new follow-up date is provided
    if (nextFollowupDate) {
      await db.update(leadsTable).set({ firstFollowupDate: nextFollowupDate, status: "followup" }).where(eq(leadsTable.id, leadId));
    }

    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/leads/:id/logs failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/leads/:id/logs/:logId — edit own log (author only)
router.patch("/erp/leads/:id/logs/:logId", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const logId = Number(req.params.logId);
    const sess = session(req);
    const [log] = await db.select().from(leadLogsTable).where(eq(leadLogsTable.id, logId));
    if (!log) return notFound(res);
    if (log.createdBy !== sess.userId && sess.role !== "Admin") {
      res.status(403).json({ error: "Can only edit your own log entries" });
      return;
    }
    const { note, nextFollowupDate } = req.body;
    const [row] = await db.update(leadLogsTable).set({
      ...(note !== undefined && { note }),
      ...(nextFollowupDate !== undefined && { nextFollowupDate }),
    }).where(eq(leadLogsTable.id, logId)).returning();
    res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/leads/:id/logs/:logId failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/leads/:id/convert — convert to project (Employee+ except SalesAgent)
router.post("/erp/leads/:id/convert", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
    if (!lead) return notFound(res);
    if (lead.status === "converted") {
      res.status(400).json({ error: "Lead is already converted" });
      return;
    }
    const sess = session(req);
    const [project] = await db.insert(projectsTable).values({
      name: lead.customerName,
      customerName: lead.customerName,
      phone: lead.phone,
      location: lead.location ?? null,
      buildingType: lead.buildingType,
      productInterest: lead.productInterest,
      estimatedValue: lead.estimatedValue ?? null,
      fromLeadId: leadId,
      assignedTo: lead.assignedTo ?? sess.userId,
      stageDisplay: "new",
      stageInternal: 1,
      createdBy: sess.userId,
    }).returning();
    await db.update(leadsTable).set({ status: "converted", convertedProjectId: project.id }).where(eq(leadsTable.id, leadId));
    res.status(201).json({ projectId: project.id, project });
  } catch (err) {
    logger.error({ err }, "POST /erp/leads/:id/convert failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/leads/:id/lose — mark as lost
router.patch("/erp/leads/:id/lose", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;
    const [row] = await db.update(leadsTable).set({ status: "lost", lostReason: reason ?? null }).where(eq(leadsTable.id, id)).returning();
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/leads/:id/lose failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

// GET /erp/projects — list (no SalesAgent, no Accountant)
router.get("/erp/projects", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const { stageDisplay } = req.query;
    const rows = stageDisplay
      ? await db.select().from(projectsTable).where(eq(projectsTable.stageDisplay, stageDisplay as string)).orderBy(projectsTable.createdAt)
      : await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects — create directly (no lead)
router.post("/erp/projects", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const { name, customerName, phone, location, buildingType, productInterest, estimatedValue, assignedTo } = req.body;
    if (!name || !customerName) {
      res.status(400).json({ error: "name and customerName are required" });
      return;
    }
    const sess = session(req);
    const [row] = await db.insert(projectsTable).values({
      name, customerName,
      phone: phone ?? null,
      location: location ?? null,
      buildingType: buildingType ?? null,
      productInterest: productInterest ?? null,
      estimatedValue: estimatedValue ? Number(estimatedValue) : null,
      assignedTo: assignedTo ? Number(assignedTo) : sess.userId,
      stageDisplay: "new",
      stageInternal: 1,
      createdBy: sess.userId,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/projects failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id — full detail + files
router.get("/erp/projects/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) return notFound(res);
    const files = await db.select({
      id: projectFilesTable.id,
      projectId: projectFilesTable.projectId,
      fileType: projectFilesTable.fileType,
      originalFilename: projectFilesTable.originalFilename,
      uploadedAt: projectFilesTable.uploadedAt,
      uploadedBy: projectFilesTable.uploadedBy,
    }).from(projectFilesTable).where(eq(projectFilesTable.projectId, id));
    res.json({ ...project, files });
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/projects/:id — update fields or stage
router.patch("/erp/projects/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const allowed = ["name", "customerName", "phone", "location", "buildingType", "productInterest", "estimatedValue", "stageDisplay", "stageInternal", "assignedTo", "deliveryDeadline", "warrantyMonths", "warrantyStartDate", "warrantyEndDate", "notes"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    const [row] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/projects/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/projects/:id — Admin/FactoryManager only
router.delete("/erp/projects/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(projectFilesTable).where(eq(projectFilesTable.projectId, id));
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/projects/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/files — upload file
router.post("/erp/projects/:id/files", requireRole(...NO_SALES_NO_ACCT), upload.single("file"), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { fileType } = req.body;
    if (!req.file || !fileType) {
      res.status(400).json({ error: "file and fileType are required" });
      return;
    }
    const sess = session(req);

    // Non-attachment types: delete existing file of same type first (one per type)
    if (fileType !== "attachment") {
      await db.delete(projectFilesTable).where(
        and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.fileType, fileType))
      );
    }

    const [row] = await db.insert(projectFilesTable).values({
      projectId,
      fileType,
      originalFilename: req.file.originalname,
      fileData: req.file.buffer,
      uploadedBy: sess.userId,
    }).returning();

    res.status(201).json({
      id: row.id,
      projectId: row.projectId,
      fileType: row.fileType,
      originalFilename: row.originalFilename,
      uploadedAt: row.uploadedAt,
      uploadedBy: row.uploadedBy,
    });
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/files failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/files/:fileId — download file
router.get("/erp/projects/:id/files/:fileId", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const fileId = Number(req.params.fileId);
    const [file] = await db.select().from(projectFilesTable).where(eq(projectFilesTable.id, fileId));
    if (!file) return notFound(res);
    res.setHeader("Content-Disposition", `attachment; filename="${file.originalFilename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(file.fileData);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/files/:fileId failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/projects/:id/files/:fileId — delete file
router.delete("/erp/projects/:id/files/:fileId", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const fileId = Number(req.params.fileId);
    await db.delete(projectFilesTable).where(eq(projectFilesTable.id, fileId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/projects/:id/files/:fileId failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
