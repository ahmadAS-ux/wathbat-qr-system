import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";

export const dropdownOptionsTable = pgTable("dropdown_options", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  value: text("value").notNull(),
  labelAr: text("label_ar").notNull(),
  labelEn: text("label_en").notNull(),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
});

export type DropdownOption = typeof dropdownOptionsTable.$inferSelect;
export type InsertDropdownOption = typeof dropdownOptionsTable.$inferInsert;
