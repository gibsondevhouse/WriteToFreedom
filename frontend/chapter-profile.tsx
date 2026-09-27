import {createRoot} from 'react-dom/client';
import {ChapterScenes} from './writing/ChapterScenes';
import {readChapterRecord, readSceneRecord} from './writing/contracts';
import type {SceneBook} from './writing/SceneCard';

const host = document.getElementById('chapter-scenes-editor');
if (host) {
  try {
    const data = JSON.parse(document.getElementById('chapter-scenes-data')!.textContent!);
    const chapter = readChapterRecord(data.chapter);
    const novel = data.novel;
    if (!novel || novel.id !== chapter.novelId || typeof novel.title !== 'string' || typeof novel.coverUrl !== 'string') throw new Error('The novel context could not be verified.');
    let coverUrl = '';
    try {const cover = new URL(novel.coverUrl); if (cover.protocol === 'https:' && !cover.username && !cover.password && !/\s/.test(novel.coverUrl)) coverUrl = novel.coverUrl;} catch {}
    const book: SceneBook = {id: novel.id, title: novel.title || 'Untitled novel', coverUrl};
    if (!Array.isArray(data.scenes)) throw new Error('The scenes could not be read.');
    const scenes = (data.scenes as unknown[]).map(readSceneRecord);
    if (scenes.some(scene => scene.chapterId !== chapter.id || scene.novelId !== undefined && scene.novelId !== chapter.novelId)) throw new Error('The scene context could not be verified.');
    createRoot(host).render(<ChapterScenes chapter={chapter} initialScenes={scenes} book={book} host={host}/>);
  } catch (error) {
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = error instanceof Error ? error.message : 'The scene editor could not be opened. Your saved writing has not been changed.';
    host.append(message);
  }
}
