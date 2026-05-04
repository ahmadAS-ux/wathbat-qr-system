import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { contractsTable } from "./contracts";

export const contractAccessLogsTable = pgTable("contract_access_logs", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contractsTable.id),
  accessedAt: timestamp("accessed_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
});
