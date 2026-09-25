import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode} from 'react';
import {announceWorkspaceChange} from '../../public/profiles/workspace-events.js';
import {StoryDate} from './StoryDate';
import {draftFromRecord, noteTemplate, ratingFields, readNoteRecord, referenceKey, serializeNote, validImageUrl, type ConnectionDraft, type FieldDefinition, type LoreNoteDraft, type NoteTarget, type ProfileData, type SectionDefinition, type TextField} from './contracts';

function Chevron() {return <svg className="collapse-chevron" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>;}
function MenuIcon() {return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/></svg>;}
function resizeTextareas(form: HTMLFormElement | null) {form?.querySelectorAll('textarea').forEach(input => {if (input.getClientRects().length) {input.style.height = 'auto'; input.style.height = input.scrollHeight + 2 + 'px';}});}

/** One root owns the complete note draft, save lifecycle, and profile controls. */
export function LoreNoteProfile({record, targets, incoming}: ProfileData) {
  const [draft, setDraft] = useState(() => draftFromRecord(record)), draftRef = useRef(draft), version = useRef(record.version);
  const [dirty, setDirty] = useState(false), dirtyRef = useRef(false), [saving, setSaving] = useState(false), inFlight = useRef(false), [error, setError] = useState(''), [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}), [failedImageUrl, setFailedImageUrl] = useState<string | null>(null), [currentHeading, setCurrentHeading] = useState('Lore profile'), [reading, setReading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState(record.imageUrl), [imageDetailsOpen, setImageDetailsOpen] = useState(!record.imageUrl || !validImageUrl(record.imageUrl));
  const form = useRef<HTMLFormElement>(null), addConnection = useRef<HTMLButtonElement>(null), mounted = useRef(true), request = useRef<AbortController | null>(null), [focusConnection, setFocusConnection] = useState<string | null>(null);
  const name = draft.name.trim() || 'Untitled lore', visibleImage = Boolean(previewImageUrl && validImageUrl(previewImageUrl)), imageError = failedImageUrl === previewImageUrl;
  function change(update: Partial<LoreNoteDraft>) {const next = {...draftRef.current, ...update}; draftRef.current = next; setDraft(next); dirtyRef.current = true; setDirty(true); setFailed(false);}
  function textChange(key: TextField, value: string) {change({[key]: value});}
  function visibility(keys: TextField[], show: boolean) {change({hiddenFields: [...new Set([...draftRef.current.hiddenFields.filter(key => !keys.includes(key)), ...(show ? [] : keys)])]});}
  function reveal(target: HTMLElement) {
    const regions: string[] = [];
    for (let node: HTMLElement | null = target; node && node !== form.current; node = node.parentElement) {if (node.classList.contains('collapsible-region')) regions.push(node.id); if (node instanceof HTMLDetailsElement) node.open = true;}
    if (regions.length) setCollapsed(previous => ({...previous, ...Object.fromEntries(regions.map(id => [id, false]))}));
    const field = target.closest<HTMLElement>('[data-profile-field]')?.dataset.profileField as TextField | undefined;
    if (field && draftRef.current.hiddenFields.includes(field)) visibility([field], true);
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (inFlight.current || !form.current) return;
    const invalid = form.current.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:invalid, textarea:invalid, select:invalid');
    if (invalid) {reveal(invalid); requestAnimationFrame(() => {invalid.focus(); invalid.reportValidity();}); return;}
    let payload;
    try {payload = serializeNote(draftRef.current, version.current);} catch (error) {setError(error instanceof Error ? error.message : 'Check the note before saving.'); return;}
    const active = document.activeElement instanceof HTMLElement && form.current.contains(document.activeElement) ? document.activeElement : null;
    const textInput = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement && ['text', 'search', 'url'].includes(active.type) ? active : null;
    const selection = textInput ? {start: textInput.selectionStart, end: textInput.selectionEnd, direction: textInput.selectionDirection} : null;
    const controller = new AbortController(); request.current = controller; inFlight.current = true; setSaving(true); setError(''); setFailed(false);
    try {
      const response = await fetch('/api/lore/' + encodeURIComponent(record.id), {method: 'PUT', credentials: 'same-origin', headers: {'content-type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal});
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Your session may have expired. Copy your changes before reloading to sign in again.');
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Could not save. Please try again.');
      const saved = readNoteRecord(data);
      if (saved.id !== record.id || saved.version <= version.current) throw new Error('The save response could not be verified. Your changes are still here. Reload before saving again.');
      if (!mounted.current) return;
      version.current = saved.version;
      const next = {...draftFromRecord(saved), connections: saved.connections.map((connection, index) => ({...connection, key: draftRef.current.connections[index]?.key || crypto.randomUUID()}))};
      draftRef.current = next; setDraft(next); dirtyRef.current = false; setDirty(false); announceWorkspaceChange();
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : 'Could not save. Please try again.'); setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) {setSaving(false); request.current = null; requestAnimationFrame(() => {if (!mounted.current || !active?.isConnected) return; active.focus({preventScroll: true}); if (textInput && selection?.start != null && selection.end != null) textInput.setSelectionRange(selection.start, selection.end, selection.direction || undefined);});}
    }
  };
  const requestSave = () => form.current?.requestSubmit();
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; request.current?.abort();};}, []);
  useEffect(() => {document.title = name + ' — Write to Freedom';}, [name]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {if (dirtyRef.current) {event.preventDefault(); event.returnValue = '';}};
    const shortcut = (event: KeyboardEvent) => {if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {event.preventDefault(); if (!inFlight.current) form.current?.requestSubmit();}};
    window.addEventListener('beforeunload', unload); document.addEventListener('keydown', shortcut);
    return () => {window.removeEventListener('beforeunload', unload); document.removeEventListener('keydown', shortcut);};
  }, []);
  useEffect(() => {
    const closeMenus = (event: MouseEvent) => form.current?.querySelectorAll<HTMLDetailsElement>('.field-menu[open]').forEach(menu => {if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;});
    const escapeMenus = (event: KeyboardEvent) => {if (event.key === 'Escape') form.current?.querySelectorAll<HTMLDetailsElement>('.field-menu[open]').forEach(menu => {menu.open = false; menu.querySelector('summary')?.focus();});};
    document.addEventListener('click', closeMenus); document.addEventListener('keydown', escapeMenus);
    return () => {document.removeEventListener('click', closeMenus); document.removeEventListener('keydown', escapeMenus);};
  }, []);
  const revealCurrent = useRef(reveal); revealCurrent.current = reveal;
  useEffect(() => {
    let frame = 0;
    const hash = () => {let anchor; try {anchor = decodeURIComponent(location.hash.slice(1));} catch {return;} const target = document.getElementById(anchor); if (!target || !form.current?.contains(target) && target.id !== 'profile') return; revealCurrent.current(target); const ownRegion = target.querySelector<HTMLElement>('.collapsible-region'); if (ownRegion) setCollapsed(previous => ({...previous, [ownRegion.id]: false})); cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {resizeTextareas(form.current); (target.matches('.profile-section') ? target.querySelector('h2') || target : target).scrollIntoView({block: target.closest('.infobox') ? 'nearest' : 'start'});});};
    hash(); window.addEventListener('hashchange', hash); return () => {cancelAnimationFrame(frame); window.removeEventListener('hashchange', hash);};
  }, []);
  useLayoutEffect(() => {resizeTextareas(form.current);}, [draft, collapsed]);
  useEffect(() => {const resize = () => resizeTextareas(form.current); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);}, []);
  useEffect(() => {
    const host = form.current!, bar = host.querySelector<HTMLElement>('.article-bar')!, content = host.querySelector<HTMLElement>('.profile-content')!, identity = host.querySelector<HTMLElement>('.infobox')!, headings = [...content.querySelectorAll<HTMLElement>('.profile-section > .section-header h2')];
    let frame = 0, headerHeight = 0;
    const update = () => {frame = 0; const bounds = bar.getBoundingClientRect(), offset = parseFloat(getComputedStyle(bar).top) || 0, height = bounds.height + offset; if (headerHeight !== height) {headerHeight = height; host.style.setProperty('--profile-header-height', height + 'px');} let current = 'Lore profile'; if (bounds.top <= offset) for (const heading of headings) if (heading.getClientRects().length && heading.getBoundingClientRect().top <= bounds.bottom) current = heading.textContent?.trim() || current; setReading(current !== 'Lore profile'); setCurrentHeading(current);};
    const schedule = () => {if (!frame) frame = requestAnimationFrame(update);};
    window.addEventListener('scroll', schedule, {passive: true}); window.addEventListener('resize', schedule); host.addEventListener('toggle', schedule, true);
    const observer = new ResizeObserver(schedule); [bar, content, identity, ...headings].forEach(element => observer.observe(element)); update();
    return () => {cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); host.removeEventListener('toggle', schedule, true);};
  }, []);
  useLayoutEffect(() => {if (focusConnection) {document.getElementById('connection-search-' + focusConnection)?.focus(); setFocusConnection(null);}}, [focusConnection, draft.connections]);

  const toggle = (id: string) => setCollapsed(previous => ({...previous, [id]: !previous[id]}));
  const collapseButton = (title: string, id: string) => <button type="button" className="collapse-toggle" aria-expanded={!collapsed[id]} aria-controls={id} data-collapse-target={id} onClick={() => toggle(id)}><span>{title}</span><Chevron/></button>;
  const group = (title: string, id: string, children: ReactNode) => <div className="card-group" key={id}><h3>{collapseButton(title, id)}</h3><div id={id} className="collapsible-region" hidden={collapsed[id]}>{children}</div></div>;
  const field = ([key, label, type]: FieldDefinition) => <div key={key} data-profile-field={key} hidden={draft.hiddenFields.includes(key)} className={'inline-field' + (type === 'textarea' ? ' prose-field' : '')}><label htmlFor={'field-' + key}>{label}</label>{type === 'date' ? <StoryDate value={draft[key]} onChange={value => textChange(key, value)} requestSave={requestSave}/> : type === 'textarea' ? <textarea id={'field-' + key} name={key} aria-label={label} rows={2} maxLength={10000} placeholder={'Add ' + label.toLowerCase() + '…'} value={draft[key]} onChange={event => textChange(key, event.target.value)}/> : <input id={'field-' + key} name={key} aria-label={label} required={key === 'name'} type={type === 'url' ? 'url' : 'text'} pattern={type === 'url' ? 'https://.*' : undefined} title={type === 'url' ? 'Use an HTTPS image URL' : undefined} autoComplete="off" maxLength={key === 'name' ? 160 : type === 'url' ? 2048 : 10000} placeholder={type === 'url' ? 'https://…' : 'Add ' + label.toLowerCase() + '…'} value={draft[key]} onChange={event => textChange(key, event.target.value)} onBlur={key === 'imageUrl' ? () => setPreviewImageUrl(draftRef.current.imageUrl.trim()) : undefined}/>}</div>;
  const section = (definition: SectionDefinition, children: ReactNode) => <section id={definition.id} className="profile-section" key={definition.id}><div className="section-header"><h2>{collapseButton(definition.title, definition.id + '-body')}</h2>{Boolean(definition.fields.length) && <details className="field-menu" hidden={collapsed[definition.id + '-body']}><summary aria-label={'Choose visible fields for ' + definition.title} title="Choose visible fields"><MenuIcon/></summary><div className="field-menu-panel">{definition.fields.map(([key, label]) => <label key={key}><input type="checkbox" data-visibility={key} checked={!draft.hiddenFields.includes(key)} onChange={event => visibility([key], event.target.checked)}/> {label}</label>)}<div className="visibility-actions"><button type="button" data-visibility-all="show" onClick={() => visibility(definition.fields.map(([key]) => key), true)}>Show all</button><button type="button" data-visibility-all="hide" onClick={() => visibility(definition.fields.map(([key]) => key), false)}>Hide all</button></div></div></details>}</div><div id={definition.id + '-body'} className="collapsible-region" hidden={collapsed[definition.id + '-body']}>{children}</div></section>;
  return <main id="profile"><nav className="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/lore/">Lore</a> / <span aria-current="page" data-display-name>{name}</span></nav>
    <form ref={form} id="profile-form" className={reading ? 'profile-reading' : undefined} data-id={record.id} data-version={version.current} noValidate onSubmit={save}>
      <div className="article-bar"><span className="current-view"><span className="current-view-label">{currentHeading}</span></span><div className="save-actions"><span id="save-status" role="status">{saving ? 'Saving…' : failed ? 'Not saved — your changes are still here' : dirty ? 'Unsaved changes' : 'Saved'}</span><button id="save-character" type="submit" disabled={saving}>Save changes</button></div></div>
      <p className="byline">Click any field to edit your lore.</p><p id="editor-error" role="alert" hidden={!error}>{error}</p>
      <fieldset id="editor-fields" disabled={saving}><legend className="sr-only">Lore profile</legend><article>
        <aside className="infobox country-infobox lore-infobox" id="identity" tabIndex={0} aria-label="Lore information">
          <h1 className="profile-name"><button type="button" id="edit-name" title="Edit note name" onClick={() => {const input = document.getElementById('field-name')!; reveal(input); requestAnimationFrame(() => input.focus());}}><span data-display-name>{name}</span></button></h1><p className="lore-type">Note</p>
          {group('Image', 'symbols', <figure className="country-media country-map"><img key={previewImageUrl} data-image="imageUrl" alt={name} referrerPolicy="no-referrer" src={visibleImage ? previewImageUrl : undefined} hidden={!visibleImage || imageError} onError={() => setFailedImageUrl(previewImageUrl)} onLoad={() => setFailedImageUrl(null)}/><figcaption><details open={imageDetailsOpen} onToggle={event => setImageDetailsOpen(event.currentTarget.open)}><summary>Image</summary>{field(['imageUrl', 'Image URL', 'url'])}</details><small className="image-error" data-image-error="imageUrl" hidden={!imageError}>Image unavailable. Check its URL.</small></figcaption></figure>)}
          {group('Entry information', 'identity-information', noteTemplate.sections[0].fields.map(field))}
          {group('Collections', 'identity-collections', <label className="lore-check"><input type="checkbox" data-collection="notes" checked disabled/> Notes</label>)}
          {group('On your dashboard', 'identity-dashboard', <><label className="lore-check"><input type="checkbox" id="lore-pinned" checked={draft.pinned} onChange={event => change({pinned: event.target.checked})}/> Pin to Continue building</label><label className="lore-check"><input type="checkbox" id="lore-featured" checked={draft.featured} onChange={event => change({featured: event.target.checked})}/> Feature on Lore</label></>)}
        </aside>
        <div className="profile-content">
          {noteTemplate.sections.filter(definition => !['identity', 'symbols'].includes(definition.id)).map(definition => section(definition, <>{definition.fields.map(field)}{definition.id === 'notes' && <div id="ratings" className="profile-ratings-slot" data-profile-ratings="notes" aria-label="Record quality ratings"><div className="profile-rating-groups attribute-groups"><section className="profile-rating-group attribute-group record"><h3>Record quality</h3><div className="attribute-ring-grid">{ratingFields.map(([key, label]) => {const raw = draft.profileRatings[key], value = Number(raw), valid = raw !== '' && Number.isInteger(value) && value >= 0 && value <= 99; return <div key={key} className="attribute-dial" data-unset={raw === ''}><div className="attribute-ring" style={{'--rating': (valid ? value / 99 * 100 : 0) + '%'} as CSSProperties}><input id={'profile-rating-' + key} name={'profile-rating-' + key} className="attribute-number" type="number" autoComplete="off" min="0" max="99" step="1" placeholder="—" aria-label={label + ' rating'} value={raw} onChange={event => change({profileRatings: {...draft.profileRatings, [key]: event.target.value}})}/></div><label className="attribute-label" htmlFor={'profile-rating-' + key}>{label}</label><input className="attribute-adjust" type="range" min="0" max="99" step="1" aria-label={'Adjust ' + label.toLowerCase()} aria-valuetext={raw === '' ? 'Not rated' : raw + ' out of 99'} value={valid ? value : 0} onChange={event => change({profileRatings: {...draft.profileRatings, [key]: event.target.value}})}/></div>;})}</div></section></div></div>}</>))}
          {section({id: 'connections', title: 'Connections', fields: []}, <><div id="lore-connections">{draft.connections.map(connection => <ConnectionRow key={connection.key} connection={connection} targets={targets} onChange={update => change({connections: draftRef.current.connections.map(row => row.key === connection.key ? {...row, ...update} : row)})} onRemove={() => {change({connections: draftRef.current.connections.filter(row => row.key !== connection.key)}); addConnection.current?.focus();}}/>)}</div><button ref={addConnection} type="button" className="lore-add-link" id="add-lore-connection" disabled={draft.connections.length >= 60} onClick={() => {const key = crypto.randomUUID(); change({connections: [...draftRef.current.connections, {key, target: null, relationship: ''}]}); setFocusConnection(key);}}>Add a connection</button><p className="section-note">Describe the connection, such as “owned by”, “describes”, or “found in”.</p></>)}
          {section({id: 'linked-from', title: 'Linked from', fields: []}, incoming.length ? <ul className="lore-backlinks">{incoming.map((link, index) => <li key={link.href + index}><a href={link.href}>{link.title || link.source}</a><p>{link.text}</p></li>)}</ul> : <p className="section-note">Entries and character notes that link here will appear here.</p>)}
          <footer className="profile-footer"><a href="/lore/">← Back to lore</a><a href="#profile">Back to top ↑</a></footer>
        </div>
      </article></fieldset>
    </form>
  </main>;
}

