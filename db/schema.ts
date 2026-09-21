import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const characterDrafts = sqliteTable('character_drafts', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  document: text('document').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('idx_character_drafts_owner_created').on(table.ownerId, table.createdAt)]);

export const factions = sqliteTable('factions', {
 id: text('id').primaryKey(),
 ownerId: text('owner_id').notNull(),
 name: text('name').notNull(),
 nameKey: text('name_key').notNull(),
 createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('idx_factions_owner_name').on(table.ownerId,table.nameKey)]);

export const factionProfiles = sqliteTable('faction_profiles', {
 ownerId: text('owner_id').notNull(),
 factionId: text('faction_id').notNull(),
 document: text('document').notNull(),
 version: integer('version').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('idx_faction_profiles_owner_faction').on(table.ownerId,table.factionId)]);

export const locations = sqliteTable('locations', {
 id: text('id').primaryKey(),
 ownerId: text('owner_id').notNull(),
 name: text('name').notNull(),
 type: text('type').notNull(),
 parentId: text('parent_id'),
 createdAt: text('created_at').notNull(),
}, table => [index('idx_locations_owner_created').on(table.ownerId,table.createdAt)]);

export const countryProfiles = sqliteTable('country_profiles', {
 ownerId: text('owner_id').notNull(),
 locationId: text('location_id').notNull(),
 document: text('document').notNull(),
 version: integer('version').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('idx_country_profiles_owner_location').on(table.ownerId,table.locationId)]);
