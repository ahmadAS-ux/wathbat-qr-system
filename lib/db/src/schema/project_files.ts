import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
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
  /** v2.5.0 valid values: glass_order | price_quotation | section | assembly_list | cut_optimisation | qoyod (multi-file). Legacy (hidden from UI): technical_doc | qoyod_deposit | qoyod_payment | attachment */
  fileType: text("file_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileData: bytea("file_data").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
});

export type ProjectFile = typeof projectFilesTable.$inferSelect;
export type InsertProjectFile = typeof projectFilesTable.$inferInsert;
