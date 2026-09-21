import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const characterDrafts = sqliteTable('character_drafts', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  document: text('document').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('idx_character_drafts_owner_created').on(table.ownerId, table.createdAt)]);
