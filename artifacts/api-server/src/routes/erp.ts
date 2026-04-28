import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { eq, and, lt, sql, ne, isNull, or, desc, inArray, ilike } from "drizzle-orm";
import {
  db,
  customersTable,
  leadsTable,
  leadLogsTable,
  projectsTable,
  projectFilesTable,
  projectPhasesTable,
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
  vendorsTable,
  purchaseOrdersTable,
  poItemsTable,
  manufacturingOrdersTable,
  PROJECT_FILE_TYPES,
  DEPRECATED_FILE_TYPES,
  MULTI_FILE_TYPES,
  UI_SLOT_ORDER,
} from "@workspace/db";
import { detectFileType, KNOWN_FILE_TYPES } from "../lib/file-detector.js";
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
import { normalizePhoneToE164 } from "../lib/phone.js";

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

// Multi-file upload: accepts field "files" (up to 20) for the detect and batch-upload endpoints
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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
const CUSTOMER_ROLES = ["Admin", "FactoryManager", "Employee", "SalesAgent"];

// File types that must be .docx (Orgadata outputs) — any other extension is rejected
const ORGADATA_FILE_TYPES = new Set([
  'glass_order', 'quotation', 'section', 'assembly_list', 'cut_optimisation', 'material_analysis',
]);

function requiresDocx(fileType: string): boolean {
  return ORGADATA_FILE_TYPES.has(fileType);
}

function isDocx(filename: string): boolean {
  return filename.toLowerCase().endsWith('.docx');
}

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

function isCustomerStatus(value: string): boolean {
  return ["active", "inactive", "archived"].includes(value);
}

function isUniqueConstraintError(err: unknown, constraintName: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const constraint = (err as { constraint?: string }).constraint;
  return code === "23505" && constraint === constraintName;
}

async function findCustomerByPhone(phone: string, excludeId?: number, runner: typeof db | DbTx = db) {
  const conditions = [eq(customersTable.phone, phone)];
  if (excludeId !== undefined) conditions.push(ne(customersTable.id, excludeId));
  const [row] = await runner
    .select({ id: customersTable.id, name: customersTable.name, phone: customersTable.phone })
    .from(customersTable)
    .where(and(...conditions));
  return row;
}

const leadSelectFields = {
  id: leadsTable.id,
  customerId: leadsTable.customerId,
  customerName: sql<string>`COALESCE(${customersTable.name}, ${leadsTable.customerName})`,
  phone: sql<string>`COALESCE(${customersTable.phone}, ${leadsTable.phone})`,
  source: leadsTable.source,
  productInterest: leadsTable.productInterest,
  buildingType: leadsTable.buildingType,
  location: leadsTable.location,
  assignedTo: leadsTable.assignedTo,
  budgetRange: leadsTable.budgetRange,
  estimatedValue: leadsTable.estimatedValue,
  firstFollowupDate: leadsTable.firstFollowupDate,
  status: leadsTable.status,
  lostReason: leadsTable.lostReason,
  convertedProjectId: leadsTable.convertedProjectId,
  createdAt: leadsTable.createdAt,
  createdBy: leadsTable.createdBy,
};

const projectSelectFields = {
  id: projectsTable.id,
  name: projectsTable.name,
  customerId: projectsTable.customerId,
  customerName: sql<string>`COALESCE(${customersTable.name}, ${projectsTable.customerName})`,
  phone: sql<string | null>`COALESCE(${customersTable.phone}, ${projectsTable.phone})`,
  location: projectsTable.location,
  buildingType: projectsTable.buildingType,
  productInterest: projectsTable.productInterest,
  estimatedValue: projectsTable.estimatedValue,
  stageDisplay: projectsTable.stageDisplay,
  stageInternal: projectsTable.stageInternal,
  fromLeadId: projectsTable.fromLeadId,
  assignedTo: projectsTable.assignedTo,
  deliveryDeadline: projectsTable.deliveryDeadline,
  warrantyMonths: projectsTable.warrantyMonths,
  warrantyStartDate: projectsTable.warrantyStartDate,
  warrantyEndDate: projectsTable.warrantyEndDate,
  notes: projectsTable.notes,
  code: projectsTable.code,
  createdAt: projectsTable.createdAt,
  createdBy: projectsTable.createdBy,
};

async function getCustomerDependencySummary(customerId: number) {
  const leadResult = await db.execute(sql`
    SELECT id, status
    FROM leads
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC, id DESC
  `);
  // Projects linked directly (customer_id) OR indirectly via from_lead_id.
  // The indirect path catches rows created before Stage 3 set customer_id.
  const projectResult = await db.execute(sql`
    SELECT DISTINCT id, name, code, stage_display
    FROM projects
    WHERE customer_id = ${customerId}
       OR from_lead_id IN (
            SELECT id FROM leads WHERE customer_id = ${customerId}
          )
    ORDER BY id DESC
  `);

  const leads = leadResult.rows.map((row: any) => ({
    id: Number(row.id),
    status: row.status as string,
  }));
  const projects = projectResult.rows.map((row: any) => ({
    id: Number(row.id),
    name: row.name as string,
    code: row.code as string | null,
    stageDisplay: row.stage_display as string,
  }));

  return {
    leadCount: leads.length,
    projectCount: projects.length,
    leads,
    projects,
  };
}

// v3.0: 15-stage display mapping (SYSTEM_DESIGN_v3.md Section 1)
function getDisplayStage(internal: number): string {
  if (internal <= 1) return 'new';
  if (internal <= 4) return 'in_study';
  if (internal <= 8) return 'in_production';
  return 'complete';
}

// v3.0: auto-advance stage when a file is uploaded
async function autoAdvanceStage(projectId: number, fileType: string, currentStage: number) {
  let targetStage: number | null = null;

  if (['section', 'assembly_list', 'cut_optimisation', 'material_analysis'].includes(fileType) && currentStage < 2) {
    targetStage = 2;
  } else if (fileType === 'vendor_order' && currentStage < 3) {
    targetStage = 3;
  } else if ((fileType === 'quotation' || fileType === 'price_quotation') && currentStage < 4) {
    targetStage = 4;
  } else if (fileType === 'glass_order' && currentStage < 3) {
    targetStage = 3;
  }

  if (targetStage !== null) {
    await db.update(projectsTable)
      .set({ stageInternal: targetStage, stageDisplay: getDisplayStage(targetStage) })
      .where(eq(projectsTable.id, projectId));
  }
}

