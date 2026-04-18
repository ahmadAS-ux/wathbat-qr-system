import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const processedDocsTable = pgTable("processed_docs", {
  id: serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  reportFilename: text("report_filename").notNull(),
  projectName: text("project_name"),
  processingDate: text("processing_date"),
  positionCount: integer("position_count").notNull().default(0),
  originalFile: bytea("original_file").notNull(),
  reportFile: bytea("report_file").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProcessedDoc = typeof processedDocsTable.$inferSelect;
export type InsertProcessedDoc = typeof processedDocsTable.$inferInsert;
