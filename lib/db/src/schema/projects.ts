import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { leadsTable } from "./leads";
import { customersTable } from "./customers";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  customerName: text("customer_name").notNull().default(""),
  phone: text("phone"),
  location: text("location"),
  buildingType: text("building_type"),
  productInterest: text("product_interest"),
  estimatedValue: integer("estimated_value"),
  stageDisplay: text("stage_display").notNull().default("new"),
  stageInternal: integer("stage_internal").notNull().default(1),
  customerId: integer("customer_id").references(() => customersTable.id),
  fromLeadId: integer("from_lead_id").references(() => leadsTable.id),
  assignedTo: integer("assigned_to").references(() => usersTable.id),
  deliveryDeadline: date("delivery_deadline"),
  warrantyMonths: integer("warranty_months"),
  warrantyStartDate: date("warranty_start_date"),
  warrantyEndDate: date("warranty_end_date"),
  notes: text("notes"),
  code: text("code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
});

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;
