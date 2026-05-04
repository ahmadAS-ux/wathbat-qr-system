import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { projectFilesTable } from "./project_files";
import { usersTable } from "./users";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  // Default FK behavior (RESTRICT): cannot delete a quotation file while a
  // contract references it. Project-delete logic update planned for v4.3.1.
  quotationFileId: integer("quotation_file_id").notNull().references(() => projectFilesTable.id),
  templateSnapshot: jsonb("template_snapshot").notNull(),
  companyInfoSnapshot: jsonb("company_info_snapshot").notNull(),
  pdfContent: bytea("pdf_content"), // populated by v4.3.1
  status: text("status").notNull().default("pending"),
  generatedAt: timestamp("generated_at"),
  accessToken: text("access_token"), // populated by v4.3.2
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  contractsProjectIdIdx: index("contracts_project_id_idx").on(table.projectId),
  contractsAccessTokenIdx: index("contracts_access_token_idx").on(table.accessToken),
}));

export type Contract = typeof contractsTable.$inferSelect;
export type InsertContract = typeof contractsTable.$inferInsert;
