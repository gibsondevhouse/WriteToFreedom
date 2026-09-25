import {memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {WritingEditor} from './Editor';
import {emptyWritingContent, readChapterRecord, readSceneRecord, readSceneSummary, serializeChapter, serializeScene, type ChapterRecord, type SceneRecord, type SceneStatus, type SceneSummary, type WritingContent} from './contracts';
import {announceWorkspaceChange} from '../../public/profiles/workspace-events.js';

type SceneDraft = {record: SceneRecord; initialContent: WritingContent; dirty: boolean; saving: boolean; error: string; revision: number};
type Drafts = Record<string, SceneDraft>;
type SceneChange = Partial<Pick<SceneRecord, 'title' | 'summary' | 'status' | 'chapterId' | 'content'>>;
type Composer = {kind: 'chapter'; chapter?: ChapterRecord} | {kind: 'scene'; chapterId: string};
const statusLabels: Record<SceneStatus, string> = {draft: 'Draft', revising: 'Revising', complete: 'Complete'};

async function requestJSON(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, {credentials: 'same-origin', cache: 'no-store', ...options});
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Your session may have expired. Copy your unsaved writing before reloading to sign in again.');
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'This request could not be completed. Please try again.');
  return data;
}
function collection(value: unknown, key: string): unknown[] {
  if (!value || typeof value !== 'object' || !(key in value) || !Array.isArray((value as Record<string, unknown>)[key])) throw new Error('The writing workspace could not be read. Please try again.');
  return (value as Record<string, unknown[]>)[key];
}
function summary(record: SceneRecord): SceneSummary {return readSceneSummary(record);}
function initialDraft(record: SceneRecord): SceneDraft {return {record, initialContent: record.content, dirty: false, saving: false, error: '', revision: 0};}
function Icon({name}: {name: 'outline' | 'reference' | 'plus' | 'edit'}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'outline' ? <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-11h4m-4 5h4"/></> : name === 'reference' ? <><path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v15"/></> : name === 'plus' ? <path d="M12 5v14M5 12h14"/> : <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/></>}</svg>;
}

