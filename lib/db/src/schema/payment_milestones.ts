import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { projectFilesTable } from "./project_files";
import { projectPhasesTable } from "./project_phases";

export const paymentMilestonesTable = pgTable("payment_milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  label: text("label").notNull(),
  percentage: integer("percentage"),
  amount: integer("amount"),          // SAR — expected amount
  paidAmount: integer("paid_amount"), // SAR — actual amount entered when marking paid
  dueDate: date("due_date"),
  status: text("status").notNull().default("pending"), // 'pending'|'due'|'paid'|'overdue'
  paidAt: timestamp("paid_at"),
  qoyodDocFileId: integer("qoyod_doc_file_id").references(() => projectFilesTable.id),
  /** 'deposit' | 'delivery' | 'final' | 'phase_signoff:N' | 'custom' */
  linkedEvent: text("linked_event"),
  /** FK to project_phases — set when milestone is linked to a specific phase sign-off */
  linkedPhaseId: integer("linked_phase_id").references(() => projectPhasesTable.id),
  notes: text("notes"),
});

export type PaymentMilestone = typeof paymentMilestonesTable.$inferSelect;
export type InsertPaymentMilestone = typeof paymentMilestonesTable.$inferInsert;
