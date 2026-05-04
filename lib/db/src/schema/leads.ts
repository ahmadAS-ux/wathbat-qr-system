import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { customersTable } from "./customers";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  source: text("source").notNull(),
  productInterest: text("product_interest").notNull(),
  buildingType: text("building_type").notNull(),
  location: text("location"),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  budgetRange: text("budget_range"),
  estimatedValue: integer("estimated_value"),
  firstFollowupDate: date("first_followup_date").notNull(),
  status: text("status").notNull().default("new"),
  lostReason: text("lost_reason"),
  customerId: integer("customer_id").references(() => customersTable.id),
  convertedProjectId: integer("converted_project_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => usersTable.id),
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;
