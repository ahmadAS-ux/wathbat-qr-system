import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  positionId: text("position_id").notNull(),
  requestType: text("request_type").notNull(),
  customerPhone: text("customer_phone"),
  projectName: text("project_name"),
  invoiceNumber: text("invoice_number"),
  message: text("message"),
  status: text("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Request = typeof requestsTable.$inferSelect;
export type InsertRequest = typeof requestsTable.$inferInsert;
