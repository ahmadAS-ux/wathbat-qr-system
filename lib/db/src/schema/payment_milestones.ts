import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { projectFilesTable } from "./project_files";

export const paymentMilestonesTable = pgTable("payment_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  label: text("label").notNull(),
  percentage: integer("percentage"),
  amount: integer("amount"),          // SAR — expected amount
  paidAmount: integer("paid_amount"), // SAR — actual amount entered when marking paid
  dueDate: date("due_date"),
  status: text("status").notNull().default("pending"), // 'pending'|'paid'|'overdue'
  paidAt: timestamp("paid_at"),
  qoyodDocFileId: integer("qoyod_doc_file_id").references(() => projectFilesTable.id),
  notes: text("notes"),
});

export type PaymentMilestone = typeof paymentMilestonesTable.$inferSelect;
export type InsertPaymentMilestone = typeof paymentMilestonesTable.$inferInsert;