function ConnectionRow({connection, targets, onChange, onRemove}: {connection: ConnectionDraft; targets: NoteTarget[]; onChange: (update: Partial<ConnectionDraft>) => void; onRemove: () => void}) {
  const [query, setQuery] = useState(''), selected = connection.target ? referenceKey(connection.target) : '', target = targets.find(item => referenceKey(item.reference) === selected);
  const filtered = targets.filter(item => referenceKey(item.reference) === selected || [item.label, item.group, item.detail].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  return <div className="lore-connection"><input id={'connection-search-' + connection.key} type="search" placeholder="Find an entry…" aria-label="Find a connected entry" value={query} onChange={event => setQuery(event.target.value)}/><select required aria-label="Connected entry" value={selected} onChange={event => onChange({target: targets.find(item => referenceKey(item.reference) === event.target.value)?.reference || null})}><option value="">Choose an entry</option>{filtered.map(item => <option key={referenceKey(item.reference)} value={referenceKey(item.reference)}>{item.label + ' · ' + item.group}</option>)}{selected && !target && <option value={selected}>Unavailable entry (existing connection)</option>}</select><input required type="text" maxLength={160} placeholder="e.g. owned by" aria-label="Connection description" value={connection.relationship} onChange={event => onChange({relationship: event.target.value})}/><a className="lore-connected-link" hidden={!target} href={target?.href}>Open entry →</a><button type="button" className="lore-remove" onClick={onRemove}>Remove</button></div>;
}
