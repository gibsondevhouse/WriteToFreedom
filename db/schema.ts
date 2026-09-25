// JSON fields and nested shapes are defined in document-contracts.js and
// generated documents.schema.json; raw text storage does not erase that contract.
// Cross-row and JSON invariants also live in the custom 0011 migration;
// Drizzle does not model SQLite triggers. Preserve them in future table rebuilds.
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const chapters = sqliteTable('chapters', {
 id: text('id').primaryKey(),
 ownerId: text('owner_id').notNull(),
 document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(),
 updatedAt: text('updated_at').notNull(),
}, table => [index('idx_chapters_owner_created').on(table.ownerId,table.createdAt,table.id)]);

export const scenes = sqliteTable('scenes', {
 id: text('id').primaryKey(),
 ownerId: text('owner_id').notNull(),
 chapterId: text('chapter_id').notNull().references(()=>chapters.id),
 document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(),
 updatedAt: text('updated_at').notNull(),
}, table => [index('idx_scenes_owner_chapter_created').on(table.ownerId,table.chapterId,table.createdAt,table.id)]);

export const loreEntries = sqliteTable('lore_entries', {
 id: text('id').primaryKey(),
 ownerId: text('owner_id').notNull(),
 document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(),
 updatedAt: text('updated_at').notNull(),
}, table => [index('idx_lore_entries_owner_updated').on(table.ownerId,table.updatedAt)]);

export const storyArcs = sqliteTable('story_arcs', {
 id: text('id').primaryKey(),
 ownerId: text('owner_id').notNull(),
 document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 createdAt: text('created_at').notNull(),
 updatedAt: text('updated_at').notNull(),
}, table => [index('idx_story_arcs_owner_updated').on(table.ownerId,table.updatedAt)]);

export const characterDrafts = sqliteTable('character_drafts', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
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
 schemaVersion: integer('schema_version').notNull().default(1),
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
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('idx_country_profiles_owner_location').on(table.ownerId,table.locationId)]);

export const cityProfiles = sqliteTable('city_profiles', {
 ownerId: text('owner_id').notNull(),
 locationId: text('location_id').notNull(),
 document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('idx_city_profiles_owner_location').on(table.ownerId,table.locationId)]);

export const locationDetails = sqliteTable('location_details', {
 ownerId: text('owner_id').notNull(),
 locationId: text('location_id').notNull(),
 document: text('document').notNull(),
 schemaVersion: integer('schema_version').notNull().default(1),
 version: integer('version').notNull().default(1),
 // Existing profiles have no historical edit time; null means unknown.
 updatedAt: text('updated_at'),
}, table => [uniqueIndex('idx_location_details_owner_location').on(table.ownerId,table.locationId)]);
