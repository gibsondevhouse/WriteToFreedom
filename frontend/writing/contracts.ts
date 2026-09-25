import {validateWritingContent, emptyWritingContent as blankContent} from '../../public/writing/document.js';

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
export interface ChapterRecord {id: string; version: number; title: string; summary: string; createdAt: string; updatedAt: string}
export interface SceneSummary extends ChapterRecord {chapterId: string; status: SceneStatus; contentSchemaVersion: 1}
export interface SceneRecord extends SceneSummary {content: WritingContent}
export type SaveScenePayload = Pick<SceneRecord, 'title' | 'summary' | 'chapterId' | 'status' | 'contentSchemaVersion' | 'content' | 'version'>;
export type SaveChapterPayload = Pick<ChapterRecord, 'title' | 'summary' | 'version'>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The writing response could not be read. Try loading it again.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('The writing response contains an unreadable field.');
  return value;
}
export function readChapterRecord(value: unknown): ChapterRecord {
  const data = record(value);
  if (!Number.isInteger(data.version) || Number(data.version) < 1) throw new Error('Reload this item before saving.');
  return {id: text(data.id), version: Number(data.version), title: text(data.title), summary: text(data.summary), createdAt: text(data.createdAt), updatedAt: text(data.updatedAt)};
}
export function readSceneSummary(value: unknown): SceneSummary {
  const data = record(value);
  if (data.contentSchemaVersion !== 1) throw new Error('This scene uses an unsupported document format. Your saved writing has not been changed.');
  if (!['draft', 'revising', 'complete'].includes(String(data.status))) throw new Error('This scene has an unreadable drafting status.');
  return {...readChapterRecord(data), chapterId: text(data.chapterId), status: data.status as SceneStatus, contentSchemaVersion: 1};
}
export function readSceneRecord(value: unknown): SceneRecord {
  return {...readSceneSummary(value), content: validateWritingContent(record(value).content) as WritingContent};
}
export function emptyWritingContent(): WritingContent {return blankContent() as WritingContent;}

/** Keep catalog/display metadata outside the writable document contract. */
export function serializeChapter(chapter: ChapterRecord): SaveChapterPayload {
  if (!chapter.title.trim() || chapter.title.length > 160) throw new Error('Enter a chapter title of 1–160 characters.');
  if (chapter.summary.length > 10000) throw new Error('Keep the chapter summary under 10,000 characters.');
  return {title: chapter.title, summary: chapter.summary, version: chapter.version};
}
export function serializeScene(scene: SceneRecord): SaveScenePayload {
  if (!scene.title.trim() || scene.title.length > 160) throw new Error('Enter a scene title of 1–160 characters.');
  if (scene.summary.length > 10000) throw new Error('Keep the scene summary under 10,000 characters.');
  return {title: scene.title, summary: scene.summary, chapterId: scene.chapterId, status: scene.status, contentSchemaVersion: 1, content: validateWritingContent(scene.content) as WritingContent, version: scene.version};
}
