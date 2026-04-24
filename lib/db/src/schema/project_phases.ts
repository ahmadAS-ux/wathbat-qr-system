import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectPhasesTable = pgTable("project_phases", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  phaseNumber: integer("phase_number").notNull(),
  label: text("label"),
  /** 'pending' | 'manufacturing' | 'delivered' | 'installed' | 'signed_off' */
  status: text("status").notNull().default("pending"),
  deliveredAt: timestamp("delivered_at"),
  installedAt: timestamp("installed_at"),
  signedOffAt: timestamp("signed_off_at"),
  customerConfirmed: boolean("customer_confirmed").notNull().default(false),
  customerConfirmedAt: timestamp("customer_confirmed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProjectPhase = typeof projectPhasesTable.$inferSelect;
export type InsertProjectPhase = typeof projectPhasesTable.$inferInsert;
