import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { customType } from 'drizzle-orm/pg-core';
import { projectsTable } from './projects';
import { projectFilesTable } from './project_files';

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() { return 'bytea'; },
});

export const parsedSectionsTable = pgTable('parsed_sections', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),
  system: text('system'),
  drawingCount: integer('drawing_count').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const parsedSectionDrawingsTable = pgTable('parsed_section_drawings', {
  id: serial('id').primaryKey(),
  parsedSectionId: integer('parsed_section_id').notNull().references(() => parsedSectionsTable.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  positionCode: text('position_code'),
  mediaFilename: text('media_filename').notNull(),
  mimeType: text('mime_type').notNull().default('image/png'),
  imageData: bytea('image_data').notNull(),
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type ParsedSection = typeof parsedSectionsTable.$inferSelect;
export type InsertParsedSection = typeof parsedSectionsTable.$inferInsert;
export type ParsedSectionDrawing = typeof parsedSectionDrawingsTable.$inferSelect;
export type InsertParsedSectionDrawing = typeof parsedSectionDrawingsTable.$inferInsert;
