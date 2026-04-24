import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { vendorsTable } from "./vendors";
import { usersTable } from "./users";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id),
  /** 'pending' | 'sent' | 'partial' | 'received' */
  status: text("status").notNull().default("pending"),
  totalAmount: integer("total_amount"),
  amountPaid: integer("amount_paid"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
});

export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrdersTable.$inferInsert;
