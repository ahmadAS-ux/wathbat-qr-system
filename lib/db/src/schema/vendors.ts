import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  /** 'Aluminum' | 'Glass' | 'Accessories' | 'Other' */
  category: text("category").notNull().default("Other"),
  contactPerson: text("contact_person"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Vendor = typeof vendorsTable.$inferSelect;
export type InsertVendor = typeof vendorsTable.$inferInsert;