/** Scene drafts and explicit writes belong here; each mounted editor owns its history. */
export function WritingWorkspace() {
  const [chapters, setChapters] = useState<ChapterRecord[]>([]), [scenes, setScenes] = useState<SceneSummary[]>([]), [drafts, setDrafts] = useState<Drafts>({}), draftsRef = useRef<Drafts>({});
  const [selectedId, setSelectedId] = useState(() => new URL(location.href).searchParams.get('scene') || ''), [catalogLoading, setCatalogLoading] = useState(true), [catalogError, setCatalogError] = useState(''), [catalogAttempt, setCatalogAttempt] = useState(0);
  const [sceneLoading, setSceneLoading] = useState(''), [loadError, setLoadError] = useState(''), [loadAttempt, setLoadAttempt] = useState(0), [composer, setComposer] = useState<Composer | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(() => matchMedia('(min-width: 950px)').matches), [referencesOpen, setReferencesOpen] = useState(false);
  const mounted = useRef(true), saves = useRef(new Map<string, AbortController>());
  const storeDraft = useCallback((id: string, update: (previous: SceneDraft | undefined) => SceneDraft) => {
    const next = {...draftsRef.current, [id]: update(draftsRef.current[id])}; draftsRef.current = next; setDrafts(next);
  }, []);
  const changeScene = useCallback((id: string, change: SceneChange) => {
    const current = draftsRef.current[id]; if (!current || current.saving) return;
    if (Object.entries(change).every(([key, value]) => current.record[key as keyof SceneRecord] === value)) return;
    storeDraft(id, previous => ({...previous!, record: {...previous!.record, ...change}, dirty: true, revision: previous!.revision + 1}));
  }, [storeDraft]);
  const chooseScene = useCallback((id: string) => {
    setSelectedId(id); setLoadError('');
    const url = new URL(location.href); url.searchParams.set('scene', id); history.replaceState(history.state, '', url);
  }, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; saves.current.forEach(controller => controller.abort());};}, []);
  useEffect(() => {
    const controller = new AbortController(); setCatalogLoading(true); setCatalogError('');
    Promise.all([requestJSON('/api/chapters', {signal: controller.signal}), requestJSON('/api/scenes', {signal: controller.signal})]).then(([chapterData, sceneData]) => {
      if (controller.signal.aborted) return;
      const nextChapters = collection(chapterData, 'chapters').map(readChapterRecord), nextScenes = collection(sceneData, 'scenes').map(readSceneSummary);
      setChapters(nextChapters); setScenes(nextScenes); setSelectedId(current => current || nextScenes[0]?.id || '');
    }).catch(error => {if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : 'Your chapters and scenes could not be loaded.');}).finally(() => {if (!controller.signal.aborted) setCatalogLoading(false);});
    return () => controller.abort();
  }, [catalogAttempt]);
  useEffect(() => {
    if (!selectedId || draftsRef.current[selectedId]) {setSceneLoading(''); setLoadError(''); return;}
    const controller = new AbortController(); setSceneLoading(selectedId); setLoadError('');
    requestJSON('/api/scenes/' + encodeURIComponent(selectedId), {signal: controller.signal}).then(value => {
      if (controller.signal.aborted) return;
      const record = readSceneRecord(value); if (record.id !== selectedId) throw new Error('The requested scene could not be verified.');
      storeDraft(selectedId, () => initialDraft(record));
    }).catch(error => {if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'This scene could not be opened.');}).finally(() => {if (!controller.signal.aborted) setSceneLoading('');});
    return () => controller.abort();
  }, [selectedId, loadAttempt, storeDraft]);
  const saveScene = useCallback(async (id: string) => {
    const draft = draftsRef.current[id]; if (!draft || draft.saving || saves.current.has(id)) return;
    let payload; try {payload = serializeScene(draft.record);} catch (error) {storeDraft(id, previous => ({...previous!, error: error instanceof Error ? error.message : 'Check this scene before saving.'})); return;}
    const controller = new AbortController(), revision = draft.revision; saves.current.set(id, controller);
    storeDraft(id, previous => ({...previous!, saving: true, error: ''}));
    try {
      const saved = readSceneRecord(await requestJSON('/api/scenes/' + encodeURIComponent(id), {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal}));
      if (saved.id !== id || saved.version !== draft.record.version + 1) throw new Error('The save response could not be verified. Your writing is still here.');
      if (!mounted.current || controller.signal.aborted) return;
      storeDraft(id, previous => ({...previous!, record: previous!.revision === revision ? saved : {...previous!.record, version: saved.version}, dirty: previous!.revision !== revision, saving: false, error: ''}));
      setScenes(previous => previous.map(scene => scene.id === id ? summary(saved) : scene)); announceWorkspaceChange();
    } catch (error) {if (mounted.current && !controller.signal.aborted) storeDraft(id, previous => ({...previous!, saving: false, error: error instanceof Error ? error.message : 'Your scene could not be saved. Your writing is still here.'}));}
    finally {saves.current.delete(id);}
  }, [storeDraft]);
  const selectedRef = useRef(selectedId); selectedRef.current = selectedId;
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {if (Object.values(draftsRef.current).some(draft => draft.dirty)) {event.preventDefault(); event.returnValue = '';}};
    const shortcut = (event: KeyboardEvent) => {if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !document.querySelector('dialog[open]')) {event.preventDefault(); if (selectedRef.current) void saveScene(selectedRef.current);}};
    window.addEventListener('beforeunload', unload); document.addEventListener('keydown', shortcut);
    return () => {window.removeEventListener('beforeunload', unload); document.removeEventListener('keydown', shortcut);};
  }, [saveScene]);
  const outlineScenes = useMemo(() => scenes.map(scene => drafts[scene.id] ? summary(drafts[scene.id].record) : scene), [scenes, drafts]);
  const selected = drafts[selectedId], dirtyCount = Object.values(drafts).filter(draft => draft.dirty).length;
  const createComplete = (record: ChapterRecord | SceneRecord) => {
    if ('content' in record) {storeDraft(record.id, () => initialDraft(record)); setScenes(previous => [...previous.filter(scene => scene.id !== record.id), summary(record)]); chooseScene(record.id);}
    else setChapters(previous => previous.some(chapter => chapter.id === record.id) ? previous.map(chapter => chapter.id === record.id ? record : chapter) : [...previous, record]);
    setComposer(null); announceWorkspaceChange();
  };
  return <main className="writing-workspace" id="writing-workspace">
    <header className="writing-heading"><div><p className="writing-eyebrow">Your manuscript</p><h1>Writing workspace</h1><p className="writing-description">A place for the story to take shape.</p></div><div className="writing-create-actions"><button type="button" className="writing-button" disabled={catalogLoading} onClick={() => setComposer({kind: 'chapter'})}><Icon name="plus"/>New chapter</button><button type="button" className="writing-button writing-primary" disabled={!chapters.length || catalogLoading} onClick={() => setComposer({kind: 'scene', chapterId: selected?.record.chapterId || chapters[0]?.id || ''})}><Icon name="plus"/>New scene</button></div></header>
    <div className="writing-viewbar"><div className="writing-panel-actions"><button type="button" className="writing-panel-toggle" aria-expanded={outlineOpen} aria-controls="writing-outline" onMouseDown={event => event.preventDefault()} onClick={() => setOutlineOpen(open => !open)}><Icon name="outline"/>{outlineOpen ? 'Hide outline' : 'Show outline'}</button><button type="button" className="writing-panel-toggle" aria-expanded={referencesOpen} aria-controls="writing-references" onMouseDown={event => event.preventDefault()} onClick={() => setReferencesOpen(open => !open)}><Icon name="reference"/>{referencesOpen ? 'Hide references' : 'Show references'}</button></div><span className="writing-draft-note">{dirtyCount ? `${dirtyCount} scene${dirtyCount === 1 ? '' : 's'} with unsaved changes` : 'Save when you’re ready'}</span></div>
    {catalogError && <div className="writing-banner" role="alert"><p>{catalogError}</p><button type="button" className="writing-button" onClick={() => setCatalogAttempt(attempt => attempt + 1)}>Retry loading workspace</button></div>}
    <div className={'writing-layout' + (outlineOpen ? ' with-outline' : '') + (referencesOpen ? ' with-references' : '')}>
      <aside id="writing-outline" className="writing-outline" aria-label="Manuscript outline" hidden={!outlineOpen}><div className="writing-panel-heading"><h2>Outline</h2><span>{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}</span></div>{catalogLoading ? <p role="status" className="writing-muted">Loading your manuscript…</p> : chapters.length ? chapters.map((chapter, index) => <ChapterOutline key={chapter.id} chapter={chapter} index={index} scenes={outlineScenes.filter(scene => scene.chapterId === chapter.id)} drafts={drafts} selectedId={selectedId} onSelect={chooseScene} onEdit={() => setComposer({kind: 'chapter', chapter})} onCreate={() => setComposer({kind: 'scene', chapterId: chapter.id})}/>) : <p className="writing-muted">Your chapters and scenes will appear here.</p>}</aside>
      <section className="writing-center" aria-label="Scene workspace" aria-busy={sceneLoading === selectedId && Boolean(selectedId)}>
        {!selectedId && <div className="writing-empty"><div className="writing-empty-symbol" aria-hidden="true">✦</div><p className="writing-eyebrow">The next page is yours</p><h2>{chapters.length ? 'Give your chapter its first scene.' : 'Every story begins somewhere.'}</h2><p>{chapters.length ? 'Create a scene, then make room for the words. Your outline and world notes will stay close by.' : 'Start with a chapter. Add scenes as your story grows, and save each one at your own pace.'}</p><button type="button" className="writing-button writing-primary" disabled={catalogLoading} onClick={() => setComposer(chapters.length ? {kind: 'scene', chapterId: chapters[0].id} : {kind: 'chapter'})}>{chapters.length ? 'Create your first scene' : 'Create your first chapter'}</button></div>}
        {sceneLoading === selectedId && !selected && <div className="writing-loading" role="status">Opening scene…</div>}
        {loadError && !selected && <div className="writing-banner" role="alert"><p>{loadError}</p><button type="button" className="writing-button" onClick={() => setLoadAttempt(attempt => attempt + 1)}>Retry opening scene</button></div>}
        {Object.entries(drafts).map(([id, draft]) => <ScenePane key={id} draft={draft} chapters={chapters} active={id === selectedId} onChange={changeScene} onSave={saveScene}/>)}
      </section>
      <ReferencePanel open={referencesOpen}/>
    </div>
    {composer && <ComposeDialog composer={composer} chapters={chapters} onClose={() => setComposer(null)} onComplete={createComplete}/>}
  </main>;
}

