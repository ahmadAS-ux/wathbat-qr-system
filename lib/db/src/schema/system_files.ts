import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const systemFilesTable = pgTable("system_files", {
  id: serial("id").primaryKey(),
  // UNIQUE constraint creates the backing index automatically — no separate
  // CREATE UNIQUE INDEX needed.
  fileKey: text("file_key").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  content: bytea("content").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id),
});

export type SystemFile = typeof systemFilesTable.$inferSelect;
export type InsertSystemFile = typeof systemFilesTable.$inferInsert;
