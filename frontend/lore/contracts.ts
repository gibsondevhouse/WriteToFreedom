import {loreTemplates, validImageUrl} from '../../public/lore/template.js';
import {cleanNoteReference, referenceKey} from '../../public/characters/notes.js';

export const textFields = ['name', 'alternateNames', 'tags', 'imageUrl', 'introduction', 'summary', 'significance', 'conflict', 'truth', 'beliefs', 'knowledge', 'history', 'body', 'sources', 'originDate', 'questions'] as const;
export type TextField = typeof textFields[number];
export type NoteText = Record<TextField, string>;
export type NoteReference = {kind: 'character' | 'location' | 'faction' | 'lore'; id: string} | {kind: 'note'; id: string; characterId: string};
export interface NoteTarget {reference: NoteReference; label: string; group: string; detail: string; href: string}
export interface Backlink {href: string; title: string; source: string; text: string}
export interface Connection {target: NoteReference; relationship: string}
export const ratingFields = [['clarity', 'Clarity'], ['reliability', 'Reliability'], ['relevance', 'Relevance'], ['completeness', 'Completeness']] as const;
export type RatingKey = typeof ratingFields[number][0];
export type ProfileRatings = Partial<Record<RatingKey, number>>;
export type LoreNoteDocument = NoteText & {type: 'note'; hiddenFields: TextField[]; collections: ['notes']; pinned: boolean; featured: boolean; connections: Connection[]; profileRatings: ProfileRatings};
export type LoreNoteRecord = LoreNoteDocument & {id: string; version: number};
export interface ProfileData {record: LoreNoteRecord; targets: NoteTarget[]; incoming: Backlink[]}
export type ConnectionDraft = {key: string; target: NoteReference | null; relationship: string};
export type LoreNoteDraft = Omit<LoreNoteDocument, 'connections' | 'profileRatings'> & {connections: ConnectionDraft[]; profileRatings: Record<RatingKey, string>};
export type SaveNotePayload = LoreNoteDocument & {version: number};
export type FieldDefinition = [TextField, string, 'input' | 'textarea' | 'url' | 'date'];
export interface SectionDefinition {id: string; title: string; fields: FieldDefinition[]}
export const noteTemplate = loreTemplates.note as {sections: SectionDefinition[]; fields: TextField[]; hideableFields: TextField[]};
export {referenceKey, validImageUrl};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('This note could not be read. Reload to try again.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('This note contains an unreadable field. Reload to try again.');
  return value;
}
function reference(value: unknown): NoteReference { return cleanNoteReference(value) as NoteReference; }
function localHref(value: unknown): string {
  const href = string(value);
  if (!href.startsWith('/') || href.startsWith('//')) throw new Error('This note contains an unreadable link.');
  return href;
}

/** Read API documents separately from display projections; neither is a write payload. */
export function readNoteRecord(value: unknown): LoreNoteRecord {
  const data = object(value);
  if (data.type !== 'note' || typeof data.id !== 'string' || !Number.isInteger(data.version) || Number(data.version) < 1) throw new Error('Reload this note before editing.');
  if (typeof data.pinned !== 'boolean' || typeof data.featured !== 'boolean' || !Array.isArray(data.connections) || !Array.isArray(data.hiddenFields) || !Array.isArray(data.collections) || data.collections.some(c => c !== 'notes') || !data.collections.includes('notes')) throw new Error('This note could not be read. Reload to try again.');
  const fields = Object.fromEntries(textFields.map(key => [key, string(data[key])])) as NoteText;
  const hiddenFields = data.hiddenFields.map(key => {
    if (typeof key !== 'string' || !noteTemplate.hideableFields.includes(key as TextField)) throw new Error('This note contains an unreadable hidden field.');
    return key as TextField;
  });
  const profileRatings: ProfileRatings = {};
  for (const [key, rating] of Object.entries(object(data.profileRatings ?? {}))) {
    if (!ratingFields.some(([allowed]) => allowed === key) || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 0 || rating > 99) throw new Error('This note contains an unreadable rating.');
    profileRatings[key as RatingKey] = rating;
  }
  return {...fields, type: 'note', id: data.id, version: Number(data.version), hiddenFields, collections: ['notes'], pinned: data.pinned, featured: data.featured, profileRatings,
    connections: data.connections.map(value => {const entry = object(value); return {target: reference(entry.target), relationship: string(entry.relationship)};})};
}
export function readProfileData(value: unknown): ProfileData {
  const data = object(value);
  if (!Array.isArray(data.targets) || !Array.isArray(data.incoming)) throw new Error('This note could not be read. Reload to try again.');
  return {record: readNoteRecord(data.record), targets: data.targets.map(value => {const target = object(value); return {reference: reference(target), label: string(target.label), group: string(target.group), detail: typeof target.detail === 'string' ? target.detail : '', href: localHref(target.href)};}),
    incoming: data.incoming.map(value => {const item = object(value); return {href: localHref(item.href), title: string(item.title), source: string(item.source), text: string(item.text)};})};
}
export function draftFromRecord(record: LoreNoteRecord): LoreNoteDraft {
  return {...record, hiddenFields: [...record.hiddenFields], connections: record.connections.map(connection => ({...connection, key: crypto.randomUUID()})), profileRatings: Object.fromEntries(ratingFields.map(([key]) => [key, record.profileRatings[key]?.toString() ?? ''])) as Record<RatingKey, string>};
}

/** Explicit allowlist: display data, local row keys, IDs, and metadata never enter writes. */
export function serializeNote(draft: LoreNoteDraft, version: number): SaveNotePayload {
  const fields = Object.fromEntries(textFields.map(key => [key, draft[key]])) as NoteText;
  if (!fields.name.trim()) throw new Error('Enter a name for this entry.');
  for (const key of textFields) if (fields[key].length > (key === 'name' ? 160 : key === 'imageUrl' ? 2048 : 10000)) throw new Error('One or more fields exceed the allowed length.');
  if (!validImageUrl(fields.imageUrl)) throw new Error('Use an HTTPS image URL.');
  const profileRatings: ProfileRatings = {};
  for (const [key] of ratingFields) {
    const value = draft.profileRatings[key];
    if (value === '') continue;
    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 0 || rating > 99) throw new Error('Use whole-number ratings from 0 to 99.');
    profileRatings[key] = rating;
  }
  if (draft.connections.length > 60) throw new Error('Keep at most 60 connections per entry.');
  const seen = new Set<string>();
  const connections = draft.connections.map(connection => {
    if (!connection.target) throw new Error('Choose a connected entry.');
    const target = reference(connection.target), key = referenceKey(target);
    if (seen.has(key)) throw new Error('Each connected entry should appear only once.');
    seen.add(key);
    if (!connection.relationship.trim() || connection.relationship.length > 160) throw new Error('Describe each connection in 160 characters or fewer.');
    return {target, relationship: connection.relationship};
  });
  return {...fields, type: 'note', version, hiddenFields: [...draft.hiddenFields], collections: ['notes'], profileRatings, pinned: draft.pinned, featured: draft.featured, connections};
}