function ChapterOutline({chapter, index, scenes, drafts, selectedId, onSelect, onEdit, onCreate}: {chapter: ChapterRecord; index: number; scenes: SceneSummary[]; drafts: Drafts; selectedId: string; onSelect: (id: string) => void; onEdit: () => void; onCreate: () => void}) {
  const [open, setOpen] = useState(true);
  return <section className="writing-chapter"><div className="writing-chapter-heading"><button type="button" className="writing-chapter-toggle" aria-expanded={open} aria-controls={'chapter-scenes-' + chapter.id} onClick={() => setOpen(value => !value)}><span className="writing-chapter-number">{String(index + 1).padStart(2, '0')}</span><span>{chapter.title}</span><span aria-hidden="true">{open ? '⌄' : '›'}</span></button><button type="button" className="writing-icon-button" aria-label={'Edit chapter: ' + chapter.title} onClick={onEdit}><Icon name="edit"/></button></div><div id={'chapter-scenes-' + chapter.id} hidden={!open}><ul className="writing-scene-list">{scenes.map(scene => <li key={scene.id}><button type="button" className={'writing-scene-link' + (scene.id === selectedId ? ' is-selected' : '')} aria-label={'Open scene: ' + (scene.title || 'Untitled scene')} aria-current={scene.id === selectedId ? 'page' : undefined} onClick={() => onSelect(scene.id)}><span className={'writing-scene-dot status-' + scene.status} aria-hidden="true"/><span className="writing-scene-label"><span>{scene.title || 'Untitled scene'}</span><small>{drafts[scene.id]?.saving ? 'Saving…' : drafts[scene.id]?.error ? 'Save needs attention' : drafts[scene.id]?.dirty ? 'Unsaved' : statusLabels[scene.status]}</small></span>{drafts[scene.id]?.dirty && <span className="writing-unsaved-dot" aria-label="Unsaved changes">•</span>}</button></li>)}</ul>{!scenes.length && <p className="writing-chapter-empty">No scenes yet</p>}<button type="button" className="writing-add-scene" aria-label={'Add scene to ' + chapter.title} onClick={onCreate}><Icon name="plus"/>Add scene</button></div></section>;
}

