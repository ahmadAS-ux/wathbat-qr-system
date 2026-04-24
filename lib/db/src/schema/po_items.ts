import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { purchaseOrdersTable } from "./purchase_orders";

export const poItemsTable = pgTable("po_items", {
  id: serial("id").primaryKey(),
  poId: integer("po_id").notNull().references(() => purchaseOrdersTable.id),
  description: text("description").notNull(),
  /** 'Aluminum' | 'Glass' | 'Accessories' | 'Special Parts' */
  category: text("category").notNull(),
  quantity: integer("quantity").notNull().default(1),
  /** 'pcs' | 'm²' | 'kg' | 'm' */
  unit: text("unit").notNull().default("pcs"),
  unitPrice: integer("unit_price"),
  receivedQuantity: integer("received_quantity").notNull().default(0),
  /** 'pending' | 'partial' | 'received' */
  status: text("status").notNull().default("pending"),
});

export type PoItem = typeof poItemsTable.$inferSelect;
export type InsertPoItem = typeof poItemsTable.$inferInsert;
