import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { eq, and, lt, sql, ne, isNull, or, desc, inArray } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadLogsTable,
  projectsTable,
  projectFilesTable,
  processedDocsTable,
  dropdownOptionsTable,
  usersTable,
  parsedQuotationsTable,
  parsedSectionsTable,
  parsedSectionDrawingsTable,
  parsedAssemblyListsTable,
  parsedCutOptimisationsTable,
  systemSettings,
  paymentMilestonesTable,
  PROJECT_FILE_TYPES,
  DEPRECATED_FILE_TYPES,
  MULTI_FILE_TYPES,
} from "@workspace/db";
import { asc } from "drizzle-orm";
import { parseQuotationDocx } from "../lib/parsers/quotation-parser.js";
import { parseSectionDocx } from "../lib/parsers/section-parser.js";
import { parseAssemblyListDocx } from "../lib/parsers/assembly-list-parser.js";
import { parseCutOptimisationDocx } from "../lib/parsers/cut-optimisation-parser.js";
import { namesMatch } from "../lib/parsers/name-match.js";

// TODO v2.5.x: when Phase 2 payments endpoint is added, payment proof uploads
// must save to fileType='qoyod' with optional metadata { milestoneId, purpose }.
// The dedicated qoyod_deposit/qoyod_payment slots were replaced by a single
// multi-file 'qoyod' slot in v2.5.0.
import { requireRole } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { parseAndInjectQR } from "./qr.js";
import { extractOrgadataMetadata } from "../lib/orgadata.js";
import { findFuzzyMatches } from "../lib/fuzzy-match.js";

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

