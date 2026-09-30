import {memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {WritingEditor} from './Editor';
import {requestWritingJSON as requestJSON} from './request';
import {SceneCard, type SceneBook} from './SceneCard';
import {emptyWritingContent, readSceneRecord, readSceneSummary, serializeScene, type ChapterRecord, type SceneRecord, type SceneStatus, type WritingContent} from './contracts';
import {announceWorkspaceChange, observeWorkspaceChanges} from '../../public/profiles/workspace-events.js';

type Draft = {record: SceneRecord; initialContent: WritingContent; dirty: boolean; saving: boolean; error: string; revision: number; generation: number; unavailable?: boolean};
type Change = Partial<Pick<SceneRecord, 'title' | 'summary' | 'status' | 'content'>>;
const newDraft = (record: SceneRecord, generation = 0): Draft => ({record, initialContent: record.content, dirty: false, saving: false, error: '', revision: 0, generation});
const statusLabels: Record<SceneStatus, string> = {draft: 'Draft', revising: 'Revising', complete: 'Complete'};
/** Each scene keeps its own mounted editor and explicit optimistic save. */
export function ChapterScenes({chapter, initialScenes, book, host}: {chapter: ChapterRecord; initialScenes: SceneRecord[]; book: SceneBook; host: HTMLElement}) {
  const [drafts, setDrafts] = useState(() => initialScenes.map(scene => newDraft(scene))), draftsRef = useRef(drafts);
  const [composer, setComposer] = useState(false), [composerDirty, setComposerDirty] = useState(false), [parentDisabled, setParentDisabled] = useState(false), [refreshError, setRefreshError] = useState('');
  const mounted = useRef(true), saves = useRef(new Map<string, AbortController>()), refreshRequest = useRef<AbortController | null>(null), ownChange = useRef(false);
  useLayoutEffect(() => {
    // The shared metadata controller uses native form listeners. Catch native
    // events at the React root too, including changes that React does not turn
    // into a synthetic onChange. Other listeners on this same root still run.
    const contain = (event: Event) => event.stopPropagation();
    host.addEventListener('input', contain); host.addEventListener('change', contain);
    return () => {host.removeEventListener('input', contain); host.removeEventListener('change', contain);};
  }, [host]);
  const store = useCallback((update: (previous: Draft[]) => Draft[]) => {const next = update(draftsRef.current); draftsRef.current = next; setDrafts(next);}, []);
  const announce = useCallback(() => {ownChange.current = true; announceWorkspaceChange(); ownChange.current = false;}, []);
  // Keep accepting edits while a request is in flight. The save response only
  // clears dirty state when no newer local revision has been made.
  const change = useCallback((id: string, fields: Change) => store(previous => previous.map(draft => draft.record.id === id && !draft.unavailable ? {...draft, record: {...draft.record, ...fields}, dirty: true, revision: draft.revision + 1, error: ''} : draft)), [store]);
  const save = useCallback(async (id: string) => {
    const draft = draftsRef.current.find(item => item.record.id === id);
    if (!draft || !draft.dirty || draft.saving || draft.unavailable || saves.current.has(id) || host.closest('fieldset')?.disabled) return;
    let payload;
    try {payload = serializeScene(draft.record);} catch (error) {store(previous => previous.map(item => item.record.id === id ? {...item, error: error instanceof Error ? error.message : 'Check this scene before saving.'} : item)); return;}
    const controller = new AbortController(); saves.current.set(id, controller);
    refreshRequest.current?.abort();
    store(previous => previous.map(item => item.record.id === id ? {...item, saving: true, error: ''} : item));
    try {
      const saved = readSceneRecord(await requestJSON('/api/scenes/' + encodeURIComponent(id), {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal}));
      if (saved.id !== id || saved.chapterId !== chapter.id || saved.novelId !== undefined && saved.novelId !== chapter.novelId || saved.version !== draft.record.version + 1) throw new Error('The save response could not be verified. Your writing is still here.');
      if (!mounted.current || controller.signal.aborted) return;
      store(previous => previous.map(item => item.record.id === id ? {...item, record: item.revision === draft.revision ? saved : {...item.record, version: saved.version}, dirty: item.revision !== draft.revision, saving: false, error: ''} : item));
      announce();
    } catch (error) {if (mounted.current && !controller.signal.aborted) store(previous => previous.map(item => item.record.id === id ? {...item, saving: false, error: error instanceof Error ? error.message : 'Your scene could not be saved. Your writing is still here.'} : item));}
    finally {saves.current.delete(id);}
  }, [chapter, host, store, announce]);

  const refresh = useCallback(async () => {
    if (ownChange.current) return;
    refreshRequest.current?.abort();
    const controller = new AbortController(); refreshRequest.current = controller;
    const query = new URLSearchParams({chapterId: chapter.id, _refresh: crypto.randomUUID()});
    if (chapter.novelId) query.set('novelId', chapter.novelId);
    let catalogRead = false;
    try {
      const catalog = await requestJSON('/api/scenes?' + query, {signal: controller.signal}) as {scenes?: unknown[]};
      catalogRead = true;
      if (!Array.isArray(catalog.scenes)) throw new Error('The scene list could not be refreshed. Your writing is still here.');
      const summaries = catalog.scenes.map(readSceneSummary);
      if (summaries.some(scene => scene.chapterId !== chapter.id || scene.novelId !== undefined && scene.novelId !== chapter.novelId)) throw new Error('The scene context could not be verified.');
      const current = draftsRef.current;
      const records = await Promise.all(summaries.map(async scene => {
        const known = current.find(draft => draft.record.id === scene.id);
        if (known && (known.dirty || known.saving || known.record.version === scene.version)) return known.record;
        const record = readSceneRecord(await requestJSON('/api/scenes/' + encodeURIComponent(scene.id) + '?_refresh=' + crypto.randomUUID(), {signal: controller.signal}));
        if (record.id !== scene.id || record.chapterId !== chapter.id || record.novelId !== undefined && record.novelId !== chapter.novelId) throw new Error('The scene context could not be verified.');
        return record;
      }));
      if (!mounted.current || controller.signal.aborted) return;
      store(previous => {
        const next = records.map(record => {
          const known = previous.find(draft => draft.record.id === record.id);
          return known && (known.dirty || known.saving || known.record.version >= record.version) ? {...known, unavailable: false} : newDraft(record, (known?.generation || 0) + 1);
        });
        const existing = new Set(records.map(record => record.id));
        previous.filter(draft => !existing.has(draft.record.id)).forEach(draft => {
          // A scene created after this catalog request started is not deleted.
          if (!current.some(item => item.record.id === draft.record.id)) next.push(draft);
          else if (draft.dirty || draft.saving) next.push({...draft, unavailable: true});
        });
        return next;
      });
      setRefreshError('');
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) {
        if (!catalogRead && error instanceof Error && 'status' in error && error.status === 404) store(previous => previous.filter(draft => draft.dirty || draft.saving).map(draft => ({...draft, unavailable: true})));
        setRefreshError(error instanceof Error ? error.message : 'The scenes could not be refreshed.');
      }
    }
  }, [chapter, store]);
  useEffect(() => {
    mounted.current = true;
    const stop = observeWorkspaceChanges(() => {void refresh();}), focused = () => {void refresh();}, visible = () => {if (document.visibilityState === 'visible') void refresh();};
    window.addEventListener('focus', focused); document.addEventListener('visibilitychange', visible);
    const fieldset = host.closest('fieldset');
    const observer = new MutationObserver(() => setParentDisabled(Boolean(fieldset?.disabled)));
    if (fieldset) {setParentDisabled(fieldset.disabled); observer.observe(fieldset, {attributes: true, attributeFilter: ['disabled']});}
    return () => {mounted.current = false; stop(); observer.disconnect(); window.removeEventListener('focus', focused); document.removeEventListener('visibilitychange', visible); refreshRequest.current?.abort(); saves.current.forEach(controller => controller.abort());};
  }, [host, refresh]);
  const dirty = drafts.some(draft => draft.dirty || draft.saving) || composerDirty;
  useLayoutEffect(() => {host.dataset.dirty = String(dirty);}, [host, dirty]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {if (host.dataset.dirty === 'true') {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [host]);
  useEffect(() => {const count = document.getElementById('chapter-scene-count'); if (count) count.textContent = String(drafts.filter(draft => !draft.unavailable).length);}, [drafts]);
  useEffect(() => {
    const button = document.getElementById('chapter-new-scene');
    if (!(button instanceof HTMLButtonElement)) return;
    const openComposer = () => {if (!host.closest('fieldset')?.disabled) setComposer(true);};
    button.disabled = parentDisabled || Boolean(host.closest('fieldset')?.disabled);
    button.addEventListener('click', openComposer);
    return () => {button.removeEventListener('click', openComposer); button.disabled = true;};
  }, [host, parentDisabled]);
  function shortcut(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
    event.preventDefault(); event.stopPropagation();
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-scene-id]')?.dataset.sceneId;
    if (id) void save(id);
  }
  return <div className="chapter-scenes-workspace" onInput={event => event.stopPropagation()} onChange={event => event.stopPropagation()} onKeyDown={shortcut}>
    {refreshError && <p className="chapter-scene-error" role="alert">{refreshError}</p>}
    {drafts.map(draft => <InlineScene key={draft.record.id + ':' + draft.generation} draft={draft} book={book} parentDisabled={parentDisabled} onChange={change} onSave={save}/>)}
    {!drafts.length && <div className="chapter-scenes-empty"><SceneCard book={book} onCreate={() => setComposer(true)} disabled={parentDisabled}/></div>}
    {composer && <SceneComposer chapter={chapter} onDirty={setComposerDirty} onClose={() => {setComposer(false); setComposerDirty(false);}} onComplete={record => {refreshRequest.current?.abort(); store(previous => previous.some(draft => draft.record.id === record.id) ? previous : [...previous, newDraft(record)]); setComposer(false); setComposerDirty(false); announce(); requestAnimationFrame(() => host.querySelector<HTMLElement>('[data-scene-id="' + record.id + '"] textarea')?.focus());}}/>}
  </div>;
}

const InlineScene = memo(function InlineScene({draft, book, parentDisabled, onChange, onSave}: {draft: Draft; book: SceneBook; parentDisabled: boolean; onChange: (id: string, fields: Change) => void; onSave: (id: string) => Promise<void>}) {
  const scene = draft.record, blocked = draft.unavailable || parentDisabled;
  const editorId = 'chapter-scene-editor-' + scene.id;
  const onContent = useCallback((content: WritingContent) => onChange(scene.id, {content}), [onChange, scene.id]);
  return <article className="chapter-inline-scene" data-scene-id={scene.id} aria-label={scene.title || 'Untitled scene'}>
    <SceneCard book={book} scene={scene} disabled={parentDisabled} readOnly={draft.unavailable} onChange={fields => onChange(scene.id, fields)}
      footer={<div className="chapter-scene-meta"><label><span>Status</span><select aria-label="Scene status" value={scene.status} disabled={blocked} onChange={event => onChange(scene.id, {status: event.target.value as SceneStatus})}>{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label></div>}/>
    {draft.unavailable && <p className="chapter-scene-error" role="alert">This scene was deleted or moved to another chapter. Your unsaved writing is kept here so you can copy it.</p>}
    {draft.error && <p className="chapter-scene-error" role="alert">{draft.error}</p>}
    <div id={editorId} className="chapter-scene-editor-panel">
      <WritingEditor sceneId={scene.id} initialContent={draft.initialContent} editable={!blocked} inlineScene saveState={draft.saving ? 'saving' : draft.unavailable ? 'unavailable' : draft.error ? 'error' : draft.dirty ? 'dirty' : 'saved'} saveError={draft.error} saveDisabled={blocked || draft.saving || !draft.dirty} onSave={() => {void onSave(scene.id);}} onUpdate={onContent}/>
    </div>
  </article>;
});

function SceneComposer({chapter, onDirty, onClose, onComplete}: {chapter: ChapterRecord; onDirty: (dirty: boolean) => void; onClose: () => void; onComplete: (record: SceneRecord) => void}) {
  const [title, setTitle] = useState(''), [summary, setSummary] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLTextAreaElement>(null), id = useRef(crypto.randomUUID()), inFlight = useRef(false), mounted = useRef(true), request = useRef<AbortController | null>(null), recovered = useRef<SceneRecord | null>(null);
  useEffect(() => {mounted.current = true; const element = dialog.current!, previous = document.activeElement; element.showModal(); input.current?.focus(); return () => {mounted.current = false; request.current?.abort(); if (element.open) element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll: true});};}, []);
  useLayoutEffect(() => {onDirty(Boolean(title || summary || busy));}, [title, summary, busy, onDirty]);
  async function create() {
    if (inFlight.current) return;
    if (!title.trim() || title.length > 160) {setError('Enter a scene title of 1–160 characters.'); input.current?.focus(); return;}
    if (summary.length > 10000) {setError('Keep the scene summary under 10,000 characters.'); return;}
    const controller = new AbortController(); request.current = controller; inFlight.current = true; setBusy(true); setError('');
    try {
      let record: SceneRecord;
      if (recovered.current) record = recovered.current;
      else {
        record = readSceneRecord(await requestJSON('/api/scenes', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({id: id.current, chapterId: chapter.id, title, summary, status: 'draft', contentSchemaVersion: 1, content: emptyWritingContent()}), signal: controller.signal}));
        if (record.id !== id.current || record.chapterId !== chapter.id || record.novelId !== undefined && record.novelId !== chapter.novelId) throw new Error('The saved scene context could not be verified. Your changes are still here.');
        recovered.current = record;
      }
      // POST retries return the already-created record. Preserve its version and
      // reconcile the current composer only through a checked optimistic write.
      if (record.title !== title.trim().replace(/\s+/g, ' ') || record.summary !== summary) {
        const previousVersion = record.version;
        record = readSceneRecord(await requestJSON('/api/scenes/' + encodeURIComponent(record.id), {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(serializeScene({...record, title, summary})), signal: controller.signal}));
        if (record.id !== id.current || record.chapterId !== chapter.id || record.novelId !== undefined && record.novelId !== chapter.novelId || record.version !== previousVersion + 1) throw new Error('The saved scene could not be verified. Your changes are still here.');
        recovered.current = record;
      }
      if (!mounted.current || controller.signal.aborted) return;
      onComplete(record);
    } catch (error) {if (mounted.current && !controller.signal.aborted) setError(error instanceof Error ? error.message : 'This scene could not be created. Your changes are still here.');}
    finally {inFlight.current = false; if (mounted.current) setBusy(false);}
  }
  return createPortal(<dialog ref={dialog} className="writing-dialog chapter-scene-dialog" aria-label="New scene" onCancel={event => {event.preventDefault(); if (!busy) onClose();}} onKeyDown={event => {if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {event.preventDefault(); event.stopPropagation(); void create();}}}>
    <div className="writing-dialog-heading"><h2>New scene</h2><button type="button" className="writing-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
    <p className="section-note">{chapter.title}</p>
    <label>Scene title<textarea ref={input} aria-label="Scene title" rows={2} maxLength={160} disabled={busy} value={title} onChange={event => setTitle(event.target.value)}/></label>
    <label>Scene summary<textarea aria-label="Scene summary" rows={4} maxLength={10000} disabled={busy} value={summary} onChange={event => setSummary(event.target.value)}/></label>
    {error && <p className="chapter-scene-error" role="alert">{error}</p>}
    <div className="writing-dialog-actions"><button type="button" className="writing-button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="writing-button writing-primary" disabled={busy} onClick={() => {void create();}}>{busy ? 'Creating…' : 'Create scene'}</button></div>
  </dialog>, document.body);
}
