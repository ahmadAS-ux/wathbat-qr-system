import { pgTable, serial, text, integer, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const projectFilesTable = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  /** v3.0 valid values: glass_order | quotation | section | assembly_list | cut_optimisation | material_analysis | vendor_order (multi) | qoyod (multi) | other (multi). Legacy: price_quotation | technical_doc | qoyod_deposit | qoyod_payment | attachment */
  fileType: text("file_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileData: bytea("file_data").notNull(),
  /** MIME type of the original uploaded file (e.g. application/vnd.openxmlformats-officedocument.wordprocessingml.document). NULL for legacy rows. */
  fileMime: varchar("file_mime", { length: 100 }),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  /** true = current active version; false = superseded (single-file types only). Multi-file types are always true. */
  isActive: boolean("is_active").notNull().default(true),
  /** v4.0.11: derived artifact — A4 HTML for .docx types, QR HTML for glass_order, byte copy for qoyod. NULL for legacy rows. */
  extractedFile: bytea("extracted_file"),
  /** v4.0.11: MIME type of the extracted artifact (e.g. text/html). NULL for legacy rows. */
  extractedMime: varchar("extracted_mime", { length: 100 }),
});

export type ProjectFile = typeof projectFilesTable.$inferSelect;
export type InsertProjectFile = typeof projectFilesTable.$inferInsert;