// multer for PDF/any file uploads (payment proofs)
const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Role sets ────────────────────────────────────────────────────────────────
const NO_SALES_NO_ACCT = ["Admin", "FactoryManager", "Employee"];
const ADMIN_FM = ["Admin", "FactoryManager"];
const ADMIN_ONLY = ["Admin"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractProjectNameFromDocx(buffer: Buffer): string | null {
  try {
    const zip = new AdmZip(buffer);
    const xml = zip.readAsText("word/document.xml");
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const segments: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      if (m[1].trim()) segments.push(m[1]);
    }
    for (let i = 0; i < segments.length; i++) {
      const t = segments[i];
      if ((t === "Project name:" || t === "Project Name:") && segments[i + 2]) {
        return segments[i + 2].trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

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
      uploadedByName: usersTable.username,
    }).from(projectFilesTable)
      .leftJoin(usersTable, eq(projectFilesTable.uploadedBy, usersTable.id))
      .where(eq(projectFilesTable.projectId, id));
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
// For glass_order: runs QR pipeline → saved to processed_docs with project_id
// For all other types: saved to project_files as before
router.post("/erp/projects/:id/files", requireRole(...NO_SALES_NO_ACCT), upload.single("file"), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const fileType = String(req.body?.fileType ?? "");
    if (!req.file || !fileType) {
      res.status(400).json({ error: "file and fileType are required" });
      return;
    }
    const sess = session(req);

    // ── v2.5.0: fileType validation ──────────────────────────────────────────
    if ((DEPRECATED_FILE_TYPES as readonly string[]).includes(fileType)) {
      res.status(400).json({ error: "This file type has been deprecated in v2.5.0. Valid types: glass_order, price_quotation, section, assembly_list, cut_optimisation, qoyod." });
      return;
    }
    if (fileType !== "glass_order" && !(PROJECT_FILE_TYPES as readonly string[]).includes(fileType)) {
      res.status(400).json({ error: "Invalid fileType" });
      return;
    }

    // ── Glass order: QR pipeline → processed_docs ──────────────────────────
    if (fileType === "glass_order") {
      const confirm = req.query.confirm === "true";
      const updateName = req.query.updateName === "true";

      const orgadataName = extractProjectNameFromDocx(req.file.buffer);

      if (!confirm) {
        const [project] = await db
          .select({ name: projectsTable.name })
          .from(projectsTable)
          .where(eq(projectsTable.id, projectId));
        if (!project) return notFound(res);

        if (
          orgadataName &&
          orgadataName.toLowerCase().trim() !== project.name.toLowerCase().trim()
        ) {
          res.status(409).json({
            conflict: true,
            orgadataName,
            systemName: project.name,
            message: "Project name in file differs from system name",
          });
          return;
        }
      }

      if (confirm && updateName && orgadataName) {
        await db
          .update(projectsTable)
          .set({ name: orgadataName })
          .where(eq(projectsTable.id, projectId));
      }

      let result: Awaited<ReturnType<typeof parseAndInjectQR>>;
      try {
        result = await parseAndInjectQR(req.file.buffer);
      } catch (err: any) {
        if (err?.message === "NO_POSITIONS") {
          res.status(400).json({
            error: "ParseError",
            message: "No positions found. Upload a valid Orgadata glass order (.docx).",
          });
          return;
        }
        throw err;
      }

      const originalName = req.file.originalname.replace(/\.docx$/i, "");
      const reportFilename = `${originalName}_QR_Report.html`;

      const [saved] = await db
        .insert(processedDocsTable)
        .values({
          originalFilename: req.file.originalname,
          reportFilename,
          projectName: result.projectName || null,
          processingDate: result.date || null,
          positionCount: result.positions.length,
          originalFile: req.file.buffer,
          reportFile: result.outputBuffer,
          projectId,
        })
        .returning({ id: processedDocsTable.id });

      res.status(201).json({
        fileId: saved.id,
        projectName: result.projectName,
        totalPositions: result.positions.length,
        positions: result.positions,
      });
      return;
    }

    // ── All other file types → project_files ────────────────────────────────
    // Multi-file types (e.g. qoyod) accumulate; single-file types replace on re-upload
    if (!(MULTI_FILE_TYPES as readonly string[]).includes(fileType)) {
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

    const newFileId = row.id;
    const fileBuffer = req.file.buffer;

    // ── Post-save parsers (failure does NOT roll back the file upload) ────────
    if (fileType === 'price_quotation') {
      try {
        const parsed = parseQuotationDocx(fileBuffer);

        // 409 Conflict: project name in file vs system name
        const [project] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, projectId));
        if (parsed.projectName && project?.name && !namesMatch(parsed.projectName, project.name)) {
          const confirmed = req.query.confirmNameMismatch === 'true';
          if (!confirmed) {
            await db.delete(projectFilesTable).where(eq(projectFilesTable.id, newFileId));
            res.status(409).json({
              error: 'PROJECT_NAME_MISMATCH',
              message: 'Project name in file does not match project in system',
              nameInFile: parsed.projectName,
              nameInSystem: project.name,
              hint: 'Re-submit with ?confirmNameMismatch=true to proceed, or cancel the upload',
            });
            return;
          }
          if (req.query.updateProjectName === 'true') {
            await db.update(projectsTable).set({ name: parsed.projectName }).where(eq(projectsTable.id, projectId));
          }
        }

        await db.delete(parsedQuotationsTable).where(eq(parsedQuotationsTable.projectId, projectId));
        await db.insert(parsedQuotationsTable).values({
          projectId,
          sourceFileId: newFileId,
          projectNameInFile: parsed.projectName,
          quotationNumber: parsed.quotationNumber,
          quotationDate: parsed.quotationDate,
          positions: parsed.positions,
          subtotalNet: parsed.subtotalNet,
          taxRate: parsed.taxRate,
          taxAmount: parsed.taxAmount,
          grandTotal: parsed.grandTotal,
          rawPositionCount: parsed.rawPositionCount,
          dedupedPositionCount: parsed.dedupedPositionCount,
        });
      } catch (err) {
        logger.warn({ err }, '[v2.5.1] Quotation parser failed — file saved but not parsed');
      }
    }

    if (fileType === 'section') {
      try {
        const parsed = parseSectionDocx(fileBuffer);

        const [project] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, projectId));
        const nameMatchesSection = parsed.projectName && project?.name
          ? namesMatch(parsed.projectName, project.name)
          : true;
        if (!nameMatchesSection) {
          logger.warn(`[v2.5.1] Section file project name mismatch: "${parsed.projectName}" vs "${project?.name}" — stored anyway`);
        }

        await db.delete(parsedSectionsTable).where(eq(parsedSectionsTable.projectId, projectId));

        const [sectionRow] = await db.insert(parsedSectionsTable).values({
          projectId,
          sourceFileId: newFileId,
          projectNameInFile: parsed.projectName,
          system: parsed.system,
          drawingCount: parsed.drawings.length,
        }).returning();

        const CHUNK = 50;
        for (let i = 0; i < parsed.drawings.length; i += CHUNK) {
          const chunk = parsed.drawings.slice(i, i + CHUNK).map(d => ({
            parsedSectionId: sectionRow.id,
            orderIndex: d.orderIndex,
            positionCode: d.positionCode,
            mediaFilename: d.mediaFilename,
            mimeType: d.mimeType,
            imageData: d.imageData,
          }));
          await db.insert(parsedSectionDrawingsTable).values(chunk);
        }
      } catch (err) {
        logger.warn({ err }, '[v2.5.1] Section parser failed — file saved but not parsed');
      }
    }

    if (fileType === 'assembly_list') {
      try {
        const parsed = parseAssemblyListDocx(fileBuffer);
        await db.delete(parsedAssemblyListsTable).where(eq(parsedAssemblyListsTable.projectId, projectId));
        await db.insert(parsedAssemblyListsTable).values({
          projectId,
          sourceFileId: newFileId,
          projectNameInFile: parsed.projectName,
          positionCount: parsed.positionCount,
          positions: parsed.positions,
        });
      } catch (err) {
        logger.warn({ err }, '[v2.5.3] Assembly list parser failed — file saved but not parsed');
      }
    }

    if (fileType === 'cut_optimisation') {
      try {
        const parsed = parseCutOptimisationDocx(fileBuffer);
        await db.delete(parsedCutOptimisationsTable).where(eq(parsedCutOptimisationsTable.projectId, projectId));
        await db.insert(parsedCutOptimisationsTable).values({
          projectId,
          sourceFileId: newFileId,
          projectNameInFile: parsed.projectName,
          profileCount: parsed.profileCount,
          profiles: parsed.profiles,
        });
      } catch (err) {
        logger.warn({ err }, '[v2.5.3] Cut optimisation parser failed — file saved but not parsed');
      }
    }

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
// Admin, FactoryManager, Accountant, or the user who uploaded it
router.delete("/erp/projects/:id/files/:fileId", requireRole("Admin", "FactoryManager"), async (req: Request, res: Response) => {
  try {
    const fileId = Number(req.params.fileId);
    const sess = session(req);
    const [file] = await db.select({ uploadedBy: projectFilesTable.uploadedBy }).from(projectFilesTable).where(eq(projectFilesTable.id, fileId));
    if (!file) return notFound(res);
    const allowed = ['Admin', 'FactoryManager', 'Accountant'].includes(sess.role) || file.uploadedBy === sess.userId;
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(projectFilesTable).where(eq(projectFilesTable.id, fileId));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "DELETE /erp/projects/:id/files/:fileId failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/qr-orders — list QR-processed glass orders linked to a project
router.get("/erp/projects/:id/qr-orders", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const rows = await db
      .select({
        id: processedDocsTable.id,
        originalFilename: processedDocsTable.originalFilename,
        projectName: processedDocsTable.projectName,
        processingDate: processedDocsTable.processingDate,
        positionCount: processedDocsTable.positionCount,
        createdAt: processedDocsTable.createdAt,
      })
      .from(processedDocsTable)
      .where(eq(processedDocsTable.projectId, id))
      .orderBy(desc(processedDocsTable.createdAt));
    res.json(rows.map(r => ({ ...r, reportFileId: r.id })));
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/qr-orders failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/files/detect-project — analyze DOCX and return suggested projects (no save)
router.post(
  '/erp/files/detect-project',
  requireRole(...NO_SALES_NO_ACCT),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const metadata = extractOrgadataMetadata(req.file.buffer);

      if (!metadata.projectName) {
        res.status(200).json({
          orgadataName: null,
          orgadataPerson: null,
          matches: [],
          warning: 'Could not extract project name from file',
        });
        return;
      }

      const allProjects = await db
        .select({
          id: projectsTable.id,
          name: projectsTable.name,
          customerName: projectsTable.customerName,
        })
        .from(projectsTable);

      const matches = findFuzzyMatches(metadata.projectName, allProjects);

      res.status(200).json({
        orgadataName: metadata.projectName,
        orgadataPerson: metadata.personInCharge,
        matches,
      });
    } catch (err) {
      logger.error(err, 'detect-project failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /erp/files/create-project-from-file — create new project with Orgadata name + user-provided fields
router.post(
  '/erp/files/create-project-from-file',
  requireRole(...NO_SALES_NO_ACCT),
  async (req: Request, res: Response) => {
    try {
      const {
        name,
        customerName,
        phone,
        buildingType,
        productInterest,
        personInCharge,
      } = req.body;

      if (!name || name.trim().length < 2) {
        res.status(400).json({ error: 'Project name is required (min 2 chars)' });
        return;
      }
      if (!customerName || customerName.trim().length < 2) {
        res.status(400).json({ error: 'Customer name is required (min 2 chars)' });
        return;
      }
      if (!buildingType) {
        res.status(400).json({ error: 'Building type is required' });
        return;
      }
      if (!productInterest) {
        res.status(400).json({ error: 'Product interest is required' });
        return;
      }
      if (phone && !/^05\d{8}$/.test(phone)) {
        res.status(400).json({ error: 'Phone must be Saudi format: 05XXXXXXXX' });
        return;
      }

      const sess = session(req);

      const [newProject] = await db
        .insert(projectsTable)
        .values({
          name: name.trim(),
          customerName: customerName.trim(),
          phone: phone || null,
          buildingType,
          productInterest,
          stageDisplay: 'new',
          stageInternal: 2,
          notes: personInCharge
            ? `Auto-created from Orgadata file. Person in charge: ${personInCharge}`
            : 'Auto-created from Orgadata file',
          createdBy: sess.userId,
        })
        .returning();

      res.status(201).json(newProject);
    } catch (err) {
      logger.error(err, 'create-project-from-file failed');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /erp/projects/:id/parsed-quotation — returns latest parsed quotation for the project
router.get("/erp/projects/:id/parsed-quotation", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [row] = await db.select().from(parsedQuotationsTable).where(eq(parsedQuotationsTable.projectId, projectId));
    if (!row) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/parsed-quotation failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/parsed-section — returns parsed section metadata + drawing list (no blobs)
router.get("/erp/projects/:id/parsed-section", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [row] = await db.select().from(parsedSectionsTable).where(eq(parsedSectionsTable.projectId, projectId));
    if (!row) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    const drawings = await db.select({
      id: parsedSectionDrawingsTable.id,
      orderIndex: parsedSectionDrawingsTable.orderIndex,
      positionCode: parsedSectionDrawingsTable.positionCode,
      mediaFilename: parsedSectionDrawingsTable.mediaFilename,
      mimeType: parsedSectionDrawingsTable.mimeType,
    }).from(parsedSectionDrawingsTable)
      .where(eq(parsedSectionDrawingsTable.parsedSectionId, row.id))
      .orderBy(asc(parsedSectionDrawingsTable.orderIndex));
    res.json({ ...row, drawings });
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/parsed-section failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/drawings/:id — streams a single section drawing image
router.get("/erp/drawings/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [row] = await db.select().from(parsedSectionDrawingsTable).where(eq(parsedSectionDrawingsTable.id, id));
    if (!row) return notFound(res);
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(row.imageData);
  } catch (err) {
    logger.error({ err }, "GET /erp/drawings/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── SETTINGS — CONTRACT TEMPLATE ────────────────────────────────────────────

const CONTRACT_TEMPLATE_KEYS = [
  'contract_cover_intro_ar',
  'contract_cover_intro_en',
  'contract_terms_ar',
  'contract_terms_en',
  'contract_signature_block_ar',
  'contract_signature_block_en',
] as const;

// GET /erp/settings/contract-template — Admin only
router.get('/erp/settings/contract-template', requireRole(...ADMIN_ONLY), async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(systemSettings)
      .where(inArray(systemSettings.key, [...CONTRACT_TEMPLATE_KEYS]));
    const obj = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(obj);
  } catch (err) {
    logger.error({ err }, 'GET /erp/settings/contract-template failed');
    res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /erp/settings/contract-template — Admin only
router.put('/erp/settings/contract-template', requireRole(...ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, unknown>;
    for (const key of Object.keys(updates)) {
      if (!(CONTRACT_TEMPLATE_KEYS as readonly string[]).includes(key)) continue;
      const val = updates[key];
      if (typeof val !== 'string') continue;
      if (val.length > 10000) { res.status(400).json({ error: 'Value too long (max 10000 chars)' }); return; }
      await db.insert(systemSettings)
        .values({ key, value: val })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: val, updatedAt: new Date() } });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'PUT /erp/settings/contract-template failed');
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─── CONTRACT ─────────────────────────────────────────────────────────────────

// GET /erp/projects/:id/contract — returns all data needed to render contract page
router.get('/erp/projects/:id/contract', requireRole('Admin', 'FactoryManager', 'SalesAgent'), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return notFound(res);

    const [quotation] = await db.select().from(parsedQuotationsTable)
      .where(eq(parsedQuotationsTable.projectId, projectId));

    const [section] = await db.select({
      id: parsedSectionsTable.id,
      projectId: parsedSectionsTable.projectId,
      sourceFileId: parsedSectionsTable.sourceFileId,
      projectNameInFile: parsedSectionsTable.projectNameInFile,
      system: parsedSectionsTable.system,
      drawingCount: parsedSectionsTable.drawingCount,
      createdAt: parsedSectionsTable.createdAt,
    }).from(parsedSectionsTable).where(eq(parsedSectionsTable.projectId, projectId));

    let drawings: Array<{ id: number; orderIndex: number; positionCode: string | null; mimeType: string }> = [];
    if (section) {
      drawings = await db.select({
        id: parsedSectionDrawingsTable.id,
        orderIndex: parsedSectionDrawingsTable.orderIndex,
        positionCode: parsedSectionDrawingsTable.positionCode,
        mimeType: parsedSectionDrawingsTable.mimeType,
      }).from(parsedSectionDrawingsTable)
        .where(eq(parsedSectionDrawingsTable.parsedSectionId, section.id))
        .orderBy(asc(parsedSectionDrawingsTable.orderIndex));
    }

    const templateRows = await db.select().from(systemSettings)
      .where(inArray(systemSettings.key, [...CONTRACT_TEMPLATE_KEYS]));
    const template = Object.fromEntries(templateRows.map(r => [r.key, r.value]));

    res.json({ project, quotation: quotation ?? null, section: section ?? null, drawings, template });
  } catch (err) {
    logger.error({ err }, 'GET /erp/projects/:id/contract failed');
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /erp/projects/:id/contract/override-log — logs when user overrides integrity errors
router.post('/erp/projects/:id/contract/override-log', requireRole('Admin', 'FactoryManager', 'SalesAgent'), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const { issueCodes } = req.body as { issueCodes?: string[] };
    const sess = session(req);
    logger.warn(`[v2.5.2] Contract print override — project ${projectId}, user ${sess.userId}, issues: ${(issueCodes || []).join(',')}`);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'POST /erp/projects/:id/contract/override-log failed');
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /erp/projects/:id/contract/mark-printed — advances stageInternal to 4 when contract is printed
router.post('/erp/projects/:id/contract/mark-printed', requireRole('Admin', 'FactoryManager', 'SalesAgent'), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [proj] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj) return notFound(res);
    if ((proj.stageInternal ?? 0) < 4) {
      await db.update(projectsTable)
        .set({ stageInternal: 4, stageDisplay: 'in_study' })
        .where(eq(projectsTable.id, projectId));
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'POST /erp/projects/:id/contract/mark-printed failed');
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /erp/projects/:id/parsed-assembly-list
router.get("/erp/projects/:id/parsed-assembly-list", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [row] = await db.select().from(parsedAssemblyListsTable).where(eq(parsedAssemblyListsTable.projectId, projectId));
    if (!row) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/parsed-assembly-list failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/parsed-cut-optimisation
router.get("/erp/projects/:id/parsed-cut-optimisation", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [row] = await db.select().from(parsedCutOptimisationsTable).where(eq(parsedCutOptimisationsTable.projectId, projectId));
    if (!row) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/parsed-cut-optimisation failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── PAYMENT MILESTONES ───────────────────────────────────────────────────────

// GET /erp/projects/:id/payments — list milestones, auto-mark overdue
router.get("/erp/projects/:id/payments", requireRole("Admin", "FactoryManager", "Employee", "Accountant"), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    // Auto-mark overdue
    await db.execute(sql`
      UPDATE payment_milestones
      SET status = 'overdue'
      WHERE project_id = ${projectId}
        AND due_date < CURRENT_DATE
        AND status = 'pending'
    `);
    const rows = await db.select().from(paymentMilestonesTable)
      .where(eq(paymentMilestonesTable.projectId, projectId))
      .orderBy(asc(paymentMilestonesTable.id));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/payments failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/payments — create milestone
router.post("/erp/projects/:id/payments", requireRole("Admin", "FactoryManager", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [proj] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj) return notFound(res);
    const { label, percentage, amount, dueDate, notes } = req.body as {
      label?: string; percentage?: number; amount?: number; dueDate?: string; notes?: string;
    };
    if (!label || label.trim().length < 1) {
      res.status(400).json({ error: "label is required" });
      return;
    }
    const [row] = await db.insert(paymentMilestonesTable).values({
      projectId,
      label: label.trim(),
      percentage: percentage ? Number(percentage) : null,
      amount: amount ? Number(amount) : null,
      dueDate: dueDate || null,
      notes: notes || null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/payments failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/payments/:id — mark paid, optional PDF upload
router.patch("/erp/payments/:id", requireRole("Admin", "Accountant"), uploadAny.single("file"), async (req: Request, res: Response) => {
  try {
    const milestoneId = Number(req.params.id);
    if (Number.isNaN(milestoneId)) return notFound(res);
    const [milestone] = await db.select().from(paymentMilestonesTable).where(eq(paymentMilestonesTable.id, milestoneId));
    if (!milestone) return notFound(res);

    const paidAmountRaw = req.body?.paidAmount;
    const paidAmount = paidAmountRaw !== undefined && paidAmountRaw !== '' ? Number(paidAmountRaw) : null;
    if (paidAmount !== null && (Number.isNaN(paidAmount) || paidAmount < 0)) {
      res.status(400).json({ error: "paidAmount must be a non-negative number" });
      return;
    }
    const notes = req.body?.notes ?? milestone.notes;
    const sess = session(req);

    let qoyodDocFileId = milestone.qoyodDocFileId;
    if (req.file) {
      const [insertedFile] = await db.insert(projectFilesTable).values({
        projectId: milestone.projectId,
        fileType: "qoyod",
        originalFilename: req.file.originalname,
        fileData: req.file.buffer,
        uploadedBy: sess.userId,
      }).returning({ id: projectFilesTable.id });
      qoyodDocFileId = insertedFile.id;
    }

    const [updated] = await db.update(paymentMilestonesTable)
      .set({
        status: "paid",
        paidAt: new Date(),
        paidAmount: paidAmount,
        qoyodDocFileId,
        notes: notes || null,
      })
      .where(eq(paymentMilestonesTable.id, milestoneId))
      .returning();

    // Stage advancement: if project stageInternal < 5 and this is the first paid milestone
    const paidMilestones = await db.select({ id: paymentMilestonesTable.id })
      .from(paymentMilestonesTable)
      .where(and(eq(paymentMilestonesTable.projectId, milestone.projectId), eq(paymentMilestonesTable.status, "paid")));
    if (paidMilestones.length === 1) {
      const [proj] = await db.select({ stageInternal: projectsTable.stageInternal }).from(projectsTable).where(eq(projectsTable.id, milestone.projectId));
      if (proj && (proj.stageInternal ?? 0) < 5) {
        await db.update(projectsTable)
          .set({ stageInternal: 5, stageDisplay: "in_production" })
          .where(eq(projectsTable.id, milestone.projectId));
      }
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/payments/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/payments/overdue-count — total overdue milestones across all projects
router.get("/erp/payments/overdue-count", requireRole("Admin", "Accountant"), async (req: Request, res: Response) => {
  try {
    // Auto-mark overdue globally
    await db.execute(sql`
      UPDATE payment_milestones
      SET status = 'overdue'
      WHERE due_date < CURRENT_DATE
        AND status = 'pending'
    `);
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM payment_milestones WHERE status = 'overdue'
    `);
    const count = Number((result.rows[0] as any)?.count ?? 0);
    res.json({ count });
  } catch (err) {
    logger.error({ err }, "GET /erp/payments/overdue-count failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/payments/all — all milestones across all projects (with project name)
router.get("/erp/payments/all", requireRole("Admin", "Accountant"), async (req: Request, res: Response) => {
  try {
    // Auto-mark overdue
    await db.execute(sql`
      UPDATE payment_milestones
      SET status = 'overdue'
      WHERE due_date < CURRENT_DATE
        AND status = 'pending'
    `);
    const rows = await db.execute(sql`
      SELECT
        pm.*,
        p.name AS project_name,
        p.customer_name
      FROM payment_milestones pm
      JOIN projects p ON p.id = pm.project_id
      ORDER BY
        CASE WHEN pm.status = 'overdue' THEN 0 ELSE 1 END,
        pm.due_date ASC NULLS LAST,
        pm.id ASC
    `);
    res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/payments/all failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
