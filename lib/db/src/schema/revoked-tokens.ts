import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const revokedTokensTable = pgTable("revoked_tokens", {
  id: serial("id").primaryKey(),
  jti: text("jti").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RevokedToken = typeof revokedTokensTable.$inferSelect;
export type InsertRevokedToken = typeof revokedTokensTable.$inferInsert;
