import { pgTable, serial, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { leadsTable } from "./leads";

export const leadLogsTable = pgTable("lead_logs", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leadsTable.id),
  note: text("note").notNull(),
  nextFollowupDate: date("next_followup_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
});

export type LeadLog = typeof leadLogsTable.$inferSelect;
export type InsertLeadLog = typeof leadLogsTable.$inferInsert;