// Helper: run post-save parsers for a file type (used by both single and batch upload)
async function runParsersForFile(fileType: string, buffer: Buffer, fileId: number, projectId: number) {
  if (fileType === 'price_quotation' || fileType === 'quotation') {
    try {
      const parsed = parseQuotationDocx(buffer);
      await db.delete(parsedQuotationsTable).where(eq(parsedQuotationsTable.projectId, projectId));
      await db.insert(parsedQuotationsTable).values({
        projectId, sourceFileId: fileId,
        projectNameInFile: parsed.projectName, quotationNumber: parsed.quotationNumber,
        quotationDate: parsed.quotationDate, positions: parsed.positions,
        subtotalNet: parsed.subtotalNet, taxRate: parsed.taxRate,
        taxAmount: parsed.taxAmount, grandTotal: parsed.grandTotal,
        rawPositionCount: parsed.rawPositionCount, dedupedPositionCount: parsed.dedupedPositionCount,
      });
    } catch (err) { logger.warn({ err }, 'Quotation parser failed'); }
  }
  if (fileType === 'section') {
    try {
      const parsed = parseSectionDocx(buffer);
      await db.delete(parsedSectionsTable).where(eq(parsedSectionsTable.projectId, projectId));
      const [sectionRow] = await db.insert(parsedSectionsTable).values({
        projectId, sourceFileId: fileId, projectNameInFile: parsed.projectName,
        system: parsed.system, drawingCount: parsed.drawings.length,
      }).returning();
      const CHUNK = 50;
      for (let i = 0; i < parsed.drawings.length; i += CHUNK) {
        const chunk = parsed.drawings.slice(i, i + CHUNK).map(d => ({
          parsedSectionId: sectionRow.id, orderIndex: d.orderIndex,
          positionCode: d.positionCode, mediaFilename: d.mediaFilename,
          mimeType: d.mimeType, imageData: d.imageData,
        }));
        await db.insert(parsedSectionDrawingsTable).values(chunk);
      }
    } catch (err) { logger.warn({ err }, 'Section parser failed'); }
  }
  if (fileType === 'assembly_list') {
    try {
      const parsed = parseAssemblyListDocx(buffer);
      await db.delete(parsedAssemblyListsTable).where(eq(parsedAssemblyListsTable.projectId, projectId));
      await db.insert(parsedAssemblyListsTable).values({
        projectId, sourceFileId: fileId, projectNameInFile: parsed.projectName,
        positionCount: parsed.positionCount, positions: parsed.positions,
      });
    } catch (err) { logger.warn({ err }, 'Assembly list parser failed'); }
  }
  if (fileType === 'cut_optimisation') {
    try {
      const parsed = parseCutOptimisationDocx(buffer);
      await db.delete(parsedCutOptimisationsTable).where(eq(parsedCutOptimisationsTable.projectId, projectId));
      await db.insert(parsedCutOptimisationsTable).values({
        projectId, sourceFileId: fileId, projectNameInFile: parsed.projectName,
        profileCount: parsed.profileCount, profiles: parsed.profiles,
      });
    } catch (err) { logger.warn({ err }, 'Cut optimisation parser failed'); }
  }
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
router.get("/erp/customers", requireRole(...CUSTOMER_ROLES), async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const status = req.query.status ? String(req.query.status).trim() : "";
    if (status && !isCustomerStatus(status)) {
      res.status(400).json({ error: "status must be active, inactive, or archived" });
      return;
    }

    const conditions = [];
    if (status) conditions.push(eq(customersTable.status, status));
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(ilike(customersTable.name, pattern), ilike(customersTable.phone, pattern)));
    }

    const rows = conditions.length > 0
      ? await db.select().from(customersTable).where(and(...conditions)).orderBy(asc(customersTable.name))
      : await db.select().from(customersTable).orderBy(asc(customersTable.name));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/customers failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/erp/customers/search", requireRole(...CUSTOMER_ROLES), async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q || q.length < 2) {
      res.json([]);
      return;
    }

    const normalizedPhone = normalizePhoneToE164(q);
    const pattern = `%${q}%`;
    const rows = normalizedPhone
      ? await db
        .select({
          id: customersTable.id,
          name: customersTable.name,
          phone: customersTable.phone,
          status: customersTable.status,
          email: customersTable.email,
          location: customersTable.location,
        })
        .from(customersTable)
        .where(or(eq(customersTable.phone, normalizedPhone), ilike(customersTable.name, pattern), ilike(customersTable.phone, pattern)))
        .orderBy(desc(customersTable.updatedAt))
        .limit(10)
      : await db
        .select({
          id: customersTable.id,
          name: customersTable.name,
          phone: customersTable.phone,
          status: customersTable.status,
          email: customersTable.email,
          location: customersTable.location,
        })
        .from(customersTable)
        .where(or(ilike(customersTable.name, pattern), ilike(customersTable.phone, pattern)))
        .orderBy(desc(customersTable.updatedAt))
        .limit(10);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/customers/search failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/erp/customers/:id", requireRole(...CUSTOMER_ROLES), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [row] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    logger.error({ err }, "GET /erp/customers/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/erp/customers/:id/dependencies", requireRole(...ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);

    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, id));
    if (!customer) return notFound(res);

    const summary = await getCustomerDependencySummary(id);
    res.json({ customerId: id, ...summary });
  } catch (err) {
    logger.error({ err }, "GET /erp/customers/:id/dependencies failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/erp/customers", requireRole(...CUSTOMER_ROLES), async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const status = req.body.status === undefined ? "active" : String(req.body.status).trim();
    const normalizedPhone = normalizePhoneToE164(String(req.body.phone ?? ""));

    if (name.length < 2) {
      res.status(400).json({ error: "name is required (min 2 chars)" });
      return;
    }
    if (!normalizedPhone) {
      res.status(400).json({ error: "phone must be a valid E.164 number" });
      return;
    }
    if (!isCustomerStatus(status)) {
      res.status(400).json({ error: "status must be active, inactive, or archived" });
      return;
    }

    const existing = await findCustomerByPhone(normalizedPhone);
    if (existing) {
      res.status(409).json({ error: "phone_exists", existingCustomerId: existing.id });
      return;
    }

    const sess = session(req);
    const [row] = await db.insert(customersTable).values({
      name,
      phone: normalizedPhone,
      email: req.body.email ? String(req.body.email).trim() : null,
      location: req.body.location ? String(req.body.location).trim() : null,
      notes: req.body.notes ? String(req.body.notes).trim() : null,
      status,
      createdBy: sess.userId,
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    if (isUniqueConstraintError(err, "customers_phone_unique")) {
      res.status(409).json({ error: "phone_exists" });
      return;
    }
    logger.error({ err }, "POST /erp/customers failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/erp/customers/:id", requireRole(...CUSTOMER_ROLES), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);

    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2) {
        res.status(400).json({ error: "name is required (min 2 chars)" });
        return;
      }
      updates.name = name;
    }
    if (req.body.phone !== undefined) {
      const normalizedPhone = normalizePhoneToE164(String(req.body.phone));
      if (!normalizedPhone) {
        res.status(400).json({ error: "phone must be a valid E.164 number" });
        return;
      }
      const existing = await findCustomerByPhone(normalizedPhone, id);
      if (existing) {
        res.status(409).json({ error: "phone_exists", existingCustomerId: existing.id });
        return;
      }
      updates.phone = normalizedPhone;
    }
    if (req.body.email !== undefined) updates.email = req.body.email ? String(req.body.email).trim() : null;
    if (req.body.location !== undefined) updates.location = req.body.location ? String(req.body.location).trim() : null;
    if (req.body.notes !== undefined) updates.notes = req.body.notes ? String(req.body.notes).trim() : null;
    if (req.body.status !== undefined) {
      const status = String(req.body.status).trim();
      if (!isCustomerStatus(status)) {
        res.status(400).json({ error: "status must be active, inactive, or archived" });
        return;
      }
      updates.status = status;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    updates.updatedAt = new Date();
    const [row] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    if (isUniqueConstraintError(err, "customers_phone_unique")) {
      res.status(409).json({ error: "phone_exists" });
      return;
    }
    logger.error({ err }, "PATCH /erp/customers/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/erp/customers/:id", requireRole(...ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);

    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.id, id));
    if (!customer) return notFound(res);

    const summary = await getCustomerDependencySummary(id);
    const confirm = req.query.confirm === "true";
    if (!confirm && (summary.leadCount > 0 || summary.projectCount > 0)) {
      res.status(409).json({ error: "has_dependencies", ...summary });
      return;
    }

    const deletion = await db.transaction(async (tx) => {
      let preservedQrOrderCount = 0;

      for (const project of summary.projects) {
        const qrCountResult = await tx.execute(
          sql`SELECT COUNT(*)::int AS count FROM processed_docs WHERE project_id = ${project.id}`,
        );
        preservedQrOrderCount += Number((qrCountResult.rows[0] as any)?.count ?? 0);

        await tx.execute(sql`UPDATE processed_docs SET project_id = NULL WHERE project_id = ${project.id}`);
        await tx.delete(manufacturingOrdersTable).where(eq(manufacturingOrdersTable.projectId, project.id));

        const pos = await tx
          .select({ id: purchaseOrdersTable.id })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.projectId, project.id));
        if (pos.length > 0) {
          await tx.delete(poItemsTable).where(inArray(poItemsTable.poId, pos.map((po) => po.id)));
        }

        await tx.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.projectId, project.id));
        await tx.delete(paymentMilestonesTable).where(eq(paymentMilestonesTable.projectId, project.id));
        await tx.delete(projectPhasesTable).where(eq(projectPhasesTable.projectId, project.id));
        await tx.delete(projectFilesTable).where(eq(projectFilesTable.projectId, project.id));
        await tx.delete(projectsTable).where(eq(projectsTable.id, project.id));
      }

      if (summary.leads.length > 0) {
        await tx.delete(leadLogsTable).where(inArray(leadLogsTable.leadId, summary.leads.map((lead) => lead.id)));
        await tx.delete(leadsTable).where(inArray(leadsTable.id, summary.leads.map((lead) => lead.id)));
      }

      await tx.delete(customersTable).where(eq(customersTable.id, id));

      return {
        deletedLeadCount: summary.leadCount,
        deletedProjectCount: summary.projectCount,
        preservedQrOrderCount,
      };
    });

    res.json({ ok: true, deletedCustomerId: id, ...deletion });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/customers/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/erp/leads", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const { status, assignedTo, overdue } = req.query;
    const conditions = [];
    if (status) conditions.push(eq(leadsTable.status, status as string));
    if (assignedTo) conditions.push(eq(leadsTable.assignedTo, Number(assignedTo)));
    if (overdue === "true") {
      conditions.push(lt(leadsTable.firstFollowupDate, new Date().toISOString().split("T")[0]));
      conditions.push(eq(leadsTable.status, "followup"));
    }

    const rows = conditions.length > 0
      ? await db.select(leadSelectFields)
        .from(leadsTable)
        .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
        .where(and(...conditions))
        .orderBy(leadsTable.createdAt)
      : await db.select(leadSelectFields)
        .from(leadsTable)
        .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
        .orderBy(leadsTable.createdAt);

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
    const customerId = req.body.customerId ? Number(req.body.customerId) : null;
    if ((req.body.customerId !== undefined && req.body.customerId !== null && req.body.customerId !== "") && Number.isNaN(customerId)) {
      res.status(400).json({ error: "customerId must be a valid number" });
      return;
    }
    if ((!customerId && !customerName) || !source || !productInterest || !buildingType || !firstFollowupDate) {
      res.status(400).json({ error: "customerId or customerName, source, productInterest, buildingType, firstFollowupDate are required" });
      return;
    }
    const sess = session(req);
    const created = await db.transaction(async (tx) => {
      const resolvedCustomer = await resolveCustomerLink(tx, {
        createdBy: sess.userId,
        customerId,
        customerName: customerName ?? null,
        phone: phone ?? null,
        seedLocation: location ?? null,
      });
      if ("error" in resolvedCustomer) return resolvedCustomer;

      const [row] = await tx.insert(leadsTable).values({
        customerId: resolvedCustomer.customerId,
        customerName: resolvedCustomer.customerName,
        phone: resolvedCustomer.phone,
        source,
        productInterest,
        buildingType,
        location: location ?? null,
        assignedTo: assignedTo ? Number(assignedTo) : sess.userId,
        budgetRange: budgetRange ?? null,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        firstFollowupDate,
        createdBy: sess.userId,
      }).returning();
      if (!row) throw new Error("Lead insert failed");
      return row;
    });

    if ("error" in created) {
      if (created.error === "customer_not_found") {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      if (created.error === "phone_exists") {
        res.status(409).json({ error: "phone_exists", existingCustomerId: created.existingCustomerId });
        return;
      }
      if (created.error === "phone_invalid") {
        res.status(400).json({ error: "phone must be a valid E.164 number" });
        return;
      }
      res.status(400).json({ error: "customerName is required" });
      return;
    }

    const [row] = await db.select(leadSelectFields)
      .from(leadsTable)
      .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(eq(leadsTable.id, created.id));
    res.status(201).json(row ?? created);
  } catch (err) {
    logger.error({ err }, "POST /erp/leads failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/leads/search?q=:query — fuzzy customer search (must be before /:id)
router.get("/erp/leads/search", requireRole("Admin", "FactoryManager", "Employee"), async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q || q.length < 3) {
      res.json([]);
      return;
    }
    const normalizedPhone = normalizePhoneToE164(q);
    const pattern = `%${q}%`;
    const rows = await db.execute(
      sql`SELECT
            l.id,
            l.customer_id,
            COALESCE(c.name, l.customer_name) AS customer_name,
            COALESCE(c.phone, l.phone) AS phone,
            l.status,
            l.building_type,
            l.converted_project_id
          FROM leads l
          LEFT JOIN customers c ON c.id = l.customer_id
          WHERE COALESCE(c.name, l.customer_name) ILIKE ${pattern}
             OR COALESCE(c.phone, l.phone) ILIKE ${pattern}
             OR (${normalizedPhone} IS NOT NULL AND COALESCE(c.phone, l.phone) = ${normalizedPhone})
          ORDER BY l.created_at DESC
          LIMIT 5`
    );
    const results = rows.rows.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      phone: r.phone,
      status: r.status,
      buildingType: r.building_type,
      convertedProjectId: r.converted_project_id,
    }));
    res.json(results);
  } catch (err) {
    logger.error({ err }, "GET /erp/leads/search failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/search — global search across leads + projects (min 2 chars)
router.get("/erp/search", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q || q.length < 2) { res.json([]); return; }
    const sess = session(req);
    const pattern = `%${q}%`;
    const results: { type: string; id: number; name: string; subtitle: string; url: string }[] = [];

    // Search leads (not for Accountant)
    if (sess.role !== "Accountant") {
      const normalizedPhone = normalizePhoneToE164(q);
      const leadRows = await db.execute(
        sql`SELECT
              l.id,
              COALESCE(c.name, l.customer_name) AS customer_name,
              COALESCE(c.phone, l.phone) AS phone,
              l.status
            FROM leads l
            LEFT JOIN customers c ON c.id = l.customer_id
            WHERE COALESCE(c.name, l.customer_name) ILIKE ${pattern}
               OR COALESCE(c.phone, l.phone) ILIKE ${pattern}
               OR (${normalizedPhone} IS NOT NULL AND COALESCE(c.phone, l.phone) = ${normalizedPhone})
            ORDER BY l.created_at DESC LIMIT 5`
      );
      for (const r of leadRows.rows as any[]) {
        results.push({ type: "lead", id: r.id, name: r.customer_name, subtitle: r.phone ?? "", url: `/erp/leads/${r.id}` });
      }
    }

    // Search projects (not for SalesAgent or Accountant)
    if (sess.role !== "SalesAgent" && sess.role !== "Accountant") {
      const projRows = await db.execute(
        sql`SELECT
              p.id,
              p.name,
              COALESCE(c.name, p.customer_name) AS customer_name
            FROM projects p
            LEFT JOIN customers c ON c.id = p.customer_id
            WHERE p.name ILIKE ${pattern} OR COALESCE(c.name, p.customer_name) ILIKE ${pattern}
            ORDER BY p.created_at DESC LIMIT 5`
      );
      for (const r of projRows.rows as any[]) {
        results.push({ type: "project", id: r.id, name: r.name, subtitle: r.customer_name ?? "", url: `/erp/projects/${r.id}` });
      }
    }

    res.json(results.slice(0, 8));
  } catch (err) {
    logger.error({ err }, "GET /erp/search failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/leads/:id — detail + logs
router.get("/erp/leads/:id", requireRole("Admin", "FactoryManager", "Employee", "SalesAgent"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [lead] = await db.select(leadSelectFields)
      .from(leadsTable)
      .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(eq(leadsTable.id, id));
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
    const sess = session(req);
    const [existingLead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!existingLead) return notFound(res);

    const leadUpdates: Record<string, unknown> = {};
    const leadFieldMap: Record<string, string> = {
      source: "source",
      productInterest: "productInterest",
      buildingType: "buildingType",
      location: "location",
      assignedTo: "assignedTo",
      budgetRange: "budgetRange",
      estimatedValue: "estimatedValue",
      firstFollowupDate: "firstFollowupDate",
      status: "status",
    };
    for (const [requestKey, columnKey] of Object.entries(leadFieldMap)) {
      if (req.body[requestKey] !== undefined) leadUpdates[columnKey] = req.body[requestKey];
    }
    if (leadUpdates.assignedTo !== undefined) leadUpdates.assignedTo = leadUpdates.assignedTo ? Number(leadUpdates.assignedTo) : null;
    if (leadUpdates.estimatedValue !== undefined) leadUpdates.estimatedValue = leadUpdates.estimatedValue ? Number(leadUpdates.estimatedValue) : null;

    const requestedCustomerId = req.body.customerId ? Number(req.body.customerId) : null;
    if ((req.body.customerId !== undefined && req.body.customerId !== null && req.body.customerId !== "") && Number.isNaN(requestedCustomerId)) {
      res.status(400).json({ error: "customerId must be a valid number" });
      return;
    }

    const hasCustomerUpdate =
      req.body.customerId !== undefined ||
      req.body.customerName !== undefined ||
      req.body.phone !== undefined;

    if (Object.keys(leadUpdates).length === 0 && !hasCustomerUpdate) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const updatedLead = await db.transaction(async (tx) => {
      const finalLeadUpdates = { ...leadUpdates };
      if (hasCustomerUpdate) {
        const resolvedCustomer = await resolveCustomerLink(tx, {
          createdBy: sess.userId,
          customerId: requestedCustomerId,
          customerName: req.body.customerName ?? null,
          phone: req.body.phone ?? null,
          fallbackCustomerId: existingLead.customerId ?? null,
          legacyCustomerName: existingLead.customerName,
          legacyPhone: existingLead.phone,
        });
        if ("error" in resolvedCustomer) return resolvedCustomer;

        finalLeadUpdates.customerId = resolvedCustomer.customerId;
        finalLeadUpdates.customerName = resolvedCustomer.customerName;
        finalLeadUpdates.phone = resolvedCustomer.phone;
      }

      const [row] = await tx.update(leadsTable).set(finalLeadUpdates).where(eq(leadsTable.id, id)).returning();
      return row;
    });

    if ("error" in updatedLead) {
      if (updatedLead.error === "customer_not_found") return res.status(404).json({ error: "Customer not found" });
      if (updatedLead.error === "phone_exists") return res.status(409).json({ error: "phone_exists", existingCustomerId: updatedLead.existingCustomerId });
      if (updatedLead.error === "phone_invalid") return res.status(400).json({ error: "phone must be a valid E.164 number" });
      return res.status(400).json({ error: "customerName is required" });
    }

    const [row] = await db.select(leadSelectFields)
      .from(leadsTable)
      .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(eq(leadsTable.id, id));
    res.json(row ?? updatedLead);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/leads/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/leads/:id — Admin/FactoryManager only (cascades linked projects)
router.delete("/erp/leads/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    // Cascade delete any converted projects linked to this lead
    const linkedProjects = await db.select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.fromLeadId, id));
    for (const proj of linkedProjects) {
      await db.delete(manufacturingOrdersTable).where(eq(manufacturingOrdersTable.projectId, proj.id));
      const pos = await db.select({ id: purchaseOrdersTable.id }).from(purchaseOrdersTable).where(eq(purchaseOrdersTable.projectId, proj.id));
      if (pos.length > 0) await db.delete(poItemsTable).where(inArray(poItemsTable.poId, pos.map(p => p.id)));
      await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.projectId, proj.id));
      await db.delete(paymentMilestonesTable).where(eq(paymentMilestonesTable.projectId, proj.id));
      await db.delete(projectPhasesTable).where(eq(projectPhasesTable.projectId, proj.id));
      await db.delete(projectFilesTable).where(eq(projectFilesTable.projectId, proj.id));
      await db.delete(projectsTable).where(eq(projectsTable.id, proj.id));
    }
    await db.delete(leadLogsTable).where(eq(leadLogsTable.leadId, id));
    await db.delete(leadsTable).where(eq(leadsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/leads/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/leads/:id/linked-projects — returns projects converted from this lead
router.get("/erp/leads/:id/linked-projects", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const projects = await db.select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable)
      .where(eq(projectsTable.fromLeadId, id));
    res.json(projects);
  } catch (err) {
    logger.error({ err }, "GET /erp/leads/:id/linked-projects failed");
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
    const [lead] = await db.select(leadSelectFields)
      .from(leadsTable)
      .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(eq(leadsTable.id, leadId));
    if (!lead) return notFound(res);
    if (lead.status === "converted") {
      res.status(400).json({ error: "Lead is already converted" });
      return;
    }
    const sess = session(req);
    const createdProject = await db.transaction(async (tx) => {
      const resolvedCustomer = await resolveCustomerLink(tx, {
        createdBy: sess.userId,
        customerId: lead.customerId ?? null,
        customerName: lead.customerName,
        phone: lead.phone ?? null,
        seedLocation: lead.location ?? null,
      });
      if ("error" in resolvedCustomer) return resolvedCustomer;

      const [project] = await tx.insert(projectsTable).values({
        name: lead.customerName,
        customerId: resolvedCustomer.customerId,
        customerName: resolvedCustomer.customerName,
        phone: resolvedCustomer.phone,
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
      await tx.update(leadsTable)
        .set({ status: "converted", convertedProjectId: project.id })
        .where(eq(leadsTable.id, leadId));
      return project;
    });

    if ("error" in createdProject) {
      if (createdProject.error === "customer_not_found") {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      if (createdProject.error === "phone_exists") {
        res.status(409).json({ error: "phone_exists", existingCustomerId: createdProject.existingCustomerId });
        return;
      }
      if (createdProject.error === "phone_invalid") {
        res.status(400).json({ error: "phone must be a valid E.164 number" });
        return;
      }
      res.status(400).json({ error: "customerName is required" });
      return;
    }

    res.status(201).json({ projectId: createdProject.id, project: createdProject });
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

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CustomerLinkPayload = {
  createdBy: number;
  customerId?: number | null;
  customerName?: string | null;
  phone?: string | null;
  seedLocation?: string | null;
  fallbackCustomerId?: number | null;
  legacyCustomerName?: string | null;
  legacyPhone?: string | null;
};

type CustomerLinkResult =
  | { customerId: number; customerName: string; phone: string }
  | { error: "customer_not_found" | "customer_name_required" | "phone_invalid" | "phone_exists"; existingCustomerId?: number };

async function resolveCustomerLink(tx: DbTx, payload: CustomerLinkPayload): Promise<CustomerLinkResult> {
  const requestedCustomerId = payload.customerId ?? null;
  if (requestedCustomerId !== null) {
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, requestedCustomerId));
    if (!customer) return { error: "customer_not_found" };
    return { customerId: customer.id, customerName: customer.name, phone: customer.phone };
  }

  const finalName = payload.customerName?.trim() || payload.legacyCustomerName?.trim() || "";
  if (!finalName) return { error: "customer_name_required" };

  const candidatePhone = payload.phone ?? payload.legacyPhone ?? null;
  const normalizedPhone = candidatePhone ? normalizePhoneToE164(String(candidatePhone)) : null;
  if (!normalizedPhone) return { error: "phone_invalid" };

  if (payload.fallbackCustomerId) {
    const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, payload.fallbackCustomerId));
    if (!customer) return { error: "customer_not_found" };

    const duplicate = await findCustomerByPhone(normalizedPhone, customer.id, tx);
    if (duplicate) return { error: "phone_exists", existingCustomerId: duplicate.id };

    const [updated] = await tx.update(customersTable).set({
      name: finalName,
      phone: normalizedPhone,
      updatedAt: new Date(),
    }).where(eq(customersTable.id, customer.id)).returning();

    return { customerId: updated.id, customerName: updated.name, phone: updated.phone };
  }

  const existing = await findCustomerByPhone(normalizedPhone, undefined, tx);
  if (existing) {
    return { customerId: existing.id, customerName: existing.name, phone: existing.phone };
  }

  const [created] = await tx.insert(customersTable).values({
    name: finalName,
    phone: normalizedPhone,
    location: payload.seedLocation?.trim() || null,
    status: "active",
    createdBy: payload.createdBy,
  }).returning();

  return { customerId: created.id, customerName: created.name, phone: created.phone };
}

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export async function generateAndSetProjectCode(newProjectId: number, tx: DbTx): Promise<string> {
  const projResult = await tx.execute(sql`SELECT building_type FROM projects WHERE id = ${newProjectId}`);
  const buildingType = (projResult.rows[0] as any)?.building_type as string | null;
  const typePrefix = buildingType && buildingType.length >= 1
    ? buildingType.slice(0, 2).toUpperCase().padEnd(2, 'X')
    : 'XX';

  // Fixed advisory lock key serializes code generation across concurrent inserts.
  // Lock is held until the outer transaction commits.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(20260101)`);

  let code = '';
  for (;;) {
    const random5 = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    code = `WT-${typePrefix}-${random5}`;
    const exists = await tx.execute(sql`SELECT 1 FROM projects WHERE code = ${code} AND id != ${newProjectId}`);
    if (exists.rows.length === 0) break;
  }

  await tx.execute(sql`UPDATE projects SET code = ${code} WHERE id = ${newProjectId}`);
  return code;
}

// GET /erp/projects — list (no SalesAgent, no Accountant)
router.get("/erp/projects", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const { stageDisplay } = req.query;
    const rows = stageDisplay
      ? await db.select(projectSelectFields)
        .from(projectsTable)
        .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
        .where(eq(projectsTable.stageDisplay, stageDisplay as string))
        .orderBy(projectsTable.createdAt)
      : await db.select(projectSelectFields)
        .from(projectsTable)
        .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
        .orderBy(projectsTable.createdAt);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/stage-distribution — count projects grouped by stageInternal (1-15)
router.get("/erp/projects/stage-distribution", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ stage: projectsTable.stageInternal, count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .groupBy(projectsTable.stageInternal);
    const dist: Record<number, number> = {};
    for (let i = 1; i <= 15; i++) dist[i] = 0;
    for (const r of rows) {
      if (r.stage && r.stage >= 1 && r.stage <= 15) dist[r.stage] = r.count;
    }
    res.json(dist);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/stage-distribution failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects — create directly or linked to existing lead via fromLeadId
router.post("/erp/projects", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const { name, phone, location, buildingType, productInterest, estimatedValue, assignedTo, fromLeadId } = req.body;
    let { customerName } = req.body;
    const customerId = req.body.customerId ? Number(req.body.customerId) : null;
    if ((req.body.customerId !== undefined && req.body.customerId !== null && req.body.customerId !== "") && Number.isNaN(customerId)) {
      res.status(400).json({ error: "customerId must be a valid number" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const sess = session(req);

    let resolvedFromLeadId: number | null = fromLeadId ? Number(fromLeadId) : null;
    let resolvedPhone: string | null = phone ?? null;
    let resolvedLocation: string | null = location ?? null;
    let resolvedBuildingType: string | null = buildingType ?? null;
    let resolvedProductInterest: string | null = productInterest ?? null;
    let resolvedEstimatedValue: number | null = estimatedValue ? Number(estimatedValue) : null;
    let leadCustomerId: number | null = null;
    let leadCustomerName: string | null = null;
    let leadPhone: string | null = null;

    if (resolvedFromLeadId) {
      const [lead] = await db.select(leadSelectFields)
        .from(leadsTable)
        .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
        .where(eq(leadsTable.id, resolvedFromLeadId));
      if (!lead) {
        res.status(404).json({ error: "Lead not found" });
        return;
      }
      leadCustomerId = lead.customerId ?? null;
      leadCustomerName = lead.customerName;
      leadPhone = lead.phone ?? null;
      if (!customerName) customerName = lead.customerName;
      if (!resolvedPhone) resolvedPhone = lead.phone ?? null;
      if (!resolvedLocation) resolvedLocation = lead.location;
      if (!resolvedBuildingType) resolvedBuildingType = lead.buildingType;
      if (!resolvedProductInterest) resolvedProductInterest = lead.productInterest;
      if (resolvedEstimatedValue === null) resolvedEstimatedValue = lead.estimatedValue;
    }

    if (!customerId && !customerName) {
      res.status(400).json({ error: "customerId or customerName is required" });
      return;
    }

    const createdProject = await db.transaction(async (tx) => {
      const resolvedCustomer = await resolveCustomerLink(tx, {
        createdBy: sess.userId,
        customerId: customerId ?? leadCustomerId,
        customerName: customerName ?? leadCustomerName,
        phone: resolvedPhone,
        seedLocation: resolvedLocation,
        legacyCustomerName: leadCustomerName,
        legacyPhone: leadPhone,
      });
      if ("error" in resolvedCustomer) return resolvedCustomer;

      const [row] = await tx.insert(projectsTable).values({
        name,
        customerId: resolvedCustomer.customerId,
        customerName: resolvedCustomer.customerName,
        phone: resolvedCustomer.phone,
        location: resolvedLocation,
        buildingType: resolvedBuildingType,
        productInterest: resolvedProductInterest,
        estimatedValue: resolvedEstimatedValue,
        assignedTo: assignedTo ? Number(assignedTo) : sess.userId,
        stageDisplay: "new",
        stageInternal: 1,
        fromLeadId: resolvedFromLeadId,
        createdBy: sess.userId,
      }).returning();

      if (resolvedFromLeadId) {
        await tx.update(leadsTable)
          .set({ status: "converted", convertedProjectId: row.id })
          .where(and(eq(leadsTable.id, resolvedFromLeadId), inArray(leadsTable.status, ["new", "followup"])));
      }

      // v3.0: create default Phase 1 for every new project
      await tx.insert(projectPhasesTable).values({
        projectId: row.id,
        phaseNumber: 1,
        label: 'المرحلة 1 / Phase 1',
        status: 'pending',
      });

      // v3.0: create default payment milestones
      await tx.insert(paymentMilestonesTable).values([
        { projectId: row.id, label: 'Deposit / دفعة مقدمة', percentage: 50, linkedEvent: 'deposit' },
        { projectId: row.id, label: 'Before delivery / قبل التوصيل', percentage: 40, linkedEvent: 'delivery' },
        { projectId: row.id, label: 'After sign-off / بعد التسليم', percentage: 10, linkedEvent: 'final' },
      ]);

      // Step 16: generate and persist project code (WT-YYYY-XXXX) — within same transaction, no orphan rows
      const code = await generateAndSetProjectCode(row.id, tx);
      return { row, code };
    });

    if ("error" in createdProject) {
      if (createdProject.error === "customer_not_found") {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      if (createdProject.error === "phone_exists") {
        res.status(409).json({ error: "phone_exists", existingCustomerId: createdProject.existingCustomerId });
        return;
      }
      if (createdProject.error === "phone_invalid") {
        res.status(400).json({ error: "phone must be a valid E.164 number" });
        return;
      }
      res.status(400).json({ error: "customerName is required" });
      return;
    }

    res.status(201).json({ ...createdProject.row, code: createdProject.code });
  } catch (err) {
    logger.error({ err }, "POST /erp/projects failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id — full detail + files (active only) + phases (Accountant allowed for payment deep-link)
router.get("/erp/projects/:id", requireRole("Admin", "FactoryManager", "Employee", "Accountant"), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [project] = await db.select(projectSelectFields)
      .from(projectsTable)
      .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
      .where(eq(projectsTable.id, id));
    if (!project) return notFound(res);
    const files = await db.select({
      id: projectFilesTable.id,
      projectId: projectFilesTable.projectId,
      fileType: projectFilesTable.fileType,
      originalFilename: projectFilesTable.originalFilename,
      uploadedAt: projectFilesTable.uploadedAt,
      uploadedBy: projectFilesTable.uploadedBy,
      uploadedByName: usersTable.username,
      isActive: projectFilesTable.isActive,
    }).from(projectFilesTable)
      .leftJoin(usersTable, eq(projectFilesTable.uploadedBy, usersTable.id))
      .where(and(eq(projectFilesTable.projectId, id), eq(projectFilesTable.isActive, true)));
    const phases = await db.select().from(projectPhasesTable)
      .where(eq(projectPhasesTable.projectId, id))
      .orderBy(asc(projectPhasesTable.phaseNumber));
    res.json({ ...project, files, phases });
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/projects/:id — update fields or stage
router.patch("/erp/projects/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const sess = session(req);
    const [existingProject] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!existingProject) return notFound(res);

    const projectUpdates: Record<string, unknown> = {};
    const projectFieldMap: Record<string, string> = {
      name: "name",
      location: "location",
      buildingType: "buildingType",
      productInterest: "productInterest",
      estimatedValue: "estimatedValue",
      stageDisplay: "stageDisplay",
      stageInternal: "stageInternal",
      assignedTo: "assignedTo",
      deliveryDeadline: "deliveryDeadline",
      warrantyMonths: "warrantyMonths",
      warrantyStartDate: "warrantyStartDate",
      warrantyEndDate: "warrantyEndDate",
      notes: "notes",
    };
    for (const [requestKey, columnKey] of Object.entries(projectFieldMap)) {
      if (req.body[requestKey] !== undefined) projectUpdates[columnKey] = req.body[requestKey];
    }
    if (projectUpdates.assignedTo !== undefined) projectUpdates.assignedTo = projectUpdates.assignedTo ? Number(projectUpdates.assignedTo) : null;
    if (projectUpdates.estimatedValue !== undefined) projectUpdates.estimatedValue = projectUpdates.estimatedValue ? Number(projectUpdates.estimatedValue) : null;
    if (projectUpdates.stageInternal !== undefined) projectUpdates.stageInternal = Number(projectUpdates.stageInternal);
    if (projectUpdates.warrantyMonths !== undefined) projectUpdates.warrantyMonths = projectUpdates.warrantyMonths ? Number(projectUpdates.warrantyMonths) : null;

    const requestedCustomerId = req.body.customerId ? Number(req.body.customerId) : null;
    if ((req.body.customerId !== undefined && req.body.customerId !== null && req.body.customerId !== "") && Number.isNaN(requestedCustomerId)) {
      res.status(400).json({ error: "customerId must be a valid number" });
      return;
    }

    const hasCustomerUpdate =
      req.body.customerId !== undefined ||
      req.body.customerName !== undefined ||
      req.body.phone !== undefined;

    if (Object.keys(projectUpdates).length === 0 && !hasCustomerUpdate) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const updatedProject = await db.transaction(async (tx) => {
      const finalProjectUpdates = { ...projectUpdates };
      if (hasCustomerUpdate) {
        const resolvedCustomer = await resolveCustomerLink(tx, {
          createdBy: sess.userId,
          customerId: requestedCustomerId,
          customerName: req.body.customerName ?? null,
          phone: req.body.phone ?? null,
          fallbackCustomerId: existingProject.customerId ?? null,
          legacyCustomerName: existingProject.customerName,
          legacyPhone: existingProject.phone,
        });
        if ("error" in resolvedCustomer) return resolvedCustomer;

        finalProjectUpdates.customerId = resolvedCustomer.customerId;
        finalProjectUpdates.customerName = resolvedCustomer.customerName;
        finalProjectUpdates.phone = resolvedCustomer.phone;
      }

      const [row] = await tx.update(projectsTable).set(finalProjectUpdates).where(eq(projectsTable.id, id)).returning();
      return row;
    });

    if ("error" in updatedProject) {
      if (updatedProject.error === "customer_not_found") {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      if (updatedProject.error === "phone_exists") {
        res.status(409).json({ error: "phone_exists", existingCustomerId: updatedProject.existingCustomerId });
        return;
      }
      if (updatedProject.error === "phone_invalid") {
        res.status(400).json({ error: "phone must be a valid E.164 number" });
        return;
      }
      res.status(400).json({ error: "customerName is required" });
      return;
    }

    const [row] = await db.select(projectSelectFields)
      .from(projectsTable)
      .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
      .where(eq(projectsTable.id, id));
    res.json(row ?? updatedProject);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/projects/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/projects/:id — Admin/FactoryManager only
router.delete("/erp/projects/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    // processed_docs.project_id has no ON DELETE CASCADE — NULL it out to preserve QR history
    await db.execute(sql`UPDATE processed_docs SET project_id = NULL WHERE project_id = ${id}`);
    // Phase 3: manufacturing_orders
    await db.delete(manufacturingOrdersTable).where(eq(manufacturingOrdersTable.projectId, id));
    // Phase 3: po_items → purchase_orders (grandchildren first)
    const pos = await db.select({ id: purchaseOrdersTable.id }).from(purchaseOrdersTable).where(eq(purchaseOrdersTable.projectId, id));
    if (pos.length > 0) {
      await db.delete(poItemsTable).where(inArray(poItemsTable.poId, pos.map(p => p.id)));
    }
    await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.projectId, id));
    // payment_milestones has no onDelete cascade — must delete explicitly
    await db.delete(paymentMilestonesTable).where(eq(paymentMilestonesTable.projectId, id));
    // project_phases: delete after clearing FK refs in payment_milestones
    await db.delete(projectPhasesTable).where(eq(projectPhasesTable.projectId, id));
    // project_files delete cascades: parsed_quotations, parsed_sections, parsed_section_drawings,
    // parsed_assembly_lists, parsed_cut_optimisations (all have ON DELETE CASCADE on source_file_id)
    await db.delete(projectFilesTable).where(eq(projectFilesTable.projectId, id));
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/projects/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/files — upload file(s)
// Supports both legacy single-file (field: "file" + body: fileType) and
// new multi-file (field: "files" array + body: fileTypes JSON array).
// For glass_order: runs QR pipeline → saved to processed_docs with project_id
// For single-file types: old files set to is_active=false, new file set to is_active=true
// For multi-file types (vendor_order, qoyod, other): all files stay is_active=true
router.post("/erp/projects/:id/files", requireRole(...NO_SALES_NO_ACCT), uploadMulti.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 20 }]), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    const sess = session(req);

    const filesMap = req.files as Record<string, Express.Multer.File[]> | undefined;
    const singleFile = filesMap?.['file']?.[0] ?? undefined;
    const multiFiles = filesMap?.['files'] ?? [];

    // ── Multi-file batch upload (new v3.0 path) ──────────────────────────────
    if (multiFiles.length > 0) {
      let fileTypesRaw: string[] = [];
      try {
        fileTypesRaw = JSON.parse(String(req.body?.fileTypes ?? '[]'));
      } catch {
        logger.warn({ projectId, reason: 'invalid_filetypes_json' }, 'Upload rejected: fileTypes is not valid JSON');
        res.status(400).json({ error: 'fileTypes must be a valid JSON array' });
        return;
      }
      if (fileTypesRaw.length !== multiFiles.length) {
        logger.warn({ projectId, reason: 'filetypes_count_mismatch', fileCount: multiFiles.length, typeCount: fileTypesRaw.length }, 'Upload rejected: fileTypes array length does not match files count');
        res.status(400).json({ error: 'fileTypes array length must match files count' });
        return;
      }

      const [proj] = await db.select({ stageInternal: projectsTable.stageInternal }).from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!proj) return notFound(res);

      const results = [];
      for (let i = 0; i < multiFiles.length; i++) {
        const f = multiFiles[i]!;
        const ft = String(fileTypesRaw[i]);

        if ((DEPRECATED_FILE_TYPES as readonly string[]).includes(ft)) {
          results.push({ filename: f.originalname, error: 'Deprecated file type', fileType: ft });
          continue;
        }
        if (!(PROJECT_FILE_TYPES as readonly string[]).includes(ft)) {
          results.push({ filename: f.originalname, error: 'Invalid fileType', fileType: ft });
          continue;
        }

        if (requiresDocx(ft) && !isDocx(f.originalname)) {
          results.push({ filename: f.originalname, error: `Only .docx files are accepted for ${ft}`, fileType: ft });
          continue;
        }

        if (ft === 'glass_order') {
          // Glass order via QR pipeline — handled via same logic as single upload below
          // For batch, run inline
          try {
            const result = await parseAndInjectQR(f.buffer);
            const reportFilename = `${f.originalname.replace(/\.docx$/i, '')}_QR_Report.html`;
            const [saved] = await db.insert(processedDocsTable).values({
              originalFilename: f.originalname,
              reportFilename,
              projectName: result.projectName || null,
              processingDate: result.date || null,
              positionCount: result.positions.length,
              originalFile: f.buffer,
              reportFile: result.outputBuffer,
              projectId,
            }).returning({ id: processedDocsTable.id });
            results.push({ filename: f.originalname, fileType: ft, savedId: saved.id });
            await autoAdvanceStage(projectId, ft, proj.stageInternal ?? 1);
          } catch (err: any) {
            results.push({ filename: f.originalname, fileType: ft, error: 'QR parse failed' });
          }
          continue;
        }

        // Single-file types: mark old files inactive
        if (!(MULTI_FILE_TYPES as readonly string[]).includes(ft)) {
          await db.update(projectFilesTable)
            .set({ isActive: false })
            .where(and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.fileType, ft), eq(projectFilesTable.isActive, true)));
        }

        const [row] = await db.insert(projectFilesTable).values({
          projectId, fileType: ft, originalFilename: f.originalname, fileData: f.buffer, uploadedBy: sess.userId, isActive: true,
        }).returning();

        await runParsersForFile(ft, f.buffer, row.id, projectId);
        await autoAdvanceStage(projectId, ft, proj.stageInternal ?? 1);
        results.push({ id: row.id, fileType: ft, originalFilename: f.originalname, uploadedAt: row.uploadedAt });
      }

      res.status(201).json(results);
      return;
    }

    // ── Single-file legacy upload path ───────────────────────────────────────
    const fileType = String(req.body?.fileType ?? "");
    if (!singleFile || !fileType) {
      logger.warn({ projectId, fileType: fileType || undefined, filename: singleFile?.originalname, reason: 'missing_file' }, 'Upload rejected: file or fileType missing from request');
      res.status(400).json({ error: "file and fileType are required" });
      return;
    }

    // ── v2.5.0: fileType validation ──────────────────────────────────────────
    if ((DEPRECATED_FILE_TYPES as readonly string[]).includes(fileType)) {
      logger.warn({ projectId, fileType, filename: singleFile?.originalname, reason: 'deprecated_type' }, 'Upload rejected: deprecated file type');
      res.status(400).json({ error: "This file type has been deprecated. Valid types: glass_order, quotation, section, assembly_list, cut_optimisation, material_analysis, vendor_order, qoyod, other." });
      return;
    }
    if (!(PROJECT_FILE_TYPES as readonly string[]).includes(fileType)) {
      logger.warn({ projectId, fileType, filename: singleFile?.originalname, reason: 'invalid_type' }, 'Upload rejected: invalid fileType');
      res.status(400).json({ error: "Invalid fileType" });
      return;
    }

    // Use singleFile (already confirmed non-null above) as a typed local reference
    const uploadedFile = singleFile;

    if (requiresDocx(fileType) && !isDocx(uploadedFile.originalname)) {
      logger.warn({ projectId, fileType, filename: uploadedFile.originalname, reason: 'wrong_extension' }, 'Upload rejected: non-docx file for docx slot');
      res.status(400).json({ error: `Only .docx files are accepted for ${fileType}` });
      return;
    }

    // ── Glass order: QR pipeline → processed_docs ──────────────────────────
    if (fileType === "glass_order") {
      const confirm = req.query.confirm === "true";

      const orgadataName = extractProjectNameFromDocx(uploadedFile.buffer);

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

      let result: Awaited<ReturnType<typeof parseAndInjectQR>>;
      try {
        result = await parseAndInjectQR(uploadedFile.buffer);
      } catch (err: any) {
        if (err?.message === "NO_POSITIONS") {
          logger.warn({ projectId, fileType: 'glass_order', filename: uploadedFile.originalname, reason: 'no_positions' }, 'Upload rejected: glass order file has no positions');
          res.status(400).json({
            error: "ParseError",
            message: "No positions found. Upload a valid Orgadata glass order (.docx).",
          });
          return;
        }
        throw err;
      }

      const originalName = uploadedFile.originalname.replace(/\.docx$/i, "");
      const reportFilename = `${originalName}_QR_Report.html`;

      const [saved] = await db
        .insert(processedDocsTable)
        .values({
          originalFilename: uploadedFile.originalname,
          reportFilename,
          projectName: result.projectName || null,
          processingDate: result.date || null,
          positionCount: result.positions.length,
          originalFile: uploadedFile.buffer,
          reportFile: result.outputBuffer,
          projectId,
        })
        .returning({ id: processedDocsTable.id });

      // Stage auto-advance for glass_order
      const [projForGlass] = await db.select({ stageInternal: projectsTable.stageInternal }).from(projectsTable).where(eq(projectsTable.id, projectId));
      if (projForGlass) await autoAdvanceStage(projectId, 'glass_order', projForGlass.stageInternal ?? 1);

      res.status(201).json({
        fileId: saved.id,
        projectName: result.projectName,
        totalPositions: result.positions.length,
        positions: result.positions,
      });
      return;
    }

    // ── All other file types → project_files ────────────────────────────────
    // Multi-file types accumulate; single-file types: mark old version inactive
    if (!(MULTI_FILE_TYPES as readonly string[]).includes(fileType)) {
      await db.update(projectFilesTable)
        .set({ isActive: false })
        .where(and(eq(projectFilesTable.projectId, projectId), eq(projectFilesTable.fileType, fileType), eq(projectFilesTable.isActive, true)));
    }

    const [row] = await db.insert(projectFilesTable).values({
      projectId,
      fileType,
      originalFilename: uploadedFile.originalname,
      fileData: uploadedFile.buffer,
      uploadedBy: sess.userId,
      isActive: true,
    }).returning();

    const newFileId = row.id;
    const fileBuffer = uploadedFile.buffer;

    // ── Post-save parsers (failure does NOT roll back the file upload) ────────
    if (fileType === 'price_quotation' || fileType === 'quotation') {
      try {
        const parsed = parseQuotationDocx(fileBuffer);

        // 409 Conflict: project name in file vs system name
        const [project] = await db.select({ name: projectsTable.name }).from(projectsTable).where(eq(projectsTable.id, projectId));
        if (parsed.projectName && project?.name && !namesMatch(parsed.projectName, project.name)) {
          const confirmed = req.query.confirmNameMismatch === 'true';
          if (!confirmed) {
            // Rollback: mark file inactive (don't hard-delete so version history is preserved)
            await db.update(projectFilesTable).set({ isActive: false }).where(eq(projectFilesTable.id, newFileId));
            res.status(409).json({
              error: 'PROJECT_NAME_MISMATCH',
              message: 'Project name in file does not match project in system',
              nameInFile: parsed.projectName,
              nameInSystem: project.name,
              hint: 'Re-submit with ?confirmNameMismatch=true to proceed, or cancel the upload',
            });
            return;
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

    // v3.0: stage auto-advance after single-file upload
    const [projForAdv] = await db.select({ stageInternal: projectsTable.stageInternal }).from(projectsTable).where(eq(projectsTable.id, projectId));
    if (projForAdv) await autoAdvanceStage(projectId, fileType, projForAdv.stageInternal ?? 1);

    res.status(201).json({
      id: row.id,
      projectId: row.projectId,
      fileType: row.fileType,
      originalFilename: row.originalFilename,
      uploadedAt: row.uploadedAt,
      uploadedBy: row.uploadedBy,
      isActive: row.isActive,
    });
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/files failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/files — list files (?includeInactive=true for all versions)
router.get("/erp/projects/:id/files", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const includeInactive = req.query.includeInactive === 'true';
    const rows = await db.select({
      id: projectFilesTable.id,
      projectId: projectFilesTable.projectId,
      fileType: projectFilesTable.fileType,
      originalFilename: projectFilesTable.originalFilename,
      uploadedAt: projectFilesTable.uploadedAt,
      uploadedBy: projectFilesTable.uploadedBy,
      isActive: projectFilesTable.isActive,
    }).from(projectFilesTable)
      .where(
        includeInactive
          ? eq(projectFilesTable.projectId, id)
          : and(eq(projectFilesTable.projectId, id), eq(projectFilesTable.isActive, true))
      )
      .orderBy(desc(projectFilesTable.uploadedAt));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/files failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/files/expected — file slots with active status and version counts
router.get("/erp/projects/:id/files/expected", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);

    // Count versions per type (all files, including inactive)
    const allFiles = await db.select({
      id: projectFilesTable.id,
      fileType: projectFilesTable.fileType,
      originalFilename: projectFilesTable.originalFilename,
      uploadedAt: projectFilesTable.uploadedAt,
      isActive: projectFilesTable.isActive,
    }).from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, id))
      .orderBy(desc(projectFilesTable.uploadedAt));

    const slots = KNOWN_FILE_TYPES.map(slot => {
      const filesForType = allFiles.filter(f => f.fileType === slot.value || (slot.value === 'quotation' && f.fileType === 'price_quotation'));
      const activeFile = filesForType.find(f => f.isActive) ?? null;
      return {
        type: slot.value,
        labelEn: slot.labelEn,
        labelAr: slot.labelAr,
        multi: slot.multi,
        uploaded: filesForType.length > 0,
        activeFile,
        versionCount: filesForType.length,
      };
    });

    res.json(slots);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/files/expected failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/files/detect — detect file types from filenames (no save)
router.post("/erp/projects/:id/files/detect", requireRole(...NO_SALES_NO_ACCT), uploadMulti.array('files', 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }
    const results = files.map(f => {
      const { detected, confidence } = detectFileType(f.originalname);
      return { filename: f.originalname, size: f.size, detectedType: detected, confidence };
    });
    res.json(results);
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/files/detect failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/projects/:id/files/:fileId — download file
router.get("/erp/projects/:id/files/:fileId", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const fileId = Number(req.params.fileId);
    const projectId = Number(req.params.id);
    const [file] = await db.select().from(projectFilesTable).where(and(eq(projectFilesTable.id, fileId), eq(projectFilesTable.projectId, projectId)));
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

// ─── PROJECT PHASES ───────────────────────────────────────────────────────────

// GET /erp/projects/:id/phases
router.get("/erp/projects/:id/phases", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const rows = await db.select().from(projectPhasesTable)
      .where(eq(projectPhasesTable.projectId, id))
      .orderBy(asc(projectPhasesTable.phaseNumber));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/phases failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/phases — create phase
router.post("/erp/projects/:id/phases", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [proj] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, id));
    if (!proj) return notFound(res);
    const { label, phase_number, phaseNumber } = req.body as { label?: string; phase_number?: number; phaseNumber?: number };
    const pNum = Number(phaseNumber ?? phase_number ?? 1);
    const [row] = await db.insert(projectPhasesTable).values({
      projectId: id,
      phaseNumber: pNum,
      label: label || null,
      status: 'pending',
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/phases failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/phases/:id — update phase status/dates/notes
router.patch("/erp/phases/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const allowed = ['status', 'label', 'deliveredAt', 'installedAt', 'signedOffAt', 'notes'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }
    const [row] = await db.update(projectPhasesTable).set(updates).where(eq(projectPhasesTable.id, id)).returning();
    if (!row) return notFound(res);
    res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/phases/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/phases/:id — Admin/FactoryManager only
router.delete("/erp/phases/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    // Unlink payment milestones that reference this phase before deleting
    await db.execute(sql`UPDATE payment_milestones SET linked_phase_id = NULL WHERE linked_phase_id = ${id}`);
    await db.delete(projectPhasesTable).where(eq(projectPhasesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/phases/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/phases/:id/signoff — sign off a phase, trigger milestones, and start warranty if all phases done
router.patch("/erp/phases/:id/signoff", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [phase] = await db.select().from(projectPhasesTable).where(eq(projectPhasesTable.id, id));
    if (!phase) return notFound(res);

    const [updatedPhase] = await db.update(projectPhasesTable)
      .set({ status: 'signed_off', signedOffAt: new Date() })
      .where(eq(projectPhasesTable.id, id))
      .returning();

    // Trigger payment milestones linked to this phase
    const triggeredMilestones = await db.update(paymentMilestonesTable)
      .set({ status: 'due' })
      .where(and(
        eq(paymentMilestonesTable.linkedPhaseId, id),
        eq(paymentMilestonesTable.status, 'pending'),
      ))
      .returning();

    // Check if ALL phases for this project are now signed off → start warranty
    const allPhases = await db.select().from(projectPhasesTable)
      .where(eq(projectPhasesTable.projectId, phase.projectId));
    const allSignedOff = allPhases.length > 0 && allPhases.every(p => p.status === 'signed_off' || p.id === id);
    let warrantyStarted = false;
    if (allSignedOff) {
      const [proj] = await db.select({
        stageInternal: projectsTable.stageInternal,
        warrantyMonths: projectsTable.warrantyMonths,
      }).from(projectsTable).where(eq(projectsTable.id, phase.projectId));
      if (proj && (proj.stageInternal ?? 0) < 13) {
        const warrantyMonths = proj.warrantyMonths ?? 12;
        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + warrantyMonths);
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        await db.update(projectsTable)
          .set({
            stageInternal: 13,
            stageDisplay: 'complete',
            warrantyStartDate: fmt(today),
            warrantyEndDate: fmt(endDate),
          })
          .where(eq(projectsTable.id, phase.projectId));
        warrantyStarted = true;
      }
      // Auto-advance to stage 11 even if warranty already set
      else if (proj && (proj.stageInternal ?? 0) < 11) {
        await db.update(projectsTable)
          .set({ stageInternal: 11, stageDisplay: 'complete' })
          .where(eq(projectsTable.id, phase.projectId));
      }
    } else {
      // At least one phase signed off → advance to stage 11 if lower
      const [proj] = await db.select({ stageInternal: projectsTable.stageInternal })
        .from(projectsTable).where(eq(projectsTable.id, phase.projectId));
      if (proj && (proj.stageInternal ?? 0) < 11) {
        await db.update(projectsTable)
          .set({ stageInternal: 11, stageDisplay: 'complete' })
          .where(eq(projectsTable.id, phase.projectId));
      }
    }

    res.json({ phase: updatedPhase, triggeredMilestones, warrantyStarted });
  } catch (err) {
    logger.error({ err }, "PATCH /erp/phases/:id/signoff failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── PHASE 4 — DELIVERY, INSTALLATION, CUSTOMER CONFIRMATION ─────────────────

// PATCH /erp/phases/:id/deliver — mark phase as delivered, auto-advance project to stage 9
router.patch("/erp/phases/:id/deliver", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [phase] = await db.select().from(projectPhasesTable).where(eq(projectPhasesTable.id, id));
    if (!phase) return notFound(res);

    const [updated] = await db.update(projectPhasesTable)
      .set({ status: 'delivered', deliveredAt: new Date() })
      .where(eq(projectPhasesTable.id, id))
      .returning();

    const [proj] = await db.select({ stageInternal: projectsTable.stageInternal })
      .from(projectsTable).where(eq(projectsTable.id, phase.projectId));
    if (proj && (proj.stageInternal ?? 0) < 9) {
      await db.update(projectsTable)
        .set({ stageInternal: 9, stageDisplay: 'complete' })
        .where(eq(projectsTable.id, phase.projectId));
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/phases/:id/deliver failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/phases/:id/install — mark phase as installed, auto-advance project to stage 10
router.patch("/erp/phases/:id/install", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [phase] = await db.select().from(projectPhasesTable).where(eq(projectPhasesTable.id, id));
    if (!phase) return notFound(res);

    const [updated] = await db.update(projectPhasesTable)
      .set({ status: 'installed', installedAt: new Date() })
      .where(eq(projectPhasesTable.id, id))
      .returning();

    const [proj] = await db.select({ stageInternal: projectsTable.stageInternal })
      .from(projectsTable).where(eq(projectsTable.id, phase.projectId));
    if (proj && (proj.stageInternal ?? 0) < 10) {
      await db.update(projectsTable)
        .set({ stageInternal: 10, stageDisplay: 'complete' })
        .where(eq(projectsTable.id, phase.projectId));
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/phases/:id/install failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/phases/:id — public — get phase info for customer confirmation page
router.get("/erp/phases/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [phase] = await db.select().from(projectPhasesTable).where(eq(projectPhasesTable.id, id));
    if (!phase) return notFound(res);
    const [proj] = await db.select({
      id: projectsTable.id,
      name: projectsTable.name,
      customerName: sql<string>`COALESCE(${customersTable.name}, ${projectsTable.customerName})`,
    })
      .from(projectsTable)
      .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
      .where(eq(projectsTable.id, phase.projectId));
    res.json({ ...phase, projectName: proj?.name ?? '', customerName: proj?.customerName ?? '' });
  } catch (err) {
    logger.error({ err }, "GET /erp/phases/:id failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/phases/:id/confirm — PUBLIC — customer confirmation via QR scan
router.post("/erp/phases/:id/confirm", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [phase] = await db.select().from(projectPhasesTable).where(eq(projectPhasesTable.id, id));
    if (!phase) return notFound(res);
    const [proj] = await db.select({ name: projectsTable.name })
      .from(projectsTable).where(eq(projectsTable.id, phase.projectId));
    await db.update(projectPhasesTable)
      .set({ customerConfirmed: true, customerConfirmedAt: new Date() })
      .where(eq(projectPhasesTable.id, id));
    res.json({ success: true, projectName: proj?.name ?? '', phaseNumber: phase.phaseNumber });
  } catch (err) {
    logger.error({ err }, "POST /erp/phases/:id/confirm failed");
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
          customerName: sql<string>`COALESCE(${customersTable.name}, ${projectsTable.customerName})`,
        })
        .from(projectsTable)
        .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id));

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

// GET /erp/files/audit — flat log of all active ERP project files (Admin only)
router.get("/erp/files/audit", requireRole('Admin'), async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        pf.id,
        pf.project_id,
        p.name        AS project_name,
        p.code        AS project_code,
        pf.file_type,
        pf.original_filename,
        pf.uploaded_at,
        u.username    AS uploaded_by_name
      FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      JOIN users    u ON u.id = pf.uploaded_by
      WHERE pf.is_active = true
      ORDER BY pf.uploaded_at DESC
      LIMIT 1000
    `);
    res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, 'GET /erp/files/audit failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    const [project] = await db
      .select(projectSelectFields)
      .from(projectsTable)
      .leftJoin(customersTable, eq(projectsTable.customerId, customersTable.id))
      .where(eq(projectsTable.id, projectId));
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

    let drawings: Array<{ id: number; orderIndex: number; positionCode: string | null; mimeType: string; imageDataB64: string }> = [];
    if (section) {
      const rawDrawings = await db.select({
        id: parsedSectionDrawingsTable.id,
        orderIndex: parsedSectionDrawingsTable.orderIndex,
        positionCode: parsedSectionDrawingsTable.positionCode,
        mimeType: parsedSectionDrawingsTable.mimeType,
        imageData: parsedSectionDrawingsTable.imageData,
      }).from(parsedSectionDrawingsTable)
        .where(eq(parsedSectionDrawingsTable.parsedSectionId, section.id))
        .orderBy(asc(parsedSectionDrawingsTable.orderIndex));
      drawings = rawDrawings.map(d => ({
        id: d.id,
        orderIndex: d.orderIndex,
        positionCode: d.positionCode,
        mimeType: d.mimeType,
        imageDataB64: Buffer.from(d.imageData as unknown as Buffer).toString('base64'),
      }));
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
    res.json(row ?? null);
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
    res.json(row ?? null);
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
router.post("/erp/projects/:id/payments", requireRole("Admin", "Accountant"), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [proj] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!proj) return notFound(res);
    const { label, percentage, amount, dueDate, notes, linkedEvent, linkedPhaseId } = req.body as {
      label?: string; percentage?: number; amount?: number; dueDate?: string; notes?: string;
      linkedEvent?: string; linkedPhaseId?: number;
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
      linkedEvent: linkedEvent || null,
      linkedPhaseId: linkedPhaseId ? Number(linkedPhaseId) : null,
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

// ─── VENDORS ─────────────────────────────────────────────────────────────────

// GET /erp/vendors
router.get("/erp/vendors", requireRole(...NO_SALES_NO_ACCT), async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(vendorsTable).orderBy(asc(vendorsTable.name));
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/vendors failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/vendors
router.post("/erp/vendors", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const { name, phone, email, category, contactPerson, notes } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: "Vendor name is required (min 2 chars)" });
    }
    const [row] = await db.insert(vendorsTable).values({
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      category: category || "Other",
      contactPerson: contactPerson ? String(contactPerson).trim() : null,
      notes: notes ? String(notes).trim() : null,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "POST /erp/vendors failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/vendors/:id
router.patch("/erp/vendors/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const { name, phone, email, category, contactPerson, notes } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
    if (email !== undefined) updates.email = email ? String(email).trim() : null;
    if (category !== undefined) updates.category = category;
    if (contactPerson !== undefined) updates.contactPerson = contactPerson ? String(contactPerson).trim() : null;
    if (notes !== undefined) updates.notes = notes ? String(notes).trim() : null;
    const [row] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, id)).returning();
    if (!row) return notFound(res);
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/vendors/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/vendors/:id — blocked if vendor has POs
router.delete("/erp/vendors/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [existing] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.id, id));
    if (!existing) return notFound(res);
    const linkedPos = await db.select({ id: purchaseOrdersTable.id }).from(purchaseOrdersTable).where(eq(purchaseOrdersTable.vendorId, id));
    if (linkedPos.length > 0) {
      return res.status(409).json({ error: "Cannot delete vendor with linked purchase orders" });
    }
    await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/vendors/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/vendors/:id/purchase-orders — all POs for a vendor across all projects
router.get("/erp/vendors/:id/purchase-orders", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const rows = await db.execute(sql`
      SELECT po.*, p.name AS project_name, COALESCE(c.name, p.customer_name) AS customer_name
      FROM purchase_orders po
      JOIN projects p ON p.id = po.project_id
      LEFT JOIN customers c ON c.id = p.customer_id
      WHERE po.vendor_id = ${id}
      ORDER BY po.created_at DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/vendors/:id/purchase-orders failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────

// GET /erp/projects/:id/purchase-orders
router.get("/erp/projects/:id/purchase-orders", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const rows = await db.execute(sql`
      SELECT po.*, v.name AS vendor_name,
             (SELECT COUNT(*) FROM po_items WHERE po_id = po.id) AS items_count
      FROM purchase_orders po
      JOIN vendors v ON v.id = po.vendor_id
      WHERE po.project_id = ${projectId}
      ORDER BY po.created_at DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/purchase-orders failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/purchase-orders
router.post("/erp/projects/:id/purchase-orders", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const sess = session(req);
    const { vendorId, notes, items } = req.body;
    if (!vendorId) return res.status(400).json({ error: "vendorId is required" });
    const [po] = await db.insert(purchaseOrdersTable).values({
      projectId,
      vendorId: Number(vendorId),
      notes: notes || null,
      createdBy: sess.userId,
    }).returning();
    if (items && Array.isArray(items) && items.length > 0) {
      await db.insert(poItemsTable).values(items.map((item: any) => ({
        poId: po.id,
        description: String(item.description || '').trim() || 'Item',
        category: item.category || 'Other',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'pcs',
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
      })));
    }
    return res.status(201).json(po);
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/purchase-orders failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/purchase-orders/:id — PO detail with items
router.get("/erp/purchase-orders/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
    if (!po) return notFound(res);
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, po.vendorId));
    const items = await db.select().from(poItemsTable).where(eq(poItemsTable.poId, id)).orderBy(asc(poItemsTable.id));
    return res.json({ ...po, vendor, items });
  } catch (err) {
    logger.error({ err }, "GET /erp/purchase-orders/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/purchase-orders/:id
router.patch("/erp/purchase-orders/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const { status, notes, totalAmount, amountPaid } = req.body;
    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes || null;
    if (totalAmount !== undefined) updates.totalAmount = totalAmount ? Number(totalAmount) : null;
    if (amountPaid !== undefined) updates.amountPaid = amountPaid ? Number(amountPaid) : null;
    const [row] = await db.update(purchaseOrdersTable).set(updates).where(eq(purchaseOrdersTable.id, id)).returning();
    if (!row) return notFound(res);
    return res.json(row);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/purchase-orders/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/purchase-orders/:id
router.delete("/erp/purchase-orders/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    await db.delete(poItemsTable).where(eq(poItemsTable.poId, id));
    await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/purchase-orders/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── PO ITEMS ────────────────────────────────────────────────────────────────

// POST /erp/purchase-orders/:id/items
router.post("/erp/purchase-orders/:id/items", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id);
    if (Number.isNaN(poId)) return notFound(res);
    const { description, category, quantity, unit, unitPrice } = req.body;
    if (!description || String(description).trim().length < 1) {
      return res.status(400).json({ error: "description is required" });
    }
    const [item] = await db.insert(poItemsTable).values({
      poId,
      description: String(description).trim(),
      category: category || 'Other',
      quantity: quantity ? Number(quantity) : 1,
      unit: unit || 'pcs',
      unitPrice: unitPrice ? Number(unitPrice) : null,
    }).returning();
    return res.status(201).json(item);
  } catch (err) {
    logger.error({ err }, "POST /erp/purchase-orders/:id/items failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/po-items/:id — update receivedQuantity (auto-computes status)
router.patch("/erp/po-items/:id", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const [item] = await db.select().from(poItemsTable).where(eq(poItemsTable.id, id));
    if (!item) return notFound(res);
    const receivedQuantity = req.body.receivedQuantity !== undefined ? Number(req.body.receivedQuantity) : item.receivedQuantity;
    const qty = item.quantity;
    const newReceived = Math.max(0, receivedQuantity);
    const newStatus = newReceived >= qty ? 'received' : newReceived > 0 ? 'partial' : 'pending';
    const updates: Record<string, unknown> = { receivedQuantity: newReceived, status: newStatus };
    if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.quantity !== undefined) updates.quantity = Number(req.body.quantity);
    if (req.body.unit !== undefined) updates.unit = req.body.unit;
    if (req.body.unitPrice !== undefined) updates.unitPrice = req.body.unitPrice ? Number(req.body.unitPrice) : null;
    const [updated] = await db.update(poItemsTable).set(updates).where(eq(poItemsTable.id, id)).returning();
    // Auto-advance PO status
    const allItems = await db.select().from(poItemsTable).where(eq(poItemsTable.poId, item.poId));
    const allReceived = allItems.every(i => (i.id === id ? newStatus : i.status) === 'received');
    const anyReceived = allItems.some(i => (i.id === id ? newStatus : i.status) !== 'pending');
    const poStatus = allReceived ? 'received' : anyReceived ? 'partial' : 'pending';
    await db.update(purchaseOrdersTable).set({ status: poStatus }).where(eq(purchaseOrdersTable.id, item.poId));
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/po-items/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /erp/po-items/:id
router.delete("/erp/po-items/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    await db.delete(poItemsTable).where(eq(poItemsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /erp/po-items/:id failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── MANUFACTURING ORDERS ────────────────────────────────────────────────────

// GET /erp/projects/:id/manufacturing
router.get("/erp/projects/:id/manufacturing", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const [mfg] = await db.select().from(manufacturingOrdersTable).where(eq(manufacturingOrdersTable.projectId, projectId));
    return res.json(mfg ?? null);
  } catch (err) {
    logger.error({ err }, "GET /erp/projects/:id/manufacturing failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// POST /erp/projects/:id/manufacturing — FactoryManager/Admin only
router.post("/erp/projects/:id/manufacturing", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const projectId = Number(req.params.id);
    if (Number.isNaN(projectId)) return notFound(res);
    const sess = session(req);
    const [existing] = await db.select({ id: manufacturingOrdersTable.id }).from(manufacturingOrdersTable).where(eq(manufacturingOrdersTable.projectId, projectId));
    if (existing) return res.status(409).json({ error: "Manufacturing order already exists for this project" });
    const [project] = await db.select({ stageInternal: projectsTable.stageInternal, deliveryDeadline: projectsTable.deliveryDeadline }).from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) return notFound(res);
    const [mfg] = await db.insert(manufacturingOrdersTable).values({
      projectId,
      deliveryDeadline: project.deliveryDeadline ?? null,
      notes: req.body.notes || null,
      createdBy: sess.userId,
    }).returning();
    // Auto-advance to stage 7 if current < 7
    if ((project.stageInternal ?? 0) < 7) {
      await db.update(projectsTable).set({ stageInternal: 7, stageDisplay: 'in_production' }).where(eq(projectsTable.id, projectId));
    }
    return res.status(201).json(mfg);
  } catch (err) {
    logger.error({ err }, "POST /erp/projects/:id/manufacturing failed");
    return res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /erp/manufacturing/:id — update status/notes
router.patch("/erp/manufacturing/:id", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return notFound(res);
    const sess = session(req);
    const [existing] = await db.select().from(manufacturingOrdersTable).where(eq(manufacturingOrdersTable.id, id));
    if (!existing) return notFound(res);
    const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy: sess.userId };
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes || null;
    const [updated] = await db.update(manufacturingOrdersTable).set(updates).where(eq(manufacturingOrdersTable.id, id)).returning();
    // Stage auto-advance
    if (req.body.status === 'ready') {
      const [proj] = await db.select({ stageInternal: projectsTable.stageInternal }).from(projectsTable).where(eq(projectsTable.id, existing.projectId));
      if (proj && (proj.stageInternal ?? 0) < 8) {
        await db.update(projectsTable).set({ stageInternal: 8, stageDisplay: 'in_production' }).where(eq(projectsTable.id, existing.projectId));
      }
    }
    return res.json(updated);
  } catch (err) {
    logger.error({ err }, "PATCH /erp/manufacturing/:id failed");
    return res.status(500).json({ error: "Internal error" });
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
        COALESCE(c.name, p.customer_name) AS customer_name
      FROM payment_milestones pm
      JOIN projects p ON p.id = pm.project_id
      LEFT JOIN customers c ON c.id = p.customer_id
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

// GET /erp/payments/cashflow-summary — collected, outstanding, revenue MTD
router.get("/erp/payments/cashflow-summary", requireRole("Admin", "Accountant"), async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN paid_amount IS NOT NULL THEN paid_amount ELSE 0 END), 0)::int AS collected,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN COALESCE(amount, 0) - COALESCE(paid_amount, 0) ELSE 0 END), 0)::int AS outstanding,
        COALESCE(SUM(CASE WHEN date_trunc('month', paid_at) = date_trunc('month', NOW()) THEN COALESCE(paid_amount, 0) ELSE 0 END), 0)::int AS revenue_mtd
      FROM payment_milestones
    `);
    const row = result.rows[0] as any;
    res.json({
      collected: Number(row?.collected ?? 0),
      outstanding: Number(row?.outstanding ?? 0),
      revenueMtd: Number(row?.revenue_mtd ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "GET /erp/payments/cashflow-summary failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/stats/cashflow — collected, outstanding, total, percentage, revenueMtd (wider role access than /payments/cashflow-summary)
router.get("/erp/stats/cashflow", requireRole("Admin", "Accountant", "FactoryManager"), async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN paid_amount IS NOT NULL THEN paid_amount ELSE 0 END), 0)::int AS collected,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN COALESCE(amount, 0) - COALESCE(paid_amount, 0) ELSE 0 END), 0)::int AS outstanding,
        COALESCE(SUM(CASE WHEN date_trunc('month', paid_at) = date_trunc('month', NOW()) THEN COALESCE(paid_amount, 0) ELSE 0 END), 0)::int AS revenue_mtd
      FROM payment_milestones
    `);
    const row = result.rows[0] as any;
    const collected = Number(row?.collected ?? 0);
    const outstanding = Number(row?.outstanding ?? 0);
    const revenueMtd = Number(row?.revenue_mtd ?? 0);
    const total = collected + outstanding;
    const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
    res.json({ collected, outstanding, total, percentage, revenueMtd });
  } catch (err) {
    logger.error({ err }, "GET /erp/stats/cashflow failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/stats/trends — 10-point daily sparkline arrays for the 4 KPI cards
router.get("/erp/stats/trends", requireRole("Admin", "Accountant", "FactoryManager"), async (req: Request, res: Response) => {
  try {
    const [projResult, revenueResult, outstandingResult, qrResult] = await Promise.all([
      db.execute(sql`
        WITH days AS (
          SELECT generate_series(NOW() - INTERVAL '9 days', NOW(), INTERVAL '1 day')::date AS day
        )
        SELECT COALESCE(COUNT(p.id), 0)::int AS count
        FROM days d
        LEFT JOIN projects p ON p.created_at::date = d.day
        GROUP BY d.day ORDER BY d.day
      `),
      db.execute(sql`
        WITH days AS (
          SELECT generate_series(NOW() - INTERVAL '9 days', NOW(), INTERVAL '1 day')::date AS day
        )
        SELECT COALESCE(SUM(pm.paid_amount), 0)::int AS count
        FROM days d
        LEFT JOIN payment_milestones pm ON pm.paid_at::date = d.day
        GROUP BY d.day ORDER BY d.day
      `),
      db.execute(sql`
        WITH days AS (
          SELECT generate_series(NOW() - INTERVAL '9 days', NOW(), INTERVAL '1 day')::date AS day
        )
        SELECT COALESCE(SUM(CASE WHEN pm.status != 'paid' THEN COALESCE(pm.amount, 0) - COALESCE(pm.paid_amount, 0) ELSE 0 END), 0)::int AS count
        FROM days d
        LEFT JOIN payment_milestones pm ON pm.created_at::date = d.day
        GROUP BY d.day ORDER BY d.day
      `),
      db.execute(sql`
        WITH days AS (
          SELECT generate_series(NOW() - INTERVAL '9 days', NOW(), INTERVAL '1 day')::date AS day
        )
        SELECT COALESCE(COUNT(pd.id), 0)::int AS count
        FROM days d
        LEFT JOIN processed_docs pd ON pd.created_at::date = d.day
        GROUP BY d.day ORDER BY d.day
      `),
    ]);
    const toArr = (r: any) => (r.rows as any[]).map(row => Number(row.count ?? 0));
    res.json({
      projectsTrend:    toArr(projResult),
      revenueTrend:     toArr(revenueResult),
      outstandingTrend: toArr(outstandingResult),
      qrTrend:          toArr(qrResult),
    });
  } catch (err) {
    logger.error({ err }, "GET /erp/stats/trends failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/activity — enriched activity feed with user attribution
router.get("/erp/activity", requireRole(...ADMIN_FM), async (req: Request, res: Response) => {
  try {
    const rawLimit = parseInt(String(req.query.limit ?? "10"), 10);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 50);
    const result = await db.execute(sql`
      SELECT action, target, "user", timestamp FROM (
        SELECT 'project_created' AS action, p.name AS target,
          u.username AS "user", p.created_at AS timestamp
        FROM projects p JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC LIMIT 5
      ) proj
      UNION ALL
      SELECT action, target, "user", timestamp FROM (
        SELECT 'payment_paid' AS action,
          p.name || ' · ' || pm.label AS target,
          COALESCE(a.username, 'system') AS "user",
          pm.paid_at AS timestamp
        FROM payment_milestones pm
        JOIN projects p ON pm.project_id = p.id
        LEFT JOIN users a ON p.assigned_to = a.id
        WHERE pm.paid_at IS NOT NULL
        ORDER BY pm.paid_at DESC LIMIT 5
      ) pay
      UNION ALL
      SELECT action, target, "user", timestamp FROM (
        SELECT 'file_uploaded' AS action,
          pf.file_type || ' · ' || p.name AS target,
          u.username AS "user",
          pf.created_at AS timestamp
        FROM project_files pf
        JOIN projects p ON pf.project_id = p.id
        JOIN users u ON pf.uploaded_by = u.id
        WHERE pf.is_active = true
        ORDER BY pf.created_at DESC LIMIT 5
      ) files
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/activity failed");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /erp/activity-feed — recent events from projects + paid milestones
router.get("/erp/activity-feed", requireRole(...NO_SALES_NO_ACCT), async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT type, name, detail, time FROM (
        SELECT 'project' AS type, p.name, COALESCE(c.name, p.customer_name) AS detail, p.created_at AS time
        FROM projects p
        LEFT JOIN customers c ON c.id = p.customer_id
        ORDER BY p.created_at DESC LIMIT 4
      ) proj
      UNION ALL
      SELECT type, name, detail, time FROM (
        SELECT 'payment' AS type, p.name AS name,
          pm.label || ' · ' || pm.paid_amount::text || ' ر.س' AS detail,
          pm.paid_at AS time
        FROM payment_milestones pm
        JOIN projects p ON pm.project_id = p.id
        WHERE pm.paid_at IS NOT NULL ORDER BY pm.paid_at DESC LIMIT 4
      ) pay
      ORDER BY time DESC LIMIT 6
    `);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err }, "GET /erp/activity-feed failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