const ScenePane = memo(function ScenePane({draft, chapters, active, onChange, onSave}: {draft: SceneDraft; chapters: ChapterRecord[]; active: boolean; onChange: (id: string, change: SceneChange) => void; onSave: (id: string) => Promise<void>}) {
  const scene = draft.record, onContent = useCallback((content: WritingContent) => onChange(scene.id, {content}), [scene.id, onChange]), form = useRef<HTMLFormElement>(null);
  const save = (event: FormEvent) => {event.preventDefault(); if (!form.current?.reportValidity()) return; void onSave(scene.id);};
  return <div className="writing-scene-pane" hidden={!active} aria-label={scene.title || 'Untitled scene'}><form ref={form} className="writing-scene-form" onSubmit={save}>
    <div className="writing-scene-topline"><label className="writing-scene-chapter-label"><span className="writing-sr-only">Scene chapter</span><select aria-label="Scene chapter" value={scene.chapterId} disabled={draft.saving} onChange={event => onChange(scene.id, {chapterId: event.target.value})}>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label><div className="writing-save-actions"><span id={active ? 'scene-save-status' : undefined} role="status" className={draft.error ? 'writing-save-error' : ''}>{draft.saving ? 'Saving…' : draft.error ? 'Not saved — your writing is still here' : draft.dirty ? 'Unsaved changes' : 'Saved'}</span><button type="submit" className="writing-button writing-primary" disabled={draft.saving}>{draft.saving ? 'Saving…' : 'Save scene'}</button></div></div>
    <label className="writing-title-label"><span className="writing-sr-only">Scene title</span><input aria-label="Scene title" className="writing-scene-title" name="title" required maxLength={160} placeholder="Untitled scene" autoComplete="off" value={scene.title} disabled={draft.saving} onChange={event => onChange(scene.id, {title: event.target.value})}/></label>
    <div className="writing-scene-meta"><label>Scene status<select aria-label="Scene status" value={scene.status} disabled={draft.saving} onChange={event => onChange(scene.id, {status: event.target.value as SceneStatus})}>{Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label><details className="writing-summary"><summary>Scene summary</summary><label className="writing-sr-only" htmlFor={'scene-summary-' + scene.id}>Scene summary</label><textarea id={'scene-summary-' + scene.id} aria-label="Scene summary" value={scene.summary} maxLength={10000} rows={3} placeholder="What changes in this scene?" disabled={draft.saving} onChange={event => onChange(scene.id, {summary: event.target.value})}/></details></div>
    {draft.error && <p id={active ? 'scene-error' : undefined} className="writing-inline-error" role="alert">{draft.error}</p>}
  </form><WritingEditor sceneId={scene.id} initialContent={draft.initialContent} editable={!draft.saving} active={active} onUpdate={onContent}/></div>;
});

function ComposeDialog({composer, chapters, onClose, onComplete}: {composer: Composer; chapters: ChapterRecord[]; onClose: () => void; onComplete: (record: ChapterRecord | SceneRecord) => void}) {
  const isChapter = composer.kind === 'chapter', existing = composer.kind === 'chapter' ? composer.chapter : undefined, label = existing ? 'Edit chapter' : isChapter ? 'New chapter' : 'New scene';
  const [title, setTitle] = useState(existing?.title || ''), [summaryText, setSummaryText] = useState(existing?.summary || ''), [chapterId, setChapterId] = useState(composer.kind === 'scene' ? composer.chapterId : ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), titleInput = useRef<HTMLInputElement>(null), request = useRef<AbortController | null>(null), inFlight = useRef(false), alive = useRef(true), id = useRef(existing?.id || crypto.randomUUID()), recovered = useRef<ChapterRecord | SceneRecord | null>(null);
  useEffect(() => {alive.current = true; const element = dialog.current!, previous = document.activeElement; element.showModal(); titleInput.current?.focus(); return () => {alive.current = false; request.current?.abort(); if (element.open) element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll: true});};}, []);
  useEffect(() => {const unload = (event: BeforeUnloadEvent) => {if (title !== (existing?.title || '') || summaryText !== (existing?.summary || '')) {event.preventDefault(); event.returnValue = '';}}; window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);}, [title, summaryText, existing]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (inFlight.current || !event.currentTarget.reportValidity()) return;
    if (!title.trim()) {setError('Enter a title.'); titleInput.current?.focus(); return;}
    const controller = new AbortController(); request.current = controller; inFlight.current = true; setBusy(true); setError('');
    try {
      const endpoint = isChapter ? '/api/chapters' : '/api/scenes', known = existing || recovered.current;
      const parse = isChapter ? readChapterRecord : readSceneRecord;
      const matches = (record: ChapterRecord | SceneRecord) => record.title === title.trim().replace(/\s+/g, ' ') && record.summary === summaryText && (isChapter || 'chapterId' in record && record.chapterId === chapterId);
      const updateKnown = async (current: ChapterRecord | SceneRecord) => {
        const body = isChapter ? serializeChapter({...current, title, summary: summaryText}) : {version: current.version, title, summary: summaryText, chapterId};
        const next = parse(await requestJSON(endpoint + '/' + encodeURIComponent(current.id), {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: controller.signal}));
        if (next.id !== id.current || next.version !== current.version + 1) throw new Error('The save response could not be verified. Your changes are still here.');
        return next;
      };
      let record: ChapterRecord | SceneRecord;
      if (known) record = await updateKnown(known);
      else {
        const body = isChapter ? {id: id.current, title, summary: summaryText} : {id: id.current, chapterId, title, summary: summaryText, status: 'draft', contentSchemaVersion: 1, content: emptyWritingContent()};
        record = parse(await requestJSON(endpoint, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: controller.signal}));
        if (record.id !== id.current) throw new Error('The saved entry could not be verified.');
        // An earlier POST can have committed even when its response was lost.
        // Keep this version when recovering; a concurrent edit must still conflict.
        recovered.current = record;
        if (!matches(record)) record = await updateKnown(record);
      }
      if (!matches(record)) throw new Error('The saved details did not match your changes. Keep this dialog open and try again.');
      if (alive.current) onComplete(record);
    } catch (error) {if (alive.current && !controller.signal.aborted) setError(error instanceof Error ? error.message : 'This entry could not be saved. Please try again.');}
    finally {inFlight.current = false; if (alive.current) setBusy(false);}
  };
  return <dialog ref={dialog} className="writing-dialog" aria-labelledby="writing-dialog-title" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}><form onSubmit={submit}><div className="writing-dialog-heading"><div><p className="writing-eyebrow">Your manuscript</p><h2 id="writing-dialog-title">{label}</h2></div><button type="button" className="writing-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div><fieldset disabled={busy}><label>{isChapter ? 'Chapter title' : 'Scene title'}<input ref={titleInput} aria-label={isChapter ? 'Chapter title' : 'Scene title'} required maxLength={160} autoComplete="off" value={title} onChange={event => setTitle(event.target.value)}/></label>{!isChapter && <label>Chapter<select aria-label="Chapter" value={chapterId} required onChange={event => setChapterId(event.target.value)}>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>}<label>{isChapter ? 'Chapter summary' : 'Scene summary'}<textarea aria-label={isChapter ? 'Chapter summary' : 'Scene summary'} rows={4} maxLength={10000} placeholder={isChapter ? 'A few words about this chapter…' : 'What happens in this scene?'} value={summaryText} onChange={event => setSummaryText(event.target.value)}/></label></fieldset>{error && <p className="writing-inline-error" role="alert">{error}</p>}<div className="writing-dialog-actions"><button type="button" className="writing-button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="writing-button writing-primary" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save chapter' : isChapter ? 'Create chapter' : 'Create scene'}</button></div></form></dialog>;
}

