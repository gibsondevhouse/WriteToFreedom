import {validateWritingContent, writingContentSchemaVersion, emptyWritingContent as blankContent} from '../../public/writing/document.js';

export type WritingMark = {type: 'bold' | 'italic' | 'strike' | 'underline' | 'code'};
export interface WritingNode {
  type: 'paragraph' | 'heading' | 'text' | 'bulletList' | 'orderedList' | 'listItem' | 'blockquote' | 'horizontalRule' | 'hardBreak';
  attrs?: {level?: number; start?: number; type?: '1' | 'a' | 'A' | 'i' | 'I' | null};
  content?: WritingNode[];
  text?: string;
  marks?: WritingMark[];
}
export interface WritingContent {type: 'doc'; content: WritingNode[]}
export type SceneStatus = 'draft' | 'revising' | 'complete';
export interface ChapterRecord {id: string; schemaVersion: 1; version: number; title: string; summary: string; novelId?: string; createdAt: string; updatedAt: string}
export interface SceneSummary extends ChapterRecord {chapterId: string; status: SceneStatus; contentSchemaVersion: 1}
export interface SceneRecord extends SceneSummary {content: WritingContent}
export type SaveScenePayload = Pick<SceneRecord, 'title' | 'summary' | 'chapterId' | 'status' | 'contentSchemaVersion' | 'content' | 'schemaVersion' | 'version'>;
export type SaveChapterPayload = Pick<ChapterRecord, 'title' | 'summary' | 'schemaVersion' | 'version'>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The writing response could not be read. Try loading it again.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('The writing response contains an unreadable field.');
  return value;
}
function identifier(value: unknown): string {
  const id = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('The writing response contains an unreadable ID.');
  return id;
}
function timestamp(value: unknown): string {
  const date = text(value), milliseconds = Date.parse(date);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== date) throw new Error('The writing response contains an unreadable timestamp.');
  return date;
}
export function readChapterRecord(value: unknown): ChapterRecord {
  const data = record(value);
  if (data.schemaVersion !== 1) throw new Error('This writing entry uses an unsupported data format. Your saved writing has not been changed.');
  if (!Number.isSafeInteger(data.version) || Number(data.version) < 1) throw new Error('Reload this item before saving.');
  const title = text(data.title), summary = text(data.summary);
  if (!title.trim() || title.length > 160 || summary.length > 10000) throw new Error('The writing response contains unreadable metadata.');
  return {id: identifier(data.id), schemaVersion: 1, version: Number(data.version), title, summary, ...(data.novelId ? {novelId: identifier(data.novelId)} : {}), createdAt: timestamp(data.createdAt), updatedAt: timestamp(data.updatedAt)};
}
export function readSceneSummary(value: unknown): SceneSummary {
  const data = record(value);
  if (data.contentSchemaVersion !== writingContentSchemaVersion) throw new Error('This scene uses an unsupported document format. Your saved writing has not been changed.');
  if (typeof data.status !== 'string' || !['draft', 'revising', 'complete'].includes(data.status)) throw new Error('This scene has an unreadable drafting status.');
  return {...readChapterRecord(data), chapterId: identifier(data.chapterId), status: data.status as SceneStatus, contentSchemaVersion: writingContentSchemaVersion};
}
export function readSceneRecord(value: unknown): SceneRecord {
  return {...readSceneSummary(value), content: validateWritingContent(record(value).content) as WritingContent};
}
export function emptyWritingContent(): WritingContent {return blankContent() as WritingContent;}

/** Keep catalog/display metadata outside the writable document contract. */
export function serializeChapter(chapter: ChapterRecord): SaveChapterPayload {
  if (chapter.schemaVersion !== 1 || !Number.isSafeInteger(chapter.version) || chapter.version < 1 || chapter.version === Number.MAX_SAFE_INTEGER) throw new Error('Reload this item before saving.');
  if (!chapter.title.trim() || chapter.title.length > 160) throw new Error('Enter a chapter title of 1–160 characters.');
  if (chapter.summary.length > 10000) throw new Error('Keep the chapter summary under 10,000 characters.');
  return {title: chapter.title, summary: chapter.summary, schemaVersion: 1, version: chapter.version};
}
export function serializeScene(scene: SceneRecord): SaveScenePayload {
  if (scene.schemaVersion !== 1 || !Number.isSafeInteger(scene.version) || scene.version < 1 || scene.version === Number.MAX_SAFE_INTEGER) throw new Error('Reload this item before saving.');
  if (scene.contentSchemaVersion !== writingContentSchemaVersion) throw new Error('This scene uses an unsupported document format. Your saved writing has not been changed.');
  identifier(scene.chapterId);
  if (!['draft', 'revising', 'complete'].includes(scene.status)) throw new Error('Choose Draft, Revising, or Complete as the scene status.');
  if (!scene.title.trim() || scene.title.length > 160) throw new Error('Enter a scene title of 1–160 characters.');
  if (scene.summary.length > 10000) throw new Error('Keep the scene summary under 10,000 characters.');
  return {title: scene.title, summary: scene.summary, chapterId: scene.chapterId, status: scene.status, schemaVersion: 1, contentSchemaVersion: writingContentSchemaVersion, content: validateWritingContent(scene.content) as WritingContent, version: scene.version};
}
