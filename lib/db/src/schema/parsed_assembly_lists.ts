import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { projectsTable } from './projects';
import { projectFilesTable } from './project_files';

export interface AssemblyGlassItem {
  quantity: number;
  widthMm: number;
  heightMm: number;
  areaSqm: number;
  description: string;
}

export interface AssemblyPosition {
  positionCode: string;
  quantity: number;
  system: string | null;
  widthMm: number | null;
  heightMm: number | null;
  glassItems: AssemblyGlassItem[];
}

export const parsedAssemblyListsTable = pgTable('parsed_assembly_lists', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),
  positionCount: integer('position_count').notNull().default(0),
  positions: jsonb('positions').notNull().$type<AssemblyPosition[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type ParsedAssemblyList = typeof parsedAssemblyListsTable.$inferSelect;
export type InsertParsedAssemblyList = typeof parsedAssemblyListsTable.$inferInsert;