type Reference = {id: string; name: string; category: string; summary: string; href: string};
function ReferencePanel({open}: {open: boolean}) {
  const [items, setItems] = useState<Reference[]>([]), [query, setQuery] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || loaded) return;
    const controller = new AbortController(); setLoading(true); setError('');
    requestJSON('/api/dashboard', {signal: controller.signal}).then(data => {
      if (!data || typeof data !== 'object') throw new Error('Your world references could not be read.');
      const next: Reference[] = [];
      for (const [key, category] of [['characters', 'Characters'], ['factions', 'Factions'], ['locations', 'Places'], ['lore', 'Lore'], ['storyArcs', 'Story arcs']]) {
        const values = (data as Record<string, unknown>)[key]; if (!Array.isArray(values)) continue;
        for (const value of values) if (value && typeof value === 'object' && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.href === 'string' && value.href.startsWith('/') && !value.href.startsWith('//')) next.push({id: key + ':' + value.id, name: value.name, category, summary: typeof value.summary === 'string' ? value.summary : '', href: value.href});
      }
      if (!controller.signal.aborted) {setItems(next); setLoaded(true);}
    }).catch(error => {if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'References could not be loaded.');}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [open, loaded, attempt]);
  const filtered = useMemo(() => {const needle = query.toLocaleLowerCase().trim(); return items.filter(item => [item.name, item.category, item.summary].join(' ').toLocaleLowerCase().includes(needle));}, [items, query]);
  return <aside id="writing-references" className="writing-references" aria-label="World references" hidden={!open}><div className="writing-panel-heading"><h2>At your side</h2><Icon name="reference"/></div><p className="writing-muted">Your world, within reach. Entries open in a new tab.</p><label className="writing-reference-search"><span className="writing-sr-only">Search references</span><input type="search" aria-label="Search references" placeholder="Find a character, place, note…" value={query} onChange={event => setQuery(event.target.value)}/></label>{loading && <p role="status" className="writing-muted">Loading your world…</p>}{error && <div role="alert"><p className="writing-inline-error">{error}</p><button type="button" className="writing-button" onClick={() => setAttempt(value => value + 1)}>Retry references</button></div>}{loaded && !filtered.length && <p className="writing-muted">{query ? 'No matching references.' : 'The world you build will appear here.'}</p>}<ul className="writing-reference-list">{filtered.slice(0, 60).map(item => <li key={item.id}><a href={item.href} target="_blank" rel="noopener noreferrer"><span className="writing-reference-category">{item.category}</span><strong>{item.name}<span aria-hidden="true"> ↗</span></strong>{item.summary && <span className="writing-reference-summary">{item.summary}</span>}<span className="writing-sr-only"> (opens in a new tab)</span></a></li>)}</ul>{filtered.length > 60 && <p className="writing-muted">Showing 60 entries. Search to narrow the list.</p>}</aside>;
}
