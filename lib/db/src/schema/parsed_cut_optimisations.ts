import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projectsTable } from './projects';
import { projectFilesTable } from './project_files';

export interface CutProfile {
  number: string;
  description: string;
  colour: string;
  quantity: number;
  lengthMm: number;
  wastageMm: number;
  wastagePercent: number;
}

export const parsedCutOptimisationsTable = pgTable('parsed_cut_optimisations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),
  profileCount: integer('profile_count').notNull().default(0),
  profiles: jsonb('profiles').notNull().$type<CutProfile[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type ParsedCutOptimisation = typeof parsedCutOptimisationsTable.$inferSelect;
export type InsertParsedCutOptimisation = typeof parsedCutOptimisationsTable.$inferInsert;
