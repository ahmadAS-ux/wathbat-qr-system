import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projectsTable } from './projects';
import { projectFilesTable } from './project_files';

export const parsedQuotationsTable = pgTable('parsed_quotations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),
  quotationNumber: text('quotation_number'),
  quotationDate: text('quotation_date'),
  currency: text('currency').notNull().default('SAR'),
  positions: jsonb('positions').notNull(),
  subtotalNet: text('subtotal_net'),
  taxRate: text('tax_rate'),
  taxAmount: text('tax_amount'),
  grandTotal: text('grand_total'),
  rawPositionCount: integer('raw_position_count').notNull(),
  dedupedPositionCount: integer('deduped_position_count').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type ParsedQuotation = typeof parsedQuotationsTable.$inferSelect;
export type InsertParsedQuotation = typeof parsedQuotationsTable.$inferInsert;
