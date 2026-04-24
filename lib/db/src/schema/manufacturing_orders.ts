import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const manufacturingOrdersTable = pgTable("manufacturing_orders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  /** 'pending' | 'in_progress' | 'ready' */
  status: text("status").notNull().default("pending"),
  deliveryDeadline: date("delivery_deadline"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  updatedAt: timestamp("updated_at"),
  updatedBy: integer("updated_by").references(() => usersTable.id),
});

export type ManufacturingOrder = typeof manufacturingOrdersTable.$inferSelect;
export type InsertManufacturingOrder = typeof manufacturingOrdersTable.$inferInsert;
